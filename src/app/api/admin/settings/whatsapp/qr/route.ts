import { NextRequest } from 'next/server';
import { withAuth, apiSuccess, apiError, ApiContext } from '@/lib/api/helpers';
import prisma from '@/lib/db';
import { getQrCode, checkConnection, EvolutionConfig } from '@/lib/evolution-api';

// GET /api/admin/settings/whatsapp/qr — Get fresh QR code for WhatsApp pairing
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
            return apiError('WhatsApp não configurado', 400);
        }

        const config: EvolutionConfig = {
            apiUrl: tenant.evolutionApiUrl,
            apiKey: tenant.evolutionApiKey,
            instance: tenant.evolutionInstance,
        };

        // Check if already connected
        const status = await checkConnection(config);
        if (status.connected) {
            return apiSuccess({ connected: true, phone: status.phone });
        }

        // Get fresh QR
        const qr = await getQrCode(config);

        return apiSuccess({
            connected: false,
            qrCode: qr.qrCode || null,
            pairingCode: qr.pairingCode || null,
            error: qr.error || null,
        });
    },
    { roles: ['SUPERADMIN', 'TENANT_ADMIN'] }
);
