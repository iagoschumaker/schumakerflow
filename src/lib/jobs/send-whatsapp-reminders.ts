import prisma from '@/lib/db';
import { sendText, getEvolutionConfig } from '@/lib/evolution-api';

/**
 * Send WhatsApp reminders for invoices that are due today or overdue.
 * Uses Evolution API per tenant — skips tenants without config.
 *
 * Rules:
 *  - 3 days before due: friendly reminder
 *  - On due date: payment reminder
 *  - Overdue: urgent collection message
 *  - Max 1 message per invoice per day (dedup via NotificationLog)
 */
export async function sendWhatsappReminders(tenantId: string): Promise<string> {
    // Check if tenant has Evolution API configured
    const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
            evolutionInstance: true,
            name: true,
            pixKey: true,
            pixKeyType: true,
            pixReceiverName: true,
        },
    });

    const config = getEvolutionConfig(tenant?.evolutionInstance);
    if (!config) {
        return `Skipped tenant ${tenantId} — WhatsApp not configured`;
    }

    const now = new Date();
    const today = now.toISOString().slice(0, 10);

    // Find all PENDING and OVERDUE invoices
    const invoices = await prisma.invoice.findMany({
        where: {
            tenantId,
            status: { in: ['PENDING', 'OVERDUE'] },
        },
        include: {
            client: { select: { name: true, phone: true } },
            contract: { select: { name: true } },
        },
    });

    let sent = 0;
    let skipped = 0;

    for (const invoice of invoices) {
        const phone = (invoice.client.phone || '').replace(/\D/g, '');
        if (!phone) { skipped++; continue; }

        const dueDate = new Date(invoice.dueDate);
        const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const dueDateStr = dueDate.toLocaleDateString('pt-BR');
        const amount = `R$ ${Number(invoice.totalAmount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

        let notificationType: string | null = null;
        let message = '';

        if (daysUntilDue < 0 && invoice.status === 'OVERDUE') {
            // Overdue — urgent message
            const daysLate = Math.abs(daysUntilDue);
            notificationType = 'WHATSAPP_OVERDUE';
            message = `⚠️ *Fatura em atraso — ${tenant.name}*\n\n`;
            message += `Olá ${invoice.client.name}, sua fatura no valor de *${amount}* venceu em *${dueDateStr}* (${daysLate} dia${daysLate > 1 ? 's' : ''} de atraso).\n\n`;
            message += `Por favor, regularize o pagamento o mais rápido possível para evitar restrições de acesso.\n`;
        } else if (daysUntilDue === 0) {
            // Due today
            notificationType = 'WHATSAPP_DUE_TODAY';
            message = `📅 *Fatura vence hoje — ${tenant.name}*\n\n`;
            message += `Olá ${invoice.client.name}, sua fatura no valor de *${amount}* vence *hoje* (${dueDateStr}).\n\n`;
            message += `Realize o pagamento para manter seu acesso.\n`;
        } else if (daysUntilDue > 0 && daysUntilDue <= 3) {
            // 1-3 days before due
            notificationType = 'WHATSAPP_REMINDER';
            message = `🔔 *Lembrete de fatura — ${tenant.name}*\n\n`;
            message += `Olá ${invoice.client.name}, sua fatura no valor de *${amount}* vence em *${daysUntilDue} dia${daysUntilDue > 1 ? 's' : ''}* (${dueDateStr}).\n`;
        }

        if (!notificationType) continue;

        // Add contract/description info
        if (invoice.contract?.name) {
            message += `Contrato: ${invoice.contract.name}\n`;
        }

        // Add PIX info if configured
        if (tenant.pixKey) {
            message += `\n*Dados para pagamento PIX:*\n`;
            message += `Tipo: ${tenant.pixKeyType}\n`;
            message += `Chave: *${tenant.pixKey}*\n`;
            if (tenant.pixReceiverName) message += `Nome: ${tenant.pixReceiverName}\n`;
        }

        message += `\nObrigado! 🙏`;

        // Check if we already sent this type of notification today
        const existing = await prisma.notificationLog.findFirst({
            where: {
                tenantId,
                invoiceId: invoice.id,
                type: notificationType as any,
                sentAt: {
                    gte: new Date(`${today}T00:00:00Z`),
                    lt: new Date(`${today}T23:59:59Z`),
                },
            },
        });

        if (existing) { skipped++; continue; }

        // Send via Evolution API
        const result = await sendText(config, phone, message);

        // Log the notification
        await prisma.notificationLog.create({
            data: {
                tenantId,
                type: notificationType as any,
                recipientEmail: phone,
                subject: `WhatsApp: ${notificationType}`,
                body: message,
                invoiceId: invoice.id,
                success: result.success,
                error: result.error || null,
            },
        });

        if (result.success) sent++;
    }

    return `WhatsApp reminders: ${sent} sent, ${skipped} skipped for tenant ${tenantId}`;
}
