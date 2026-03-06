import prisma from '@/lib/db';
import { checkPixPaymentStatus } from '@/lib/finance/mercadopago';
import { InvoiceStatus } from '@prisma/client';

/**
 * Sync PIX payment statuses from Mercado Pago.
 * Checks all PENDING invoices with external references.
 */
export async function syncPixPayments(tenantId: string): Promise<string> {
    const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { mpAccessToken: true },
    });

    if (!tenant?.mpAccessToken) {
        return 'Skipped: No Mercado Pago token configured';
    }

    // Find pending invoices with external references
    const pendingInvoices = await prisma.invoice.findMany({
        where: {
            tenantId,
            status: { in: [InvoiceStatus.PENDING, InvoiceStatus.OVERDUE] },
            externalReference: { not: null },
        },
        include: {
            payments: {
                where: { transactionId: { not: null } },
            },
        },
    });

    let updated = 0;

    for (const invoice of pendingInvoices) {
        for (const payment of invoice.payments) {
            if (!payment.transactionId) continue;

            try {
                const status = await checkPixPaymentStatus(
                    payment.transactionId,
                    tenant.mpAccessToken!
                );

                if (status.status === 'approved' && payment.status !== 'CONFIRMED') {
                    await prisma.payment.update({
                        where: { id: payment.id },
                        data: {
                            status: 'CONFIRMED',
                            confirmedAt: status.paidAt ? new Date(status.paidAt) : new Date(),
                        },
                    });

                    // Update invoice
                    await prisma.invoice.update({
                        where: { id: invoice.id },
                        data: {
                            status: InvoiceStatus.PAID,
                            paidAt: status.paidAt ? new Date(status.paidAt) : new Date(),
                        },
                    });

                    updated++;
                } else if (status.status === 'rejected' || status.status === 'cancelled') {
                    await prisma.payment.update({
                        where: { id: payment.id },
                        data: { status: 'FAILED' },
                    });
                }
            } catch (e) {
                console.error(`Failed to check payment ${payment.id}:`, e);
            }
        }
    }

    return `Updated ${updated} payments`;
}
