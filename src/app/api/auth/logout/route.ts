import { NextResponse } from 'next/server';
import { clearSession } from '@/lib/auth/session';

export async function POST() {
    await clearSession();
    return NextResponse.json({ data: { message: 'Logged out successfully' } });
}
