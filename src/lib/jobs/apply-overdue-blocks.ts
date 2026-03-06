import prisma from '@/lib/db';

/**
 * Apply overdue status to past-due invoices and block delinquent clients.
 * Should run daily.
 *
 * Steps:
 * 1. Find PENDING invoices past due date → mark OVERDUE
 * 2. Find clients with OVERDUE invoices past blockAfterDays → set isBlocked
 * 3. Unblock clients with no overdue invoices
 */
export async function applyOverdueBlocks(tenantId: string): Promise<string> {
    const now = new Date();

    // Get tenant config
    const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { blockAfterDays: true, blockMode: true },
    });

    if (!tenant) return 'Tenant not found';

    // Step 1: Mark pending invoices as overdue
    const overdueResult = await prisma.invoice.updateMany({
        where: {
            tenantId,
            status: 'PENDING' as const,
            dueDate: { lt: now },
        },
        data: { status: 'OVERDUE' as const },
    });

    // Step 2: Find clients with old overdue invoices → block
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - tenant.blockAfterDays);

    const clientsToBlock = await prisma.invoice.findMany({
        where: {
            tenantId,
            status: 'OVERDUE' as const,
            dueDate: { lt: cutoffDate },
        },
        select: { clientId: true },
        distinct: ['clientId'],
    });

    let blocked = 0;
    for (const { clientId } of clientsToBlock) {
        await prisma.client.update({
            where: { id: clientId },
            data: { isActive: false },
        });
        blocked++;

        // Log notification
        const client = await prisma.client.findUnique({
            where: { id: clientId },
            select: { email: true, name: true },
        });
        if (client?.email) {
            await prisma.notificationLog.create({
                data: {
                    tenantId,
                    type: 'DOWNLOAD_BLOCKED',
                    recipientEmail: client.email,
                    subject: `Acesso bloqueado — ${client.name}`,
                    body: `O acesso a downloads foi bloqueado devido a faturas em atraso há mais de ${tenant.blockAfterDays} dias.`,
                    success: true,
                },
            });
        }
    }

    // Step 3: Unblock clients with no overdue invoices
    const allOverdueClients = await prisma.invoice.findMany({
        where: {
            tenantId,
            status: 'OVERDUE' as const,
        },
        select: { clientId: true },
        distinct: ['clientId'],
    });
    const overdueClientIds = new Set(allOverdueClients.map((c: { clientId: string }) => c.clientId));

    // Find previously blocked clients that no longer have overdue invoices
    const blockedClients = await prisma.client.findMany({
        where: {
            tenantId,
            isActive: false,
        },
        select: { id: true },
    });

    let unblocked = 0;
    for (const client of blockedClients) {
        if (!overdueClientIds.has(client.id)) {
            await prisma.client.update({
                where: { id: client.id },
                data: { isActive: true },
            });
            unblocked++;
        }
    }

    return `Marked ${overdueResult.count} invoices OVERDUE, blocked ${blocked} clients, unblocked ${unblocked}`;
}
