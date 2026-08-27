// In-memory rate limiter — single VPS process, no Redis. Resets on deploy/restart.

interface Bucket {
    count: number;
    resetAt: number;
}

const buckets = new Map<string, Bucket>();

function check(key: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || now > bucket.resetAt) {
        buckets.set(key, { count: 1, resetAt: now + windowMs });
        return true;
    }

    if (bucket.count >= limit) return false;

    bucket.count++;
    return true;
}

export function checkAutosaveRateLimit(tokenHash: string): boolean {
    return check(`autosave:${tokenHash}`, 60, 60_000);
}

export function checkSubmitRateLimit(tokenHash: string): boolean {
    return check(`submit:${tokenHash}`, 5, 60 * 60_000);
}

export function checkIpRateLimit(ipHash: string): boolean {
    return check(`ip:${ipHash}`, 300, 60 * 60_000);
}
