import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { verifyPassword } from '@/lib/auth/password';
import { createSession, setSessionCookie } from '@/lib/auth/session';
import { z } from 'zod';

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
    tenantSlug: z.string().optional(),
    // When user has multiple contexts, they pick one
    context: z.object({
        type: z.enum(['superadmin', 'tenant', 'client']),
        tenantId: z.string().optional(),
        clientId: z.string().optional(),
    }).optional(),
});

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const parsed = loginSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: 'Invalid input', details: parsed.error.flatten() },
                { status: 400 }
            );
        }

        const { email, password, tenantSlug, context } = parsed.data;

        // Find user by email (single lookup)
        const user = await prisma.user.findUnique({
            where: { email },
            include: {
                tenantMembers: {
                    include: { tenant: true },
                    where: { isActive: true },
                },
                clientAccess: {
                    include: {
                        tenant: true,
                        client: { select: { id: true, name: true } },
                    },
                    where: { isActive: true },
                },
            },
        });

        if (!user || !user.isActive) {
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
        }

        const validPassword = await verifyPassword(password, user.passwordHash);
        if (!validPassword) {
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
        }

        // Build all available contexts for this user
        const contexts: Array<{
            type: 'superadmin' | 'tenant' | 'client';
            tenantId?: string;
            tenantName?: string;
            tenantSlug?: string;
            clientId?: string;
            clientName?: string;
            role?: string;
        }> = [];

        if (user.isSuperAdmin) {
            contexts.push({ type: 'superadmin' });
        }

        for (const tm of user.tenantMembers) {
            contexts.push({
                type: 'tenant',
                tenantId: tm.tenantId,
                tenantName: tm.tenant.name,
                tenantSlug: tm.tenant.slug,
                role: tm.role,
            });
        }

        for (const ca of user.clientAccess) {
            contexts.push({
                type: 'client',
                tenantId: ca.tenantId,
                tenantName: ca.tenant.name,
                tenantSlug: ca.tenant.slug,
                clientId: ca.clientId,
                clientName: ca.client.name,
            });
        }

        if (contexts.length === 0) {
            // User exists but has no access to anything — still log them in
            // with a "no_access" role so they can see a landing page
            const token = await createSession({
                userId: user.id,
                email: user.email,
                name: user.name,
                role: 'NO_ACCESS',
            });
            await setSessionCookie(token);

            // Update last login
            await prisma.user.update({
                where: { id: user.id },
                data: { lastLoginAt: new Date() },
            });

            return NextResponse.json({
                data: {
                    userId: user.id,
                    name: user.name,
                    email: user.email,
                    role: 'NO_ACCESS',
                    noAccess: true,
                },
            });
        }

        // Determine which context to use
        let selectedContext = contexts[0];

        if (context) {
            // User explicitly picked a context
            if (context.type === 'superadmin') {
                selectedContext = contexts.find(c => c.type === 'superadmin')!;
            } else if (context.type === 'tenant' && context.tenantId) {
                selectedContext = contexts.find(c => c.type === 'tenant' && c.tenantId === context.tenantId)!;
            } else if (context.type === 'client' && context.clientId) {
                selectedContext = contexts.find(c => c.type === 'client' && c.clientId === context.clientId)!;
            }
        } else if (tenantSlug) {
            // Try to match by tenant slug
            const match = contexts.find(c => c.tenantSlug === tenantSlug);
            if (match) selectedContext = match;
        }

        // Always show context selection page if no explicit context was picked
        if (!context && !tenantSlug) {
            return NextResponse.json({
                data: {
                    requireContext: true,
                    userId: user.id,
                    name: user.name,
                    email: user.email,
                    contexts,
                },
            });
        }

        if (!selectedContext) {
            return NextResponse.json({ error: 'Invalid context selection' }, { status: 400 });
        }

        // Create session based on selected context
        const role = selectedContext.type === 'superadmin'
            ? 'SUPERADMIN'
            : selectedContext.type === 'tenant'
                ? (selectedContext.role || 'TENANT_ADMIN')
                : 'CLIENT_USER';

        const token = await createSession({
            userId: user.id,
            email: user.email,
            name: user.name,
            role,
            tenantId: selectedContext.tenantId,
            clientId: selectedContext.clientId,
        });

        await setSessionCookie(token);

        // Update last login
        await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
        });

        return NextResponse.json({
            data: {
                userId: user.id,
                name: user.name,
                email: user.email,
                role,
                tenantId: selectedContext.tenantId,
                clientId: selectedContext.clientId,
                isSuperAdmin: user.isSuperAdmin,
                contexts,
            },
        });
    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
