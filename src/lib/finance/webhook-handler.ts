import prisma from '@/lib/db';
import { checkPixPaymentStatus } from '@/lib/finance/mercadopago';
import { InvoiceStatus } from '@prisma/client';

/**
 * Handle a Mercado Pago webhook notification.
 * Finds the payment by transaction ID and updates status.
 */
export async function webhookHandler(paymentId: string): Promise<void> {
    // Find payment by transaction ID
    const payment = await prisma.payment.findFirst({
        where: { transactionId: paymentId },
        include: {
            invoice: true,
            tenant: { select: { mpAccessToken: true } },
        },
    });

    if (!payment) {
        console.log(`Webhook: payment ${paymentId} not found in database`);
        return;
    }

    if (!payment.tenant.mpAccessToken) return;

    try {
        const status = await checkPixPaymentStatus(
            paymentId,
            payment.tenant.mpAccessToken
        );

        if (status.status === 'approved') {
            await prisma.payment.update({
                where: { id: payment.id },
                data: {
                    status: 'CONFIRMED',
                    confirmedAt: status.paidAt ? new Date(status.paidAt) : new Date(),
                    rawWebhookData: JSON.stringify(status),
                },
            });

            await prisma.invoice.update({
                where: { id: payment.invoiceId },
                data: {
                    status: InvoiceStatus.PAID,
                    paidAt: status.paidAt ? new Date(status.paidAt) : new Date(),
                },
            });
        } else if (status.status === 'rejected' || status.status === 'cancelled') {
            await prisma.payment.update({
                where: { id: payment.id },
                data: {
                    status: 'FAILED',
                    rawWebhookData: JSON.stringify(status),
                },
            });
        }
    } catch (error) {
        console.error(`Webhook handler error for payment ${paymentId}:`, error);
    }
}
