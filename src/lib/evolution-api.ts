/**
 * Evolution API v2 — WhatsApp messaging service.
 * Each tenant stores their own Evolution API credentials.
 */

export interface EvolutionConfig {
    apiUrl: string;   // Base URL, e.g. https://evo.example.com
    apiKey: string;   // API key
    instance: string; // Instance name
}

/**
 * Normalize a Brazilian phone number to the format expected by Evolution API.
 * Ensures country code 55 prefix and removes non-digit characters.
 */
export function normalizePhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    // If already has country code
    if (digits.startsWith('55') && digits.length >= 12) return digits;
    // Add country code
    if (digits.length === 10 || digits.length === 11) return `55${digits}`;
    return digits;
}

/**
 * Send a plain text message via Evolution API v2.
 */
export async function sendText(
    config: EvolutionConfig,
    phone: string,
    message: string
): Promise<{ success: boolean; error?: string }> {
    const number = normalizePhone(phone);
    const url = `${config.apiUrl.replace(/\/$/, '')}/message/sendText/${config.instance}`;

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                apikey: config.apiKey,
            },
            body: JSON.stringify({
                number,
                text: message,
            }),
        });

        if (!res.ok) {
            const text = await res.text().catch(() => 'Unknown error');
            console.error(`Evolution API error [${res.status}]:`, text);
            return { success: false, error: `HTTP ${res.status}: ${text}` };
        }

        return { success: true };
    } catch (error: any) {
        console.error('Evolution API connection error:', error);
        return { success: false, error: error?.message || 'Connection failed' };
    }
}

/**
 * Check if the Evolution API instance is connected (has an active WhatsApp session).
 */
export async function checkConnection(
    config: EvolutionConfig
): Promise<{ connected: boolean; phone?: string; error?: string }> {
    const url = `${config.apiUrl.replace(/\/$/, '')}/instance/connectionState/${config.instance}`;

    try {
        const res = await fetch(url, {
            method: 'GET',
            headers: { apikey: config.apiKey },
        });

        if (!res.ok) {
            return { connected: false, error: `HTTP ${res.status}` };
        }

        const data = await res.json();
        const state = data?.instance?.state || data?.state;
        return {
            connected: state === 'open',
            phone: data?.instance?.owner || undefined,
        };
    } catch (error: any) {
        return { connected: false, error: error?.message || 'Connection failed' };
    }
}

/**
 * Get the QR code to connect a WhatsApp instance.
 */
export async function getQrCode(
    config: EvolutionConfig
): Promise<{ qrCode?: string; pairingCode?: string; error?: string }> {
    const url = `${config.apiUrl.replace(/\/$/, '')}/instance/connect/${config.instance}`;

    try {
        const res = await fetch(url, {
            method: 'GET',
            headers: { apikey: config.apiKey },
        });

        if (!res.ok) {
            const text = await res.text().catch(() => '');
            return { error: `HTTP ${res.status}: ${text}` };
        }

        const data = await res.json();
        return {
            qrCode: data?.base64 || data?.qrcode?.base64 || undefined,
            pairingCode: data?.pairingCode || undefined,
        };
    } catch (error: any) {
        return { error: error?.message || 'Failed to get QR code' };
    }
}

/**
 * Create a new instance on the Evolution API server.
 */
export async function createInstance(
    config: EvolutionConfig
): Promise<{ success: boolean; error?: string }> {
    const url = `${config.apiUrl.replace(/\/$/, '')}/instance/create`;

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                apikey: config.apiKey,
            },
            body: JSON.stringify({
                instanceName: config.instance,
                integration: 'WHATSAPP-BAILEYS',
                qrcode: true,
            }),
        });

        if (!res.ok) {
            const text = await res.text().catch(() => '');
            // Instance might already exist — that's fine
            if (res.status === 403 || text.includes('already')) {
                return { success: true };
            }
            return { success: false, error: `HTTP ${res.status}: ${text}` };
        }

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error?.message || 'Failed to create instance' };
    }
}
