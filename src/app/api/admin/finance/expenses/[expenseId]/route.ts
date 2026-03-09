import { NextRequest } from 'next/server';
import { withAuth, apiSuccess, apiError, ApiContext } from '@/lib/api/helpers';
import prisma from '@/lib/db';
import { z } from 'zod';

const updateSchema = z.object({
    description: z.string().min(1).optional(),
    amount: z.number().positive().optional(),
    category: z.enum(['SOFTWARE', 'EQUIPMENT', 'MARKETING', 'OFFICE', 'SALARY', 'FREELANCER', 'TAX', 'OTHER']).optional(),
    date: z.string().optional(),
    dueDate: z.string().optional().nullable(),
    referenceMonth: z.string().optional(),
    notes: z.string().optional(),
    recurring: z.boolean().optional(),
    status: z.enum(['PENDING', 'PAID', 'OVERDUE', 'CANCELLED']).optional(),
});

// PUT /api/admin/finance/expenses/[expenseId]
export const PUT = withAuth(
    async (req: NextRequest, ctx: ApiContext) => {
        const expenseId = req.nextUrl.pathname.split('/').pop()!;
        const body = await req.json();
        const parsed = updateSchema.safeParse(body);
        if (!parsed.success) {
            return apiError(parsed.error.issues.map((e: { message: string }) => e.message).join(', '), 400);
        }

        const existing = await prisma.expense.findFirst({
            where: { id: expenseId, tenantId: ctx.tenantId },
        });
        if (!existing) return apiError('Despesa não encontrada', 404);

        const data: Record<string, unknown> = {};

        if (parsed.data.description !== undefined) data.description = parsed.data.description;
        if (parsed.data.amount !== undefined) data.amount = parsed.data.amount;
        if (parsed.data.category !== undefined) data.category = parsed.data.category;
        if (parsed.data.notes !== undefined) data.notes = parsed.data.notes || null;
        if (parsed.data.recurring !== undefined) data.recurring = parsed.data.recurring;
        if (parsed.data.referenceMonth !== undefined) data.referenceMonth = parsed.data.referenceMonth;
        if (parsed.data.status !== undefined) {
            data.status = parsed.data.status;
            if (parsed.data.status === 'PAID' && !existing.paidAt) {
                data.paidAt = new Date();
            }
            if (parsed.data.status !== 'PAID') {
                data.paidAt = null;
            }
        }
        if (parsed.data.date !== undefined) {
            const d = new Date(`${parsed.data.date}T12:00:00`);
            data.date = d;
            if (!parsed.data.referenceMonth) {
                data.referenceMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            }
        }
        if (parsed.data.dueDate !== undefined) {
            data.dueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null;
        }

        const expense = await prisma.expense.update({
            where: { id: expenseId },
            data,
        });

        return apiSuccess(expense);
    },
    { roles: ['SUPERADMIN', 'TENANT_ADMIN'] }
);

// PATCH /api/admin/finance/expenses/[expenseId] — mark paid/unpaid
export const PATCH = withAuth(
    async (req: NextRequest, ctx: ApiContext) => {
        const expenseId = req.nextUrl.pathname.split('/').pop()!;
        const body = await req.json();
        const { action } = body;

        const existing = await prisma.expense.findFirst({
            where: { id: expenseId, tenantId: ctx.tenantId },
        });
        if (!existing) return apiError('Despesa não encontrada', 404);

        if (action === 'mark_paid') {
            if (existing.status === 'PAID') return apiError('Despesa já está paga', 400);
            const expense = await prisma.expense.update({
                where: { id: expenseId },
                data: { status: 'PAID', paidAt: new Date() },
            });

            // Auto-generate next month for recurring expenses
            if (existing.recurring) {
                const curDate = new Date(existing.date);
                const nextDate = new Date(curDate.getFullYear(), curDate.getMonth() + 1, curDate.getDate());
                const nextRefMonth = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;

                // Idempotency: check if next month already exists
                const alreadyExists = await prisma.expense.findFirst({
                    where: {
                        tenantId: ctx.tenantId,
                        description: existing.description,
                        referenceMonth: nextRefMonth,
                        category: existing.category,
                    },
                });

                if (!alreadyExists) {
                    const nextDueDate = existing.dueDate
                        ? new Date(new Date(existing.dueDate).getFullYear(), new Date(existing.dueDate).getMonth() + 1, new Date(existing.dueDate).getDate())
                        : null;

                    await prisma.expense.create({
                        data: {
                            tenantId: ctx.tenantId,
                            description: existing.description,
                            amount: existing.amount,
                            category: existing.category,
                            date: nextDate,
                            dueDate: nextDueDate,
                            referenceMonth: nextRefMonth,
                            notes: existing.notes,
                            recurring: true,
                            status: 'PENDING',
                        },
                    });
                }
            }

            return apiSuccess(expense);
        }

        if (action === 'mark_unpaid') {
            const expense = await prisma.expense.update({
                where: { id: expenseId },
                data: { status: 'PENDING', paidAt: null },
            });
            return apiSuccess(expense);
        }

        return apiError('Ação inválida', 400);
    },
    { roles: ['SUPERADMIN', 'TENANT_ADMIN'] }
);

// DELETE /api/admin/finance/expenses/[expenseId]
export const DELETE = withAuth(
    async (req: NextRequest, ctx: ApiContext) => {
        const expenseId = req.nextUrl.pathname.split('/').pop()!;

        const existing = await prisma.expense.findFirst({
            where: { id: expenseId, tenantId: ctx.tenantId },
        });
        if (!existing) return apiError('Despesa não encontrada', 404);

        await prisma.expense.delete({ where: { id: expenseId } });

        return apiSuccess({ deleted: true });
    },
    { roles: ['SUPERADMIN', 'TENANT_ADMIN'] }
);
