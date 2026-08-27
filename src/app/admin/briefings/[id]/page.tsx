'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Copy, Check, RefreshCw, Ban, RotateCcw, Archive, Download, FileJson, AlertTriangle, ArrowLeft } from 'lucide-react';
import { useToast } from '@/components/Toast';
import { buildBriefingExport, type ExportSection, type ExportAnswer } from '@/lib/briefings/export';
import { formatMonthBR, formatDateBR, dbDateToIso } from '@/lib/briefings/dates';

interface CycleData {
    id: string;
    status: string;
    referenceMonth: string;
    dueDate: string | null;
    submittedAt: string | null;
    createdAt: string;
    client: { id: string; name: string };
    template: { id: string; name: string; sections: ExportSection[] };
    answers: ExportAnswer[];
    links: { id: string; tokenPreview: string; expiresAt: string; revokedAt: string | null; opensCount: number; lastOpenedAt: string | null }[];
    events: { id: string; type: string; createdAt: string }[];
}

const STATUS_LABEL: Record<string, string> = {
    draft: 'Rascunho', sent: 'Enviado', in_progress: 'Preenchendo', submitted: 'Recebido', archived: 'Arquivado',
};
const STATUS_BADGE: Record<string, string> = {
    draft: 'badge-gray', sent: 'badge-info', in_progress: 'badge-warning', submitted: 'badge-success', archived: 'badge-gray',
};
const EVENT_LABEL: Record<string, string> = {
    link_created: 'Link criado', link_opened: 'Link aberto', autosaved: 'Respostas salvas automaticamente',
    submitted: 'Briefing enviado', reopened: 'Reaberto para edição', link_revoked: 'Link revogado', archived: 'Arquivado',
    autosave_rejected: 'Tentativa de salvar campo inválido',
};

export default function BriefingDetailPage() {
    const params = useParams<{ id: string }>();
    const router = useRouter();
    const { showToast, showConfirm } = useToast();

    const [cycle, setCycle] = useState<CycleData | null>(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [newToken, setNewToken] = useState<string | null>(null);
    const [copiedText, setCopiedText] = useState(false);
    const [copiedLink, setCopiedLink] = useState(false);

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

    const activeLink = cycle?.links.find((l) => !l.revokedAt) || cycle?.links[0] || null;
    const linkStatus = activeLink
        ? activeLink.revokedAt ? 'revogado' : new Date(activeLink.expiresAt) < new Date() ? 'expirado' : 'ativo'
        : null;

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
        if (data?.token) { setNewToken(data.token); load(); }
    };

    const handleRevoke = async () => {
        const ok = await showConfirm({ title: 'Revogar link', message: 'O cliente não vai mais conseguir acessar por esse link. Confirma?', variant: 'danger' });
        if (!ok) return;
        await runAction('revokeLink');
        load();
    };

    const handleReopen = async () => {
        const ok = await showConfirm({ title: 'Reabrir briefing', message: 'O ciclo volta a aceitar edição do cliente. Confirma?' });
        if (!ok) return;
        await runAction('reopen');
        load();
    };

    const handleArchive = async () => {
        const ok = await showConfirm({ title: 'Arquivar briefing', message: 'O link ativo será revogado e o ciclo marcado como encerrado. Confirma?', variant: 'danger' });
        if (!ok) return;
        await runAction('archive');
        load();
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

    const newLink = newToken ? `${window.location.origin}/b/${newToken}` : '';

    return (
        <div>
            <div className="page-header">
                <div>
                    <button className="btn btn-secondary btn-sm" onClick={() => router.push('/admin/briefings')} style={{ marginBottom: 8 }}>
                        <ArrowLeft size={14} /> Voltar
                    </button>
                    <h1>{cycle.client.name}</h1>
                    <p>{cycle.template.name} — {formatMonthBR(dbDateToIso(new Date(cycle.referenceMonth)))}</p>
                </div>
            </div>

            <div className="page-content" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                {/* Header info */}
                <div className="card" style={{ padding: 'var(--space-4)', display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span className={`badge ${STATUS_BADGE[cycle.status] || 'badge-gray'}`}>{STATUS_LABEL[cycle.status] || cycle.status}</span>
                    {cycle.dueDate && <span className="text-sm text-muted">Prazo: {formatDateBR(dbDateToIso(new Date(cycle.dueDate)))}</span>}
                    {cycle.submittedAt && <span className="text-sm text-muted">Enviado em: {formatDateBR(dbDateToIso(new Date(cycle.submittedAt)))}</span>}
                </div>

                {/* Link block */}
                <div className="card" style={{ padding: 'var(--space-4)' }}>
                    <h2 style={{ fontSize: '1rem', marginBottom: 'var(--space-3)' }}>Link</h2>

                    {newToken ? (
                        <div style={{ marginBottom: 'var(--space-3)' }}>
                            <p style={{ fontWeight: 600, color: 'var(--color-warning)', marginBottom: 4 }}>Este link aparece uma única vez. Copie agora.</p>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <input className="form-input" readOnly value={newLink} onFocus={(e) => e.target.select()} />
                                <button type="button" className="btn btn-secondary" onClick={() => copy(newLink, 'link')}>
                                    {copiedLink ? <Check size={16} /> : <Copy size={16} />}
                                </button>
                            </div>
                        </div>
                    ) : activeLink ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 'var(--space-3)', fontSize: '0.85rem' }}>
                            <div>Status do link: <strong style={{
                                color: linkStatus === 'ativo' ? 'var(--color-success)' : linkStatus === 'expirado' ? 'var(--color-warning)' : 'var(--color-danger)',
                            }}>{linkStatus}</strong></div>
                            <div className="text-muted">Expira em {formatDateBR(dbDateToIso(new Date(activeLink.expiresAt)))}</div>
                            <div className="text-muted">Aberto {activeLink.opensCount}x{activeLink.lastOpenedAt ? ` — última vez em ${formatDateBR(dbDateToIso(new Date(activeLink.lastOpenedAt)))}` : ''}</div>
                            <div className="text-muted">Token: ······{activeLink.tokenPreview}</div>
                        </div>
                    ) : (
                        <p className="text-sm text-muted" style={{ marginBottom: 'var(--space-3)' }}>Nenhum link ativo.</p>
                    )}

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button className="btn btn-secondary btn-sm" onClick={handleRegenerate} disabled={busy || cycle.status === 'archived'}>
                            <RefreshCw size={14} /> Gerar novo link
                        </button>
                        {activeLink && !activeLink.revokedAt && (
                            <button className="btn btn-secondary btn-sm" onClick={handleRevoke} disabled={busy}>
                                <Ban size={14} /> Revogar link
                            </button>
                        )}
                    </div>
                </div>

                {/* CONFERIR */}
                {built.conferir.length > 0 && (
                    <div className="card" style={{ padding: 'var(--space-4)', borderColor: 'var(--color-warning)' }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, color: 'var(--color-warning)' }}>
                            <AlertTriangle size={16} /> <strong>Conferir</strong>
                        </div>
                        <ul style={{ margin: 0, paddingLeft: 20, fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
                            {built.conferir.map((c, i) => <li key={i}>{c}</li>)}
                        </ul>
                    </div>
                )}

                {/* Respostas */}
                <div className="card" style={{ padding: 'var(--space-4)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)', flexWrap: 'wrap', gap: 8 }}>
                        <h2 style={{ fontSize: '1rem', margin: 0 }}>Respostas</h2>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => copy(built.text, 'text')}>
                                {copiedText ? <Check size={14} /> : <Copy size={14} />} Copiar como texto
                            </button>
                            <button className="btn btn-secondary btn-sm" onClick={downloadTxt}><Download size={14} /> .txt</button>
                            <button className="btn btn-secondary btn-sm" onClick={downloadJson}><FileJson size={14} /> JSON</button>
                        </div>
                    </div>

                    {built.sections.length === 0 && built.emptySections.length === 0 && (
                        <p className="text-sm text-muted">Nenhuma resposta ainda.</p>
                    )}

                    {built.sections.map((section) => (
                        <div key={section.title} style={{ marginBottom: 'var(--space-4)' }}>
                            <h3 style={{ fontSize: '0.9rem', marginBottom: 8 }}>{section.title}</h3>
                            {section.kind === 'single' ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    {section.singleItems.map((item, i) => (
                                        <div key={i} style={{ fontSize: '0.85rem' }}><span className="text-muted">{item.label}:</span> {item.value}</div>
                                    ))}
                                </div>
                            ) : (
                                section.repeaterGroups.map((group, gi) => (
                                    <div key={gi} style={{ border: '1px solid var(--color-border-light)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', marginBottom: 8 }}>
                                        <strong style={{ fontSize: '0.85rem' }}>{group.itemLabel} {gi + 1}</strong>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                                            {group.items.map((item, i) => (
                                                <div key={i} style={{ fontSize: '0.85rem' }}><span className="text-muted">{item.label}:</span> {item.value}</div>
                                            ))}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    ))}

                    {built.emptySections.length > 0 && (
                        <div style={{ marginTop: 'var(--space-3)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--color-border-light)' }}>
                            {built.emptySections.map((es, i) => (
                                <p key={i} className="text-sm text-muted">{es.emptyLabel}</p>
                            ))}
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8 }}>
                    {cycle.status === 'submitted' && (
                        <button className="btn btn-secondary" onClick={handleReopen} disabled={busy}><RotateCcw size={16} /> Reabrir para edição</button>
                    )}
                    {cycle.status !== 'archived' && (
                        <button className="btn btn-secondary" onClick={handleArchive} disabled={busy}><Archive size={16} /> Arquivar</button>
                    )}
                </div>

                {/* Histórico */}
                <div className="card" style={{ padding: 'var(--space-4)' }}>
                    <h2 style={{ fontSize: '1rem', marginBottom: 'var(--space-3)' }}>Histórico</h2>
                    {cycle.events.length === 0 ? (
                        <p className="text-sm text-muted">Nenhum evento ainda.</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {cycle.events.map((ev) => (
                                <div key={ev.id} style={{ fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-secondary)' }}>
                                    <span>{EVENT_LABEL[ev.type] || ev.type}</span>
                                    <span className="text-muted">{new Date(ev.createdAt).toLocaleString('pt-BR')}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
