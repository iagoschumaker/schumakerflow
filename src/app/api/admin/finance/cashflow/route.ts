import { NextRequest } from 'next/server';
import { withAuth, apiSuccess, ApiContext } from '@/lib/api/helpers';
import prisma from '@/lib/db';

// GET /api/admin/finance/cashflow?month=2026-03
export const GET = withAuth(
    async (req: NextRequest, ctx: ApiContext) => {
        const url = new URL(req.url);
        const monthParam = url.searchParams.get('month');

        const now = new Date();
        const [y, m] = monthParam
            ? monthParam.split('-').map(Number)
            : [now.getFullYear(), now.getMonth() + 1];

        const start = new Date(y, m - 1, 1);
        const end = new Date(y, m, 1);

        // Income: paid invoices where paidAt falls in this month
        const paidInvoices = await prisma.invoice.findMany({
            where: {
                tenantId: ctx.tenantId,
                status: 'PAID',
                paidAt: { gte: start, lt: end },
            },
            include: {
                client: { select: { name: true, phone: true } },
                contract: { select: { name: true, type: true } },
                items: { select: { description: true, quantity: true, unitPrice: true, totalAmount: true, type: true } },
            },
            orderBy: { paidAt: 'desc' },
        });

        // Expenses PAID in this month (only paid expenses enter cashflow)
        const expenses = await prisma.expense.findMany({
            where: {
                tenantId: ctx.tenantId,
                status: 'PAID',
                paidAt: { gte: start, lt: end },
            },
            orderBy: { paidAt: 'desc' },
        });

        const totalIncome = paidInvoices.reduce((s: number, i) => s + Number(i.totalAmount), 0);
        const totalExpenses = expenses.reduce((s: number, e) => s + Number(e.amount), 0);
        const balance = totalIncome - totalExpenses;

        // Unified transaction list with full details
        const transactions = [
            ...paidInvoices.map(i => ({
                id: i.id,
                type: 'income' as const,
                description: i.contract?.name || i.notes || `Fatura - ${i.client.name}`,
                client: i.client.name,
                clientPhone: i.client.phone,
                amount: Number(i.totalAmount),
                date: i.paidAt!.toISOString(),
                dueDate: i.dueDate.toISOString(),
                paidAt: i.paidAt!.toISOString(),
                referenceMonth: i.referenceMonth,
                notes: i.notes,
                category: null,
                contractName: i.contract?.name || null,
                contractType: i.contract?.type || null,
                items: i.items.map(it => ({
                    description: it.description,
                    quantity: it.quantity,
                    unitPrice: Number(it.unitPrice),
                    totalAmount: Number(it.totalAmount),
                    type: it.type,
                })),
            })),
            ...expenses.map(e => ({
                id: e.id,
                type: 'expense' as const,
                description: e.description,
                client: null,
                clientPhone: null,
                amount: Number(e.amount),
                date: e.date.toISOString(),
                dueDate: null,
                paidAt: null,
                referenceMonth: e.referenceMonth,
                notes: e.notes,
                category: e.category,
                contractName: null,
                contractType: null,
                items: [] as { description: string; quantity: number; unitPrice: number; totalAmount: number; type: string }[],
            })),
        ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        return apiSuccess({
            month: `${y}-${String(m).padStart(2, '0')}`,
            totalIncome,
            totalExpenses,
            balance,
            incomeCount: paidInvoices.length,
            expenseCount: expenses.length,
            transactions,
        });
    },
    { roles: ['SUPERADMIN', 'TENANT_ADMIN'] }
);
