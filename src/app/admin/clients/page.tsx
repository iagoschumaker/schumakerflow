'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/Toast';
import { Users, Search, UserPlus, Mail, Phone, FolderKanban, FileText, ChevronRight, Film, X, Loader2 } from 'lucide-react';
import FloatingActionButton from '@/components/FloatingActionButton';

interface Client {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    isActive: boolean;
    createdAt: string;
    _count: { projects: number; clientUsers: number; invoices: number };
    projects: { _count: { files: number } }[];
}

export default function ClientsPage() {
    const router = useRouter();
    const { showToast } = useToast();
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    // Create modal
    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({ name: '', email: '', phone: '' });

    const loadClients = async () => {
        const res = await fetch('/api/admin/clients');
        const data = await res.json();
        setClients(data.data || []);
        setLoading(false);
    };

    useEffect(() => { loadClients(); }, []);

    const filtered = clients.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        (c.email && c.email.toLowerCase().includes(search.toLowerCase())) ||
        (c.phone && c.phone.includes(search))
    );

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim()) { showToast('Nome é obrigatório', 'warning'); return; }
        setSaving(true);
        try {
            const res = await fetch('/api/admin/clients', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: form.name.trim(),
                    email: form.email || undefined,
                    phone: form.phone || undefined,
                }),
            });
            const data = await res.json();
            if (data.data) {
                showToast('Cliente criado com sucesso!', 'success');
                setShowModal(false);
                setForm({ name: '', email: '', phone: '' });
                loadClients();
            } else {
                showToast(data.error || 'Erro ao criar', 'error');
            }
        } finally { setSaving(false); }
    };

    // Generate initials + color
    const getInitials = (name: string) => {
        const parts = name.trim().split(/\s+/);
        return parts.length >= 2
            ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
            : name.slice(0, 2).toUpperCase();
    };

    const avatarColors = [
        '#6366f1', '#8b5cf6', '#a855f7', '#ec4899', '#f43f5e',
        '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
        '#06b6d4', '#3b82f6', '#6d28d9', '#db2777',
    ];
    const getColor = (name: string) => {
        let hash = 0;
        for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
        return avatarColors[Math.abs(hash) % avatarColors.length];
    };

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1>Clientes</h1>
                    <p>Gerencie os clientes e seus acessos</p>
                </div>
            </div>

            <div className="page-content">
                {/* Search */}
                <div style={{ position: 'relative', marginBottom: 'var(--space-5)' }}>
                    <Search size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', pointerEvents: 'none' }} />
                    <input
                        className="form-input"
                        placeholder="Buscar por nome, email ou telefone..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{ paddingLeft: 42 }}
                    />
                </div>

                {/* Stats */}
                <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-5)', flexWrap: 'wrap' }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '8px 16px', borderRadius: 'var(--radius-md)',
                        background: 'var(--color-bg-secondary)', fontSize: '0.85rem',
                    }}>
                        <Users size={16} style={{ color: 'var(--color-primary)' }} />
                        <span style={{ fontWeight: 700 }}>{clients.length}</span>
                        <span className="text-muted">clientes</span>
                    </div>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '8px 16px', borderRadius: 'var(--radius-md)',
                        background: 'var(--color-bg-secondary)', fontSize: '0.85rem',
                    }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }} />
                        <span style={{ fontWeight: 700 }}>{clients.filter(c => c.isActive).length}</span>
                        <span className="text-muted">ativos</span>
                    </div>
                </div>

                {/* Cards Grid */}
                {loading ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className="card animate-pulse" style={{ height: 140 }} />
                        ))}
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="card empty-state">
                        <div className="empty-icon"><Users size={32} /></div>
                        <h3>{search ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}</h3>
                        <p className="text-sm text-muted">
                            {search ? 'Tente outra busca.' : 'Use o botão + para criar o primeiro.'}
                        </p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
                        {filtered.map((client) => {
                            const color = getColor(client.name);
                            return (
                                <div
                                    key={client.id}
                                    onClick={() => router.push(`/admin/clients/${client.id}`)}
                                    style={{
                                        background: 'var(--color-surface)',
                                        borderRadius: 'var(--radius-lg)',
                                        padding: 'var(--space-4)',
                                        cursor: 'pointer',
                                        border: '1px solid var(--color-border)',
                                        transition: 'all 0.2s ease',
                                        position: 'relative',
                                        overflow: 'hidden',
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.borderColor = color;
                                        e.currentTarget.style.boxShadow = `0 4px 20px ${color}18`;
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.borderColor = 'var(--color-border)';
                                        e.currentTarget.style.boxShadow = 'none';
                                        e.currentTarget.style.transform = 'translateY(0)';
                                    }}
                                >
                                    {/* Top strip */}
                                    <div style={{
                                        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                                        background: client.isActive ? color : '#9ca3af',
                                    }} />

                                    {/* Header row */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                                        <div style={{
                                            width: 44, height: 44, borderRadius: '50%',
                                            background: color,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            color: '#fff', fontWeight: 700, fontSize: '0.85rem',
                                            flexShrink: 0,
                                        }}>
                                            {getInitials(client.name)}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: 700, fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {client.name}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                                                <span className={`badge ${client.isActive ? 'badge-success' : 'badge-gray'}`} style={{ fontSize: '0.65rem', padding: '1px 8px' }}>
                                                    {client.isActive ? 'Ativo' : 'Inativo'}
                                                </span>
                                            </div>
                                        </div>
                                        <ChevronRight size={18} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                                    </div>

                                    {/* Contact */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 'var(--space-3)' }}>
                                        {client.email && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                                                <Mail size={12} style={{ flexShrink: 0 }} />
                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{client.email}</span>
                                            </div>
                                        )}
                                        {client.phone && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                                                <Phone size={12} style={{ flexShrink: 0 }} />
                                                <span>{client.phone}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Stats row */}
                                    <div style={{
                                        display: 'flex', gap: 'var(--space-3)',
                                        paddingTop: 'var(--space-3)',
                                        borderTop: '1px solid var(--color-border)',
                                        fontSize: '0.78rem',
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }} title="Projetos">
                                            <FolderKanban size={13} style={{ color: 'var(--color-primary)' }} />
                                            <span style={{ fontWeight: 700 }}>{client._count.projects}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }} title="Arquivos">
                                            <Film size={13} style={{ color: '#06b6d4' }} />
                                            <span style={{ fontWeight: 700 }}>{client.projects.reduce((sum, p) => sum + p._count.files, 0)}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }} title="Faturas">
                                            <FileText size={13} style={{ color: '#f59e0b' }} />
                                            <span style={{ fontWeight: 700 }}>{client._count.invoices}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }} title="Logins">
                                            <Users size={13} style={{ color: '#8b5cf6' }} />
                                            <span style={{ fontWeight: 700 }}>{client._count.clientUsers}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <FloatingActionButton actions={[
                { label: 'Novo Cliente', icon: <UserPlus size={18} />, onClick: () => { setForm({ name: '', email: '', phone: '' }); setShowModal(true); } },
            ]} />

            {/* Create Client Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
                        <div className="modal-header">
                            <h2>Novo Cliente</h2>
                            <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--color-text)' }}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleCreate}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Nome *</label>
                                    <input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Nome do cliente" required autoFocus />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Email</label>
                                    <input className="form-input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="email@cliente.com" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Telefone</label>
                                    <input className="form-input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="(11) 99999-9999" />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    {saving ? <Loader2 size={16} className="animate-spin" /> : 'Criar Cliente'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
