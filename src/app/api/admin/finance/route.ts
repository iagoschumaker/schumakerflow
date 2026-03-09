import { NextRequest } from 'next/server';
import { withAuth, apiSuccess, apiError, ApiContext } from '@/lib/api/helpers';
import prisma from '@/lib/db';
import { createPixCharge } from '@/lib/finance/mercadopago';
import { getMonthlyDueDate } from '@/lib/finance/business-days';
import { z } from 'zod';
import { randomUUID } from 'crypto';

// Helper: auto-create next invoice for a contract
async function autoCreateNextInvoice(tenantId: string, contractId: string, afterMonth?: string) {
    const contract = await prisma.contract.findFirst({
        where: { id: contractId, tenantId, status: 'ACTIVE' },
        include: { client: true },
    });
    if (!contract) return null;

    const amount = Number(contract.monthlyAmount || contract.perVideoAmount || contract.perProjectAmount || contract.oneOffAmount || 0);
    if (amount <= 0) return null;

    // If contract has an end date and it's in the past, don't generate
    if (contract.endDate && new Date(contract.endDate) < new Date()) return null;

    // Calculate the target month
    let targetDate: Date;
    if (afterMonth) {
        const [y, m] = afterMonth.split('-').map(Number);
        targetDate = new Date(y, m, 1); // next month after afterMonth
    } else {
        targetDate = new Date(); // current month
    }
    const targetMonth = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}`;

    // Check idempotency - don't create if one already exists for this month (any status)
    const existing = await prisma.invoice.findFirst({
        where: { tenantId, contractId, referenceMonth: targetMonth },
    });
    if (existing) return existing;

    const billingDay = contract.billingDay || 5;
    const dueDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), Math.min(billingDay, 28), 12, 0, 0);

    const typeLabel = { MONTHLY: 'Mensalidade', PER_VIDEO: 'Por Arquivo', PER_PROJECT: 'Por Projeto', ONE_OFF: 'Avulso' }[contract.type as string] || contract.type;
    const itemType = { MONTHLY: 'MONTHLY_FEE', PER_VIDEO: 'VIDEO', PER_PROJECT: 'PROJECT', ONE_OFF: 'ONE_OFF' }[contract.type as string] || 'ONE_OFF';

    const invoice = await prisma.invoice.create({
        data: {
            tenantId,
            clientId: contract.clientId,
            contractId: contract.id,
            dueDate,
            totalAmount: amount,
            status: 'PENDING',
            referenceMonth: targetMonth,
            idempotencyKey: `auto_${contract.id}_${targetMonth}`,
            items: {
                create: [{ description: `${typeLabel} - ${contract.name} (${targetMonth})`, quantity: 1, unitPrice: amount, totalAmount: amount, type: itemType as any }],
            },
        },
    });

    return invoice;
}

// ==================== CONTRACTS ====================

const contractSchema = z.object({
    clientId: z.string().uuid(),
    type: z.enum(['MONTHLY', 'PER_VIDEO', 'PER_PROJECT', 'ONE_OFF']),
    name: z.string().min(1),
    description: z.string().optional(),
    monthlyAmount: z.number().positive().optional(),
    perVideoAmount: z.number().positive().optional(),
    perProjectAmount: z.number().positive().optional(),
    oneOffAmount: z.number().positive().optional(),
    billingDay: z.number().int().min(1).max(20).optional(),
    startDate: z.string(),
    endDate: z.string().optional(),
});

// GET /api/admin/finance/contracts
export const GET = withAuth(
    async (req: NextRequest, ctx: ApiContext) => {
        const { searchParams } = req.nextUrl;
        const tab = searchParams.get('tab') || 'contracts';
        const clientId = searchParams.get('clientId');

        if (tab === 'invoices') {
            const where: Record<string, unknown> = { tenantId: ctx.tenantId };
            if (clientId) where.clientId = clientId;
            const status = searchParams.get('status');
            if (status) where.status = status;

            const invoices = await prisma.invoice.findMany({
                where,
                include: {
                    client: { select: { name: true, phone: true } },
                    contract: { select: { name: true } },
                    items: true,
                    _count: { select: { payments: true } },
                },
                orderBy: { dueDate: 'desc' },
                take: 100,
            });

            return apiSuccess(invoices);
        }

        if (tab === 'payments') {
            const where: Record<string, unknown> = { tenantId: ctx.tenantId };
            const payments = await prisma.payment.findMany({
                where,
                include: {
                    invoice: { select: { id: true, dueDate: true, totalAmount: true, client: { select: { name: true } } } },
                },
                orderBy: { createdAt: 'desc' },
                take: 100,
            });

            return apiSuccess(payments);
        }

        // Default: contracts
        const where: Record<string, unknown> = { tenantId: ctx.tenantId };
        if (clientId) where.clientId = clientId;

        const contracts = await prisma.contract.findMany({
            where,
            include: {
                client: { select: { name: true } },
                _count: { select: { invoices: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        return apiSuccess(contracts);
    },
    { roles: ['SUPERADMIN', 'TENANT_ADMIN'] }
);

// POST /api/admin/finance
export const POST = withAuth(
    async (req: NextRequest, ctx: ApiContext) => {
        const body = await req.json();
        const action = body.action || 'create_contract';

        if (action === 'create_contract') {
            const parsed = contractSchema.safeParse(body);
            if (!parsed.success) return apiError('Invalid input', 400);

            const client = await prisma.client.findFirst({
                where: { id: parsed.data.clientId, tenantId: ctx.tenantId },
            });
            if (!client) return apiError('Client not found', 404);

            const contract = await prisma.contract.create({
                data: {
                    tenantId: ctx.tenantId,
                    clientId: parsed.data.clientId,
                    type: parsed.data.type,
                    name: parsed.data.name,
                    description: parsed.data.description,
                    monthlyAmount: parsed.data.monthlyAmount,
                    perVideoAmount: parsed.data.perVideoAmount,
                    perProjectAmount: parsed.data.perProjectAmount,
                    oneOffAmount: parsed.data.oneOffAmount,
                    billingDay: parsed.data.billingDay || 5,
                    startDate: new Date(parsed.data.startDate),
                    endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
                },
            });

            await prisma.auditLog.create({
                data: {
                    tenantId: ctx.tenantId,
                    userId: ctx.session.userId,
                    action: 'contract.create',
                    entityType: 'Contract',
                    entityId: contract.id,
                    details: JSON.stringify({ type: parsed.data.type, name: parsed.data.name }),
                },
            });

            // Auto-generate first invoice if no end date
            if (!parsed.data.endDate || new Date(parsed.data.endDate) > new Date()) {
                await autoCreateNextInvoice(ctx.tenantId, contract.id);
            }

            return apiSuccess(contract, 201);
        }

        if (action === 'create_invoice') {
            const invoiceSchema = z.object({
                clientId: z.string().uuid(),
                contractId: z.string().uuid().optional(),
                dueDate: z.string(),
                items: z.array(z.object({
                    description: z.string(),
                    quantity: z.number().int().positive(),
                    unitPrice: z.number().positive(),
                    type: z.string(),
                    fileId: z.string().uuid().optional(),
                })),
                notes: z.string().optional(),
                generatePix: z.boolean().optional(),
            });

            const parsed = invoiceSchema.safeParse(body);
            if (!parsed.success) return apiError('Invalid input', 400);

            const client = await prisma.client.findFirst({
                where: { id: parsed.data.clientId, tenantId: ctx.tenantId },
            });
            if (!client) return apiError('Client not found', 404);

            const totalAmount = parsed.data.items.reduce(
                (sum, item) => sum + item.quantity * item.unitPrice, 0
            );

            const externalReference = `inv_${randomUUID()}`;
            const idempotencyKey = `inv_${parsed.data.clientId}_${parsed.data.dueDate}_${Date.now()}`;

            // Generate PIX charge if requested
            let pixPayload: string | undefined;
            let pixQrCode: string | undefined;

            if (parsed.data.generatePix) {
                try {
                    const pixCharge = await createPixCharge(
                        {
                            amount: totalAmount,
                            description: `Fatura Schumaker Flow - ${client.name}`,
                            externalReference,
                            payerEmail: client.email || undefined,
                            payerName: client.name,
                        },
                        ctx.tenant?.mpAccessToken || undefined
                    );
                    pixPayload = pixCharge.pixPayload;
                    pixQrCode = pixCharge.qrCodeBase64;
                } catch (e) {
                    console.error('Failed to create PIX charge:', e);
                }
            }

            const invoice = await prisma.invoice.create({
                data: {
                    tenantId: ctx.tenantId,
                    clientId: parsed.data.clientId,
                    contractId: parsed.data.contractId,
                    dueDate: new Date(parsed.data.dueDate + 'T12:00:00'),
                    totalAmount,
                    status: 'PENDING',
                    pixPayload,
                    pixQrCode,
                    externalReference,
                    idempotencyKey,
                    notes: parsed.data.notes,
                    items: {
                        create: parsed.data.items.map((item) => ({
                            description: item.description,
                            quantity: item.quantity,
                            unitPrice: item.unitPrice,
                            totalAmount: item.quantity * item.unitPrice,
                            type: item.type as 'MONTHLY_FEE' | 'VIDEO' | 'PROJECT' | 'ONE_OFF',
                            fileId: item.fileId,
                        })),
                    },
                },
                include: { items: true },
            });

            await prisma.auditLog.create({
                data: {
                    tenantId: ctx.tenantId,
                    userId: ctx.session.userId,
                    action: 'invoice.create',
                    entityType: 'Invoice',
                    entityId: invoice.id,
                    details: JSON.stringify({ totalAmount, dueDate: parsed.data.dueDate }),
                },
            });

            return apiSuccess(invoice, 201);
        }

        if (action === 'mark_paid') {
            const schema = z.object({
                invoiceId: z.string().uuid(),
                notes: z.string().optional(),
                proofUrl: z.string().optional(),
            });

            const parsed = schema.safeParse(body);
            if (!parsed.success) return apiError('Invalid input', 400);

            const invoice = await prisma.invoice.findFirst({
                where: { id: parsed.data.invoiceId, tenantId: ctx.tenantId },
            });
            if (!invoice) return apiError('Invoice not found', 404);
            if (invoice.status === 'PAID') return apiError('Fatura já está paga', 400);

            await prisma.invoice.update({
                where: { id: parsed.data.invoiceId },
                data: {
                    status: 'PAID',
                    paidAt: new Date(),
                    notes: parsed.data.notes || invoice.notes,
                    proofUrl: parsed.data.proofUrl,
                },
            });

            // Create manual payment record
            await prisma.payment.create({
                data: {
                    tenantId: ctx.tenantId,
                    invoiceId: parsed.data.invoiceId,
                    method: 'MANUAL',
                    status: 'CONFIRMED',
                    amount: invoice.totalAmount,
                    confirmedAt: new Date(),
                    notes: parsed.data.notes,
                },
            });

            await prisma.auditLog.create({
                data: {
                    tenantId: ctx.tenantId,
                    userId: ctx.session.userId,
                    action: 'invoice.mark_paid',
                    entityType: 'Invoice',
                    entityId: parsed.data.invoiceId,
                },
            });

            // Auto-generate next invoice if contract is active and ongoing
            if (invoice.contractId) {
                await autoCreateNextInvoice(ctx.tenantId, invoice.contractId, invoice.referenceMonth || undefined);
            }

            return apiSuccess({ message: 'Invoice marked as paid' });
        }

        if (action === 'cancel_invoice') {
            const schema = z.object({ invoiceId: z.string().uuid() });
            const parsed = schema.safeParse(body);
            if (!parsed.success) return apiError('Invalid input', 400);

            const invoice = await prisma.invoice.findFirst({
                where: { id: parsed.data.invoiceId, tenantId: ctx.tenantId },
            });
            if (!invoice) return apiError('Invoice not found', 404);

            await prisma.invoice.update({
                where: { id: parsed.data.invoiceId },
                data: { status: 'CANCELLED' },
            });

            await prisma.auditLog.create({
                data: {
                    tenantId: ctx.tenantId,
                    userId: ctx.session.userId,
                    action: 'invoice.cancel',
                    entityType: 'Invoice',
                    entityId: parsed.data.invoiceId,
                },
            });

            return apiSuccess({ message: 'Invoice cancelled' });
        }

        if (action === 'generate_monthly') {
            // Auto-generate invoices for all active MONTHLY contracts for the target month
            const targetMonth = body.month || new Date().toISOString().slice(0, 7); // "2026-03"
            const [year, month] = targetMonth.split('-').map(Number);

            const contracts = await prisma.contract.findMany({
                where: {
                    tenantId: ctx.tenantId,
                    type: 'MONTHLY',
                    status: 'ACTIVE',
                    startDate: { lte: new Date(year, month - 1, 28) }, // started before end of month
                },
                include: { client: true },
            });

            let generated = 0;
            let skipped = 0;

            for (const contract of contracts) {
                // Check if invoice already exists for this contract+month
                const existing = await prisma.invoice.findFirst({
                    where: {
                        tenantId: ctx.tenantId,
                        contractId: contract.id,
                        referenceMonth: targetMonth,
                    },
                });

                if (existing) { skipped++; continue; }

                const billingDay = contract.billingDay || 5;
                const dueDate = new Date(year, month - 1, Math.min(billingDay, 28));
                if (dueDate < new Date()) dueDate.setMonth(dueDate.getMonth() + 1);

                const amount = Number(contract.monthlyAmount || 0);
                if (amount <= 0) { skipped++; continue; }

                await prisma.invoice.create({
                    data: {
                        tenantId: ctx.tenantId,
                        clientId: contract.clientId,
                        contractId: contract.id,
                        dueDate,
                        totalAmount: amount,
                        status: 'PENDING',
                        referenceMonth: targetMonth,
                        idempotencyKey: `gen_${contract.id}_${targetMonth}`,
                        items: {
                            create: [{
                                description: `Mensalidade - ${contract.name} (${targetMonth})`,
                                quantity: 1,
                                unitPrice: amount,
                                totalAmount: amount,
                                type: 'MONTHLY_FEE',
                            }],
                        },
                    },
                });

                generated++;
            }

            return apiSuccess({ generated, skipped, total: contracts.length, month: targetMonth });
        }

        if (action === 'update_contract') {
            const schema = z.object({
                contractId: z.string().uuid(),
                name: z.string().min(1).optional(),
                description: z.string().optional(),
                type: z.string().optional(),
                status: z.string().optional(),
                monthlyAmount: z.number().positive().optional().nullable(),
                perVideoAmount: z.number().positive().optional().nullable(),
                perProjectAmount: z.number().positive().optional().nullable(),
                oneOffAmount: z.number().positive().optional().nullable(),
                billingDay: z.number().int().min(1).max(28).optional(),
                startDate: z.string().optional(),
                endDate: z.string().optional().nullable(),
            });
            const parsed = schema.safeParse(body);
            if (!parsed.success) return apiError('Invalid input', 400);

            const contract = await prisma.contract.findFirst({
                where: { id: parsed.data.contractId, tenantId: ctx.tenantId },
            });
            if (!contract) return apiError('Contract not found', 404);

            const updateData: Record<string, unknown> = {};
            if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
            if (parsed.data.description !== undefined) updateData.description = parsed.data.description;
            if (parsed.data.type !== undefined) updateData.type = parsed.data.type;
            if (parsed.data.status !== undefined) updateData.status = parsed.data.status;
            if (parsed.data.monthlyAmount !== undefined) updateData.monthlyAmount = parsed.data.monthlyAmount;
            if (parsed.data.perVideoAmount !== undefined) updateData.perVideoAmount = parsed.data.perVideoAmount;
            if (parsed.data.perProjectAmount !== undefined) updateData.perProjectAmount = parsed.data.perProjectAmount;
            if (parsed.data.oneOffAmount !== undefined) updateData.oneOffAmount = parsed.data.oneOffAmount;
            if (parsed.data.billingDay !== undefined) updateData.billingDay = parsed.data.billingDay;
            if (parsed.data.startDate !== undefined) updateData.startDate = new Date(parsed.data.startDate);
            if (parsed.data.endDate !== undefined) updateData.endDate = parsed.data.endDate ? new Date(parsed.data.endDate) : null;

            const updated = await prisma.contract.update({
                where: { id: parsed.data.contractId },
                data: updateData,
            });

            await prisma.auditLog.create({
                data: {
                    tenantId: ctx.tenantId,
                    userId: ctx.session.userId,
                    action: 'contract.update',
                    entityType: 'Contract',
                    entityId: parsed.data.contractId,
                    details: JSON.stringify(updateData),
                },
            });

            return apiSuccess(updated);
        }

        if (action === 'delete_contract') {
            const schema = z.object({ contractId: z.string().uuid() });
            const parsed = schema.safeParse(body);
            if (!parsed.success) return apiError('Invalid input', 400);

            const contract = await prisma.contract.findFirst({
                where: { id: parsed.data.contractId, tenantId: ctx.tenantId },
                include: { _count: { select: { invoices: true } } },
            });
            if (!contract) return apiError('Contract not found', 404);

            // Unlink invoices first
            await prisma.invoice.updateMany({
                where: { contractId: parsed.data.contractId },
                data: { contractId: null },
            });

            await prisma.contract.delete({ where: { id: parsed.data.contractId } });

            await prisma.auditLog.create({
                data: {
                    tenantId: ctx.tenantId,
                    userId: ctx.session.userId,
                    action: 'contract.delete',
                    entityType: 'Contract',
                    entityId: parsed.data.contractId,
                },
            });

            return apiSuccess({ message: 'Contract deleted' });
        }

        if (action === 'update_invoice') {
            const schema = z.object({
                invoiceId: z.string().uuid(),
                dueDate: z.string().optional(),
                notes: z.string().optional().nullable(),
                status: z.string().optional(),
                referenceMonth: z.string().optional().nullable(),
            });
            const parsed = schema.safeParse(body);
            if (!parsed.success) return apiError('Invalid input', 400);

            const invoice = await prisma.invoice.findFirst({
                where: { id: parsed.data.invoiceId, tenantId: ctx.tenantId },
            });
            if (!invoice) return apiError('Invoice not found', 404);

            const updateData: Record<string, unknown> = {};
            if (parsed.data.dueDate !== undefined) {
                // Append T12:00:00 to avoid timezone shift issues
                updateData.dueDate = new Date(parsed.data.dueDate + 'T12:00:00');
            }
            if (parsed.data.notes !== undefined) updateData.notes = parsed.data.notes;
            if (parsed.data.status !== undefined) updateData.status = parsed.data.status;
            if (parsed.data.referenceMonth !== undefined) updateData.referenceMonth = parsed.data.referenceMonth;

            // Auto-detect overdue: if dueDate is in the past and status is PENDING, mark as OVERDUE
            const effectiveDueDate = updateData.dueDate ? (updateData.dueDate as Date) : invoice.dueDate;
            const effectiveStatus = (updateData.status as string) || invoice.status;
            if (effectiveStatus === 'PENDING' && new Date(effectiveDueDate) < new Date()) {
                updateData.status = 'OVERDUE';
            }

            // If reverting from PAID to PENDING/OVERDUE, delete the auto-generated next invoice
            if (invoice.status === 'PAID' && parsed.data.status && parsed.data.status !== 'PAID' && invoice.contractId) {
                // Find the next auto-generated PENDING invoice for this contract
                const nextInvoice = await prisma.invoice.findFirst({
                    where: {
                        tenantId: ctx.tenantId,
                        contractId: invoice.contractId,
                        status: 'PENDING',
                        id: { not: parsed.data.invoiceId },
                        dueDate: { gt: invoice.dueDate },
                    },
                    orderBy: { dueDate: 'asc' },
                });
                if (nextInvoice) {
                    await prisma.invoiceItem.deleteMany({ where: { invoiceId: nextInvoice.id } });
                    await prisma.payment.deleteMany({ where: { invoiceId: nextInvoice.id } });
                    await prisma.invoice.delete({ where: { id: nextInvoice.id } });
                }
                // Also clear paidAt
                updateData.paidAt = null;
            }

            const updated = await prisma.invoice.update({
                where: { id: parsed.data.invoiceId },
                data: updateData,
            });

            await prisma.auditLog.create({
                data: {
                    tenantId: ctx.tenantId,
                    userId: ctx.session.userId,
                    action: 'invoice.update',
                    entityType: 'Invoice',
                    entityId: parsed.data.invoiceId,
                    details: JSON.stringify(updateData),
                },
            });

            return apiSuccess(updated);
        }

        if (action === 'delete_invoice') {
            const schema = z.object({ invoiceId: z.string().uuid() });
            const parsed = schema.safeParse(body);
            if (!parsed.success) return apiError('Invalid input', 400);

            const invoice = await prisma.invoice.findFirst({
                where: { id: parsed.data.invoiceId, tenantId: ctx.tenantId },
            });
            if (!invoice) return apiError('Invoice not found', 404);

            // Delete items and payments first, then the invoice
            await prisma.invoiceItem.deleteMany({ where: { invoiceId: parsed.data.invoiceId } });
            await prisma.payment.deleteMany({ where: { invoiceId: parsed.data.invoiceId } });
            await prisma.invoice.delete({ where: { id: parsed.data.invoiceId } });

            await prisma.auditLog.create({
                data: {
                    tenantId: ctx.tenantId,
                    userId: ctx.session.userId,
                    action: 'invoice.delete',
                    entityType: 'Invoice',
                    entityId: parsed.data.invoiceId,
                },
            });

            return apiSuccess({ message: 'Invoice deleted' });
        }

        return apiError('Unknown action', 400);
    },
    { roles: ['SUPERADMIN', 'TENANT_ADMIN'] }
);
