'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';

type FieldType = 'text' | 'textarea' | 'date' | 'month' | 'time' | 'money' | 'number' | 'select' | 'boolean' | 'email' | 'phone' | 'url';

interface Field {
    id: string;
    key: string;
    label: string;
    hint: string | null;
    placeholder: string | null;
    type: FieldType;
    options: string[] | null;
    isRequired: boolean;
    width: 'half' | 'full';
}

interface Section {
    id: string;
    title: string;
    description: string | null;
    kind: 'single' | 'repeater';
    repeaterItemLabel: string | null;
    emptyLabel: string | null;
    isOptional: boolean;
    fields: Field[];
}

interface AnswerIn {
    fieldId: string;
    groupIndex: number;
    value: { raw: unknown };
}

interface Props {
    token: string;
    clientName: string;
    sections: Section[];
    initialAnswers: AnswerIn[];
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

function answerKey(fieldId: string, groupIndex: number) {
    return `${fieldId}:${groupIndex}`;
}

export default function BriefingForm({ token, clientName, sections, initialAnswers }: Props) {
    const [values, setValues] = useState<Map<string, unknown>>(() => {
        const m = new Map<string, unknown>();
        for (const a of initialAnswers) m.set(answerKey(a.fieldId, a.groupIndex), a.value?.raw ?? '');
        return m;
    });

    const [groups, setGroups] = useState<Record<string, number[]>>(() => {
        const g: Record<string, number[]> = {};
        for (const s of sections) {
            if (s.kind !== 'repeater') continue;
            const indices = new Set<number>();
            for (const a of initialAnswers) {
                if (s.fields.some((f) => f.id === a.fieldId)) indices.add(a.groupIndex);
            }
            g[s.id] = indices.size > 0 ? Array.from(indices).sort((a, b) => a - b) : [];
        }
        return g;
    });

    const [status, setStatus] = useState<SaveStatus>('idle');
    const [savedAt, setSavedAt] = useState<Date | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [missing, setMissing] = useState<{ fieldId: string; label: string; sectionTitle: string }[]>([]);
    const [confirmOpen, setConfirmOpen] = useState(false);

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingRef = useRef<Map<string, unknown>>(new Map());

    const flush = useCallback(async () => {
        if (pendingRef.current.size === 0) return;
        const answers: AnswerIn[] = Array.from(pendingRef.current.entries()).map(([key, raw]) => {
            const [fieldId, groupIndexStr] = key.split(':');
            return { fieldId, groupIndex: Number(groupIndexStr), value: { raw } };
        });
        pendingRef.current = new Map();

        setStatus('saving');
        try {
            const res = await fetch(`/api/public/briefings/${token}/autosave`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ answers }),
            });
            if (!res.ok) throw new Error('save failed');
            setStatus('saved');
            setSavedAt(new Date());
        } catch {
            setStatus('error');
        }
    }, [token]);

    const scheduleSave = useCallback((fieldId: string, groupIndex: number, raw: unknown) => {
        pendingRef.current.set(answerKey(fieldId, groupIndex), raw);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(flush, 800);
    }, [flush]);

    useEffect(() => {
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, []);

    const setValue = (fieldId: string, groupIndex: number, raw: unknown) => {
        setValues((prev) => {
            const next = new Map(prev);
            next.set(answerKey(fieldId, groupIndex), raw);
            return next;
        });
        scheduleSave(fieldId, groupIndex, raw);
    };

    const addGroup = (sectionId: string) => {
        setGroups((prev) => {
            const current = prev[sectionId] || [];
            const nextIndex = current.length > 0 ? Math.max(...current) + 1 : 0;
            return { ...prev, [sectionId]: [...current, nextIndex] };
        });
    };

    const removeGroup = (sectionId: string, groupIndex: number) => {
        setGroups((prev) => ({ ...prev, [sectionId]: (prev[sectionId] || []).filter((g) => g !== groupIndex) }));
        setValues((prev) => {
            const next = new Map(prev);
            const section = sections.find((s) => s.id === sectionId);
            section?.fields.forEach((f) => next.delete(answerKey(f.id, groupIndex)));
            return next;
        });
    };

    const totalFillable = useMemo(() => {
        let n = 0;
        for (const s of sections) {
            if (s.kind === 'single') n += s.fields.length;
            else n += s.fields.length * Math.max(groups[s.id]?.length || 0, 1);
        }
        return n;
    }, [sections, groups]);
    const filledCount = useMemo(() => {
        let n = 0;
        values.forEach((v) => {
            if (v !== null && v !== undefined && v !== '') n++;
        });
        return n;
    }, [values]);
    const progress = totalFillable > 0 ? Math.min(100, Math.round((filledCount / totalFillable) * 100)) : 0;

    const handleSubmitClick = () => {
        setConfirmOpen(true);
    };

    const doSubmit = async () => {
        setConfirmOpen(false);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        await flush();

        setSubmitting(true);
        try {
            const res = await fetch(`/api/public/briefings/${token}/submit`, { method: 'POST' });
            if (res.status === 422) {
                const data = await res.json();
                setMissing(data.missing || []);
                setSubmitting(false);
                return;
            }
            if (!res.ok) throw new Error('submit failed');
            setSubmitted(true);
        } catch {
            setStatus('error');
        } finally {
            setSubmitting(false);
        }
    };

    if (submitted) {
        return (
            <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)', background: 'var(--color-bg)' }}>
                <div className="card" style={{ maxWidth: 420, width: '100%', textAlign: 'center', padding: 'var(--space-8) var(--space-6)' }}>
                    <CheckCircle2 size={40} color="var(--color-success)" style={{ marginBottom: 'var(--space-3)' }} />
                    <h1 style={{ fontSize: '1.15rem', marginBottom: 'var(--space-2)' }}>Briefing enviado!</h1>
                    <p style={{ color: 'var(--color-text-secondary)' }}>Obrigado, {clientName}. Recebemos suas respostas.</p>
                </div>
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100dvh', background: 'var(--color-bg)', paddingBottom: 100 }}>
            <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', padding: 'var(--space-3) var(--space-4)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <strong style={{ fontSize: '0.95rem' }}>{clientName}</strong>
                    <SaveIndicator status={status} savedAt={savedAt} />
                </div>
                <div style={{ height: 6, background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${progress}%`, background: 'var(--color-primary)', transition: 'width 0.3s' }} />
                </div>
            </div>

            <div style={{ maxWidth: 640, margin: '0 auto', padding: 'var(--space-4)' }}>
                {sections.map((section) => (
                    <SectionBlock
                        key={section.id}
                        section={section}
                        groupIndices={section.kind === 'repeater' ? (groups[section.id] || []) : [0]}
                        values={values}
                        onChange={setValue}
                        onAddGroup={() => addGroup(section.id)}
                        onRemoveGroup={(gi) => removeGroup(section.id, gi)}
                        missingFieldIds={new Set(missing.filter((m) => sections.find(s => s.id === section.id)?.fields.some(f => f.id === m.fieldId)).map((m) => m.fieldId))}
                    />
                ))}

                {missing.length > 0 && (
                    <div className="card" style={{ borderColor: 'var(--color-danger)', padding: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, color: 'var(--color-danger)' }}>
                            <AlertCircle size={18} />
                            <strong>Faltam campos obrigatórios</strong>
                        </div>
                        <ul style={{ paddingLeft: 20, margin: 0, color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
                            {missing.map((m, i) => (
                                <li key={i}>{m.sectionTitle} — {m.label}</li>
                            ))}
                        </ul>
                    </div>
                )}

                <button className="btn btn-primary btn-lg" style={{ width: '100%' }} onClick={handleSubmitClick} disabled={submitting}>
                    {submitting ? <Loader2 size={18} className="spin" /> : 'Enviar briefing'}
                </button>
            </div>

            {confirmOpen && (
                <div className="modal-overlay" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 50 }} onClick={() => setConfirmOpen(false)}>
                    <div className="card" style={{ maxWidth: 480, width: '100%', margin: 'var(--space-4)', padding: 'var(--space-6)' }} onClick={(e) => e.stopPropagation()}>
                        <h2 style={{ fontSize: '1.05rem', marginBottom: 'var(--space-3)' }}>Confirmar envio?</h2>
                        <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)', fontSize: '0.9rem' }}>
                            {progress < 100 ? `Você preencheu ${progress}% do formulário. Depois de enviar, não dá para editar.` : 'Depois de enviar, não dá para editar.'}
                        </p>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setConfirmOpen(false)}>Voltar</button>
                            <button className="btn btn-primary" style={{ flex: 1 }} onClick={doSubmit}>Enviar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function SaveIndicator({ status, savedAt }: { status: SaveStatus; savedAt: Date | null }) {
    if (status === 'saving') return <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>salvando…</span>;
    if (status === 'error') return <span style={{ fontSize: '0.75rem', color: 'var(--color-danger)' }}>falha ao salvar, tentando de novo</span>;
    if (status === 'saved' && savedAt) return <span style={{ fontSize: '0.75rem', color: 'var(--color-success)' }}>salvo às {savedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>;
    return <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>&nbsp;</span>;
}

function SectionBlock({
    section, groupIndices, values, onChange, onAddGroup, onRemoveGroup, missingFieldIds,
}: {
    section: Section;
    groupIndices: number[];
    values: Map<string, unknown>;
    onChange: (fieldId: string, groupIndex: number, raw: unknown) => void;
    onAddGroup: () => void;
    onRemoveGroup: (groupIndex: number) => void;
    missingFieldIds: Set<string>;
}) {
    return (
        <div className="card" style={{ padding: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
            <div style={{ marginBottom: 'var(--space-3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <h2 style={{ fontSize: '1rem', margin: 0 }}>{section.title}</h2>
                    {section.isOptional && <span className="badge" style={{ background: 'var(--color-bg-secondary)', color: 'var(--color-text-muted)' }}>se houver</span>}
                </div>
                {section.description && <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: 4 }}>{section.description}</p>}
            </div>

            {section.kind === 'single' && (
                <FieldGrid section={section} groupIndex={0} values={values} onChange={onChange} missingFieldIds={missingFieldIds} />
            )}

            {section.kind === 'repeater' && (
                <>
                    {groupIndices.length === 0 && (
                        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)' }}>
                            {section.emptyLabel || 'Nenhum item adicionado ainda.'}
                        </p>
                    )}
                    {groupIndices.map((gi, idx) => (
                        <div key={gi} style={{ border: '1px solid var(--color-border-light)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                <strong style={{ fontSize: '0.9rem' }}>{section.repeaterItemLabel || 'Item'} {idx + 1}</strong>
                                <button type="button" className="btn btn-sm btn-secondary" onClick={() => onRemoveGroup(gi)}>
                                    <Trash2 size={14} />
                                </button>
                            </div>
                            <FieldGrid section={section} groupIndex={gi} values={values} onChange={onChange} missingFieldIds={missingFieldIds} />
                        </div>
                    ))}
                    <button type="button" className="btn btn-secondary" onClick={onAddGroup} style={{ width: '100%' }}>
                        <Plus size={16} /> Adicionar {section.repeaterItemLabel?.toLowerCase() || 'item'}
                    </button>
                </>
            )}
        </div>
    );
}

function FieldGrid({
    section, groupIndex, values, onChange, missingFieldIds,
}: {
    section: Section;
    groupIndex: number;
    values: Map<string, unknown>;
    onChange: (fieldId: string, groupIndex: number, raw: unknown) => void;
    missingFieldIds: Set<string>;
}) {
    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            {section.fields.map((field) => (
                <div key={field.id} className="form-group" style={{ gridColumn: field.width === 'full' ? '1 / -1' : undefined, marginBottom: 0 }}>
                    <label className="form-label">
                        {field.label}{field.isRequired && <span style={{ color: 'var(--color-danger)' }}> *</span>}
                    </label>
                    {field.hint && <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: -4, marginBottom: 6 }}>{field.hint}</p>}
                    <FieldInput
                        field={field}
                        value={values.get(answerKey(field.id, groupIndex)) ?? ''}
                        onChange={(raw) => onChange(field.id, groupIndex, raw)}
                    />
                    {missingFieldIds.has(field.id) && <p className="form-error">Obrigatório</p>}
                </div>
            ))}
        </div>
    );
}

function FieldInput({ field, value, onChange }: { field: Field; value: unknown; onChange: (raw: unknown) => void }) {
    const strValue = typeof value === 'string' ? value : value === null || value === undefined ? '' : String(value);

    switch (field.type) {
        case 'textarea':
            return <textarea className="form-textarea" placeholder={field.placeholder || undefined} value={strValue} onChange={(e) => onChange(e.target.value)} />;
        case 'date':
            return <input type="date" className="form-input" value={strValue} onChange={(e) => onChange(e.target.value)} />;
        case 'month':
            return <input type="month" className="form-input" value={strValue} onChange={(e) => onChange(e.target.value)} />;
        case 'time':
            return <input type="time" className="form-input" value={strValue} onChange={(e) => onChange(e.target.value)} />;
        case 'money':
            return (
                <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>R$</span>
                    <input
                        type="text"
                        inputMode="decimal"
                        className="form-input"
                        style={{ paddingLeft: 32 }}
                        placeholder="0,00"
                        value={strValue}
                        onChange={(e) => onChange(e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.'))}
                    />
                </div>
            );
        case 'number':
            return <input type="number" className="form-input" value={strValue} onChange={(e) => onChange(e.target.value)} />;
        case 'select':
            return (
                <select className="form-select" value={strValue} onChange={(e) => onChange(e.target.value)}>
                    <option value="">Selecione</option>
                    {(field.options || []).map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                    ))}
                </select>
            );
        case 'boolean':
            return (
                <select className="form-select" value={strValue} onChange={(e) => onChange(e.target.value)}>
                    <option value="">Selecione</option>
                    <option value="true">Sim</option>
                    <option value="false">Não</option>
                </select>
            );
        case 'email':
            return <input type="email" className="form-input" placeholder={field.placeholder || undefined} value={strValue} onChange={(e) => onChange(e.target.value)} />;
        case 'phone':
            return <input type="tel" className="form-input" placeholder={field.placeholder || undefined} value={strValue} onChange={(e) => onChange(e.target.value)} />;
        case 'url':
            return <input type="url" className="form-input" placeholder={field.placeholder || undefined} value={strValue} onChange={(e) => onChange(e.target.value)} />;
        default:
            return <input type="text" className="form-input" placeholder={field.placeholder || undefined} value={strValue} onChange={(e) => onChange(e.target.value)} />;
    }
}
