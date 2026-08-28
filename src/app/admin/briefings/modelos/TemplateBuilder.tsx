'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Trash2, ChevronUp, ChevronDown, Save, X, Lock } from 'lucide-react';
import { useToast } from '@/components/Toast';

type FieldType = 'text' | 'textarea' | 'date' | 'month' | 'time' | 'money' | 'number' | 'select' | 'boolean' | 'email' | 'phone' | 'url';

const FIELD_TYPE_LABEL: Record<FieldType, string> = {
    text: 'Texto curto', textarea: 'Texto longo', date: 'Data', month: 'Mês', time: 'Horário',
    money: 'Dinheiro', number: 'Número', select: 'Lista de opções', boolean: 'Sim / Não',
    email: 'E-mail', phone: 'Telefone', url: 'Link',
};

interface FieldDraft {
    _localId: string;
    id?: string;
    key: string;
    label: string;
    type: FieldType;
    width: 'half' | 'full';
    isRequired: boolean;
    isActive: boolean;
    hint: string;
    placeholder: string;
    options: string[];
    answerCount: number;
}

interface SectionDraft {
    _localId: string;
    id?: string;
    title: string;
    description: string;
    kind: 'single' | 'repeater';
    repeaterItemLabel: string;
    emptyLabel: string;
    isOptional: boolean;
    fields: FieldDraft[];
}

let localIdSeq = 0;
function newLocalId(): string {
    localIdSeq += 1;
    return `local-${localIdSeq}`;
}

function slugifyKey(label: string): string {
    return label
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/(^_|_$)/g, '') || 'campo';
}

function blankField(): FieldDraft {
    return {
        _localId: newLocalId(), key: '', label: '', type: 'text', width: 'half',
        isRequired: false, isActive: true, hint: '', placeholder: '', options: [], answerCount: 0,
    };
}

function blankSection(): SectionDraft {
    return {
        _localId: newLocalId(), title: '', description: '', kind: 'single',
        repeaterItemLabel: '', emptyLabel: '', isOptional: false, fields: [blankField()],
    };
}

function move<T>(arr: T[], index: number, dir: -1 | 1): T[] {
    const target = index + dir;
    if (target < 0 || target >= arr.length) return arr;
    const next = [...arr];
    [next[index], next[target]] = [next[target], next[index]];
    return next;
}

interface TemplateData {
    id: string;
    name: string;
    description: string | null;
    isActive: boolean;
    _count: { cycles: number };
    sections: {
        id: string;
        title: string;
        description: string | null;
        kind: 'single' | 'repeater';
        repeaterItemLabel: string | null;
        emptyLabel: string | null;
        isOptional: boolean;
        fields: {
            id: string; key: string; label: string; type: FieldType; width: 'half' | 'full';
            isRequired: boolean; isActive: boolean; hint: string | null; placeholder: string | null;
            options: string[] | null; _count: { answers: number };
        }[];
    }[];
}

export default function TemplateBuilder({ templateId }: { templateId?: string }) {
    const router = useRouter();
    const { showToast, showConfirm } = useToast();
    const isNew = !templateId;

    const [loading, setLoading] = useState(!isNew);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [isActive, setIsActive] = useState(true);
    const [cyclesUsing, setCyclesUsing] = useState(0);
    const [sections, setSections] = useState<SectionDraft[]>(() => (isNew ? [blankSection()] : []));

    const load = useCallback(async () => {
        if (!templateId) return;
        const res = await fetch('/api/admin/briefings/templates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'get', id: templateId }),
        });
        const data = await res.json();
        const t: TemplateData | undefined = data.data;
        if (!t) {
            showToast('Modelo não encontrado', 'error');
            router.push('/admin/briefings/modelos');
            return;
        }
        setName(t.name);
        setDescription(t.description || '');
        setIsActive(t.isActive);
        setCyclesUsing(t._count.cycles);
        setSections(t.sections.map((s) => ({
            _localId: newLocalId(),
            id: s.id,
            title: s.title,
            description: s.description || '',
            kind: s.kind,
            repeaterItemLabel: s.repeaterItemLabel || '',
            emptyLabel: s.emptyLabel || '',
            isOptional: s.isOptional,
            fields: s.fields.map((f) => ({
                _localId: newLocalId(),
                id: f.id,
                key: f.key,
                label: f.label,
                type: f.type,
                width: f.width,
                isRequired: f.isRequired,
                isActive: f.isActive,
                hint: f.hint || '',
                placeholder: f.placeholder || '',
                options: f.options || [],
                answerCount: f._count.answers,
            })),
        })));
        setLoading(false);
    }, [templateId, router, showToast]);

    useEffect(() => { load(); }, [load]);

    const updateSection = (si: number, patch: Partial<SectionDraft>) => {
        setSections((prev) => prev.map((s, i) => (i === si ? { ...s, ...patch } : s)));
    };
    const updateField = (si: number, fi: number, patch: Partial<FieldDraft>) => {
        setSections((prev) => prev.map((s, i) => {
            if (i !== si) return s;
            return { ...s, fields: s.fields.map((f, j) => (j === fi ? { ...f, ...patch } : f)) };
        }));
    };

    const addSection = () => setSections((prev) => [...prev, blankSection()]);
    const removeSection = (si: number) => setSections((prev) => prev.filter((_, i) => i !== si));
    const moveSection = (si: number, dir: -1 | 1) => setSections((prev) => move(prev, si, dir));

    const addField = (si: number) => setSections((prev) => prev.map((s, i) => (i === si ? { ...s, fields: [...s.fields, blankField()] } : s)));
    const removeField = (si: number, fi: number) => setSections((prev) => prev.map((s, i) => (i === si ? { ...s, fields: s.fields.filter((_, j) => j !== fi) } : s)));
    const moveField = (si: number, fi: number, dir: -1 | 1) => setSections((prev) => prev.map((s, i) => (i === si ? { ...s, fields: move(s.fields, fi, dir) } : s)));

    const sectionHasAnswers = (s: SectionDraft) => s.fields.some((f) => f.answerCount > 0);

    const handleSave = async () => {
        if (!name.trim()) { showToast('Dê um nome ao modelo', 'warning'); return; }
        if (sections.length === 0) { showToast('Adicione ao menos uma seção', 'warning'); return; }
        for (const s of sections) {
            if (!s.title.trim()) { showToast('Toda seção precisa de um título', 'warning'); return; }
            if (s.fields.length === 0) { showToast(`A seção "${s.title}" precisa de ao menos um campo`, 'warning'); return; }
            for (const f of s.fields) {
                if (!f.label.trim()) { showToast(`Um campo da seção "${s.title}" está sem pergunta/rótulo`, 'warning'); return; }
            }
        }

        setSaving(true);
        try {
            const payload = {
                name: name.trim(),
                description: description.trim() || undefined,
                ...(isNew ? {} : { isActive }),
                sections: sections.map((s) => ({
                    id: s.id,
                    title: s.title.trim(),
                    description: s.description.trim() || undefined,
                    kind: s.kind,
                    repeaterItemLabel: s.kind === 'repeater' ? (s.repeaterItemLabel.trim() || undefined) : undefined,
                    emptyLabel: s.kind === 'repeater' ? (s.emptyLabel.trim() || undefined) : undefined,
                    isOptional: s.isOptional,
                    fields: s.fields.map((f) => ({
                        id: f.id,
                        key: f.key.trim() || slugifyKey(f.label),
                        label: f.label.trim(),
                        type: f.type,
                        width: f.width,
                        isRequired: f.isRequired,
                        isActive: f.isActive,
                        hint: f.hint.trim() || undefined,
                        placeholder: f.placeholder.trim() || undefined,
                        options: f.type === 'select' ? f.options.map((o) => o.trim()).filter(Boolean) : undefined,
                    })),
                })),
            };

            const res = await fetch('/api/admin/briefings/templates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(isNew ? { action: 'create', ...payload } : { action: 'update', id: templateId, ...payload }),
            });
            const data = await res.json();
            if (!res.ok) {
                showToast(data.error || 'Erro ao salvar', 'error');
                return;
            }
            showToast(isNew ? 'Modelo criado!' : 'Modelo salvo!', 'success');
            router.push(`/admin/briefings/modelos/${isNew ? data.data.id : templateId}`);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        const ok = await showConfirm({
            title: 'Excluir modelo',
            message: 'As seções e campos deste modelo serão apagados permanentemente. Não pode ser desfeito.',
            confirmText: 'Excluir',
            variant: 'danger',
        });
        if (!ok) return;
        setDeleting(true);
        try {
            const res = await fetch('/api/admin/briefings/templates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'delete', id: templateId }),
            });
            const data = await res.json();
            if (!res.ok) {
                showToast(data.error || 'Erro ao excluir', 'error');
                return;
            }
            showToast('Modelo excluído!', 'success');
            router.push('/admin/briefings/modelos');
        } finally {
            setDeleting(false);
        }
    };

    if (loading) return <div className="page-content"><div className="card animate-pulse" style={{ height: 400 }} /></div>;

    return (
        <div>
            <div className="page-header">
                <div>
                    <button className="btn btn-secondary btn-sm" onClick={() => router.push('/admin/briefings/modelos')} style={{ marginBottom: 10 }}>
                        <ArrowLeft size={14} /> Voltar
                    </button>
                    <h1>{isNew ? 'Novo modelo' : 'Editar modelo'}</h1>
                    <p>As seções e campos que compõem o formulário do cliente</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    {!isNew && (
                        <button
                            className="btn btn-danger"
                            onClick={handleDelete}
                            disabled={deleting || cyclesUsing > 0}
                            title={cyclesUsing > 0 ? `${cyclesUsing} ciclo(s) usam este modelo — desative em vez de excluir` : undefined}
                        >
                            <Trash2 size={16} /> Excluir
                        </button>
                    )}
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                        <Save size={16} /> {saving ? 'Salvando...' : 'Salvar'}
                    </button>
                </div>
            </div>

            <div className="page-content" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)', maxWidth: 880 }}>
                <div className="card">
                    <div className="card-header"><h2 className="card-title">Informações do modelo</h2></div>
                    <div className="form-group">
                        <label className="form-label">Nome *</label>
                        <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Social Media — mensal" />
                    </div>
                    <div className="form-group" style={{ marginBottom: isNew ? 0 : 'var(--space-4)' }}>
                        <label className="form-label">Descrição (opcional)</label>
                        <input className="form-input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Aparece só para você, não para o cliente" />
                    </div>
                    {!isNew && (
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', cursor: 'pointer' }}>
                            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                            Ativo — aparece na hora de criar um novo briefing
                        </label>
                    )}
                    {cyclesUsing > 0 && (
                        <p className="text-xs text-muted" style={{ marginTop: 'var(--space-3)' }}>
                            Em uso em {cyclesUsing} ciclo(s). Seções e campos com respostas gravadas não podem ser removidos, só desativados.
                        </p>
                    )}
                </div>

                {sections.map((s, si) => {
                    const hasAnswers = sectionHasAnswers(s);
                    return (
                        <div key={s._localId} className="card">
                            <div className="card-header">
                                <input
                                    className="form-input"
                                    value={s.title}
                                    onChange={(e) => updateSection(si, { title: e.target.value })}
                                    placeholder="Título da seção"
                                    style={{ fontWeight: 700, maxWidth: 420 }}
                                />
                                <div style={{ display: 'flex', gap: 4 }}>
                                    <button className="btn btn-secondary btn-sm" onClick={() => moveSection(si, -1)} disabled={si === 0} title="Mover para cima"><ChevronUp size={14} /></button>
                                    <button className="btn btn-secondary btn-sm" onClick={() => moveSection(si, 1)} disabled={si === sections.length - 1} title="Mover para baixo"><ChevronDown size={14} /></button>
                                    <button
                                        className="btn btn-secondary btn-sm"
                                        onClick={() => removeSection(si)}
                                        disabled={hasAnswers}
                                        title={hasAnswers ? 'Tem campos com respostas gravadas — não pode ser removida' : 'Remover seção'}
                                    >
                                        {hasAnswers ? <Lock size={14} /> : <Trash2 size={14} />}
                                    </button>
                                </div>
                            </div>

                            <div style={{ padding: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">Descrição da seção (opcional)</label>
                                    <input className="form-input" value={s.description} onChange={(e) => updateSection(si, { description: e.target.value })} placeholder="Ajuda o cliente a entender o que preencher" />
                                </div>

                                <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label">Tipo de seção</label>
                                        <select className="form-input" value={s.kind} onChange={(e) => updateSection(si, { kind: e.target.value as 'single' | 'repeater' })}>
                                            <option value="single">Campos únicos</option>
                                            <option value="repeater">Lista repetível (cliente pode adicionar vários itens)</option>
                                        </select>
                                    </div>
                                    {s.kind === 'repeater' && (
                                        <>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label">Nome de cada item</label>
                                                <input className="form-input" value={s.repeaterItemLabel} onChange={(e) => updateSection(si, { repeaterItemLabel: e.target.value })} placeholder="Ex: Novidade" style={{ maxWidth: 200 }} />
                                            </div>
                                            <div className="form-group" style={{ marginBottom: 0 }}>
                                                <label className="form-label">Texto quando vazio</label>
                                                <input className="form-input" value={s.emptyLabel} onChange={(e) => updateSection(si, { emptyLabel: e.target.value })} placeholder="Ex: Novidades — nenhuma este mês" style={{ maxWidth: 280 }} />
                                            </div>
                                        </>
                                    )}
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', cursor: 'pointer', paddingBottom: 8 }}>
                                        <input type="checkbox" checked={s.isOptional} onChange={(e) => updateSection(si, { isOptional: e.target.checked })} />
                                        Opcional (cliente pode pular)
                                    </label>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                                    {s.fields.map((f, fi) => (
                                        <FieldEditor
                                            key={f._localId}
                                            field={f}
                                            isFirst={fi === 0}
                                            isLast={fi === s.fields.length - 1}
                                            onChange={(patch) => updateField(si, fi, patch)}
                                            onMove={(dir) => moveField(si, fi, dir)}
                                            onRemove={() => removeField(si, fi)}
                                        />
                                    ))}
                                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => addField(si)} style={{ alignSelf: 'flex-start' }}>
                                        <Plus size={14} /> Adicionar campo
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}

                <button type="button" className="btn btn-secondary" onClick={addSection} style={{ alignSelf: 'flex-start' }}>
                    <Plus size={16} /> Adicionar seção
                </button>
            </div>
        </div>
    );
}

function FieldEditor({
    field, isFirst, isLast, onChange, onMove, onRemove,
}: {
    field: FieldDraft;
    isFirst: boolean;
    isLast: boolean;
    onChange: (patch: Partial<FieldDraft>) => void;
    onMove: (dir: -1 | 1) => void;
    onRemove: () => void;
}) {
    const locked = field.answerCount > 0;

    const addOption = () => onChange({ options: [...field.options, ''] });
    const updateOption = (i: number, value: string) => onChange({ options: field.options.map((o, j) => (j === i ? value : o)) });
    const removeOption = (i: number) => onChange({ options: field.options.filter((_, j) => j !== i) });

    return (
        <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)' }}>
            <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div className="form-group" style={{ marginBottom: 0, flex: '2 1 220px' }}>
                    <label className="form-label">Pergunta / rótulo *</label>
                    <input
                        className="form-input"
                        value={field.label}
                        onChange={(e) => {
                            const label = e.target.value;
                            onChange(field.key ? { label } : { label, key: slugifyKey(label) });
                        }}
                        placeholder="Ex: O que é"
                    />
                </div>
                <div className="form-group" style={{ marginBottom: 0, flex: '1 1 160px' }}>
                    <label className="form-label">Tipo</label>
                    <select className="form-input" value={field.type} onChange={(e) => onChange({ type: e.target.value as FieldType })}>
                        {(Object.keys(FIELD_TYPE_LABEL) as FieldType[]).map((t) => (
                            <option key={t} value={t}>{FIELD_TYPE_LABEL[t]}</option>
                        ))}
                    </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0, flex: '1 1 110px' }}>
                    <label className="form-label">Largura</label>
                    <select className="form-input" value={field.width} onChange={(e) => onChange({ width: e.target.value as 'half' | 'full' })}>
                        <option value="half">Meia</option>
                        <option value="full">Cheia</option>
                    </select>
                </div>
                <div style={{ display: 'flex', gap: 4, paddingBottom: 2 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => onMove(-1)} disabled={isFirst} title="Mover para cima"><ChevronUp size={14} /></button>
                    <button className="btn btn-secondary btn-sm" onClick={() => onMove(1)} disabled={isLast} title="Mover para baixo"><ChevronDown size={14} /></button>
                    <button
                        className="btn btn-secondary btn-sm"
                        onClick={onRemove}
                        disabled={locked}
                        title={locked ? `Tem ${field.answerCount} resposta(s) gravada(s) — desative em vez de remover` : 'Remover campo'}
                    >
                        {locked ? <Lock size={14} /> : <Trash2 size={14} />}
                    </button>
                </div>
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', marginTop: 'var(--space-3)', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={field.isRequired} onChange={(e) => onChange({ isRequired: e.target.checked })} />
                    Obrigatório
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={field.isActive} onChange={(e) => onChange({ isActive: e.target.checked })} />
                    Ativo
                </label>
                <div className="form-group" style={{ marginBottom: 0, flex: '1 1 200px' }}>
                    <label className="form-label">Dica (opcional)</label>
                    <input className="form-input" value={field.hint} onChange={(e) => onChange({ hint: e.target.value })} placeholder="Texto de ajuda abaixo da pergunta" />
                </div>
            </div>

            {field.type === 'select' && (
                <div style={{ marginTop: 'var(--space-3)' }}>
                    <label className="form-label">Opções</label>
                    {field.options.map((opt, oi) => (
                        <div key={oi} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                            <input className="form-input" value={opt} onChange={(e) => updateOption(oi, e.target.value)} placeholder={`Opção ${oi + 1}`} />
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => removeOption(oi)}><X size={14} /></button>
                        </div>
                    ))}
                    <button type="button" className="btn btn-secondary btn-sm" onClick={addOption}><Plus size={14} /> Adicionar opção</button>
                </div>
            )}

            {locked && (
                <p className="text-xs text-muted" style={{ marginTop: 'var(--space-3)' }}>
                    Tem {field.answerCount} resposta(s) gravada(s) em ciclos anteriores — não pode ser removido, só desativado.
                </p>
            )}
        </div>
    );
}
