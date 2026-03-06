import prisma from '@/lib/db';
import { getMonthlyDueDate, formatReferenceMonth } from '@/lib/finance/business-days';
import { createPixCharge } from '@/lib/finance/mercadopago';
import { randomUUID } from 'crypto';

/**
 * Generate invoices for PER_VIDEO contracts based on published FINAL files.
 * Counts FINAL files published since the last billing date and creates an invoice
 * with per-file line items.
 *
 * Should run on the 1st of each month (or as needed).
 */
export async function generateVideoBilling(tenantId: string): Promise<string> {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const referenceMonth = formatReferenceMonth(now);
    const dueDate = getMonthlyDueDate(year, month);

    // Find active PER_VIDEO contracts
    const contracts = await prisma.contract.findMany({
        where: {
            tenantId,
            type: 'PER_VIDEO',
            status: 'ACTIVE' as const,
            startDate: { lte: now },
        },
        include: {
            client: { select: { id: true, name: true, email: true } },
        },
    });

    let created = 0;
    let skipped = 0;

    for (const contract of contracts) {
        // Check idempotency
        const idempotencyKey = `video_${contract.id}_${referenceMonth}`;
        const existing = await prisma.invoice.findUnique({
            where: { idempotencyKey },
        });

        if (existing) {
            skipped++;
            continue;
        }

        // Calculate billing period (previous month)
        const startOfPrevMonth = new Date(year, month - 2, 1);
        const endOfPrevMonth = new Date(year, month - 1, 0, 23, 59, 59);

        // Count published FINAL files for this client's companies
        const finalFiles = await prisma.file.findMany({
            where: {
                tenantId,
                kind: 'FINAL' as const,
                isVisible: true,
                publishedAt: {
                    gte: startOfPrevMonth,
                    lte: endOfPrevMonth,
                },
                project: {
                    clientId: contract.clientId,
                },
            },
            include: {
                project: { select: { name: true, client: { select: { name: true } } } },
            },
        });

        if (finalFiles.length === 0) {
            skipped++;
            continue;
        }

        const perVideoAmount = Number(contract.perVideoAmount || 0);
        if (perVideoAmount <= 0) {
            skipped++;
            continue;
        }

        const totalAmount = finalFiles.length * perVideoAmount;
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
                        amount: totalAmount,
                        description: `Arquivos ${referenceMonth} - ${contract.client.name} (${finalFiles.length} arquivos)`,
                        externalReference,
                        payerEmail: contract.client.email || undefined,
                        payerName: contract.client.name,
                    },
                    tenant.mpAccessToken
                );
                pixPayload = pix.pixPayload;
                pixQrCode = pix.qrCodeBase64;
            } catch (e) {
                console.error('PIX charge creation failed for video billing:', e);
            }
        }

        // Create invoice with per-file line items
        await prisma.invoice.create({
            data: {
                tenantId,
                clientId: contract.clientId,
                contractId: contract.id,
                dueDate,
                totalAmount,
                status: 'PENDING' as any,
                pixPayload,
                pixQrCode,
                externalReference,
                idempotencyKey,
                referenceMonth,
                items: {
                    create: finalFiles.map((file: any) => ({
                        description: `Arquivo: ${file.name} (${file.project.client?.name || ''} / ${file.project.name})`,
                        quantity: 1,
                        unitPrice: perVideoAmount,
                        totalAmount: perVideoAmount,
                        type: 'VIDEO' as any,
                        fileId: file.id,
                    })),
                },
            },
        });

        created++;
    }

    return `Generated ${created} video billing invoices, skipped ${skipped} (ref: ${referenceMonth})`;
}
