import { NextRequest } from 'next/server';
import { withAuth, apiSuccess, apiError, ApiContext } from '@/lib/api/helpers';
import prisma from '@/lib/db';

// GET /api/portal/invoices
export const GET = withAuth(
    async (_req: NextRequest, ctx: ApiContext) => {
        if (!ctx.session.clientId) return apiError('Not a client user', 403);

        const invoices = await prisma.invoice.findMany({
            where: {
                tenantId: ctx.tenantId,
                clientId: ctx.session.clientId,
            },
            include: {
                items: true,
            },
            orderBy: { dueDate: 'desc' },
        });

        // Check if blocked
        const overdueCount = invoices.filter(
            (i) => i.status === 'OVERDUE'
        ).length;

        return apiSuccess({
            invoices: invoices.map((inv) => ({
                id: inv.id,
                dueDate: inv.dueDate,
                totalAmount: Number(inv.totalAmount),
                status: inv.status,
                pixPayload: inv.pixPayload,
                pixQrCode: inv.pixQrCode,
                paidAt: inv.paidAt,
                referenceMonth: inv.referenceMonth,
                items: inv.items.map((item) => ({
                    description: item.description,
                    quantity: item.quantity,
                    unitPrice: Number(item.unitPrice),
                    totalAmount: Number(item.totalAmount),
                    type: item.type,
                })),
            })),
            overdueCount,
            isBlocked: overdueCount > 0,
        });
    },
    { roles: ['CLIENT_USER'] }
);
