import prisma from '@/lib/db';
import { InvoiceStatus } from '@prisma/client';

/**
 * Check if a client is blocked due to delinquency.
 * Returns the block mode if blocked, null if not blocked.
 */
export async function checkDelinquency(
    tenantId: string,
    clientId: string
): Promise<{ isBlocked: boolean; blockMode: string; reason?: string }> {
    // Get tenant config
    const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { blockAfterDays: true, blockMode: true },
    });

    if (!tenant) {
        return { isBlocked: false, blockMode: 'BLOCK_FINAL_ONLY' };
    }

    const { blockAfterDays, blockMode } = tenant;

    // Find overdue invoices
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - blockAfterDays);

    const overdueInvoices = await prisma.invoice.findMany({
        where: {
            tenantId,
            clientId,
            status: InvoiceStatus.OVERDUE,
            dueDate: { lt: cutoffDate },
        },
        orderBy: { dueDate: 'asc' },
        take: 1,
    });

    if (overdueInvoices.length > 0) {
        const oldestOverdue = overdueInvoices[0];
        const daysOverdue = Math.floor(
            (Date.now() - new Date(oldestOverdue.dueDate).getTime()) / (1000 * 60 * 60 * 24)
        );

        return {
            isBlocked: true,
            blockMode,
            reason: `Fatura vencida há ${daysOverdue} dias (vencimento: ${oldestOverdue.dueDate.toLocaleDateString('pt-BR')})`,
        };
    }

    return { isBlocked: false, blockMode };
}

/**
 * Check if a specific file download is blocked.
 * BLOCK_FINAL_ONLY: only blocks FINAL files
 * BLOCK_ALL: blocks all file downloads
 */
export async function isDownloadBlocked(
    tenantId: string,
    clientId: string,
    fileKind: string
): Promise<{ blocked: boolean; reason?: string }> {
    const { isBlocked, blockMode, reason } = await checkDelinquency(tenantId, clientId);

    if (!isBlocked) {
        return { blocked: false };
    }

    if (blockMode === 'BLOCK_ALL') {
        return { blocked: true, reason };
    }

    // BLOCK_FINAL_ONLY
    if (fileKind === 'FINAL') {
        return { blocked: true, reason };
    }

    return { blocked: false };
}
