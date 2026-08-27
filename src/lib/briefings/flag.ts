import { notFound } from 'next/navigation';

export function isBriefingsEnabled(): boolean {
    return process.env.BRIEFINGS_ENABLED === 'true';
}

export function assertBriefingsEnabled(): void {
    if (!isBriefingsEnabled()) notFound();
}
