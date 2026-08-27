import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { isBriefingsEnabled } from '@/lib/briefings/flag';
import { hashToken as computeTokenLookup, hashIp } from '@/lib/briefings/token';
import { checkSubmitRateLimit, checkIpRateLimit } from '@/lib/briefings/rate-limit';
import { hasValue } from '@/lib/briefings/validate';
import { notifyBriefingSubmitted } from '@/lib/briefings/notify';

function getClientIp(req: NextRequest): string {
    return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        || req.headers.get('x-real-ip')
        || 'unknown';
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
    if (!isBriefingsEnabled()) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { token } = await params;
    const tokenLookup = computeTokenLookup(token);
    const ipHash = hashIp(getClientIp(req));

    if (!checkIpRateLimit(ipHash)) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    if (!checkSubmitRateLimit(tokenLookup)) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

    const link = await prisma.briefingLink.findUnique({
        where: { tokenLookup },
        include: {
            cycle: {
                include: {
                    template: {
                        include: { sections: { include: { fields: true }, orderBy: { sortOrder: 'asc' } } },
                    },
                    answers: true,
                },
            },
        },
    });

    if (!link) {
        return NextResponse.json({ error: 'Invalid link' }, { status: 404 });
    }
    if (link.cycle.status === 'submitted') {
        return NextResponse.json({ error: 'Already submitted' }, { status: 409 });
    }
    if (link.revokedAt || link.expiresAt < new Date()) {
        return NextResponse.json({ error: 'Invalid link' }, { status: 404 });
    }
    if (link.cycle.status === 'archived') {
        return NextResponse.json({ error: 'Cycle is closed' }, { status: 409 });
    }

    const answeredKeys = new Set(
        link.cycle.answers.filter((a) => hasValue(a.value)).map((a) => `${a.fieldId}:${a.groupIndex}`)
    );
    const groupsBySection = new Map<string, Set<number>>();
    for (const a of link.cycle.answers) {
        const field = link.cycle.template.sections
            .flatMap((s) => s.fields.map((f) => ({ sectionId: s.id, fieldId: f.id })))
            .find((f) => f.fieldId === a.fieldId);
        if (!field) continue;
        if (!groupsBySection.has(field.sectionId)) groupsBySection.set(field.sectionId, new Set());
        groupsBySection.get(field.sectionId)!.add(a.groupIndex);
    }

    const missing: { fieldId: string; label: string; sectionTitle: string }[] = [];

    for (const section of link.cycle.template.sections) {
        if (section.kind === 'single') {
            for (const field of section.fields) {
                if (!field.isRequired || !field.isActive) continue;
                if (!answeredKeys.has(`${field.id}:0`)) {
                    missing.push({ fieldId: field.id, label: field.label, sectionTitle: section.title });
                }
            }
        } else {
            const groups = groupsBySection.get(section.id);
            if (!groups || groups.size === 0) continue; // no items started -- nothing to validate
            for (const groupIndex of groups) {
                for (const field of section.fields) {
                    if (!field.isRequired || !field.isActive) continue;
                    if (!answeredKeys.has(`${field.id}:${groupIndex}`)) {
                        missing.push({ fieldId: field.id, label: field.label, sectionTitle: section.title });
                    }
                }
            }
        }
    }

    if (missing.length > 0) {
        return NextResponse.json({ missing }, { status: 422 });
    }

    await prisma.$transaction([
        prisma.briefingCycle.update({
            where: { id: link.cycleId },
            data: { status: 'submitted', submittedAt: new Date(), archivedAt: new Date() },
        }),
        prisma.briefingLink.updateMany({
            where: { cycleId: link.cycleId, revokedAt: null },
            data: { revokedAt: new Date() },
        }),
        prisma.briefingEvent.create({ data: { cycleId: link.cycleId, type: 'archived', meta: { reason: 'auto_on_submit' } } }),
    ]);
    await notifyBriefingSubmitted(link.cycleId);

    return NextResponse.json({ ok: true });
}
