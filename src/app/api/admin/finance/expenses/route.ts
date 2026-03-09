import { NextRequest } from 'next/server';
import { withAuth, apiSuccess, apiError, ApiContext } from '@/lib/api/helpers';
import prisma from '@/lib/db';
import { z } from 'zod';

// Helper: parse "YYYY-MM-DD" into a UTC noon Date to avoid timezone shifts
function parseDate(dateStr: string): Date {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

const expenseSchema = z.object({
    description: z.string().min(1, 'Descrição é obrigatória'),
    amount: z.number().positive('Valor deve ser positivo'),
    category: z.enum(['SOFTWARE', 'EQUIPMENT', 'MARKETING', 'OFFICE', 'SALARY', 'FREELANCER', 'TAX', 'OTHER']),
    date: z.string().min(1),
    referenceMonth: z.string().optional(),
    notes: z.string().optional(),
    recurring: z.boolean().optional(),
    status: z.enum(['PENDING', 'PAID', 'OVERDUE', 'CANCELLED']).optional(),
    installments: z.number().int().min(1).max(60).optional(),
});

// GET /api/admin/finance/expenses?month=2026-03
export const GET = withAuth(
    async (req: NextRequest, ctx: ApiContext) => {
        const url = new URL(req.url);
        const month = url.searchParams.get('month'); // "2026-03"

        const where: Record<string, unknown> = { tenantId: ctx.tenantId };

        if (month) {
            const [y, m] = month.split('-').map(Number);
            const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
            const end = new Date(Date.UTC(y, m, 1, 0, 0, 0));
            where.date = { gte: start, lt: end };
        }

        const expenses = await prisma.expense.findMany({
            where,
            orderBy: { date: 'desc' },
        });

        // Auto-mark overdue: past date and still PENDING
        const now = new Date();
        const updated = expenses.map(e => {
            if (e.status === 'PENDING' && new Date(e.date) < now) {
                return { ...e, status: 'OVERDUE' as const };
            }
            return e;
        });

        return apiSuccess(updated);
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

        const { description, amount, category, date, notes, recurring, status, installments } = parsed.data;
        const dateObj = parseDate(date);
        const numInstallments = installments || 1;

        const created = [];
        for (let i = 0; i < numInstallments; i++) {
            // Advance month using UTC to avoid timezone shifts
            const installDate = new Date(Date.UTC(
                dateObj.getUTCFullYear(),
                dateObj.getUTCMonth() + i,
                dateObj.getUTCDate(),
                12, 0, 0
            ));
            const refMonth = `${installDate.getUTCFullYear()}-${String(installDate.getUTCMonth() + 1).padStart(2, '0')}`;
            const desc = numInstallments > 1
                ? `${description} (${i + 1}/${numInstallments})`
                : description;

            const expense = await prisma.expense.create({
                data: {
                    tenantId: ctx.tenantId,
                    description: desc,
                    amount: amount,
                    category,
                    date: installDate,
                    dueDate: installDate,
                    referenceMonth: refMonth,
                    notes: notes || null,
                    recurring: recurring || false,
                    status: status || 'PENDING',
                },
            });
            created.push(expense);
        }

        return apiSuccess(numInstallments === 1 ? created[0] : created, 201);
    },
    { roles: ['SUPERADMIN', 'TENANT_ADMIN'] }
);
