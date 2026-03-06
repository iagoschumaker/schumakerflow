import prisma from '@/lib/db';
import { JobStatus } from '@prisma/client';

interface JobRunOptions {
    jobName: string;
    tenantId?: string;
    idempotencyKey?: string;
    handler: () => Promise<string | void>;
}

/**
 * Run a job with idempotency, retry, and logging.
 */
export async function runJob(options: JobRunOptions): Promise<{
    status: JobStatus;
    details?: string;
    error?: string;
}> {
    const { jobName, tenantId, idempotencyKey, handler } = options;

    // Check idempotency
    if (idempotencyKey) {
        const existing = await prisma.jobRun.findUnique({
            where: { idempotencyKey },
        });
        if (existing && existing.status === 'SUCCESS') {
            return { status: 'SKIPPED', details: 'Already executed (idempotent)' };
        }
    }

    // Create job run record
    const jobRun = await prisma.jobRun.create({
        data: {
            jobName,
            tenantId,
            status: 'RUNNING',
            idempotencyKey,
        },
    });

    try {
        const details = await handler();

        // Mark success
        await prisma.jobRun.update({
            where: { id: jobRun.id },
            data: {
                status: 'SUCCESS',
                finishedAt: new Date(),
                details: details || 'Completed successfully',
            },
        });

        return { status: 'SUCCESS', details: details || undefined };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Mark failed
        await prisma.jobRun.update({
            where: { id: jobRun.id },
            data: {
                status: 'FAILED',
                finishedAt: new Date(),
                error: errorMessage,
            },
        });

        console.error(`Job ${jobName} failed:`, error);
        return { status: 'FAILED', error: errorMessage };
    }
}

/**
 * Run a job for each active tenant.
 */
export async function runJobForAllTenants(
    jobName: string,
    handler: (tenantId: string) => Promise<string | void>
): Promise<{ total: number; success: number; failed: number }> {
    const tenants = await prisma.tenant.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true },
    });

    let success = 0;
    let failed = 0;

    for (const tenant of tenants) {
        const result = await runJob({
            jobName,
            tenantId: tenant.id,
            idempotencyKey: `${jobName}_${tenant.id}_${new Date().toISOString().slice(0, 10)}`,
            handler: () => handler(tenant.id),
        });

        if (result.status === 'SUCCESS' || result.status === 'SKIPPED') {
            success++;
        } else {
            failed++;
        }
    }

    return { total: tenants.length, success, failed };
}
