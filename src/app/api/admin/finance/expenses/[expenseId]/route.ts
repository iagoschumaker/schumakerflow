import { NextRequest } from 'next/server';
import { withAuth, apiSuccess, apiError, ApiContext } from '@/lib/api/helpers';
import prisma from '@/lib/db';
import { z } from 'zod';

const updateSchema = z.object({
    description: z.string().min(1).optional(),
    amount: z.number().positive().optional(),
    category: z.enum(['SOFTWARE', 'EQUIPMENT', 'MARKETING', 'OFFICE', 'SALARY', 'FREELANCER', 'TAX', 'OTHER']).optional(),
    date: z.string().optional(),
    referenceMonth: z.string().optional(),
    notes: z.string().optional(),
    recurring: z.boolean().optional(),
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

        const data: Record<string, unknown> = { ...parsed.data };
        if (data.date) {
            const d = new Date(data.date as string);
            data.date = d;
            if (!parsed.data.referenceMonth) {
                data.referenceMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            }
        }

        const expense = await prisma.expense.update({
            where: { id: expenseId },
            data,
        });

        return apiSuccess(expense);
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
