import { NextRequest, NextResponse } from 'next/server';
import { webhookHandler } from '@/lib/finance/webhook-handler';

/**
 * POST /api/webhooks/mercadopago
 * Receives payment notifications from Mercado Pago.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // Mercado Pago sends notifications with type and data.id
        if (body.type === 'payment' && body.data?.id) {
            await webhookHandler(String(body.data.id));
        }

        return NextResponse.json({ status: 'ok' });
    } catch (error) {
        console.error('Webhook error:', error);
        return NextResponse.json({ status: 'error' }, { status: 500 });
    }
}
