import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';

export async function GET(_request: NextRequest) {
    const session = await getSession();
    if (!session) {
        return NextResponse.json({ data: null }, { status: 401 });
    }

    return NextResponse.json({
        data: {
            userId: session.userId,
            email: session.email,
            name: session.name,
            role: session.role,
            tenantId: session.tenantId,
            clientId: session.clientId,
        },
    });
}
