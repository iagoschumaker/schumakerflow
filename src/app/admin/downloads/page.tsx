'use client';

import { useEffect, useState } from 'react';
import { Download, Search, X, FileText, User, Calendar, Wifi } from 'lucide-react';

interface DownloadEvent {
    id: string;
    status: string;
    ip: string | null;
    startedAt: string;
    completedAt: string | null;
    file: { name: string; kind: string; project: { name: string; client: { name: string } } };
    clientUser: { name: string; email: string } | null;
}

const statusLabel = (s: string) => {
    const m: Record<string, string> = { STARTED: 'Iniciado', COMPLETED: 'Concluído', FAILED: 'Falhou' };
    return m[s] || s;
};

const statusColor = (s: string) => {
    const m: Record<string, string> = { STARTED: '#3b82f6', COMPLETED: '#22c55e', FAILED: '#ef4444' };
    return m[s] || '#9ca3af';
};

const kindLabel = (k: string) => {
    const m: Record<string, string> = { PREVIEW: 'Prévia', FINAL: 'Final', RAW: 'Bruto', OTHER: 'Outro' };
    return m[k] || k;
};

export default function DownloadsPage() {
    const [events, setEvents] = useState<DownloadEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        fetch('/api/admin/downloads')
            .then((r) => r.json())
            .then((d) => setEvents(d.data || []))
            .finally(() => setLoading(false));
    }, []);

    const filtered = events.filter(ev => {
        const q = search.toLowerCase();
        return (
            ev.file?.name?.toLowerCase().includes(q) ||
            ev.file?.project?.name?.toLowerCase().includes(q) ||
            ev.file?.project?.client?.name?.toLowerCase().includes(q) ||
            ev.clientUser?.name?.toLowerCase().includes(q) ||
            ev.clientUser?.email?.toLowerCase().includes(q)
        );
    });

    const stats = {
        total: events.length,
        completed: events.filter(e => e.status === 'COMPLETED').length,
        failed: events.filter(e => e.status === 'FAILED').length,
    };

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1>Downloads</h1>
                    <p>Histórico de downloads dos clientes</p>
                </div>
            </div>

            {/* Stats pills */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 'var(--space-4)' }}>
                {[
                    { label: 'downloads', value: stats.total, color: 'var(--color-primary)', icon: <Download size={14} /> },
                    { label: 'concluídos', value: stats.completed, color: '#22c55e', icon: <FileText size={14} /> },
                    { label: 'falharam', value: stats.failed, color: '#ef4444', icon: <X size={14} /> },
                ].map((s, i) => (
                    <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '6px 14px', borderRadius: 999,
                        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                        fontSize: '0.82rem',
                    }}>
                        <span style={{ color: s.color }}>{s.icon}</span>
                        <span style={{ fontWeight: 700 }}>{s.value}</span>
                        <span className="text-muted">{s.label}</span>
                    </div>
                ))}
            </div>

            {/* Search bar */}
            <div style={{ position: 'relative', marginBottom: 'var(--space-4)' }}>
                <Search size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', pointerEvents: 'none' }} />
                <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar por arquivo, projeto, cliente, usuário..."
                    style={{
                        width: '100%', padding: '10px 14px 10px 44px',
                        border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)',
                        fontSize: '0.9rem', background: 'var(--color-bg)', outline: 'none',
                        color: 'var(--color-text)',
                    }}
                    onFocus={(e) => { e.target.style.borderColor = 'var(--color-primary)'; e.target.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.1)'; }}
                    onBlur={(e) => { e.target.style.borderColor = 'var(--color-border)'; e.target.style.boxShadow = 'none'; }}
                />
                {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: 'var(--color-text-muted)' }}><X size={16} /></button>}
            </div>

            {loading ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 'var(--space-3)' }}>
                    {[1, 2, 3].map(i => <div key={i} className="card animate-pulse" style={{ height: 120 }} />)}
                </div>
            ) : filtered.length === 0 ? (
                <div className="card empty-state">
                    <div className="empty-icon"><Download size={32} /></div>
                    <h3>{search ? 'Nenhum download encontrado' : 'Nenhum download registrado'}</h3>
                    <p className="text-sm text-muted">{search ? 'Tente outra busca.' : 'Os downloads aparecerão aqui quando os clientes baixarem arquivos.'}</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 'var(--space-3)' }}>
                    {filtered.map((ev) => (
                        <div key={ev.id} className="card" style={{
                            padding: 0, overflow: 'hidden',
                            transition: 'all 0.2s ease',
                        }}
                            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.08)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                        >
                            {/* Top color strip */}
                            <div style={{ height: 3, background: statusColor(ev.status) }} />
                            <div style={{ padding: 'var(--space-4)' }}>
                                {/* File info */}
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                                    <div style={{
                                        width: 40, height: 40, borderRadius: 10,
                                        background: `${statusColor(ev.status)}14`,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: statusColor(ev.status), flexShrink: 0,
                                    }}>
                                        <Download size={18} />
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {ev.file?.name || 'Arquivo'}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                                            {ev.file?.project?.name || '—'} • {ev.file?.project?.client?.name || '—'}
                                        </div>
                                    </div>
                                    <div style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 4,
                                        padding: '2px 8px', borderRadius: 999,
                                        fontSize: '0.7rem', fontWeight: 600,
                                        background: `${statusColor(ev.status)}18`,
                                        color: statusColor(ev.status),
                                    }}>
                                        {statusLabel(ev.status)}
                                    </div>
                                </div>

                                {/* Details */}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', fontSize: '0.78rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-muted)' }}>
                                        <User size={12} />
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {ev.clientUser?.name || 'Anônimo'}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-muted)' }}>
                                        <FileText size={12} />
                                        <span>{kindLabel(ev.file?.kind)}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-muted)' }}>
                                        <Calendar size={12} />
                                        <span>{new Date(ev.startedAt).toLocaleString('pt-BR')}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-muted)' }}>
                                        <Wifi size={12} />
                                        <span>{ev.ip || '—'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
