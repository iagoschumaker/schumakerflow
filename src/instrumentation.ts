export async function register() {
    if (process.env.NEXT_RUNTIME !== 'nodejs') return;
    if (process.env.BRIEFINGS_ENABLED !== 'true') return;

    // Fails the server boot on purpose: an admin who reveals a link, or a
    // client submitting a form, must never hit a route that silently can't
    // decrypt a token because the key was never set. Next's instrumentation
    // hook doesn't reliably kill the process on a thrown error -- it can
    // leave the server up and answering every route with a 500, which a
    // process manager reports as "online". Force the exit so it reads as
    // a crash, not a degraded-but-running process.
    try {
        const { getTokenKey } = await import('@/lib/briefings/token');
        getTokenKey();
    } catch (err) {
        console.error('[briefings] boot check failed:', err instanceof Error ? err.message : err);
        process.exit(1);
    }
}
