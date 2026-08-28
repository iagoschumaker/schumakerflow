'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Copy, Check, RefreshCw, Ban, RotateCcw, Archive, ArchiveRestore, Eye, Download, FileJson, AlertTriangle, ArrowLeft, Link2, Clock, Pencil, Save, Trash2, X } from 'lucide-react';
import { useToast } from '@/components/Toast';
import { buildBriefingExport, type ExportSection, type ExportAnswer } from '@/lib/briefings/export';
import { formatMonthBR, formatDateBR, formatDateTimeBR, dbDateToIso } from '@/lib/briefings/dates';

interface CycleData {
    id: string;
    status: string;
    referenceMonth: string;
    dueDate: string | null;
    submittedAt: string | null;
    archivedAt: string | null;
    createdAt: string;
    client: { id: string; name: string };
    template: { id: string; name: string; sections: ExportSection[] };
    answers: ExportAnswer[];
    links: { id: string; tokenPreview: string; expiresAt: string; revokedAt: string | null; opensCount: number; lastOpenedAt: string | null }[];
    events: { id: string; type: string; createdAt: string }[];
}

const STATUS_LABEL: Record<string, string> = {
    draft: 'Rascunho', sent: 'Enviado', in_progress: 'Preenchendo', submitted: 'Recebido',
};
const STATUS_BADGE: Record<string, string> = {
    draft: 'badge-gray', sent: 'badge-info', in_progress: 'badge-warning', submitted: 'badge-success',
};
const EVENT_LABEL: Record<string, string> = {
    link_created: 'Link criado', link_opened: 'Link aberto', link_revealed: 'Link revelado', autosaved: 'Respostas salvas automaticamente',
    submitted: 'Briefing enviado', reopened: 'Reaberto para edição', link_revoked: 'Link revogado', edited: 'Ciclo editado',
    archived: 'Arquivado', unarchived: 'Desarquivado', autosave_rejected: 'Tentativa de salvar campo inválido',
};

function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="card">
            <div className="card-header">
                <h2 className="card-title">{title}</h2>
                {action}
            </div>
            {children}
        </div>
    );
}

function InfoItem({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>{label}</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{value}</div>
        </div>
    );
}

export default function BriefingDetailPage() {
    const params = useParams<{ id: string }>();
    const router = useRouter();
    const { showToast, showConfirm } = useToast();

    const [cycle, setCycle] = useState<CycleData | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [shownToken, setShownToken] = useState<string | null>(null);
    const [copiedText, setCopiedText] = useState(false);
    const [copiedLink, setCopiedLink] = useState(false);
    const [editing, setEditing] = useState(false);
    const [editForm, setEditForm] = useState({ referenceMonth: '', dueDate: '' });
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        const res = await fetch('/api/admin/briefings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'get', id: params.id }),
        });
        const data = await res.json();
        if (data.data) setCycle(data.data);
        setLoading(false);
    }, [params.id]);

    useEffect(() => { load(); }, [load]);

    const built = useMemo(() => {
        if (!cycle) return null;
        return buildBriefingExport({
            clientName: cycle.client.name,
            referenceMonth: new Date(cycle.referenceMonth),
            submittedAt: cycle.submittedAt ? new Date(cycle.submittedAt) : null,
            isSubmitted: cycle.status === 'submitted',
            sections: cycle.template.sections,
            answers: cycle.answers,
        });
    }, [cycle]);

    const sectionCounter = useMemo(() => {
        if (!built) return null;
        const total = built.sections.length + built.emptySections.length;
        return { filled: built.sections.length, total };
    }, [built]);

    const activeLink = cycle?.links.find((l) => !l.revokedAt) || cycle?.links[0] || null;
    const linkStatus = activeLink
        ? activeLink.revokedAt ? 'revogado' : new Date(activeLink.expiresAt) < new Date() ? 'expirado' : 'ativo'
        : null;
    const linkStatusColor = linkStatus === 'ativo' ? 'var(--color-success)' : linkStatus === 'expirado' ? 'var(--color-warning)' : 'var(--color-danger)';
    const linkActionsLocked = cycle ? (cycle.status === 'submitted' || !!cycle.archivedAt) : false;
    const linkActionsLockedReason = 'Reabra o briefing para gerar um link novo.';

    const runAction = async (action: string, extra?: Record<string, unknown>) => {
        setBusy(true);
        try {
            const res = await fetch('/api/admin/briefings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, id: params.id, ...extra }),
            });
            const data = await res.json();
            if (!res.ok) {
                showToast(data.error || 'Erro na ação', 'error');
                return null;
            }
            return data.data;
        } finally {
            setBusy(false);
        }
    };

    const handleRegenerate = async () => {
        const ok = await showConfirm({ title: 'Gerar novo link', message: 'O link atual será revogado e um novo será criado. Confirma?' });
        if (!ok) return;
        const data = await runAction('regenerateLink');
        if (data?.token) { setShownToken(data.token); load(); }
    };

    const handleReveal = async () => {
        const data = await runAction('revealLink');
        if (data?.token) { setShownToken(data.token); load(); }
    };

    const handleRevoke = async () => {
        const ok = await showConfirm({ title: 'Revogar link', message: 'O cliente não vai mais conseguir acessar por esse link. Confirma?', variant: 'danger' });
        if (!ok) return;
        setShownToken(null);
        await runAction('revokeLink');
        load();
    };

    const handleReopen = async () => {
        const ok = await showConfirm({ title: 'Reabrir briefing', message: 'O ciclo volta a aceitar edição do cliente e um link novo é gerado. Confirma?' });
        if (!ok) return;
        const data = await runAction('reopen');
        if (data?.token) setShownToken(data.token);
        load();
    };

    const handleArchive = async () => {
        const ok = await showConfirm({ title: 'Arquivar briefing', message: 'O link ativo será revogado e o ciclo sai da lista ativa. O detalhe continua acessível. Confirma?', variant: 'danger' });
        if (!ok) return;
        setShownToken(null);
        await runAction('archive');
        load();
    };

    const handleUnarchive = async () => {
        await runAction('unarchive');
        load();
    };

    const startEdit = () => {
        if (!cycle) return;
        setEditForm({
            referenceMonth: dbDateToIso(new Date(cycle.referenceMonth)).slice(0, 7),
            dueDate: cycle.dueDate ? dbDateToIso(new Date(cycle.dueDate)) : '',
        });
        setEditing(true);
    };

    const handleSaveEdit = async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/admin/briefings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'update',
                    id: params.id,
                    referenceMonth: editForm.referenceMonth,
                    dueDate: editForm.dueDate || null,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                showToast(data.error || 'Erro ao salvar', 'error');
                return;
            }
            showToast('Briefing atualizado!', 'success');
            setEditing(false);
            load();
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        const hasAnswers = cycle ? cycle.answers.length > 0 : false;
        const ok = await showConfirm({
            title: 'Excluir briefing',
            message: hasAnswers
                ? 'Isso apaga permanentemente o ciclo e as respostas do cliente. Não pode ser desfeito.'
                : 'O ciclo e seu link serão apagados permanentemente. Não pode ser desfeito.',
            confirmText: 'Excluir',
            variant: 'danger',
        });
        if (!ok) return;
        setBusy(true);
        try {
            const res = await fetch('/api/admin/briefings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'delete', id: params.id }),
            });
            if (!res.ok) {
                const data = await res.json();
                showToast(data.error || 'Erro ao excluir', 'error');
                return;
            }
            showToast('Briefing excluído!', 'success');
            router.push('/admin/briefings');
        } finally {
            setBusy(false);
        }
    };

    const copy = async (text: string, which: 'text' | 'link') => {
        await navigator.clipboard.writeText(text);
        if (which === 'text') { setCopiedText(true); setTimeout(() => setCopiedText(false), 2000); }
        else { setCopiedLink(true); setTimeout(() => setCopiedLink(false), 2000); }
    };

    const downloadTxt = () => {
        if (!built) return;
        const blob = new Blob([built.text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `briefing-${cycle?.client.name.replace(/\s+/g, '-').toLowerCase()}-${dbDateToIso(new Date(cycle!.referenceMonth))}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const downloadJson = () => {
        if (!built) return;
        const blob = new Blob([JSON.stringify(built.json, null, 2)], { type: 'application/json;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `briefing-${cycle?.client.name.replace(/\s+/g, '-').toLowerCase()}-${dbDateToIso(new Date(cycle!.referenceMonth))}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    if (loading) return <div className="page-content"><div className="card animate-pulse" style={{ height: 300 }} /></div>;
    if (!cycle || !built) return <div className="page-content"><div className="card empty-state"><h3>Briefing não encontrado</h3></div></div>;

    const shownLink = shownToken ? `${window.location.origin}/b/${shownToken}` : '';

    return (
        <div>
            <div className="page-header">
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                    <button
                        onClick={() => router.push('/admin/briefings')}
                        className="btn btn-secondary"
                        style={{ padding: '8px 12px', flexShrink: 0 }}
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <div style={{ flex: 1, minWidth: 200 }}>
                        {editing ? (
                            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">Mês de referência</label>
                                    <input type="month" className="form-input" value={editForm.referenceMonth} onChange={(e) => setEditForm({ ...editForm, referenceMonth: e.target.value })} />
                                </div>
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">Prazo</label>
                                    <input type="date" className="form-input" value={editForm.dueDate} onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })} />
                                </div>
                            </div>
                        ) : (
                            <>
                                <h1 style={{ margin: 0 }}>{cycle.client.name}</h1>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
                                    <p className="text-muted" style={{ margin: 0 }}>{cycle.template.name} — {formatMonthBR(dbDateToIso(new Date(cycle.referenceMonth)))}</p>
                                    <span className={`badge ${STATUS_BADGE[cycle.status] || 'badge-gray'}`}>{STATUS_LABEL[cycle.status] || cycle.status}</span>
                                    {cycle.archivedAt && <span className="badge badge-gray">Arquivado</span>}
                                    {cycle.dueDate && <span className="text-sm text-muted">Prazo: {formatDateBR(dbDateToIso(new Date(cycle.dueDate)))}</span>}
                                    {cycle.submittedAt && <span className="text-sm text-muted">Enviado: {formatDateTimeBR(cycle.submittedAt)}</span>}
                                </div>
                            </>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                        {editing ? (
                            <>
                                <button className="btn btn-secondary" onClick={() => setEditing(false)} disabled={saving}><X size={16} /> Cancelar</button>
                                <button className="btn btn-primary" onClick={handleSaveEdit} disabled={saving}><Save size={16} /> {saving ? 'Salvando...' : 'Salvar'}</button>
                            </>
                        ) : (
                            <>
                                <button className="btn btn-secondary" onClick={startEdit} disabled={busy}><Pencil size={16} /> Editar</button>
                                <button className="btn btn-danger" onClick={handleDelete} disabled={busy}><Trash2 size={16} /> Excluir</button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <div className="page-content" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
                {/* Link panel */}
                <Panel
                    title="Link"
                    action={
                        <div style={{ display: 'flex', gap: 8 }}>
                            {activeLink && !activeLink.revokedAt && !shownToken && (
                                <button className="btn btn-secondary btn-sm" onClick={handleReveal} disabled={busy}>
                                    <Eye size={14} /> Mostrar link
                                </button>
                            )}
                            <button
                                className="btn btn-secondary btn-sm"
                                onClick={handleRegenerate}
                                disabled={busy || linkActionsLocked}
                                title={linkActionsLocked ? linkActionsLockedReason : undefined}
                            >
                                <RefreshCw size={14} /> Gerar novo
                            </button>
                            {activeLink && !activeLink.revokedAt && (
                                <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={handleRevoke}
                                    disabled={busy || linkActionsLocked}
                                    title={linkActionsLocked ? linkActionsLockedReason : undefined}
                                >
                                    <Ban size={14} /> Revogar
                                </button>
                            )}
                        </div>
                    }
                >
                    {shownToken ? (
                        <div>
                            <p className="text-sm text-muted" style={{ marginBottom: 8 }}>Você pode mostrar este link de novo a qualquer momento em &quot;Mostrar link&quot;.</p>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <input className="form-input" readOnly value={shownLink} onFocus={(e) => e.target.select()} />
                                <button type="button" className="btn btn-secondary" onClick={() => copy(shownLink, 'link')} style={{ flexShrink: 0 }}>
                                    {copiedLink ? <Check size={16} /> : <Copy size={16} />}
                                </button>
                            </div>
                        </div>
                    ) : activeLink ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--space-4)' }}>
                            <InfoItem label="Status do link" value={<span style={{ color: linkStatusColor }}>{linkStatus}</span>} />
                            <InfoItem label="Expira em" value={formatDateBR(dbDateToIso(new Date(activeLink.expiresAt)))} />
                            <InfoItem label="Aberturas" value={activeLink.opensCount} />
                            <InfoItem label="Última abertura" value={activeLink.lastOpenedAt ? formatDateTimeBR(activeLink.lastOpenedAt) : '—'} />
                            <InfoItem label="Token" value={`······${activeLink.tokenPreview}`} />
                        </div>
                    ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                            <Link2 size={16} /> Nenhum link ativo.
                        </div>
                    )}
                </Panel>

                {/* CONFERIR */}
                {built.conferir.length > 0 && (
                    <div className="card" style={{ borderColor: 'var(--color-warning)' }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, color: 'var(--color-warning)' }}>
                            <AlertTriangle size={16} /> <strong>Conferir</strong>
                        </div>
                        <ul style={{ margin: 0, paddingLeft: 20, fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                            {built.conferir.map((c, i) => <li key={i}>{c}</li>)}
                        </ul>
                    </div>
                )}

                {/* Respostas */}
                <Panel
                    title="Respostas"
                    action={
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => copy(built.text, 'text')}>
                                {copiedText ? <Check size={14} /> : <Copy size={14} />} Copiar
                            </button>
                            <button className="btn btn-secondary btn-sm" onClick={downloadTxt}><Download size={14} /> .txt</button>
                            <button className="btn btn-secondary btn-sm" onClick={downloadJson}><FileJson size={14} /> JSON</button>
                        </div>
                    }
                >
                    {sectionCounter && (
                        <p className="text-sm text-muted" style={{ marginBottom: 'var(--space-4)' }}>
                            {sectionCounter.filled} de {sectionCounter.total} seções preenchidas
                        </p>
                    )}

                    {built.sections.length > 0 && (
                        <div className="grid-2" style={{ marginBottom: built.emptySections.length > 0 ? 'var(--space-4)' : 0 }}>
                            {built.sections.map((section) => (
                                <div key={section.title}>
                                    <h3 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: 10, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{section.title}</h3>
                                    {section.kind === 'single' ? (
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--space-3)' }}>
                                            {section.singleItems.map((item, i) => (
                                                <InfoItem key={i} label={item.label} value={item.value} />
                                            ))}
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                            {section.repeaterGroups.map((group, gi) => (
                                                <div key={gi} style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)', background: 'var(--color-bg)' }}>
                                                    <div className="badge badge-gray" style={{ marginBottom: 10 }}>{group.itemLabel} {gi + 1}</div>
                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--space-3)' }}>
                                                        {group.items.map((item, i) => (
                                                            <InfoItem key={i} label={item.label} value={item.value} />
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {built.emptySections.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {built.emptySections.map((es, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--color-bg)' }}>
                                    <span className="text-sm text-muted">{es.emptyLabel}</span>
                                    <span className="badge badge-gray">vazio</span>
                                </div>
                            ))}
                        </div>
                    )}

                    {built.sections.length === 0 && built.emptySections.length === 0 && (
                        <p className="text-sm text-muted">Nenhuma resposta ainda.</p>
                    )}
                </Panel>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8 }}>
                    {cycle.status === 'submitted' && (
                        <button className="btn btn-secondary" onClick={handleReopen} disabled={busy}><RotateCcw size={16} /> Reabrir para edição</button>
                    )}
                    {cycle.archivedAt ? (
                        <button className="btn btn-secondary" onClick={handleUnarchive} disabled={busy}><ArchiveRestore size={16} /> Desarquivar</button>
                    ) : (
                        <button className="btn btn-secondary" onClick={handleArchive} disabled={busy}><Archive size={16} /> Arquivar</button>
                    )}
                </div>

                {/* Histórico */}
                <Panel title="Histórico">
                    {cycle.events.length === 0 ? (
                        <p className="text-sm text-muted">Nenhum evento ainda.</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {cycle.events.map((ev, i) => (
                                <div key={ev.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, paddingBottom: i < cycle.events.length - 1 ? 14 : 0, position: 'relative' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-primary)', marginTop: 5 }} />
                                        {i < cycle.events.length - 1 && <div style={{ width: 1, flex: 1, background: 'var(--color-border)', marginTop: 4 }} />}
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', flex: 1, gap: 8, flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                                            {ev.type === 'link_opened' && <Eye size={13} style={{ color: 'var(--color-text-muted)' }} />}
                                            {EVENT_LABEL[ev.type] || ev.type}
                                        </span>
                                        <span className="text-xs text-muted" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <Clock size={11} /> {formatDateTimeBR(ev.createdAt)}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </Panel>
            </div>
        </div>
    );
}
