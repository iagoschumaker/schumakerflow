import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/db';
import { isBriefingsEnabled } from '@/lib/briefings/flag';
import { hashToken as computeTokenLookup, hashIp } from '@/lib/briefings/token';
import { checkAutosaveRateLimit, checkIpRateLimit } from '@/lib/briefings/rate-limit';
import { isValidFieldValue } from '@/lib/briefings/validate';

const bodySchema = z.object({
    answers: z.array(
        z.object({
            fieldId: z.string().uuid(),
            groupIndex: z.number().int().min(0).default(0),
            value: z.object({ raw: z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(z.string())]) }),
        })
    ).max(200),
});

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
    if (!checkAutosaveRateLimit(tokenLookup)) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

    const link = await prisma.briefingLink.findUnique({
        where: { tokenLookup },
        include: {
            cycle: {
                include: {
                    template: {
                        include: { sections: { include: { fields: true } } },
                    },
                },
            },
        },
    });

    if (!link) {
        return NextResponse.json({ error: 'Invalid link' }, { status: 404 });
    }
    if (link.cycle.status === 'submitted' || link.cycle.status === 'archived') {
        return NextResponse.json({ error: 'Cycle is closed' }, { status: 409 });
    }
    if (link.revokedAt || link.expiresAt < new Date()) {
        return NextResponse.json({ error: 'Invalid link' }, { status: 404 });
    }

    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });

    const fieldById = new Map(
        link.cycle.template.sections.flatMap((s) => s.fields.map((f) => [f.id, f] as const))
    );

    for (const answer of parsed.data.answers) {
        const field = fieldById.get(answer.fieldId);
        if (!field) {
            await prisma.briefingEvent.create({
                data: {
                    cycleId: link.cycleId,
                    type: 'autosave_rejected',
                    meta: { reason: 'unknown_field', fieldId: answer.fieldId },
                },
            });
            return NextResponse.json({ error: 'Unknown field' }, { status: 400 });
        }
        if (!isValidFieldValue(field.type, answer.value.raw)) {
            return NextResponse.json({ error: `Invalid value for field ${field.key}` }, { status: 400 });
        }
    }

    await prisma.$transaction(
        parsed.data.answers.map((a) =>
            prisma.briefingAnswer.upsert({
                where: {
                    cycleId_fieldId_groupIndex: {
                        cycleId: link.cycleId,
                        fieldId: a.fieldId,
                        groupIndex: a.groupIndex,
                    },
                },
                update: { value: a.value },
                create: {
                    cycleId: link.cycleId,
                    fieldId: a.fieldId,
                    groupIndex: a.groupIndex,
                    value: a.value,
                },
            })
        )
    );

    await prisma.briefingEvent.create({ data: { cycleId: link.cycleId, type: 'autosaved' } });

    return NextResponse.json({ savedAt: new Date().toISOString() });
}
