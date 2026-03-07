'use client';

import { useEffect, useState } from 'react';
import { FolderKanban, DollarSign, AlertTriangle, CheckCircle, Users, FileText, Calendar, Clock, ExternalLink, MapPin } from 'lucide-react';

interface DashboardData {
    clients: number;
    projects: number;
    files: number;
    pendingInvoices: number;
    overdueInvoices: number;
    recentProjects: Array<{
        id: string;
        name: string;
        status: string;
        client: { name: string };
        createdAt: string;
    }>;
}

interface CalEvent {
    id: string;
    summary: string;
    start: string;
    end: string;
    allDay: boolean;
    htmlLink: string;
    location: string;
}

interface Invoice {
    id: string;
    amount: number;
    dueDate: string;
    status: string;
    referenceMonth: string;
    notes: string;
    contract: {
        name: string;
        client: { name: string };
    };
}

function formatTime(dateStr: string) {
    if (!dateStr || !dateStr.includes('T')) return '';
    return new Date(dateStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatCurrency(v: number) {
    return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function AdminDashboard() {
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [todayEvents, setTodayEvents] = useState<CalEvent[]>([]);
    const [todayInvoices, setTodayInvoices] = useState<Invoice[]>([]);
    const [eventsLoading, setEventsLoading] = useState(true);

    useEffect(() => {
        async function loadDashboard() {
            try {
                const [clientsRes, projectsRes, financeRes] = await Promise.all([
                    fetch('/api/admin/clients'),
                    fetch('/api/admin/projects'),
                    fetch('/api/admin/finance?tab=invoices'),
                ]);

                const clients = await clientsRes.json();
                const projects = await projectsRes.json();
                const invoices = await financeRes.json();

                const clientList = clients.data || [];
                const projectList = projects.data || [];
                const invoiceList: Invoice[] = invoices.data || [];

                // Filter today's open invoices (due today or overdue)
                const today = new Date();
                const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                const openInvoices = invoiceList.filter((inv: Invoice) => {
                    const due = inv.dueDate?.split('T')[0];
                    return (inv.status === 'PENDING' || inv.status === 'OVERDUE') && due && due <= todayStr;
                });
                setTodayInvoices(openInvoices);

                setData({
                    clients: clientList.length,
                    projects: projectList.length,
                    files: projectList.reduce((s: number, p: Record<string, { files: number }>) => s + (p._count?.files || 0), 0),
                    pendingInvoices: invoiceList.filter((i: Invoice) => i.status === 'PENDING').length,
                    overdueInvoices: invoiceList.filter((i: Invoice) => i.status === 'OVERDUE').length,
                    recentProjects: projectList.slice(0, 5),
                });
            } catch (error) {
                console.error('Failed to load dashboard:', error);
            } finally {
                setLoading(false);
            }
        }

        async function loadEvents() {
            try {
                const today = new Date();
                const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
                const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59).toISOString();
                const res = await fetch(`/api/admin/calendar?start=${start}&end=${end}`);
                const d = await res.json();
                if (d.data) {
                    // Sort by start time
                    const sorted = (d.data as CalEvent[]).sort((a: CalEvent, b: CalEvent) => new Date(a.start).getTime() - new Date(b.start).getTime());
                    setTodayEvents(sorted);
                }
            } catch {
                // Calendar might not be connected — fail silently
            } finally {
                setEventsLoading(false);
            }
        }

        loadDashboard();
        loadEvents();
    }, []);

    if (loading) {
        return (
            <div>
                <div className="page-header">
                    <h1>Dashboard</h1>
                    <p>Visão geral do seu negócio</p>
                </div>
                <div className="page-content">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="card animate-pulse" style={{ padding: '14px 16px', height: 80 }} />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div>
            <div className="page-header">
                <h1>Dashboard</h1>
                <p>Visão geral do seu negócio</p>
            </div>

            <div className="page-content">
                {/* Stats Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
                    {[
                        { icon: <Users size={18} />, color: '#6366f1', value: String(data?.clients || 0), label: 'Clientes', sub: 'cadastrados' },
                        { icon: <FolderKanban size={18} />, color: '#06b6d4', value: String(data?.projects || 0), label: 'Projetos', sub: `${data?.files || 0} arquivos` },
                        { icon: <DollarSign size={18} />, color: '#f59e0b', value: String(data?.pendingInvoices || 0), label: 'Faturas Pendentes', sub: 'a receber' },
                        { icon: data?.overdueInvoices ? <AlertTriangle size={18} /> : <CheckCircle size={18} />, color: data?.overdueInvoices ? '#ef4444' : '#22c55e', value: String(data?.overdueInvoices || 0), label: data?.overdueInvoices ? 'Atrasadas' : 'Em dia', sub: data?.overdueInvoices ? 'requer atenção' : 'nenhuma atrasada' },
                    ].map((c, i) => (
                        <div key={i} className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, borderLeft: `3px solid ${c.color}` }}>
                            <div style={{ width: 36, height: 36, borderRadius: 10, background: `${c.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.color, flexShrink: 0 }}>{c.icon}</div>
                            <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: c.color, lineHeight: 1.2 }}>{c.value}</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', lineHeight: 1.3 }}>{c.label}</div>
                                <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', opacity: 0.7 }}>{c.sub}</div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Today's Sections — Events + Invoices side by side */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginBottom: 24 }}>

                    {/* Today's Events */}
                    <div className="card">
                        <div className="card-header">
                            <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Calendar size={16} style={{ color: 'var(--color-primary)' }} />
                                Agenda de Hoje
                            </h2>
                            <a href="/admin/calendar" className="btn btn-secondary btn-sm">Ver agenda</a>
                        </div>
                        <div style={{ padding: 'var(--space-3)' }}>
                            {eventsLoading ? (
                                <div style={{ padding: 20, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                                    Carregando...
                                </div>
                            ) : todayEvents.length === 0 ? (
                                <div style={{ padding: 20, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                                    <Calendar size={24} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                                    <div>Nenhum evento hoje</div>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {todayEvents.map((ev: CalEvent) => (
                                        <div key={ev.id} style={{
                                            display: 'flex', alignItems: 'flex-start', gap: 10,
                                            padding: '10px 12px', borderRadius: 'var(--radius-md)',
                                            background: 'var(--color-bg)', border: '1px solid var(--color-border)',
                                            transition: 'border-color 0.15s',
                                        }}>
                                            <div style={{
                                                width: 4, minHeight: 32, borderRadius: 2,
                                                background: 'var(--color-primary)', flexShrink: 0, marginTop: 2,
                                            }} />
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {ev.summary}
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                                    <Clock size={12} />
                                                    {ev.allDay ? 'Dia inteiro' : `${formatTime(ev.start)} – ${formatTime(ev.end)}`}
                                                </div>
                                                {ev.location && (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                                                        <MapPin size={12} /> {ev.location}
                                                    </div>
                                                )}
                                            </div>
                                            {ev.htmlLink && (
                                                <a href={ev.htmlLink} target="_blank" rel="noreferrer" style={{ color: 'var(--color-text-muted)', flexShrink: 0, marginTop: 2 }} title="Abrir no Google Calendar">
                                                    <ExternalLink size={14} />
                                                </a>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Today's Open Invoices */}
                    <div className="card">
                        <div className="card-header">
                            <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <DollarSign size={16} style={{ color: '#f59e0b' }} />
                                Faturas em Aberto
                            </h2>
                            <a href="/admin/finance" className="btn btn-secondary btn-sm">Ver financeiro</a>
                        </div>
                        <div style={{ padding: 'var(--space-3)' }}>
                            {todayInvoices.length === 0 ? (
                                <div style={{ padding: 20, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                                    <CheckCircle size={24} style={{ margin: '0 auto 8px', color: '#22c55e', opacity: 0.6 }} />
                                    <div>Nenhuma fatura vencida</div>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    {todayInvoices.map((inv: Invoice) => {
                                        const isOverdue = inv.status === 'OVERDUE';
                                        const dueDate = inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('pt-BR') : '';
                                        return (
                                            <div key={inv.id} style={{
                                                display: 'flex', alignItems: 'flex-start', gap: 10,
                                                padding: '10px 12px', borderRadius: 'var(--radius-md)',
                                                background: 'var(--color-bg)', border: '1px solid var(--color-border)',
                                            }}>
                                                <div style={{
                                                    width: 4, minHeight: 32, borderRadius: 2,
                                                    background: isOverdue ? '#ef4444' : '#f59e0b', flexShrink: 0, marginTop: 2,
                                                }} />
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                                                        <span style={{ fontWeight: 700, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {inv.contract?.client?.name || 'Cliente'}
                                                        </span>
                                                        <span className={`badge ${isOverdue ? 'badge-danger' : 'badge-warning'}`} style={{ fontSize: '0.6rem', padding: '1px 6px' }}>
                                                            {isOverdue ? 'Atrasada' : 'Pendente'}
                                                        </span>
                                                    </div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                                                        {inv.contract?.name} · Vence {dueDate}
                                                    </div>
                                                </div>
                                                <div style={{ fontWeight: 800, fontSize: '0.9rem', color: isOverdue ? '#ef4444' : '#f59e0b', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                                    {formatCurrency(inv.amount || 0)}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Recent Projects */}
                <div className="card">
                    <div className="card-header">
                        <h2 className="card-title">Projetos Recentes</h2>
                        <a href="/admin/projects" className="btn btn-secondary btn-sm">Ver todos</a>
                    </div>

                    {data?.recentProjects && data.recentProjects.length > 0 ? (
                        <div className="table-container" style={{ border: 'none' }}>
                            <table>
                                <thead>
                                    <tr>
                                        <th>Projeto</th>
                                        <th>Cliente</th>
                                        <th>Status</th>
                                        <th>Data</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.recentProjects.map((project) => (
                                        <tr key={project.id}>
                                            <td data-label="Projeto" className="font-semibold">{project.name}</td>
                                            <td data-label="Cliente" className="text-secondary">{project.client?.name}</td>
                                            <td data-label="Status">
                                                <span className={`badge ${project.status === 'DELIVERED' ? 'badge-success' :
                                                    project.status === 'IN_PRODUCTION' ? 'badge-info' :
                                                        project.status === 'IN_REVIEW' ? 'badge-warning' :
                                                            'badge-gray'
                                                    }`}>
                                                    {project.status === 'DELIVERED' ? 'Entregue' :
                                                        project.status === 'IN_PRODUCTION' ? 'Em Produção' :
                                                            project.status === 'IN_REVIEW' ? 'Em Revisão' :
                                                                project.status === 'DRAFT' ? 'Rascunho' :
                                                                    project.status}
                                                </span>
                                            </td>
                                            <td data-label="Data" className="text-muted text-sm">
                                                {new Date(project.createdAt).toLocaleDateString('pt-BR')}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="empty-state">
                            <div className="empty-icon"><FolderKanban size={32} /></div>
                            <h3>Nenhum projeto ainda</h3>
                            <p className="text-sm text-muted">Crie seu primeiro projeto para começar.</p>
                            <a href="/admin/projects" className="btn btn-primary mt-4">Criar Projeto</a>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
