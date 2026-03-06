import { NextRequest, NextResponse } from 'next/server';
import { withCronAuth } from '@/lib/api/helpers';
import { runJobForAllTenants } from '@/lib/jobs/runner';
import { generateMonthlyInvoices, applyOverdueAndBlocks } from '@/lib/jobs/generate-monthly-invoices';
import { syncPixPayments } from '@/lib/jobs/sync-pix-payments';
import { sendReminders } from '@/lib/jobs/send-reminders';
import { applyOverdueBlocks } from '@/lib/jobs/apply-overdue-blocks';
import { generateVideoBilling } from '@/lib/jobs/generate-video-billing';
import { sendWhatsappReminders } from '@/lib/jobs/send-whatsapp-reminders';

/**
 * POST /api/cron/run
 * Master cron endpoint that runs all scheduled jobs.
 * Secured by CRON_SECRET.
 *
 * Query params:
 *   job=all (default) | monthly-invoices | video-billing | sync-payments | apply-overdue | send-reminders | apply-blocks | send-whatsapp-reminders
 */
export const POST = withCronAuth(async (req: NextRequest) => {
    const job = req.nextUrl.searchParams.get('job') || 'all';
    const results: Record<string, unknown> = {};

    if (job === 'all' || job === 'monthly-invoices') {
        results.monthlyInvoices = await runJobForAllTenants(
            'generate-monthly-invoices',
            generateMonthlyInvoices
        );
    }

    if (job === 'all' || job === 'video-billing') {
        results.videoBilling = await runJobForAllTenants(
            'generate-video-billing',
            generateVideoBilling
        );
    }

    if (job === 'all' || job === 'sync-payments') {
        results.syncPayments = await runJobForAllTenants(
            'sync-pix-payments',
            syncPixPayments
        );
    }

    if (job === 'all' || job === 'apply-overdue') {
        results.applyOverdue = await runJobForAllTenants(
            'apply-overdue-blocks',
            applyOverdueAndBlocks
        );
    }

    if (job === 'all' || job === 'apply-blocks') {
        results.applyBlocks = await runJobForAllTenants(
            'apply-overdue-blocks-v2',
            applyOverdueBlocks
        );
    }

    if (job === 'all' || job === 'send-reminders') {
        results.sendReminders = await runJobForAllTenants(
            'send-reminders',
            sendReminders
        );
    }

    if (job === 'all' || job === 'send-whatsapp-reminders') {
        results.sendWhatsappReminders = await runJobForAllTenants(
            'send-whatsapp-reminders',
            sendWhatsappReminders
        );
    }

    return NextResponse.json({ data: results });
});
