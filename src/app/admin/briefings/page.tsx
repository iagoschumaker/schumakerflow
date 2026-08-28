'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ClipboardList, Plus, Send, PencilLine, CheckCircle2, AlertTriangle, LayoutTemplate } from 'lucide-react';
import { formatMonthBR, formatDateBR, dbDateToIso } from '@/lib/briefings/dates';
import FloatingActionButton from '@/components/FloatingActionButton';

interface Cycle {
    id: string;
    status: string;
    referenceMonth: string;
    dueDate: string | null;
    archivedAt: string | null;
    client: { id: string; name: string };
    template: { id: string; name: string };
    links: { id: string }[];
    answers: { updatedAt: string }[];
    events: { createdAt: string }[];
}

interface Client { id: string; name: string; isActive: boolean }

const STATUS_LABEL: Record<string, string> = {
    draft: 'Rascunho',
    sent: 'Enviado',
    in_progress: 'Preenchendo',
    submitted: 'Recebido',
};

const STATUS_BADGE: Record<string, string> = {
    draft: 'badge-gray',
    sent: 'badge-info',
    in_progress: 'badge-warning',
    submitted: 'badge-success',
};

export default function BriefingsListPage() {
    const router = useRouter();
    const [cycles, setCycles] = useState<Cycle[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
    const [clientFilter, setClientFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [monthFilter, setMonthFilter] = useState('');
    const [showArchived, setShowArchived] = useState(false);

    useEffect(() => {
        fetch('/api/admin/clients')
            .then((r) => r.json())
            .then((data) => setClients((data.data || []).filter((c: Client) => c.isActive)));
    }, []);

    useEffect(() => {
        let cancelled = false;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- no data-fetching lib in this project (see other admin pages); this is the existing fetch-on-mount/fetch-on-filter-change pattern.
        setLoading(true);
        fetch('/api/admin/briefings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'list',
                ...(clientFilter ? { clientId: clientFilter } : {}),
                ...(statusFilter ? { status: statusFilter } : {}),
                ...(monthFilter ? { referenceMonth: monthFilter } : {}),
                ...(showArchived ? { showArchived: true } : {}),
            }),
        })
            .then((r) => r.json())
            .then((data) => {
                if (cancelled) return;
                setCycles(data.data?.cycles || []);
                setLoading(false);
            });
        return () => { cancelled = true; };
    }, [clientFilter, statusFilter, monthFilter, showArchived]);

    const isOverdue = (cycle: Cycle) => {
        if (!cycle.dueDate || cycle.status === 'submitted' || cycle.archivedAt) return false;
        return dbDateToIso(new Date(cycle.dueDate)) < new Date().toISOString().slice(0, 10);
    };

    const lastUpdate = (cycle: Cycle) => {
        const candidates = [cycle.answers[0]?.updatedAt, cycle.events[0]?.createdAt].filter(Boolean) as string[];
        if (candidates.length === 0) return null;
        return candidates.sort().reverse()[0];
    };

    const stats = {
        sent: cycles.filter((c) => c.status === 'sent').length,
        inProgress: cycles.filter((c) => c.status === 'in_progress').length,
        submitted: cycles.filter((c) => c.status === 'submitted').length,
        overdue: cycles.filter(isOverdue).length,
    };

    return (
        <div>
            <div className="page-header">
                <h1>Briefings</h1>
                <p>Colete informações dos clientes para o planejamento do mês</p>
            </div>

            <div className="page-content">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
                    {[
                        { icon: <Send size={18} />, color: 'var(--color-info)', value: stats.sent, label: 'Enviados', sub: 'aguardando' },
                        { icon: <PencilLine size={18} />, color: 'var(--color-warning)', value: stats.inProgress, label: 'Preenchendo', sub: 'em andamento' },
                        { icon: <CheckCircle2 size={18} />, color: 'var(--color-success)', value: stats.submitted, label: 'Recebidos', sub: 'prontos' },
                        { icon: <AlertTriangle size={18} />, color: 'var(--color-danger)', value: stats.overdue, label: 'Atrasados', sub: 'passou do prazo' },
                    ].map((c, i) => (
                        <div key={i} className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, borderLeft: `3px solid ${c.color}` }}>
                            <div style={{ width: 36, height: 36, borderRadius: 10, background: `color-mix(in srgb, ${c.color} 14%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.color, flexShrink: 0 }}>{c.icon}</div>
                            <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: c.color, lineHeight: 1.2 }}>{c.value}</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', lineHeight: 1.3 }}>{c.label}</div>
                                <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', opacity: 0.7 }}>{c.sub}</div>
                            </div>
                        </div>
                    ))}
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-5)', flexWrap: 'wrap' }}>
                    <select className="form-input" style={{ maxWidth: 220 }} value={clientFilter} onChange={(e) => setClientFilter(e.target.value)}>
                        <option value="">Todos os clientes</option>
                        {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <select className="form-input" style={{ maxWidth: 180 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                        <option value="">Todos os status</option>
                        {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    <input type="month" className="form-input" style={{ maxWidth: 180 }} value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} />
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.85rem', color: 'var(--color-text-secondary)', cursor: 'pointer', paddingInline: 4 }}>
                        <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
                        Mostrar arquivados
                    </label>
                </div>

                <div className="card" style={{ padding: 0 }}>
                    <div className="card-header" style={{ padding: 'var(--space-5) var(--space-6) 0' }}>
                        <h2 className="card-title">Ciclos</h2>
                        <button className="btn btn-secondary btn-sm" onClick={() => router.push('/admin/briefings/modelos')}>
                            <LayoutTemplate size={14} /> Modelos
                        </button>
                    </div>

                    {loading ? (
                        <div style={{ padding: 'var(--space-6)' }}><div className="animate-pulse" style={{ height: 160, borderRadius: 'var(--radius-md)', background: 'var(--color-bg)' }} /></div>
                    ) : cycles.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-icon"><ClipboardList size={32} /></div>
                            <h3>Nenhum briefing ainda</h3>
                            <p className="text-sm text-muted">
                                Um briefing é um formulário que o cliente preenche pelo link, sem precisar de login,
                                para você planejar o conteúdo do mês.
                            </p>
                            <button className="btn btn-primary mt-4" onClick={() => router.push('/admin/briefings/novo')}>
                                <Plus size={16} /> Criar o primeiro
                            </button>
                        </div>
                    ) : (
                        <div className="table-container" style={{ border: 'none', borderTop: '1px solid var(--color-border)', marginTop: 'var(--space-5)', borderRadius: 0 }}>
                            <table>
                                <thead>
                                    <tr>
                                        <th>Cliente</th>
                                        <th>Modelo</th>
                                        <th>Mês</th>
                                        <th>Status</th>
                                        <th>Prazo</th>
                                        <th>Atualizado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {cycles.map((cycle) => {
                                        const update = lastUpdate(cycle);
                                        const overdue = isOverdue(cycle);
                                        return (
                                            <tr key={cycle.id} style={{ cursor: 'pointer' }} onClick={() => router.push(`/admin/briefings/${cycle.id}`)}>
                                                <td data-label="Cliente" className="font-semibold">{cycle.client.name}</td>
                                                <td data-label="Modelo" className="text-secondary">{cycle.template.name}</td>
                                                <td data-label="Mês">{formatMonthBR(dbDateToIso(new Date(cycle.referenceMonth)))}</td>
                                                <td data-label="Status">
                                                    <span className={`badge ${STATUS_BADGE[cycle.status] || 'badge-gray'}`}>{STATUS_LABEL[cycle.status] || cycle.status}</span>
                                                    {cycle.archivedAt && <span className="badge badge-gray" style={{ marginLeft: 6 }}>Arquivado</span>}
                                                </td>
                                                <td data-label="Prazo" style={overdue ? { color: 'var(--color-danger)', fontWeight: 600 } : undefined}>
                                                    {cycle.dueDate ? formatDateBR(dbDateToIso(new Date(cycle.dueDate))) : '—'}
                                                </td>
                                                <td data-label="Atualizado" className="text-secondary text-sm">
                                                    {update ? formatDateBR(dbDateToIso(new Date(update))) : '—'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            <FloatingActionButton actions={[
                { label: 'Novo briefing', icon: <Plus size={18} />, onClick: () => router.push('/admin/briefings/novo') },
            ]} />
        </div>
    );
}
