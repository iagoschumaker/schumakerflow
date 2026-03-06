import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import prisma from '@/lib/db';
import { z } from 'zod';

const schema = z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8, 'A nova senha deve ter no mínimo 8 caracteres'),
});

/**
 * POST /api/auth/change-password
 * Works for all user types — unified User table
 */
export async function POST(req: NextRequest) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid input' }, { status: 400 });
    }

    const { currentPassword, newPassword } = parsed.data;

    try {
        // All users are in the same User table now
        const user = await prisma.user.findUnique({
            where: { id: session.userId },
            select: { passwordHash: true },
        });
        if (!user) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });

        const valid = await verifyPassword(currentPassword, user.passwordHash);
        if (!valid) return NextResponse.json({ error: 'Senha atual incorreta' }, { status: 400 });

        const newHash = await hashPassword(newPassword);
        await prisma.user.update({
            where: { id: session.userId },
            data: { passwordHash: newHash },
        });

        return NextResponse.json({ data: { message: 'Senha alterada com sucesso' } });
    } catch (error) {
        console.error('Change password error:', error);
        return NextResponse.json({ error: 'Erro ao alterar senha' }, { status: 500 });
    }
}
