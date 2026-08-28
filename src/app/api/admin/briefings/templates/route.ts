import { NextRequest, NextResponse } from 'next/server';
import { withAuth, apiSuccess, apiError, ApiContext } from '@/lib/api/helpers';
import { isBriefingsEnabled } from '@/lib/briefings/flag';
import prisma from '@/lib/db';
import { z } from 'zod';
import { Prisma } from '@prisma/client';

const listSchema = z.object({
    action: z.literal('list'),
    isActive: z.boolean().optional(),
});

const getSchema = z.object({
    action: z.literal('get'),
    id: z.string().uuid(),
});

const idSchema = z.object({ id: z.string().uuid() });

const fieldTypeEnum = z.enum(['text', 'textarea', 'date', 'month', 'time', 'money', 'number', 'select', 'boolean', 'email', 'phone', 'url', 'multi_select', 'client_list']);
const widthEnum = z.enum(['half', 'full']);
const fieldRoleEnum = z.enum(['period_start', 'period_end', 'event_date', 'launch_date', 'production_date', 'scope', 'priority', 'needs_promotion', 'details']);

const fieldDraftSchema = z.object({
    id: z.string().uuid().optional(),
    key: z.string().regex(/^[a-z0-9_]+$/, 'A chave só pode ter letras minúsculas, números e underscore.').optional(),
    label: z.string().min(1),
    type: fieldTypeEnum,
    role: fieldRoleEnum.optional().nullable(),
    width: widthEnum,
    isRequired: z.boolean(),
    isActive: z.boolean(),
    hint: z.string().optional().nullable(),
    placeholder: z.string().optional().nullable(),
    // select/multi_select: string[] of choices. client_list: { listKey } pointing at a BriefingClientList.
    options: z.union([
        z.array(z.string().min(1)),
        z.object({ listKey: z.string().min(1) }),
    ]).optional().nullable(),
});

const sectionDraftSchema = z.object({
    id: z.string().uuid().optional(),
    title: z.string().min(1),
    description: z.string().optional().nullable(),
    kind: z.enum(['single', 'repeater']),
    repeaterItemLabel: z.string().optional().nullable(),
    emptyLabel: z.string().optional().nullable(),
    isOptional: z.boolean(),
    fields: z.array(fieldDraftSchema).min(1, 'Cada seção precisa de pelo menos um campo.'),
});

const createSchema = z.object({
    action: z.literal('create'),
    name: z.string().min(1),
    description: z.string().optional().nullable(),
    sections: z.array(sectionDraftSchema).min(1, 'O modelo precisa de pelo menos uma seção.'),
});

const updateSchema = z.object({
    action: z.literal('update'),
    id: z.string().uuid(),
    name: z.string().min(1),
    description: z.string().optional().nullable(),
    isActive: z.boolean(),
    sections: z.array(sectionDraftSchema).min(1, 'O modelo precisa de pelo menos uma seção.'),
});

function slugify(input: string): string {
    return input
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || 'modelo';
}

async function uniqueSlug(tenantId: string, base: string, excludeId?: string): Promise<string> {
    let slug = slugify(base);
    let n = 2;
    for (;;) {
        const clash = await prisma.briefingTemplate.findFirst({
            where: { tenantId, slug, ...(excludeId ? { id: { not: excludeId } } : {}) },
            select: { id: true },
        });
        if (!clash) return slug;
        slug = `${slugify(base)}-${n++}`;
    }
}

function slugifyKey(input: string): string {
    return input
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/(^_|_$)/g, '') || 'campo';
}

type FieldDraft = z.infer<typeof fieldDraftSchema>;

// select/multi_select store their choice list as options; client_list stores
// { listKey } instead -- never mix the two up when persisting.
function fieldOptionsValue(f: FieldDraft): string[] | { listKey: string } | undefined {
    if (f.type === 'select' || f.type === 'multi_select') {
        return Array.isArray(f.options) && f.options.length > 0 ? f.options : undefined;
    }
    if (f.type === 'client_list' && f.options && !Array.isArray(f.options)) {
        return f.options;
    }
    return undefined;
}

function uniqueFieldKeys<T extends { key?: string; label: string }>(fields: T[]): (T & { key: string })[] {
    const seen = new Map<string, number>();
    return fields.map((f) => {
        const base = f.key || slugifyKey(f.label);
        const count = seen.get(base) || 0;
        seen.set(base, count + 1);
        return { ...f, key: count === 0 ? base : `${base}_${count + 1}` };
    });
}

export const POST = withAuth(
    async (req: NextRequest, ctx: ApiContext) => {
        if (!isBriefingsEnabled()) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        const body = await req.json();

        if (body.action === 'list') {
            const parsed = listSchema.safeParse(body);
            if (!parsed.success) return apiError('Invalid input', 400);

            const where: Record<string, unknown> = { tenantId: ctx.tenantId };
            if (parsed.data.isActive !== undefined) where.isActive = parsed.data.isActive;

            const templates = await prisma.briefingTemplate.findMany({
                where,
                include: {
                    _count: { select: { sections: true, cycles: true } },
                },
                orderBy: { createdAt: 'desc' },
            });

            return apiSuccess(templates);
        }

        if (body.action === 'get') {
            const parsed = getSchema.safeParse(body);
            if (!parsed.success) return apiError('Invalid input', 400);

            const template = await prisma.briefingTemplate.findFirst({
                where: { id: parsed.data.id, tenantId: ctx.tenantId },
                include: {
                    sections: {
                        include: {
                            fields: {
                                include: { _count: { select: { answers: true } } },
                                orderBy: { sortOrder: 'asc' },
                            },
                        },
                        orderBy: { sortOrder: 'asc' },
                    },
                    _count: { select: { cycles: true } },
                },
            });
            if (!template) return apiError('Template not found', 404);

            return apiSuccess(template);
        }

        if (body.action === 'create') {
            const parsed = createSchema.safeParse(body);
            if (!parsed.success) return apiError(parsed.error.issues[0]?.message || 'Invalid input', 400);

            const slug = await uniqueSlug(ctx.tenantId, parsed.data.name);

            const template = await prisma.briefingTemplate.create({
                data: {
                    tenantId: ctx.tenantId,
                    name: parsed.data.name,
                    slug,
                    description: parsed.data.description || null,
                    isActive: true,
                    sections: {
                        create: parsed.data.sections.map((s, si) => ({
                            title: s.title,
                            description: s.description || null,
                            kind: s.kind,
                            repeaterItemLabel: s.kind === 'repeater' ? (s.repeaterItemLabel || null) : null,
                            emptyLabel: s.kind === 'repeater' ? (s.emptyLabel || null) : null,
                            isOptional: s.isOptional,
                            sortOrder: si,
                            fields: {
                                create: uniqueFieldKeys(s.fields).map((f, fi) => ({
                                    key: f.key,
                                    label: f.label,
                                    type: f.type,
                                    role: f.role || null,
                                    width: f.width,
                                    isRequired: f.isRequired,
                                    isActive: f.isActive,
                                    hint: f.hint || null,
                                    placeholder: f.placeholder || null,
                                    options: fieldOptionsValue(f),
                                    sortOrder: fi,
                                })),
                            },
                        })),
                    },
                },
            });

            return apiSuccess({ id: template.id }, 201);
        }

        if (body.action === 'update') {
            const parsed = updateSchema.safeParse(body);
            if (!parsed.success) return apiError(parsed.error.issues[0]?.message || 'Invalid input', 400);

            const existing = await prisma.briefingTemplate.findFirst({
                where: { id: parsed.data.id, tenantId: ctx.tenantId },
                include: { sections: { include: { fields: true } } },
            });
            if (!existing) return apiError('Template not found', 404);

            const slug = existing.name === parsed.data.name
                ? existing.slug
                : await uniqueSlug(ctx.tenantId, parsed.data.name, existing.id);

            const keptSectionIds = new Set(parsed.data.sections.filter((s) => s.id).map((s) => s.id!));
            const removedSectionIds = existing.sections.filter((s) => !keptSectionIds.has(s.id)).map((s) => s.id);

            try {
                await prisma.$transaction(async (tx) => {
                    await tx.briefingTemplate.update({
                        where: { id: existing.id },
                        data: { name: parsed.data.name, slug, description: parsed.data.description || null, isActive: parsed.data.isActive },
                    });

                    // Sections/fields removed by the admin -- deleting one that still has
                    // recorded answers violates the FK (no cascade there on purpose) and
                    // throws, caught below as a 409. The builder UI is expected to lock
                    // removal for anything with answers before it gets this far.
                    if (removedSectionIds.length > 0) {
                        await tx.briefingTemplateSection.deleteMany({ where: { id: { in: removedSectionIds } } });
                    }

                    for (let si = 0; si < parsed.data.sections.length; si++) {
                        const s = parsed.data.sections[si];
                        const sectionData = {
                            title: s.title,
                            description: s.description || null,
                            kind: s.kind,
                            repeaterItemLabel: s.kind === 'repeater' ? (s.repeaterItemLabel || null) : null,
                            emptyLabel: s.kind === 'repeater' ? (s.emptyLabel || null) : null,
                            isOptional: s.isOptional,
                            sortOrder: si,
                        };

                        const existingSection = s.id ? existing.sections.find((es) => es.id === s.id) : undefined;
                        const sectionId = existingSection
                            ? existingSection.id
                            : (await tx.briefingTemplateSection.create({ data: { ...sectionData, templateId: existing.id } })).id;

                        if (existingSection) {
                            await tx.briefingTemplateSection.update({ where: { id: sectionId }, data: sectionData });
                        }

                        const keptFieldIds = new Set(s.fields.filter((f) => f.id).map((f) => f.id!));
                        const removedFieldIds = (existingSection?.fields || []).filter((f) => !keptFieldIds.has(f.id)).map((f) => f.id);
                        if (removedFieldIds.length > 0) {
                            await tx.briefingTemplateField.deleteMany({ where: { id: { in: removedFieldIds } } });
                        }

                        const dedupedFields = uniqueFieldKeys(s.fields);
                        for (let fi = 0; fi < dedupedFields.length; fi++) {
                            const f = dedupedFields[fi];
                            const fieldData = {
                                key: f.key,
                                label: f.label,
                                type: f.type,
                                role: f.role || null,
                                width: f.width,
                                isRequired: f.isRequired,
                                isActive: f.isActive,
                                hint: f.hint || null,
                                placeholder: f.placeholder || null,
                                options: fieldOptionsValue(f) ?? Prisma.JsonNull,
                                sortOrder: fi,
                            };
                            if (f.id) {
                                await tx.briefingTemplateField.update({ where: { id: f.id }, data: fieldData });
                            } else {
                                await tx.briefingTemplateField.create({ data: { ...fieldData, sectionId } });
                            }
                        }
                    }
                });
            } catch (e) {
                if (e instanceof Prisma.PrismaClientKnownRequestError && (e.code === 'P2003' || e.code === 'P2014')) {
                    return apiError('Não foi possível salvar: uma seção ou campo removido já tem respostas gravadas em ciclos anteriores. Desative o campo em vez de removê-lo, e recarregue a página.', 409);
                }
                throw e;
            }

            return apiSuccess({ ok: true });
        }

        if (body.action === 'delete') {
            const parsed = idSchema.safeParse(body);
            if (!parsed.success) return apiError('Invalid input', 400);

            const template = await prisma.briefingTemplate.findFirst({
                where: { id: parsed.data.id, tenantId: ctx.tenantId },
            });
            if (!template) return apiError('Template not found', 404);

            const cyclesUsingIt = await prisma.briefingCycle.count({ where: { templateId: template.id } });
            if (cyclesUsingIt > 0) {
                return apiError(`Não é possível excluir: ${cyclesUsingIt} ciclo(s) usam este modelo. Desative o modelo em vez de excluir.`, 409);
            }

            await prisma.auditLog.create({
                data: {
                    tenantId: ctx.tenantId,
                    userId: ctx.session.userId,
                    action: 'briefingTemplate.delete',
                    entityType: 'BriefingTemplate',
                    entityId: template.id,
                    details: JSON.stringify({ name: template.name, slug: template.slug }),
                },
            });
            await prisma.briefingTemplate.delete({ where: { id: template.id } });

            return apiSuccess({ ok: true });
        }

        return apiError('Unknown action', 400);
    },
    { roles: ['SUPERADMIN', 'TENANT_ADMIN', 'TENANT_STAFF'] }
);
