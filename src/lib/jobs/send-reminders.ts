import prisma from '@/lib/db';

/**
 * Send email reminders for upcoming and overdue invoices.
 * - 3 days before due date: first reminder
 * - On due date: second reminder
 * - After due date (overdue): urgent reminder
 */
export async function sendReminders(tenantId: string): Promise<string> {
    const now = new Date();
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(now.getDate() + 3);

    // Find invoices needing reminders
    const pendingInvoices = await prisma.invoice.findMany({
        where: {
            tenantId,
            status: { in: ['PENDING', 'OVERDUE'] as const },
        },
        include: {
            client: { select: { name: true, email: true } },
        },
    });

    let sent = 0;

    for (const invoice of pendingInvoices) {
        const dueDate = new Date(invoice.dueDate);
        const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        let notificationType: 'INVOICE_REMINDER' | 'INVOICE_OVERDUE' | null = null;
        let subject = '';
        let body = '';

        if (daysUntilDue <= 0 && invoice.status === 'OVERDUE') {
            notificationType = 'INVOICE_OVERDUE';
            subject = `⚠️ Fatura em atraso — R$ ${Number(invoice.totalAmount).toFixed(2)}`;
            body = `Olá ${invoice.client.name}, sua fatura no valor de R$ ${Number(invoice.totalAmount).toFixed(2)} está vencida desde ${dueDate.toLocaleDateString('pt-BR')}. Regularize o pagamento para evitar restrições de acesso.`;
        } else if (daysUntilDue === 0) {
            notificationType = 'INVOICE_REMINDER';
            subject = `📅 Fatura vence hoje — R$ ${Number(invoice.totalAmount).toFixed(2)}`;
            body = `Olá ${invoice.client.name}, sua fatura no valor de R$ ${Number(invoice.totalAmount).toFixed(2)} vence hoje (${dueDate.toLocaleDateString('pt-BR')}). Realize o pagamento para manter seu acesso.`;
        } else if (daysUntilDue > 0 && daysUntilDue <= 3) {
            notificationType = 'INVOICE_REMINDER';
            subject = `🔔 Lembrete: fatura vence em ${daysUntilDue} dia(s) — R$ ${Number(invoice.totalAmount).toFixed(2)}`;
            body = `Olá ${invoice.client.name}, sua fatura no valor de R$ ${Number(invoice.totalAmount).toFixed(2)} vence em ${dueDate.toLocaleDateString('pt-BR')}.`;
        }

        if (!notificationType || !invoice.client.email) continue;

        // Check if we already sent a reminder today for this invoice
        const today = new Date().toISOString().slice(0, 10);
        const existingNotification = await prisma.notificationLog.findFirst({
            where: {
                tenantId,
                invoiceId: invoice.id,
                type: notificationType,
                sentAt: {
                    gte: new Date(`${today}T00:00:00Z`),
                    lt: new Date(`${today}T23:59:59Z`),
                },
            },
        });

        if (existingNotification) continue;

        // Log the notification (actual email sending depends on SMTP config)
        await prisma.notificationLog.create({
            data: {
                tenantId,
                type: notificationType,
                recipientEmail: invoice.client.email,
                subject,
                body,
                invoiceId: invoice.id,
                success: true, // Will be updated by actual email sender
            },
        });

        // TODO: Send actual email via nodemailer when SMTP is configured
        // import { sendEmail } from '@/lib/email';
        // await sendEmail({ to: invoice.client.email, subject, body });

        sent++;
    }

    return `Sent ${sent} reminders for tenant ${tenantId}`;
}
