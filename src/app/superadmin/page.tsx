'use client';

import { useEffect, useState } from 'react';
import { Building2, Users, FolderKanban, FileText, DollarSign, UserCheck, AlertTriangle, CheckCircle } from 'lucide-react';

interface DashboardData {
    tenants: number;
    activeTenants: number;
    suspendedTenants: number;
    members: number;
    clients: number;
    projects: number;
    files: number;
    invoices: number;
    recentTenants: Array<{
        id: string;
        name: string;
        slug: string;
        status: string;
        createdAt: string;
        _count: { clients: number; members: number };
    }>;
}

export default function SuperAdminDashboard() {
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetch('/api/superadmin/dashboard')
            .then(r => {
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                return r.json();
            })
            .then(d => setData(d.data))
            .catch(e => setError(e.message || 'Erro ao carregar dashboard'))
            .finally(() => setLoading(false));
    }, []);

    const statusBadge = (s: string) => {
        const map: Record<string, string> = { ACTIVE: 'badge-success', SUSPENDED: 'badge-danger', TRIAL: 'badge-info' };
        return map[s] || 'badge-gray';
    };
    const statusLabel = (s: string) => {
        const map: Record<string, string> = { ACTIVE: 'Ativo', SUSPENDED: 'Suspenso', TRIAL: 'Trial' };
        return map[s] || s;
    };

    return (
        <div>
            <div className="page-header">
                <h1>Dashboard</h1>
                <p>Visão geral da plataforma</p>
            </div>

            <div className="page-content">
                {loading ? (
                    <div className="card animate-pulse" style={{ height: 200 }} />
                ) : data ? (
                    <>
                        {/* Stats Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
                            {[
                                { icon: <Building2 size={18} />, color: '#6366f1', value: String(data.tenants), label: 'Total Flows', sub: `${data.activeTenants} ativos` },
                                { icon: <Users size={18} />, color: '#06b6d4', value: String(data.members), label: 'Membros', sub: 'Em todos os flows' },
                                { icon: <UserCheck size={18} />, color: '#10b981', value: String(data.clients), label: 'Clientes', sub: 'Total na plataforma' },
                                { icon: <FolderKanban size={18} />, color: '#f59e0b', value: String(data.projects), label: 'Projetos', sub: `${data.files} arquivos` },
                                { icon: <DollarSign size={18} />, color: '#8b5cf6', value: String(data.invoices), label: 'Faturas', sub: 'Total geradas' },
                                { icon: <FileText size={18} />, color: '#ec4899', value: String(data.files), label: 'Arquivos', sub: 'No Google Drive' },
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

                        {/* Status Summary */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginBottom: 24 }}>
                            <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
                                <div style={{ width: 42, height: 42, borderRadius: 12, background: '#10b98118', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                                    <CheckCircle size={20} />
                                </div>
                                <div>
                                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#10b981' }}>{data.activeTenants}</div>
                                    <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>Flows Ativos</div>
                                </div>
                            </div>
                            <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
                                <div style={{ width: 42, height: 42, borderRadius: 12, background: '#ef444418', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
                                    <AlertTriangle size={20} />
                                </div>
                                <div>
                                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ef4444' }}>{data.suspendedTenants}</div>
                                    <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>Flows Suspensos</div>
                                </div>
                            </div>
                        </div>

                        {/* Recent Tenants */}
                        <div className="card">
                            <div className="card-header">
                                <h2 className="card-title">Flows Recentes</h2>
                            </div>
                            <div className="table-container">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Nome</th>
                                            <th>Slug</th>
                                            <th>Status</th>
                                            <th>Clientes</th>
                                            <th>Membros</th>
                                            <th>Criado em</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.recentTenants.map(t => (
                                            <tr key={t.id}>
                                                <td className="font-semibold">{t.name}</td>
                                                <td className="text-muted">{t.slug}</td>
                                                <td><span className={`badge ${statusBadge(t.status)}`}>{statusLabel(t.status)}</span></td>
                                                <td>{t._count.clients}</td>
                                                <td>{t._count.members}</td>
                                                <td className="text-muted text-sm">{new Date(t.createdAt).toLocaleDateString('pt-BR')}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                ) : null}
            </div>
        </div>
    );
}
