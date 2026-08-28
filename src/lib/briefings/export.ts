import type { BriefingTemplateFieldType } from '@prisma/client';
import { formatDateBR, formatDateTimeBR, formatMonthBR, formatMoneyBR, formatTimeBR, dbDateToIso } from './dates';

export type FieldRole = 'period_start' | 'period_end' | 'event_date' | 'launch_date' | 'production_date' | 'scope' | 'priority' | 'needs_promotion' | 'details';

export interface ExportField {
    id: string;
    key: string;
    label: string;
    type: BriefingTemplateFieldType;
    role: FieldRole | null;
    isRequired: boolean;
    isActive: boolean;
}

export interface ExportSection {
    id: string;
    title: string;
    kind: 'single' | 'repeater';
    repeaterItemLabel: string | null;
    emptyLabel: string | null;
    isOptional: boolean;
    fields: ExportField[];
}

export interface ExportAnswer {
    fieldId: string;
    groupIndex: number;
    value: unknown; // { raw: ... }
}

export interface BuildExportInput {
    clientName: string;
    referenceMonth: Date; // @db.Date
    submittedAt: Date | null;
    isSubmitted: boolean;
    sections: ExportSection[];
    answers: ExportAnswer[];
}

interface RenderedItem {
    label: string;
    value: string;
}

interface RenderedSection {
    title: string;
    kind: 'single' | 'repeater';
    isEmpty: boolean;
    emptyLabel: string;
    singleItems: RenderedItem[];
    repeaterGroups: { index: number; itemLabel: string; items: RenderedItem[] }[];
}

export interface BuiltExport {
    clientName: string;
    referenceMonthLabel: string;
    filledBy: string | null;
    submittedAtLabel: string | null;
    sections: RenderedSection[];
    emptySections: { title: string; emptyLabel: string }[];
    conferir: string[];
    text: string;
    json: unknown;
}

function rawOf(value: unknown): unknown {
    if (value && typeof value === 'object' && 'raw' in (value as Record<string, unknown>)) {
        return (value as { raw: unknown }).raw;
    }
    return value;
}

function isFilled(raw: unknown): boolean {
    if (Array.isArray(raw)) return raw.length > 0;
    return raw !== null && raw !== undefined && raw !== '';
}

function formatValue(type: BriefingTemplateFieldType, raw: unknown): string {
    if (Array.isArray(raw)) return raw.join(', ');
    const str = String(raw);
    switch (type) {
        case 'date':
            return formatDateBR(str);
        case 'month':
            return formatMonthBR(str);
        case 'money':
            return formatMoneyBR(str);
        case 'time':
            return formatTimeBR(str);
        case 'boolean':
            return raw === true || raw === 'true' ? 'Sim' : 'Não';
        default:
            return str;
    }
}

function isTruthyAnswer(raw: unknown): boolean {
    if (typeof raw === 'boolean') return raw;
    if (typeof raw === 'string') return raw.toLowerCase() === 'sim' || raw.toLowerCase() === 'true';
    return false;
}

function scopeValues(raw: unknown): string[] {
    if (Array.isArray(raw)) return raw.filter((v): v is string => typeof v === 'string' && v.length > 0);
    if (typeof raw === 'string' && raw.length > 0) return [raw];
    return [];
}

// One (section, group) slot -- a single section's implicit group 0, or one
// item of a repeater. Role-based rules read from here instead of ever
// matching on a field's key, so the same rules work for any tenant's
// vocabulary.
interface GroupContext {
    sectionId: string;
    sectionTitle: string;
    groupIndex: number;
    itemName: string;
    roles: Partial<Record<FieldRole, { raw: unknown; fieldLabel: string; type: BriefingTemplateFieldType }>>;
}

export function buildBriefingExport(input: BuildExportInput): BuiltExport {
    const answersByFieldGroup = new Map<string, unknown>();
    for (const a of input.answers) {
        answersByFieldGroup.set(`${a.fieldId}:${a.groupIndex}`, rawOf(a.value));
    }

    const groupsBySection = new Map<string, number[]>();
    for (const section of input.sections) {
        if (section.kind !== 'repeater') continue;
        const indices = new Set<number>();
        for (const field of section.fields) {
            for (const a of input.answers) {
                if (a.fieldId === field.id && isFilled(rawOf(a.value))) indices.add(a.groupIndex);
            }
        }
        groupsBySection.set(section.id, Array.from(indices).sort((x, y) => x - y));
    }

    const referenceMonthIso = dbDateToIso(input.referenceMonth);
    const referenceYearMonth = referenceMonthIso.slice(0, 7);

    // -------- Pass 1: build one GroupContext per (section, group) slot --------
    const groupContexts: GroupContext[] = [];
    for (const section of input.sections) {
        const activeFields = section.fields.filter((f) => f.isActive);
        const slots = section.kind === 'single' ? [0] : (groupsBySection.get(section.id) || []);

        slots.forEach((gi, idx) => {
            const roles: GroupContext['roles'] = {};
            let itemName = '';
            for (const field of activeFields) {
                const raw = answersByFieldGroup.get(`${field.id}:${gi}`);
                if (!isFilled(raw)) continue;
                if (field.role) {
                    roles[field.role] = { raw, fieldLabel: field.label, type: field.type };
                } else if (!itemName) {
                    itemName = formatValue(field.type, raw);
                }
            }
            if (!itemName) {
                itemName = section.kind === 'single' ? section.title : `${section.repeaterItemLabel || 'Item'} ${idx + 1}`;
            }
            groupContexts.push({ sectionId: section.id, sectionTitle: section.title, groupIndex: gi, itemName, roles });
        });
    }

    // -------- Pass 2: role-based CONFERIR rules (cycle-wide) --------
    const conferir: string[] = [];

    for (const ctx of groupContexts) {
        // Período invertido
        const start = ctx.roles.period_start;
        const end = ctx.roles.period_end;
        if (start && end && typeof start.raw === 'string' && typeof end.raw === 'string' && end.raw < start.raw) {
            conferir.push(`${ctx.itemName}: ${end.fieldLabel.toLowerCase()} (${formatDateBR(end.raw)}) é anterior a ${start.fieldLabel.toLowerCase()} (${formatDateBR(start.raw)}).`);
        }

        // Data fora do mês (event_date / launch_date)
        for (const role of ['event_date', 'launch_date'] as const) {
            const r = ctx.roles[role];
            if (r && typeof r.raw === 'string' && !r.raw.startsWith(referenceYearMonth)) {
                conferir.push(`${ctx.itemName} — ${r.fieldLabel}: data fora do mês de referência (${formatDateBR(r.raw)}).`);
            }
        }

        // Detalhe faltando
        const needsPromotion = ctx.roles.needs_promotion;
        const details = ctx.roles.details;
        if (needsPromotion && isTruthyAnswer(needsPromotion.raw) && (!details || !isFilled(details.raw))) {
            conferir.push(`${ctx.itemName}: ${needsPromotion.fieldLabel.toLowerCase()} marcado, mas sem detalhamento.`);
        }
    }

    // Produção tardia + Escopo desencontrado -- these compare across the
    // WHOLE cycle, not just one item, so they run after the per-item pass.
    const productionEntries = groupContexts.filter((c) => c.roles.production_date && typeof c.roles.production_date.raw === 'string');
    const launchEntries = groupContexts.filter((c) => c.roles.launch_date && typeof c.roles.launch_date.raw === 'string');
    const scopedLaunchOrEvent = groupContexts.filter((c) => (c.roles.launch_date || c.roles.event_date) && c.roles.scope);

    for (const prod of productionEntries) {
        const prodDate = prod.roles.production_date!.raw as string;
        for (const launch of launchEntries) {
            const launchDate = launch.roles.launch_date!.raw as string;
            if (prodDate > launchDate) {
                conferir.push(`Produção marcada para ${formatDateBR(prodDate)}, posterior ao lançamento de "${launch.itemName}" em ${formatDateBR(launchDate)}.`);
            }
        }

        const prodScope = prod.roles.scope ? scopeValues(prod.roles.scope.raw) : [];
        if (prodScope.length > 0 && scopedLaunchOrEvent.length > 0) {
            const otherScopes = new Set<string>();
            for (const c of scopedLaunchOrEvent) {
                if (c === prod) continue;
                for (const v of scopeValues(c.roles.scope!.raw)) otherScopes.add(v);
            }
            if (otherScopes.size > 0 && !prodScope.some((v) => otherScopes.has(v))) {
                conferir.push(`Produção marcada em ${prodScope.join(', ')}, mas os itens do mês são em ${Array.from(otherScopes).join(', ')}.`);
            }
        }
    }

    // Prioridade vazia -- cycle-level, only meaningful once submitted.
    if (input.isSubmitted) {
        const anyPriority = groupContexts.some((c) => c.roles.priority && isFilled(c.roles.priority.raw));
        const templateHasPriorityRole = input.sections.some((s) => s.fields.some((f) => f.isActive && f.role === 'priority'));
        if (templateHasPriorityRole && !anyPriority) {
            conferir.push('Nenhuma prioridade do mês foi definida.');
        }
    }

    // -------- Pass 3: render sections for display/export, same as before --------
    const renderedSections: RenderedSection[] = [];
    const emptySections: { title: string; emptyLabel: string }[] = [];
    let filledBy: string | null = null;

    for (const section of input.sections) {
        const activeFields = section.fields.filter((f) => f.isActive);

        // "Preenchido por" already surfaces in the header (filledBy) -- a
        // section whose only remaining field is that one is pure duplication.
        if (activeFields.length === 1 && activeFields[0].key === 'preenchido_por') {
            const raw = answersByFieldGroup.get(`${activeFields[0].id}:0`);
            if (isFilled(raw)) filledBy = String(raw);
            continue;
        }

        if (section.kind === 'single') {
            const items: RenderedItem[] = [];
            for (const field of activeFields) {
                const raw = answersByFieldGroup.get(`${field.id}:0`);
                if (!isFilled(raw)) continue;
                if (field.key === 'preenchido_por') filledBy = String(raw);
                items.push({ label: field.label, value: formatValue(field.type, raw) });
            }
            if (items.length === 0) {
                emptySections.push({ title: section.title, emptyLabel: section.emptyLabel || `${section.title} — não preenchido` });
            } else {
                renderedSections.push({ title: section.title, kind: 'single', isEmpty: false, emptyLabel: section.emptyLabel || '', singleItems: items, repeaterGroups: [] });
            }
        } else {
            const groupIndices = groupsBySection.get(section.id) || [];
            const groups: { index: number; itemLabel: string; items: RenderedItem[] }[] = [];

            for (const gi of groupIndices) {
                const items: RenderedItem[] = [];
                for (const field of activeFields) {
                    const raw = answersByFieldGroup.get(`${field.id}:${gi}`);
                    if (!isFilled(raw)) continue;
                    items.push({ label: field.label, value: formatValue(field.type, raw) });
                }
                if (items.length > 0) {
                    groups.push({ index: gi, itemLabel: section.repeaterItemLabel || 'Item', items });
                }
            }

            if (groups.length === 0) {
                emptySections.push({ title: section.title, emptyLabel: section.emptyLabel || `${section.title} — não preenchido` });
            } else {
                renderedSections.push({ title: section.title, kind: 'repeater', isEmpty: false, emptyLabel: section.emptyLabel || '', singleItems: [], repeaterGroups: groups });
            }
        }

        // Obrigatório vazio -- only matters once the cycle has been submitted.
        if (input.isSubmitted) {
            if (section.kind === 'single') {
                for (const field of activeFields) {
                    if (!field.isRequired) continue;
                    if (!isFilled(answersByFieldGroup.get(`${field.id}:0`))) {
                        conferir.push(`${section.title} — ${field.label}: obrigatório e vazio.`);
                    }
                }
            } else {
                for (const gi of groupsBySection.get(section.id) || []) {
                    for (const field of activeFields) {
                        if (!field.isRequired) continue;
                        if (!isFilled(answersByFieldGroup.get(`${field.id}:${gi}`))) {
                            conferir.push(`${section.title} — ${field.label}: obrigatório e vazio.`);
                        }
                    }
                }
            }
        }
    }

    const submittedAtLabel = input.submittedAt ? formatDateTimeBR(input.submittedAt) : null;

    const lines: string[] = [];
    lines.push('=='.repeat(25));
    lines.push(`BRIEFING DO MÊS — ${input.clientName.toUpperCase()}`);
    lines.push(`Mês: ${formatMonthBR(referenceMonthIso)}`);
    if (filledBy) lines.push(`Preenchido por: ${filledBy}`);
    if (submittedAtLabel) lines.push(`Enviado em: ${submittedAtLabel}`);
    lines.push('=='.repeat(25));
    lines.push('');

    for (const section of renderedSections) {
        lines.push(`--- ${section.title.toUpperCase()} ---`);
        lines.push('');
        if (section.kind === 'single') {
            for (const item of section.singleItems) {
                lines.push(`• ${item.label}: ${item.value}`);
            }
        } else {
            section.repeaterGroups.forEach((group, idx) => {
                lines.push(`${group.itemLabel.toUpperCase()} ${idx + 1}`);
                for (const item of group.items) {
                    lines.push(`  ${item.label}: ${item.value}`);
                }
                lines.push('');
            });
        }
        lines.push('');
    }

    if (emptySections.length > 0) {
        lines.push('--- NÃO PREENCHIDO ---');
        lines.push('');
        for (const es of emptySections) {
            lines.push(`• ${es.emptyLabel}`);
        }
        lines.push('');
    }

    if (conferir.length > 0) {
        lines.push('--- CONFERIR ---');
        lines.push('');
        for (const c of conferir) lines.push(`! ${c}`);
        lines.push('');
    }

    lines.push('=='.repeat(25));

    return {
        clientName: input.clientName,
        referenceMonthLabel: formatMonthBR(referenceMonthIso),
        filledBy,
        submittedAtLabel,
        sections: renderedSections,
        emptySections,
        conferir,
        text: lines.join('\n'),
        json: {
            clientName: input.clientName,
            referenceMonth: referenceMonthIso,
            filledBy,
            submittedAt: input.submittedAt ? input.submittedAt.toISOString() : null,
            sections: renderedSections.map((s) => ({
                title: s.title,
                kind: s.kind,
                items: s.kind === 'single' ? s.singleItems : undefined,
                groups: s.kind === 'repeater' ? s.repeaterGroups.map((g) => ({ label: g.itemLabel, items: g.items })) : undefined,
            })),
            emptySections,
            conferir,
        },
    };
}
