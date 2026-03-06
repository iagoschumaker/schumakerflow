'use client';

import { useEffect, useState } from 'react';
import { FolderKanban, DollarSign, CheckCircle, Sparkles, FileText, Calendar, Loader2 } from 'lucide-react';

interface DashboardData {
    client: { id: string; name: string } | null;
    recentFiles: Array<{
        id: string;
        name: string;
        kind: string;
        publishedAt: string | null;
        sizeBytes: string | null;
        lastDownload: { completedAt: string } | null;
        project: { name: string };
    }>;
    pendingInvoices: Array<{
        id: string;
        dueDate: string;
        totalAmount: string;
        status: string;
    }>;
    stats: {
        totalProjects: number;
        pendingInvoices: number;
    };
}

const formatCurrency = (v: number | string) => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
const statusColor = (s: string) => ({ PENDING: '#f59e0b', PAID: '#22c55e', OVERDUE: '#ef4444', CANCELLED: '#9ca3af' }[s] || '#9ca3af');
const statusLabel = (s: string) => ({ PENDING: 'Pendente', PAID: 'Pago', OVERDUE: 'Atrasada', CANCELLED: 'Cancelada' }[s] || s);

export default function PortalDashboard() {
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/portal/dashboard')
            .then((r) => r.json())
            .then((d) => setData(d.data || null))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div>
                <div className="page-header">
                    <h1>Bem-vindo</h1>
                    <p>Carregando seu painel...</p>
                </div>
                <div className="page-content">
                    <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Loader2 size={28} className="animate-spin" style={{ color: 'var(--color-primary)' }} /></div>
                </div>
            </div>
        );
    }

    return (
        <div>
            <div className="page-header">
                <h1>Bem-vindo, {data?.client?.name || 'Cliente'} 👋</h1>
                <p>Acompanhe seus projetos, arquivos e financeiro</p>
            </div>

            <div className="page-content">
                {/* Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
                    {[
                        { icon: <FolderKanban size={18} />, color: '#06b6d4', value: String(data?.stats.totalProjects || 0), label: 'Projetos', sub: 'em andamento' },
                        { icon: data?.stats.pendingInvoices ? <DollarSign size={18} /> : <CheckCircle size={18} />, color: data?.stats.pendingInvoices ? '#f59e0b' : '#22c55e', value: String(data?.stats.pendingInvoices || 0), label: 'Faturas Pendentes', sub: data?.stats.pendingInvoices ? 'a pagar' : 'tudo em dia' },
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

                {/* Recent Files - Card based */}
                <div style={{ marginBottom: 24 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Arquivos Recentes</h2>
                        <a href="/portal/projects" className="btn btn-secondary btn-sm" style={{ fontSize: '0.75rem' }}>Ver todos</a>
                    </div>

                    {data?.recentFiles && data.recentFiles.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {data.recentFiles.map((file) => (
                                <div key={file.id} className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{ width: 36, height: 36, borderRadius: 10, background: '#6366f112', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <FileText size={16} style={{ color: '#6366f1' }} />
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 700, fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 2 }}>
                                            <span>{file.project?.name}</span>
                                            <span className={`badge ${file.kind === 'FINAL' ? 'badge-success' : file.kind === 'PREVIEW' ? 'badge-info' : 'badge-gray'}`} style={{ fontSize: '0.6rem', padding: '0 6px' }}>{file.kind}</span>
                                            {file.publishedAt && <span>{new Date(file.publishedAt).toLocaleDateString('pt-BR')}</span>}
                                        </div>
                                    </div>
                                    {!file.lastDownload && (
                                        <span className="badge badge-warning" style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.65rem', flexShrink: 0 }}>
                                            <Sparkles size={10} /> Novo
                                        </span>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
                            <FileText size={32} style={{ color: 'var(--color-text-muted)', margin: '0 auto 8px' }} />
                            <p className="text-muted" style={{ fontSize: '0.85rem' }}>Nenhum arquivo recente</p>
                        </div>
                    )}
                </div>

                {/* Pending Invoices - Card based */}
                {data?.pendingInvoices && data.pendingInvoices.length > 0 && (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: 0 }}>Faturas Pendentes</h2>
                            <a href="/portal/finance" className="btn btn-secondary btn-sm" style={{ fontSize: '0.75rem' }}>Ver todas</a>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {data.pendingInvoices.map((inv) => (
                                <div key={inv.id} className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, borderLeft: `3px solid ${statusColor(inv.status)}` }}>
                                    <div style={{ width: 36, height: 36, borderRadius: 10, background: `${statusColor(inv.status)}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <DollarSign size={16} style={{ color: statusColor(inv.status) }} />
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                            <span style={{ fontSize: '0.65rem', fontWeight: 600, padding: '1px 8px', borderRadius: 6, background: `${statusColor(inv.status)}15`, color: statusColor(inv.status) }}>{statusLabel(inv.status)}</span>
                                        </div>
                                        <div style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 3, marginTop: 3 }}>
                                            <Calendar size={11} /> Venc: {new Date(inv.dueDate).toLocaleDateString('pt-BR')}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                        <div style={{ fontSize: '1.05rem', fontWeight: 800, color: statusColor(inv.status) }}>{formatCurrency(inv.totalAmount)}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
