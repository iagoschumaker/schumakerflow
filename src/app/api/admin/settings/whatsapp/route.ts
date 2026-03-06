import { NextRequest } from 'next/server';
import { withAuth, apiSuccess, apiError, ApiContext } from '@/lib/api/helpers';
import prisma from '@/lib/db';
import { z } from 'zod';
import { checkConnection, createInstance, getQrCode, EvolutionConfig } from '@/lib/evolution-api';

const whatsappSchema = z.object({
    evolutionApiUrl: z.string().url().min(1),
    evolutionApiKey: z.string().min(1),
    evolutionInstance: z.string().min(1),
});

// GET /api/admin/settings/whatsapp — Get WhatsApp config + connection status
export const GET = withAuth(
    async (_req: NextRequest, ctx: ApiContext) => {
        const tenant = await prisma.tenant.findUnique({
            where: { id: ctx.tenantId },
            select: {
                evolutionApiUrl: true,
                evolutionApiKey: true,
                evolutionInstance: true,
            },
        });

        if (!tenant?.evolutionApiUrl || !tenant?.evolutionApiKey || !tenant?.evolutionInstance) {
            return apiSuccess({ configured: false, connected: false });
        }

        const config: EvolutionConfig = {
            apiUrl: tenant.evolutionApiUrl,
            apiKey: tenant.evolutionApiKey,
            instance: tenant.evolutionInstance,
        };

        const status = await checkConnection(config);

        return apiSuccess({
            configured: true,
            connected: status.connected,
            phone: status.phone || null,
            apiUrl: tenant.evolutionApiUrl,
            instance: tenant.evolutionInstance,
            error: status.error || null,
        });
    },
    { roles: ['SUPERADMIN', 'TENANT_ADMIN'] }
);

// PUT /api/admin/settings/whatsapp — Save WhatsApp config + create instance
export const PUT = withAuth(
    async (req: NextRequest, ctx: ApiContext) => {
        const body = await req.json();
        const parsed = whatsappSchema.safeParse(body);
        if (!parsed.success) return apiError('Dados inválidos', 400);

        const { evolutionApiUrl, evolutionApiKey, evolutionInstance } = parsed.data;

        const config: EvolutionConfig = {
            apiUrl: evolutionApiUrl,
            apiKey: evolutionApiKey,
            instance: evolutionInstance,
        };

        // Try to create instance (ignore if already exists)
        const createResult = await createInstance(config);
        if (!createResult.success) {
            return apiError(`Erro ao conectar: ${createResult.error}`, 400);
        }

        // Save to tenant
        await prisma.tenant.update({
            where: { id: ctx.tenantId },
            data: { evolutionApiUrl, evolutionApiKey, evolutionInstance },
        });

        // Get QR code for pairing
        const qr = await getQrCode(config);

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

// DELETE /api/admin/settings/whatsapp — Remove WhatsApp config
export const DELETE = withAuth(
    async (_req: NextRequest, ctx: ApiContext) => {
        await prisma.tenant.update({
            where: { id: ctx.tenantId },
            data: {
                evolutionApiUrl: null,
                evolutionApiKey: null,
                evolutionInstance: null,
            },
        });
        return apiSuccess({ message: 'WhatsApp desconectado' });
    },
    { roles: ['SUPERADMIN', 'TENANT_ADMIN'] }
);
