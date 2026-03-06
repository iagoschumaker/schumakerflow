'use client';

import { useEffect, useState } from 'react';
import { FolderKanban, DollarSign, AlertTriangle, CheckCircle, Users, FileText } from 'lucide-react';

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

export default function AdminDashboard() {
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);

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
                const invoiceList = invoices.data || [];

                setData({
                    clients: clientList.length,
                    projects: projectList.length,
                    files: projectList.reduce((s: number, p: Record<string, { files: number }>) => s + (p._count?.files || 0), 0),
                    pendingInvoices: invoiceList.filter((i: Record<string, string>) => i.status === 'PENDING').length,
                    overdueInvoices: invoiceList.filter((i: Record<string, string>) => i.status === 'OVERDUE').length,
                    recentProjects: projectList.slice(0, 5),
                });
            } catch (error) {
                console.error('Failed to load dashboard:', error);
            } finally {
                setLoading(false);
            }
        }

        loadDashboard();
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
