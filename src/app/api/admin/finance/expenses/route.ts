import { NextRequest } from 'next/server';
import { withAuth, apiSuccess, apiError, ApiContext } from '@/lib/api/helpers';
import prisma from '@/lib/db';
import { z } from 'zod';

const expenseSchema = z.object({
    description: z.string().min(1, 'Descrição é obrigatória'),
    amount: z.number().positive('Valor deve ser positivo'),
    category: z.enum(['SOFTWARE', 'EQUIPMENT', 'MARKETING', 'OFFICE', 'SALARY', 'FREELANCER', 'TAX', 'OTHER']),
    date: z.string().min(1),
    referenceMonth: z.string().optional(),
    notes: z.string().optional(),
    recurring: z.boolean().optional(),
});

// GET /api/admin/finance/expenses?month=2026-03
export const GET = withAuth(
    async (req: NextRequest, ctx: ApiContext) => {
        const url = new URL(req.url);
        const month = url.searchParams.get('month'); // "2026-03"

        const where: Record<string, unknown> = { tenantId: ctx.tenantId };

        if (month) {
            const [y, m] = month.split('-').map(Number);
            const start = new Date(y, m - 1, 1);
            const end = new Date(y, m, 1);
            where.date = { gte: start, lt: end };
        }

        const expenses = await prisma.expense.findMany({
            where,
            orderBy: { date: 'desc' },
        });

        return apiSuccess(expenses);
    },
    { roles: ['SUPERADMIN', 'TENANT_ADMIN'] }
);

// POST /api/admin/finance/expenses
export const POST = withAuth(
    async (req: NextRequest, ctx: ApiContext) => {
        const body = await req.json();
        const parsed = expenseSchema.safeParse(body);
        if (!parsed.success) {
            return apiError(parsed.error.issues.map((e: { message: string }) => e.message).join(', '), 400);
        }

        const { description, amount, category, date, notes, recurring } = parsed.data;
        const dateObj = new Date(date);
        const refMonth = parsed.data.referenceMonth || `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;

        const expense = await prisma.expense.create({
            data: {
                tenantId: ctx.tenantId,
                description,
                amount,
                category,
                date: dateObj,
                referenceMonth: refMonth,
                notes: notes || null,
                recurring: recurring || false,
            },
        });

        return apiSuccess(expense, 201);
    },
    { roles: ['SUPERADMIN', 'TENANT_ADMIN'] }
);
