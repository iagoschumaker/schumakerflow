import type { BriefingTemplateFieldType } from '@prisma/client';
import { formatDateBR, formatMonthBR, formatMoneyBR, formatTimeBR, dbDateToIso } from './dates';

export interface ExportField {
    id: string;
    key: string;
    label: string;
    type: BriefingTemplateFieldType;
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
    return raw !== null && raw !== undefined && raw !== '';
}

function formatValue(type: BriefingTemplateFieldType, raw: unknown): string {
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

    const renderedSections: RenderedSection[] = [];
    const emptySections: { title: string; emptyLabel: string }[] = [];
    const conferir: string[] = [];

    let filledBy: string | null = null;

    for (const section of input.sections) {
        const activeFields = section.fields.filter((f) => f.isActive);

        if (section.kind === 'single') {
            const items: RenderedItem[] = [];
            for (const field of activeFields) {
                const raw = answersByFieldGroup.get(`${field.id}:0`);
                if (!isFilled(raw)) continue;
                if (field.key === 'preenchido_por') filledBy = String(raw);
                items.push({ label: field.label, value: formatValue(field.type, raw) });
                if (field.type === 'date' && typeof raw === 'string' && !raw.startsWith(referenceYearMonth)) {
                    conferir.push(`${section.title} — ${field.label}: data fora do mês de referência (${formatDateBR(raw)}).`);
                }
            }
            if (items.length === 0) {
                emptySections.push({ title: section.title, emptyLabel: section.emptyLabel || `${section.title} — não preenchido` });
            } else {
                renderedSections.push({ title: section.title, kind: 'single', isEmpty: false, emptyLabel: section.emptyLabel || '', singleItems: items, repeaterGroups: [] });
            }
        } else {
            const groupIndices = groupsBySection.get(section.id) || [];
            const groups: { index: number; itemLabel: string; items: RenderedItem[] }[] = [];

            const inicioField = activeFields.find((f) => f.type === 'date' && f.key.includes('inicio'));
            const fimField = activeFields.find((f) => f.type === 'date' && f.key.includes('fim'));

            for (const gi of groupIndices) {
                const items: RenderedItem[] = [];
                for (const field of activeFields) {
                    const raw = answersByFieldGroup.get(`${field.id}:${gi}`);
                    if (!isFilled(raw)) continue;
                    items.push({ label: field.label, value: formatValue(field.type, raw) });
                    if (field.type === 'date' && typeof raw === 'string' && !raw.startsWith(referenceYearMonth)) {
                        conferir.push(`${section.title} ${groupIndices.indexOf(gi) + 1} — ${field.label}: data fora do mês de referência (${formatDateBR(raw)}).`);
                    }
                }
                if (items.length > 0) {
                    groups.push({ index: gi, itemLabel: section.repeaterItemLabel || 'Item', items });
                }

                if (inicioField && fimField) {
                    const inicio = answersByFieldGroup.get(`${inicioField.id}:${gi}`);
                    const fim = answersByFieldGroup.get(`${fimField.id}:${gi}`);
                    if (typeof inicio === 'string' && typeof fim === 'string' && inicio && fim && fim < inicio) {
                        conferir.push(`${section.repeaterItemLabel || section.title} ${groupIndices.indexOf(gi) + 1}: a data de fim é anterior à de início.`);
                    }
                }
            }

            if (groups.length === 0) {
                emptySections.push({ title: section.title, emptyLabel: section.emptyLabel || `${section.title} — não preenchido` });
            } else {
                renderedSections.push({ title: section.title, kind: 'repeater', isEmpty: false, emptyLabel: section.emptyLabel || '', singleItems: [], repeaterGroups: groups });
            }
        }

        // Required-empty check only matters once the cycle has been submitted.
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

    const submittedAtLabel = input.submittedAt
        ? `${formatDateBR(dbDateToIso(input.submittedAt))} às ${String(input.submittedAt.getUTCHours()).padStart(2, '0')}h${String(input.submittedAt.getUTCMinutes()).padStart(2, '0')}`
        : null;

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
