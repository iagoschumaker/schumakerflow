import prisma from '@/lib/db';
import { getMonthlyDueDate, formatReferenceMonth } from '@/lib/finance/business-days';
import { createPixCharge } from '@/lib/finance/mercadopago';
import { InvoiceStatus, ContractStatus } from '@prisma/client';
import { randomUUID } from 'crypto';

/**
 * Generate monthly invoices for all active MONTHLY contracts in a tenant.
 * Should run on the 1st day of each month.
 * Due date = 5th business day of the month.
 */
export async function generateMonthlyInvoices(tenantId: string): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // 1-indexed
    const referenceMonth = formatReferenceMonth(now);
    const dueDate = getMonthlyDueDate(year, month);

    // Find active monthly contracts for this tenant
    const contracts = await prisma.contract.findMany({
        where: {
            tenantId,
            type: 'MONTHLY',
            status: ContractStatus.ACTIVE,
            startDate: { lte: now },
        },
        include: {
            client: true,
        },
    });

    let created = 0;
    let skipped = 0;

    for (const contract of contracts) {
        // Check idempotency - don't create duplicate invoice for same month
        const idempotencyKey = `monthly_${contract.id}_${referenceMonth}`;
        const existing = await prisma.invoice.findUnique({
            where: { idempotencyKey },
        });

        if (existing) {
            skipped++;
            continue;
        }

        const amount = Number(contract.monthlyAmount || 0);
        if (amount <= 0) {
            skipped++;
            continue;
        }

        const externalReference = `inv_${randomUUID()}`;

        // Try to create PIX charge
        let pixPayload: string | undefined;
        let pixQrCode: string | undefined;

        const tenant = await prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { mpAccessToken: true },
        });

        if (tenant?.mpAccessToken) {
            try {
                const pix = await createPixCharge(
                    {
                        amount,
                        description: `Mensalidade ${referenceMonth} - ${contract.client.name}`,
                        externalReference,
                        payerEmail: contract.client.email || undefined,
                        payerName: contract.client.name,
                    },
                    tenant.mpAccessToken
                );
                pixPayload = pix.pixPayload;
                pixQrCode = pix.qrCodeBase64;
            } catch (e) {
                console.error('PIX charge creation failed:', e);
            }
        }

        await prisma.invoice.create({
            data: {
                tenantId,
                clientId: contract.clientId,
                contractId: contract.id,
                dueDate,
                totalAmount: amount,
                status: InvoiceStatus.PENDING,
                pixPayload,
                pixQrCode,
                externalReference,
                idempotencyKey,
                referenceMonth,
                items: {
                    create: [{
                        description: `Mensalidade ${contract.name} - ${referenceMonth}`,
                        quantity: 1,
                        unitPrice: amount,
                        totalAmount: amount,
                        type: 'MONTHLY_FEE',
                    }],
                },
            },
        });

        created++;
    }

    return `Generated ${created} invoices, skipped ${skipped} (ref: ${referenceMonth})`;
}

/**
 * Mark overdue invoices and apply blocks.
 */
export async function applyOverdueAndBlocks(tenantId: string): Promise<string> {
    const now = new Date();

    // Find PENDING invoices past due date
    const overdueInvoices = await prisma.invoice.findMany({
        where: {
            tenantId,
            status: InvoiceStatus.PENDING,
            dueDate: { lt: now },
        },
    });

    let marked = 0;
    for (const invoice of overdueInvoices) {
        await prisma.invoice.update({
            where: { id: invoice.id },
            data: { status: InvoiceStatus.OVERDUE },
        });
        marked++;
    }

    return `Marked ${marked} invoices as OVERDUE`;
}
