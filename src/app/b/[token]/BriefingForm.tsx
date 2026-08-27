'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Trash2, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import styles from './briefing-public.module.css';

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
    referenceMonthLabel: string;
    sections: Section[];
    initialAnswers: AnswerIn[];
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

function answerKey(fieldId: string, groupIndex: number) {
    return `${fieldId}:${groupIndex}`;
}

export default function BriefingForm({ token, clientName, referenceMonthLabel, sections, initialAnswers }: Props) {
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
            <div className={styles.stateWrapper}>
                <div className={styles.stateCard}>
                    <CheckCircle2 size={40} color="#34C759" />
                    <h1 className={styles.stateTitle}>Briefing enviado!</h1>
                    <p className={styles.stateMessage}>Obrigado, {clientName}. Recebemos suas respostas.</p>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.page}>
            <div className={styles.header}>
                <div className={styles.headerTop}>
                    <div>
                        <p className={styles.clientName}>{clientName}</p>
                        <p className={styles.briefingTitle}>Briefing de {referenceMonthLabel}</p>
                    </div>
                    <SaveIndicator status={status} savedAt={savedAt} />
                </div>
                <div className={styles.progressTrack}>
                    <div className={styles.progressFill} style={{ width: `${progress}%` }} />
                </div>
            </div>

            <div className={styles.content}>
                {sections.map((section) => (
                    <SectionBlock
                        key={section.id}
                        section={section}
                        groupIndices={section.kind === 'repeater' ? (groups[section.id] || []) : [0]}
                        values={values}
                        onChange={setValue}
                        onAddGroup={() => addGroup(section.id)}
                        onRemoveGroup={(gi) => removeGroup(section.id, gi)}
                        missingFieldIds={new Set(missing.filter((m) => section.fields.some((f) => f.id === m.fieldId)).map((m) => m.fieldId))}
                    />
                ))}

                {missing.length > 0 && (
                    <div className={styles.missingCard}>
                        <div className={styles.missingHeader}>
                            <AlertCircle size={18} />
                            Faltam campos obrigatórios
                        </div>
                        <ul className={styles.missingList}>
                            {missing.map((m, i) => (
                                <li key={i}>{m.sectionTitle} — {m.label}</li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>

            <div className={styles.footer}>
                <button className={styles.submitButton} onClick={handleSubmitClick} disabled={submitting}>
                    {submitting ? <Loader2 size={18} className="spin" /> : 'Enviar briefing'}
                </button>
            </div>

            {confirmOpen && (
                <div className={styles.modalOverlay} onClick={() => setConfirmOpen(false)}>
                    <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
                        <h2 className={styles.modalTitle}>Confirmar envio?</h2>
                        <p className={styles.modalText}>
                            {progress < 100 ? `Você preencheu ${progress}% do formulário. Depois de enviar, não dá para editar.` : 'Depois de enviar, não dá para editar.'}
                        </p>
                        <div className={styles.modalActions}>
                            <button className={styles.secondaryButton} onClick={() => setConfirmOpen(false)}>Voltar</button>
                            <button className={styles.primaryButton} onClick={doSubmit}>Enviar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function SaveIndicator({ status, savedAt }: { status: SaveStatus; savedAt: Date | null }) {
    if (status === 'saving') return <span className={`${styles.saveIndicator} ${styles.saveIndicatorSaving}`}>salvando…</span>;
    if (status === 'error') return <span className={`${styles.saveIndicator} ${styles.saveIndicatorError}`}>falha ao salvar, tentando de novo</span>;
    if (status === 'saved' && savedAt) return <span className={`${styles.saveIndicator} ${styles.saveIndicatorSaved}`}>salvo às {savedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>;
    return <span className={styles.saveIndicator}>&nbsp;</span>;
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
        <div className={styles.sectionCard}>
            <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>{section.title}</h2>
                {section.isOptional && <span className={styles.optionalBadge}>se houver</span>}
            </div>
            {section.description && <p className={styles.sectionDescription}>{section.description}</p>}

            {section.kind === 'single' && (
                <FieldGrid section={section} groupIndex={0} values={values} onChange={onChange} missingFieldIds={missingFieldIds} />
            )}

            {section.kind === 'repeater' && (
                <>
                    {groupIndices.map((gi, idx) => (
                        <div key={gi} className={styles.repeaterItem}>
                            <div className={styles.repeaterItemHeader}>
                                <span className={styles.repeaterItemTitle}>{section.repeaterItemLabel || 'Item'} {idx + 1}</span>
                                <button type="button" className={styles.removeButton} onClick={() => onRemoveGroup(gi)} aria-label="Remover">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                            <FieldGrid section={section} groupIndex={gi} values={values} onChange={onChange} missingFieldIds={missingFieldIds} />
                        </div>
                    ))}

                    {groupIndices.length === 0 ? (
                        <div className={styles.repeaterEmpty}>
                            <p className={styles.repeaterEmptyLabel}>{section.emptyLabel || 'Nenhum item adicionado ainda.'}</p>
                            <button type="button" className={styles.addButton} onClick={onAddGroup}>
                                <Plus size={16} /> Adicionar {section.repeaterItemLabel?.toLowerCase() || 'item'}
                            </button>
                        </div>
                    ) : (
                        <button type="button" className={`${styles.addButton} ${styles.addButtonBlock}`} onClick={onAddGroup}>
                            <Plus size={16} /> Adicionar {section.repeaterItemLabel?.toLowerCase() || 'item'}
                        </button>
                    )}
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
        <div className={styles.fieldGrid}>
            {section.fields.map((field) => (
                <div key={field.id} className={`${styles.field} ${field.width === 'full' ? styles.fieldFull : ''}`}>
                    <label className={styles.fieldLabel}>
                        {field.label}{field.isRequired && <span className={styles.required}> *</span>}
                    </label>
                    {field.hint && <p className={styles.fieldHint}>{field.hint}</p>}
                    <FieldInput
                        field={field}
                        value={values.get(answerKey(field.id, groupIndex)) ?? ''}
                        onChange={(raw) => onChange(field.id, groupIndex, raw)}
                    />
                    {missingFieldIds.has(field.id) && <p className={styles.fieldError}>Obrigatório</p>}
                </div>
            ))}
        </div>
    );
}

function FieldInput({ field, value, onChange }: { field: Field; value: unknown; onChange: (raw: unknown) => void }) {
    const strValue = typeof value === 'string' ? value : value === null || value === undefined ? '' : String(value);

    switch (field.type) {
        case 'textarea':
            return <textarea className={styles.textarea} placeholder={field.placeholder || undefined} value={strValue} onChange={(e) => onChange(e.target.value)} />;
        case 'date':
            return <input type="date" className={styles.input} value={strValue} onChange={(e) => onChange(e.target.value)} />;
        case 'month':
            return <input type="month" className={styles.input} value={strValue} onChange={(e) => onChange(e.target.value)} />;
        case 'time':
            return <input type="time" className={styles.input} value={strValue} onChange={(e) => onChange(e.target.value)} />;
        case 'money':
            return (
                <div className={styles.moneyWrapper}>
                    <span className={styles.moneyPrefix}>R$</span>
                    <input
                        type="text"
                        inputMode="decimal"
                        className={`${styles.input} ${styles.moneyInput}`}
                        placeholder="0,00"
                        value={strValue}
                        onChange={(e) => onChange(e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.'))}
                    />
                </div>
            );
        case 'number':
            return <input type="number" className={styles.input} value={strValue} onChange={(e) => onChange(e.target.value)} />;
        case 'select':
            return (
                <select className={styles.select} value={strValue} onChange={(e) => onChange(e.target.value)}>
                    <option value="">Selecione</option>
                    {(field.options || []).map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                    ))}
                </select>
            );
        case 'boolean':
            return (
                <select className={styles.select} value={strValue} onChange={(e) => onChange(e.target.value)}>
                    <option value="">Selecione</option>
                    <option value="true">Sim</option>
                    <option value="false">Não</option>
                </select>
            );
        case 'email':
            return <input type="email" className={styles.input} placeholder={field.placeholder || undefined} value={strValue} onChange={(e) => onChange(e.target.value)} />;
        case 'phone':
            return <input type="tel" className={styles.input} placeholder={field.placeholder || undefined} value={strValue} onChange={(e) => onChange(e.target.value)} />;
        case 'url':
            return <input type="url" className={styles.input} placeholder={field.placeholder || undefined} value={strValue} onChange={(e) => onChange(e.target.value)} />;
        default:
            return <input type="text" className={styles.input} placeholder={field.placeholder || undefined} value={strValue} onChange={(e) => onChange(e.target.value)} />;
    }
}
