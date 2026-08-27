import prisma from '@/lib/db';

// Plug nodemailer here once SMTP is configured for real (SMTP_* env vars already exist).
export async function notifyBriefingSubmitted(cycleId: string): Promise<void> {
    await prisma.briefingEvent.create({
        data: { cycleId, type: 'submitted' },
    });
}
