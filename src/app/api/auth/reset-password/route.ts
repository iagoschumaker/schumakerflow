import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { hashPassword } from '@/lib/auth/password';
import { z } from 'zod';
import { randomUUID } from 'crypto';

const requestSchema = z.object({
    email: z.string().email(),
});

const confirmSchema = z.object({
    token: z.string().min(1),
    newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

/**
 * POST /api/auth/reset-password
 * Body: { email } — request reset
 * Body: { token, newPassword } — confirm reset
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // If token is present → confirm reset
        if (body.token) {
            const parsed = confirmSchema.safeParse(body);
            if (!parsed.success) {
                return NextResponse.json(
                    { error: 'Invalid input', details: parsed.error.flatten() },
                    { status: 400 }
                );
            }

            const { token, newPassword } = parsed.data;
            const newHash = await hashPassword(newPassword);

            // All users are in User table now
            const user = await prisma.user.findFirst({
                where: {
                    resetToken: token,
                    resetTokenExp: { gt: new Date() },
                },
            });

            if (user) {
                await prisma.user.update({
                    where: { id: user.id },
                    data: {
                        passwordHash: newHash,
                        resetToken: null,
                        resetTokenExp: null,
                    },
                });
                return NextResponse.json({ data: { message: 'Password reset successfully' } });
            }

            return NextResponse.json(
                { error: 'Invalid or expired token' },
                { status: 400 }
            );
        }

        // Request reset
        const parsed = requestSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid input', details: parsed.error.flatten() },
                { status: 400 }
            );
        }

        const { email } = parsed.data;
        const resetToken = randomUUID();
        const resetTokenExp = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        // Single User table lookup
        const user = await prisma.user.findUnique({ where: { email } });
        if (user) {
            await prisma.user.update({
                where: { id: user.id },
                data: { resetToken, resetTokenExp },
            });
        }

        // TODO: Send email with reset link
        if (process.env.NODE_ENV === 'development') {
            console.log(`[DEV] Password reset token for ${email}: ${resetToken}`);
        }

        // Always return success to prevent email enumeration
        return NextResponse.json({
            data: { message: 'If the email exists, a reset link has been sent.' },
        });
    } catch (error) {
        console.error('Reset password error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
