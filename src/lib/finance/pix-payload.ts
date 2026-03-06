/**
 * PIX BR Code (EMV) payload generator for static QR codes.
 * Based on BACEN specification for PIX payments.
 */

function tlv(id: string, value: string): string {
    const len = value.length.toString().padStart(2, '0');
    return `${id}${len}${value}`;
}

function crc16(payload: string): string {
    const polynomial = 0x1021;
    let result = 0xFFFF;
    const bytes = Buffer.from(payload, 'utf-8');

    for (let i = 0; i < bytes.length; i++) {
        result ^= bytes[i] << 8;
        for (let j = 0; j < 8; j++) {
            if (result & 0x8000) {
                result = (result << 1) ^ polynomial;
            } else {
                result <<= 1;
            }
            result &= 0xFFFF;
        }
    }

    return result.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Generate a PIX BR Code payload string (Copia e Cola).
 */
export function generatePixPayload(options: {
    pixKey: string;
    pixKeyType: string;
    receiverName: string;
    city?: string;
    amount?: number;
    txId?: string;
    description?: string;
}): string {
    const { pixKey, receiverName, city = 'SAO PAULO', amount, txId = '***' } = options;

    // Remove accents and special chars, uppercase, max lengths
    const cleanName = receiverName
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toUpperCase().substring(0, 25);
    const cleanCity = city
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toUpperCase().substring(0, 15);

    // Merchant Account Information (ID 26)
    const gui = tlv('00', 'BR.GOV.BCB.PIX');
    const key = tlv('01', pixKey);
    const merchantAccount = tlv('26', gui + key);

    let payload = '';
    payload += tlv('00', '01');           // Payload Format Indicator
    payload += tlv('01', '12');           // Point of Initiation: 12 = static
    payload += merchantAccount;            // Merchant Account
    payload += tlv('52', '0000');          // MCC (not applicable)
    payload += tlv('53', '986');           // Currency: BRL

    if (amount && amount > 0) {
        payload += tlv('54', amount.toFixed(2));  // Transaction Amount
    }

    payload += tlv('58', 'BR');            // Country Code
    payload += tlv('59', cleanName);       // Merchant Name
    payload += tlv('60', cleanCity);       // Merchant City

    // Additional data (txId)
    const additionalData = tlv('05', txId);
    payload += tlv('62', additionalData);

    // CRC placeholder + calculate
    payload += '6304';
    const crc = crc16(payload);
    payload += crc;

    return payload;
}
