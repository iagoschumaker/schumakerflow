import { NextRequest } from 'next/server';
import { withAuth, apiSuccess, ApiContext } from '@/lib/api/helpers';
import prisma from '@/lib/db';

// GET /api/admin/agenda?month=2026-03
export const GET = withAuth(
    async (req: NextRequest, ctx: ApiContext) => {
        const url = new URL(req.url);
        const month = url.searchParams.get('month');

        const now = new Date();
        const year = month ? parseInt(month.split('-')[0]) : now.getFullYear();
        const mon = month ? parseInt(month.split('-')[1]) : now.getMonth() + 1;

        const start = new Date(Date.UTC(year, mon - 1, 1, 0, 0, 0));
        const end = new Date(Date.UTC(year, mon, 1, 0, 0, 0));

        // Fetch invoices with due dates in this month
        const invoices = await (prisma as any).invoice.findMany({
            where: {
                tenantId: ctx.tenantId,
                dueDate: { gte: start, lt: end },
            },
            include: { client: { select: { name: true } } },
        });

        // Fetch expenses in this month
        const expenses = await (prisma as any).expense.findMany({
            where: {
                tenantId: ctx.tenantId,
                date: { gte: start, lt: end },
            },
        });

        // Fetch projects with deliveredAt in this month
        const projects = await prisma.project.findMany({
            where: {
                tenantId: ctx.tenantId,
                deliveredAt: { gte: start, lt: end },
            },
            include: { client: { select: { name: true } } },
        });

        // Build events
        const events: Array<{
            id: string;
            date: string;
            type: 'invoice_due' | 'invoice_paid' | 'expense' | 'delivery';
            title: string;
            subtitle: string | null;
            amount: number | null;
            color: string;
            status: string | null;
        }> = [];

        for (const inv of invoices) {
            events.push({
                id: `inv-${inv.id}`,
                date: inv.dueDate.toISOString().slice(0, 10),
                type: 'invoice_due',
                title: `Fatura — ${inv.client?.name || 'Cliente'}`,
                subtitle: inv.referenceMonth ? `Ref: ${inv.referenceMonth}` : null,
                amount: Number(inv.totalAmount),
                color: inv.status === 'PAID' ? '#22c55e' : inv.status === 'OVERDUE' ? '#ef4444' : '#f59e0b',
                status: inv.status,
            });
        }

        for (const exp of expenses) {
            events.push({
                id: `exp-${exp.id}`,
                date: exp.date.toISOString().slice(0, 10),
                type: 'expense',
                title: exp.description,
                subtitle: exp.category || null,
                amount: Number(exp.amount),
                color: exp.status === 'PAID' ? '#6b7280' : '#ef4444',
                status: exp.status,
            });
        }

        for (const proj of projects) {
            events.push({
                id: `proj-${proj.id}`,
                date: proj.deliveredAt!.toISOString().slice(0, 10),
                type: 'delivery',
                title: `Entrega — ${proj.name}`,
                subtitle: proj.client?.name || null,
                amount: null,
                color: '#3b82f6',
                status: proj.status,
            });
        }

        // Sort by date
        events.sort((a, b) => a.date.localeCompare(b.date));

        return apiSuccess({
            month: `${year}-${String(mon).padStart(2, '0')}`,
            events,
            summary: {
                invoices: invoices.length,
                expenses: expenses.length,
                deliveries: projects.length,
            },
        });
    },
    { roles: ['SUPERADMIN', 'TENANT_ADMIN'] }
);
