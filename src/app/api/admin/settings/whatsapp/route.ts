import { NextRequest } from 'next/server';
import { withAuth, apiSuccess, apiError, ApiContext } from '@/lib/api/helpers';
import prisma from '@/lib/db';
import { checkConnection, createInstance, getQrCode, getEvolutionConfig } from '@/lib/evolution-api';

// GET /api/admin/settings/whatsapp — Get WhatsApp connection status
export const GET = withAuth(
    async (_req: NextRequest, ctx: ApiContext) => {
        const tenant = await prisma.tenant.findUnique({
            where: { id: ctx.tenantId },
            select: { evolutionInstance: true, slug: true },
        });

        if (!tenant?.evolutionInstance) {
            return apiSuccess({ configured: false, connected: false });
        }

        const config = getEvolutionConfig(tenant.evolutionInstance);
        if (!config) {
            return apiSuccess({ configured: false, connected: false, error: 'Evolution API não configurada no servidor' });
        }

        const status = await checkConnection(config);

        return apiSuccess({
            configured: true,
            connected: status.connected,
            phone: status.phone || null,
            error: status.error || null,
        });
    },
    { roles: ['SUPERADMIN', 'TENANT_ADMIN'] }
);

// PUT /api/admin/settings/whatsapp — Connect WhatsApp (one-click)
export const PUT = withAuth(
    async (_req: NextRequest, ctx: ApiContext) => {
        // Get tenant slug for auto-generating instance name
        const tenant = await prisma.tenant.findUnique({
            where: { id: ctx.tenantId },
            select: { slug: true, evolutionInstance: true },
        });

        if (!tenant) return apiError('Tenant não encontrado', 404);

        // Auto-generate instance name from tenant slug
        const instanceName = tenant.evolutionInstance || `flow-${tenant.slug}`;

        const config = getEvolutionConfig(instanceName);
        if (!config) {
            return apiError('Evolution API não configurada no servidor. Contate o suporte.', 500);
        }

        // Create instance (ignore if already exists)
        const createResult = await createInstance(config);
        if (!createResult.success) {
            return apiError(`Erro ao conectar: ${createResult.error}`, 400);
        }

        // Save instance name to tenant
        await prisma.tenant.update({
            where: { id: ctx.tenantId },
            data: { evolutionInstance: instanceName },
        });

        // Get QR code for pairing (may take a few seconds to generate)
        let qr: { qrCode?: string; pairingCode?: string; error?: string } = {};
        for (let attempt = 0; attempt < 5; attempt++) {
            await new Promise(resolve => setTimeout(resolve, 2000)); // wait 2s
            qr = await getQrCode(config);
            if (qr.qrCode) break;
        }

        // Check connection status
        const status = await checkConnection(config);

        return apiSuccess({
            configured: true,
            connected: status.connected,
            phone: status.phone || null,
            qrCode: qr.qrCode || null,
            pairingCode: qr.pairingCode || null,
        });
    },
    { roles: ['SUPERADMIN', 'TENANT_ADMIN'] }
);

// DELETE /api/admin/settings/whatsapp — Disconnect WhatsApp
export const DELETE = withAuth(
    async (_req: NextRequest, ctx: ApiContext) => {
        await prisma.tenant.update({
            where: { id: ctx.tenantId },
            data: { evolutionInstance: null },
        });
        return apiSuccess({ message: 'WhatsApp desconectado' });
    },
    { roles: ['SUPERADMIN', 'TENANT_ADMIN'] }
);
