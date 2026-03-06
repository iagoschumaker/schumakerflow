/**
 * Mercado Pago PIX Integration
 * Creates PIX charges and checks payment status.
 */

interface PixChargeRequest {
    amount: number;
    description: string;
    externalReference: string;
    payerEmail?: string;
    payerName?: string;
}

interface PixChargeResponse {
    transactionId: string;
    qrCodeBase64: string;
    pixPayload: string; // copia e cola
    status: string;
    externalReference: string;
}

interface PixStatusResponse {
    transactionId: string;
    status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'refunded';
    paidAmount?: number;
    paidAt?: string;
}

/**
 * Check if Mercado Pago is configured.
 */
export function isMercadoPagoConfigured(): boolean {
    return !!process.env.MERCADO_PAGO_ACCESS_TOKEN;
}

/**
 * Create a PIX charge via Mercado Pago API.
 */
export async function createPixCharge(
    request: PixChargeRequest,
    accessToken?: string
): Promise<PixChargeResponse> {
    const token = accessToken || process.env.MERCADO_PAGO_ACCESS_TOKEN;

    if (!token) {
        // Return mock data for development
        console.log('[DEV] Mock PIX charge created:', request);
        return {
            transactionId: `mock_tx_${Date.now()}`,
            qrCodeBase64: generateMockQRCode(),
            pixPayload: `00020126580014br.gov.bcb.pix0136mock-${request.externalReference}`,
            status: 'pending',
            externalReference: request.externalReference,
        };
    }

    const response = await fetch('https://api.mercadopago.com/v1/payments', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            'X-Idempotency-Key': request.externalReference,
        },
        body: JSON.stringify({
            transaction_amount: request.amount,
            description: request.description,
            payment_method_id: 'pix',
            payer: {
                email: request.payerEmail || 'not-provided@example.com',
                first_name: request.payerName || 'Cliente',
            },
            external_reference: request.externalReference,
        }),
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Mercado Pago API error: ${response.status} - ${errorBody}`);
    }

    const data = await response.json();

    return {
        transactionId: String(data.id),
        qrCodeBase64: data.point_of_interaction?.transaction_data?.qr_code_base64 || '',
        pixPayload: data.point_of_interaction?.transaction_data?.qr_code || '',
        status: data.status,
        externalReference: data.external_reference,
    };
}

/**
 * Check the status of a PIX payment.
 */
export async function checkPixPaymentStatus(
    transactionId: string,
    accessToken?: string
): Promise<PixStatusResponse> {
    const token = accessToken || process.env.MERCADO_PAGO_ACCESS_TOKEN;

    if (!token) {
        console.log('[DEV] Mock PIX status check:', transactionId);
        return {
            transactionId,
            status: 'pending',
        };
    }

    const response = await fetch(
        `https://api.mercadopago.com/v1/payments/${transactionId}`,
        {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        }
    );

    if (!response.ok) {
        throw new Error(`Mercado Pago API error: ${response.status}`);
    }

    const data = await response.json();

    return {
        transactionId: String(data.id),
        status: data.status,
        paidAmount: data.transaction_amount,
        paidAt: data.date_approved,
    };
}

/**
 * Search payments by external reference.
 */
export async function searchPaymentsByReference(
    externalReference: string,
    accessToken?: string
): Promise<PixStatusResponse[]> {
    const token = accessToken || process.env.MERCADO_PAGO_ACCESS_TOKEN;

    if (!token) {
        return [];
    }

    const response = await fetch(
        `https://api.mercadopago.com/v1/payments/search?external_reference=${externalReference}`,
        {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        }
    );

    if (!response.ok) {
        throw new Error(`Mercado Pago search error: ${response.status}`);
    }

    const data = await response.json();

    return (data.results || []).map((p: Record<string, unknown>) => ({
        transactionId: String(p.id),
        status: p.status as string,
        paidAmount: p.transaction_amount as number,
        paidAt: p.date_approved as string | undefined,
    }));
}

/**
 * Generate a mock QR code base64 for development.
 */
function generateMockQRCode(): string {
    // Simple placeholder - a tiny transparent PNG in base64
    return 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
}
