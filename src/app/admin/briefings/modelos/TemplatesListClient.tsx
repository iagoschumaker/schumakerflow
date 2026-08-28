'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LayoutTemplate, Plus, ArrowLeft } from 'lucide-react';
import FloatingActionButton from '@/components/FloatingActionButton';

interface Template {
    id: string;
    name: string;
    description: string | null;
    isActive: boolean;
    _count: { sections: number; cycles: number };
}

export default function BriefingTemplatesPage() {
    const router = useRouter();
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/admin/briefings/templates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'list' }),
        })
            .then((r) => r.json())
            .then((data) => {
                setTemplates(data.data || []);
                setLoading(false);
            });
    }, []);

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
                        <h1 style={{ margin: 0 }}>Modelos de briefing</h1>
                        <p className="text-muted" style={{ marginTop: 4 }}>As seções e campos que compõem cada formulário</p>
                    </div>
                </div>
            </div>

            <div className="page-content">
                <div className="card" style={{ padding: 0 }}>
                    <div className="card-header" style={{ padding: 'var(--space-5) var(--space-6) 0' }}>
                        <h2 className="card-title">Modelos</h2>
                    </div>

                    {loading ? (
                        <div style={{ padding: 'var(--space-6)' }}><div className="animate-pulse" style={{ height: 160, borderRadius: 'var(--radius-md)', background: 'var(--color-bg)' }} /></div>
                    ) : templates.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-icon"><LayoutTemplate size={32} /></div>
                            <h3>Nenhum modelo ainda</h3>
                            <p className="text-sm text-muted">
                                Um modelo define as seções e campos que o cliente vai preencher. Crie um para poder gerar briefings.
                            </p>
                            <button className="btn btn-primary mt-4" onClick={() => router.push('/admin/briefings/modelos/novo')}>
                                <Plus size={16} /> Criar o primeiro
                            </button>
                        </div>
                    ) : (
                        <div className="table-container" style={{ border: 'none', borderTop: '1px solid var(--color-border)', marginTop: 'var(--space-5)', borderRadius: 0 }}>
                            <table>
                                <thead>
                                    <tr>
                                        <th>Nome</th>
                                        <th>Seções</th>
                                        <th>Status</th>
                                        <th>Em uso</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {templates.map((t) => (
                                        <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => router.push(`/admin/briefings/modelos/${t.id}`)}>
                                            <td data-label="Nome" className="font-semibold">
                                                {t.name}
                                                {t.description && <div className="text-xs text-muted" style={{ fontWeight: 400, marginTop: 2 }}>{t.description}</div>}
                                            </td>
                                            <td data-label="Seções">{t._count.sections}</td>
                                            <td data-label="Status">
                                                <span className={`badge ${t.isActive ? 'badge-success' : 'badge-gray'}`}>{t.isActive ? 'Ativo' : 'Inativo'}</span>
                                            </td>
                                            <td data-label="Em uso" className="text-secondary">{t._count.cycles} ciclo(s)</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            <FloatingActionButton actions={[
                { label: 'Novo modelo', icon: <Plus size={18} />, onClick: () => router.push('/admin/briefings/modelos/novo') },
            ]} />
        </div>
    );
}
