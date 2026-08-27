import { NextRequest, NextResponse } from 'next/server';
import { withAuth, apiSuccess, apiError, ApiContext } from '@/lib/api/helpers';
import { isBriefingsEnabled } from '@/lib/briefings/flag';
import { generateToken, decryptToken } from '@/lib/briefings/token';
import { buildBriefingExport } from '@/lib/briefings/export';
import prisma from '@/lib/db';
import { z } from 'zod';
import { Prisma } from '@prisma/client';

const listSchema = z.object({
    action: z.literal('list'),
    clientId: z.string().uuid().optional(),
    status: z.enum(['draft', 'sent', 'in_progress', 'submitted']).optional(),
    referenceMonth: z.string().optional(),
    showArchived: z.boolean().optional(),
    page: z.number().int().positive().optional(),
});

const getSchema = z.object({
    action: z.literal('get'),
    id: z.string().uuid(),
});

const createSchema = z.object({
    action: z.literal('create'),
    clientId: z.string().uuid(),
    templateId: z.string().uuid(),
    referenceMonth: z.string().regex(/^\d{4}-\d{2}$/),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const idSchema = z.object({ id: z.string().uuid() });

const updateSchema = z.object({
    action: z.literal('update'),
    id: z.string().uuid(),
    referenceMonth: z.string().regex(/^\d{4}-\d{2}$/).optional(),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

const exportSchema = z.object({
    action: z.literal('export'),
    id: z.string().uuid(),
    format: z.enum(['text', 'json']),
});

function monthStartUtc(yyyyMm: string): Date {
    const [y, m] = yyyyMm.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, 1));
}

export const POST = withAuth(
    async (req: NextRequest, ctx: ApiContext) => {
        if (!isBriefingsEnabled()) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        const body = await req.json();

        if (body.action === 'list') {
            const parsed = listSchema.safeParse(body);
            if (!parsed.success) return apiError('Invalid input', 400);

            const pageSize = 20;
            const page = parsed.data.page || 1;

            const where: Record<string, unknown> = { tenantId: ctx.tenantId };
            if (parsed.data.clientId) where.clientId = parsed.data.clientId;
            if (parsed.data.status) where.status = parsed.data.status;
            if (parsed.data.referenceMonth) where.referenceMonth = monthStartUtc(parsed.data.referenceMonth);
            if (!parsed.data.showArchived) where.archivedAt = null;

            const [cycles, total] = await Promise.all([
                prisma.briefingCycle.findMany({
                    where,
                    include: {
                        client: { select: { id: true, name: true } },
                        template: { select: { id: true, name: true } },
                        links: { where: { revokedAt: null }, select: { id: true } },
                        _count: { select: { answers: true } },
                        answers: { orderBy: { updatedAt: 'desc' }, take: 1, select: { updatedAt: true } },
                        events: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
                    },
                    orderBy: [{ referenceMonth: 'desc' }, { client: { name: 'asc' } }],
                    skip: (page - 1) * pageSize,
                    take: pageSize,
                }),
                prisma.briefingCycle.count({ where }),
            ]);

            return apiSuccess({ cycles, total, page, pageSize });
        }

        if (body.action === 'get') {
            const parsed = getSchema.safeParse(body);
            if (!parsed.success) return apiError('Invalid input', 400);

            const cycle = await prisma.briefingCycle.findFirst({
                where: { id: parsed.data.id, tenantId: ctx.tenantId },
                include: {
                    client: { select: { id: true, name: true } },
                    template: { include: { sections: { include: { fields: true }, orderBy: { sortOrder: 'asc' } } } },
                    answers: true,
                    events: { orderBy: { createdAt: 'desc' } },
                    links: {
                        select: { id: true, tokenPreview: true, expiresAt: true, revokedAt: true, opensCount: true, lastOpenedAt: true },
                    },
                },
            });
            if (!cycle) return apiError('Cycle not found', 404);

            return apiSuccess(cycle);
        }

        if (body.action === 'create') {
            const parsed = createSchema.safeParse(body);
            if (!parsed.success) return apiError('Invalid input', 400);

            const client = await prisma.client.findFirst({
                where: { id: parsed.data.clientId, tenantId: ctx.tenantId },
            });
            if (!client) return apiError('Client not found', 404);

            const template = await prisma.briefingTemplate.findFirst({
                where: { id: parsed.data.templateId, tenantId: ctx.tenantId },
            });
            if (!template) return apiError('Template not found', 404);

            const referenceMonth = monthStartUtc(parsed.data.referenceMonth);
            const dueDate = parsed.data.dueDate ? new Date(`${parsed.data.dueDate}T00:00:00.000Z`) : null;

            const { token, tokenEnc, tokenLookup, preview } = generateToken();
            const expiresAt = dueDate
                ? new Date(dueDate.getTime() + 15 * 24 * 60 * 60 * 1000)
                : new Date(Date.now() + 45 * 24 * 60 * 60 * 1000);

            try {
                const cycle = await prisma.briefingCycle.create({
                    data: {
                        tenantId: ctx.tenantId,
                        clientId: parsed.data.clientId,
                        templateId: parsed.data.templateId,
                        referenceMonth,
                        dueDate,
                        status: 'sent',
                        createdBy: ctx.session.userId,
                        links: { create: { tokenEnc, tokenLookup, tokenPreview: preview, expiresAt } },
                        events: { create: { type: 'link_created' } },
                    },
                    include: { client: { select: { name: true } }, template: { select: { name: true } } },
                });

                return apiSuccess({ cycle, token }, 201);
            } catch (e) {
                if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
                    return apiError('Já existe um briefing deste modelo para este cliente neste mês.', 409);
                }
                throw e;
            }
        }

        if (body.action === 'update') {
            const parsed = updateSchema.safeParse(body);
            if (!parsed.success) return apiError('Invalid input', 400);
            if (parsed.data.referenceMonth === undefined && parsed.data.dueDate === undefined) {
                return apiError('Nothing to update', 400);
            }

            const cycle = await prisma.briefingCycle.findFirst({ where: { id: parsed.data.id, tenantId: ctx.tenantId } });
            if (!cycle) return apiError('Cycle not found', 404);

            const data: Prisma.BriefingCycleUpdateInput = {};
            if (parsed.data.referenceMonth) data.referenceMonth = monthStartUtc(parsed.data.referenceMonth);
            if (parsed.data.dueDate !== undefined) {
                data.dueDate = parsed.data.dueDate ? new Date(`${parsed.data.dueDate}T00:00:00.000Z`) : null;
            }

            try {
                await prisma.$transaction([
                    prisma.briefingCycle.update({ where: { id: cycle.id }, data }),
                    prisma.briefingEvent.create({
                        data: { cycleId: cycle.id, type: 'edited', meta: { referenceMonth: parsed.data.referenceMonth, dueDate: parsed.data.dueDate } },
                    }),
                ]);
            } catch (e) {
                if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
                    return apiError('Já existe um briefing deste modelo para este cliente neste mês.', 409);
                }
                throw e;
            }

            return apiSuccess({ ok: true });
        }

        if (body.action === 'delete') {
            const parsed = idSchema.safeParse(body);
            if (!parsed.success) return apiError('Invalid input', 400);

            const cycle = await prisma.briefingCycle.findFirst({ where: { id: parsed.data.id, tenantId: ctx.tenantId } });
            if (!cycle) return apiError('Cycle not found', 404);

            // The cycle's own event log (briefing_events) dies with it, so the
            // deletion itself is recorded in the tenant-wide audit log instead --
            // same convention as Client/Project hard-delete.
            await prisma.auditLog.create({
                data: {
                    tenantId: ctx.tenantId,
                    userId: ctx.session.userId,
                    action: 'briefingCycle.delete',
                    entityType: 'BriefingCycle',
                    entityId: cycle.id,
                    details: JSON.stringify({ clientId: cycle.clientId, templateId: cycle.templateId, referenceMonth: cycle.referenceMonth, status: cycle.status }),
                },
            });
            await prisma.briefingCycle.delete({ where: { id: cycle.id } });

            return apiSuccess({ ok: true });
        }

        if (body.action === 'regenerateLink') {
            const parsed = idSchema.safeParse(body);
            if (!parsed.success) return apiError('Invalid input', 400);

            const cycle = await prisma.briefingCycle.findFirst({ where: { id: parsed.data.id, tenantId: ctx.tenantId } });
            if (!cycle) return apiError('Cycle not found', 404);

            const { token, tokenEnc, tokenLookup, preview } = generateToken();
            const expiresAt = cycle.dueDate
                ? new Date(cycle.dueDate.getTime() + 15 * 24 * 60 * 60 * 1000)
                : new Date(Date.now() + 45 * 24 * 60 * 60 * 1000);

            await prisma.$transaction([
                prisma.briefingLink.updateMany({
                    where: { cycleId: cycle.id, revokedAt: null },
                    data: { revokedAt: new Date() },
                }),
                prisma.briefingLink.create({
                    data: { cycleId: cycle.id, tokenEnc, tokenLookup, tokenPreview: preview, expiresAt },
                }),
                prisma.briefingEvent.create({ data: { cycleId: cycle.id, type: 'link_created' } }),
            ]);

            return apiSuccess({ token });
        }

        if (body.action === 'revealLink') {
            const parsed = idSchema.safeParse(body);
            if (!parsed.success) return apiError('Invalid input', 400);

            const cycle = await prisma.briefingCycle.findFirst({ where: { id: parsed.data.id, tenantId: ctx.tenantId } });
            if (!cycle) return apiError('Cycle not found', 404);

            const link = await prisma.briefingLink.findFirst({
                where: { cycleId: cycle.id, revokedAt: null },
                orderBy: { expiresAt: 'desc' },
            });
            if (!link) return apiError('No active link', 404);

            const token = decryptToken(link.tokenEnc);
            await prisma.briefingEvent.create({ data: { cycleId: cycle.id, type: 'link_revealed' } });

            return apiSuccess({ token });
        }

        if (body.action === 'revokeLink') {
            const parsed = idSchema.safeParse(body);
            if (!parsed.success) return apiError('Invalid input', 400);

            const cycle = await prisma.briefingCycle.findFirst({ where: { id: parsed.data.id, tenantId: ctx.tenantId } });
            if (!cycle) return apiError('Cycle not found', 404);

            await prisma.$transaction([
                prisma.briefingLink.updateMany({
                    where: { cycleId: cycle.id, revokedAt: null },
                    data: { revokedAt: new Date() },
                }),
                prisma.briefingEvent.create({ data: { cycleId: cycle.id, type: 'link_revoked' } }),
            ]);

            return apiSuccess({ ok: true });
        }

        if (body.action === 'reopen') {
            const parsed = idSchema.safeParse(body);
            if (!parsed.success) return apiError('Invalid input', 400);

            const cycle = await prisma.briefingCycle.findFirst({ where: { id: parsed.data.id, tenantId: ctx.tenantId } });
            if (!cycle) return apiError('Cycle not found', 404);
            if (cycle.status !== 'submitted') return apiError('Only submitted cycles can be reopened', 409);

            await prisma.$transaction([
                prisma.briefingCycle.update({ where: { id: cycle.id }, data: { status: 'in_progress', archivedAt: null } }),
                prisma.briefingEvent.create({ data: { cycleId: cycle.id, type: 'reopened' } }),
            ]);

            return apiSuccess({ ok: true });
        }

        if (body.action === 'archive') {
            const parsed = idSchema.safeParse(body);
            if (!parsed.success) return apiError('Invalid input', 400);

            const cycle = await prisma.briefingCycle.findFirst({ where: { id: parsed.data.id, tenantId: ctx.tenantId } });
            if (!cycle) return apiError('Cycle not found', 404);

            await prisma.$transaction([
                prisma.briefingCycle.update({ where: { id: cycle.id }, data: { archivedAt: new Date() } }),
                prisma.briefingLink.updateMany({
                    where: { cycleId: cycle.id, revokedAt: null },
                    data: { revokedAt: new Date() },
                }),
                prisma.briefingEvent.create({ data: { cycleId: cycle.id, type: 'archived' } }),
            ]);

            return apiSuccess({ ok: true });
        }

        if (body.action === 'unarchive') {
            const parsed = idSchema.safeParse(body);
            if (!parsed.success) return apiError('Invalid input', 400);

            const cycle = await prisma.briefingCycle.findFirst({ where: { id: parsed.data.id, tenantId: ctx.tenantId } });
            if (!cycle) return apiError('Cycle not found', 404);

            await prisma.$transaction([
                prisma.briefingCycle.update({ where: { id: cycle.id }, data: { archivedAt: null } }),
                prisma.briefingEvent.create({ data: { cycleId: cycle.id, type: 'unarchived' } }),
            ]);

            return apiSuccess({ ok: true });
        }

        if (body.action === 'export') {
            const parsed = exportSchema.safeParse(body);
            if (!parsed.success) return apiError('Invalid input', 400);

            const cycle = await prisma.briefingCycle.findFirst({
                where: { id: parsed.data.id, tenantId: ctx.tenantId },
                include: {
                    client: { select: { name: true } },
                    template: { include: { sections: { include: { fields: true }, orderBy: { sortOrder: 'asc' } } } },
                    answers: true,
                },
            });
            if (!cycle) return apiError('Cycle not found', 404);

            const built = buildBriefingExport({
                clientName: cycle.client.name,
                referenceMonth: cycle.referenceMonth,
                submittedAt: cycle.submittedAt,
                isSubmitted: cycle.status === 'submitted',
                sections: cycle.template.sections.map((s) => ({
                    id: s.id,
                    title: s.title,
                    kind: s.kind,
                    repeaterItemLabel: s.repeaterItemLabel,
                    emptyLabel: s.emptyLabel,
                    isOptional: s.isOptional,
                    fields: s.fields.map((f) => ({ id: f.id, key: f.key, label: f.label, type: f.type, isRequired: f.isRequired, isActive: f.isActive })),
                })),
                answers: cycle.answers.map((a) => ({ fieldId: a.fieldId, groupIndex: a.groupIndex, value: a.value })),
            });

            if (parsed.data.format === 'text') return apiSuccess({ text: built.text });
            return apiSuccess({ json: built.json });
        }

        return apiError('Unknown action', 400);
    },
    { roles: ['SUPERADMIN', 'TENANT_ADMIN', 'TENANT_STAFF'] }
);
