import { randomBytes, createHash, createCipheriv, createDecipheriv } from 'crypto';

const IV_LENGTH = 12; // 96-bit, recommended for GCM
const AUTH_TAG_LENGTH = 16;

let cachedKey: Buffer | null = null;

export function getTokenKey(): Buffer {
    if (cachedKey) return cachedKey;

    const b64 = process.env.BRIEFINGS_TOKEN_KEY;
    if (!b64) {
        throw new Error(
            'BRIEFINGS_TOKEN_KEY não configurada. O módulo Briefings não pode operar sem uma chave de criptografia (32 bytes, base64) para os links. Gere com: openssl rand -base64 32'
        );
    }

    const key = Buffer.from(b64, 'base64');
    if (key.length !== 32) {
        throw new Error(
            `BRIEFINGS_TOKEN_KEY inválida: decodificou para ${key.length} bytes, precisa ser exatamente 32 (AES-256). Gere com: openssl rand -base64 32`
        );
    }

    cachedKey = key;
    return key;
}

export function encryptToken(token: string): string {
    const key = getTokenKey();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, ciphertext]).toString('base64');
}

export function decryptToken(tokenEnc: string): string {
    const key = getTokenKey();
    const buf = Buffer.from(tokenEnc, 'base64');
    const iv = buf.subarray(0, IV_LENGTH);
    const authTag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const ciphertext = buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

export function hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
}

export function generateToken(): { token: string; tokenEnc: string; tokenLookup: string; preview: string } {
    const token = randomBytes(32).toString('base64url');
    return { token, tokenEnc: encryptToken(token), tokenLookup: hashToken(token), preview: token.slice(-6) };
}

export function hashIp(ip: string): string {
    const salt = process.env.JWT_SECRET || 'briefings_ip_salt';
    return createHash('sha256').update(ip + salt).digest('hex');
}
