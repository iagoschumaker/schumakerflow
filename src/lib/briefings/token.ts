import { randomBytes, createHash } from 'crypto';

export function generateToken(): { token: string; hash: string; preview: string } {
    const token = randomBytes(32).toString('base64url');
    return { token, hash: hashToken(token), preview: token.slice(-6) };
}

export function hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
}

export function hashIp(ip: string): string {
    const salt = process.env.JWT_SECRET || 'briefings_ip_salt';
    return createHash('sha256').update(ip + salt).digest('hex');
}
