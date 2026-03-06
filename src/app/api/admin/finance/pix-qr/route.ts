import { NextRequest, NextResponse } from 'next/server';
import { withAuth, apiError, ApiContext } from '@/lib/api/helpers';
import prisma from '@/lib/db';
import { generatePixPayload } from '@/lib/finance/pix-payload';
import QRCode from 'qrcode';

// POST /api/admin/finance/pix-qr
// Body: { amount: number, clientName: string, invoiceId?: string }
export const POST = withAuth(
    async (req: NextRequest, ctx: ApiContext) => {
        const body = await req.json();
        const { amount, clientName, invoiceId } = body;

        const tenant = await prisma.tenant.findUnique({
            where: { id: ctx.tenantId },
            select: { pixKey: true, pixKeyType: true, pixReceiverName: true },
        });

        if (!tenant?.pixKey) {
            return apiError('PIX não configurado. Vá em Configurações para cadastrar.', 400);
        }

        const txId = invoiceId
            ? invoiceId.replace(/-/g, '').substring(0, 25)
            : '***';

        const payload = generatePixPayload({
            pixKey: tenant.pixKey,
            pixKeyType: tenant.pixKeyType || 'CPF',
            receiverName: tenant.pixReceiverName || 'PAGAMENTO',
            amount: Number(amount) || 0,
            txId,
        });

        // Generate QR code as data URL
        const qrDataUrl = await QRCode.toDataURL(payload, {
            width: 400,
            margin: 2,
            color: { dark: '#000000', light: '#ffffff' },
            errorCorrectionLevel: 'M',
        });

        return NextResponse.json({
            data: {
                payload,
                qrDataUrl,
                pixKey: tenant.pixKey,
                pixKeyType: tenant.pixKeyType,
                receiverName: tenant.pixReceiverName,
                amount,
                clientName,
            },
        });
    },
    { roles: ['SUPERADMIN', 'TENANT_ADMIN'] }
);
