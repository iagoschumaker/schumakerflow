'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useToast } from '@/components/Toast';
import {
    ArrowLeft, Pencil, Trash2, Users, Mail, Phone, Calendar,
    FolderKanban, FileText, Shield, Loader2, X, UserPlus, Save, Link
} from 'lucide-react';

interface ClientDetail {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    isActive: boolean;
    createdAt: string;
    clientUsers: { id: string; name: string; email: string; isActive: boolean; lastLoginAt: string | null }[];
    projects: { id: string; name: string; status: string; _count: { files: number } }[];
    _count: { invoices: number };
}

export default function ClientDetailPage() {
    const { clientId } = useParams<{ clientId: string }>();
    const router = useRouter();
    const { showToast, showConfirm } = useToast();

    const [client, setClient] = useState<ClientDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editForm, setEditForm] = useState({ name: '', email: '', phone: '' });

    // User management
    const [showUserModal, setShowUserModal] = useState(false);
    const [linkEmail, setLinkEmail] = useState('');
    const [savingUser, setSavingUser] = useState(false);


    const isNew = clientId === 'new';

    const loadClient = async () => {
        if (isNew) {
            setEditing(true);
            setLoading(false);
            return;
        }
        try {
            const res = await fetch(`/api/admin/clients/${clientId}`);
            const data = await res.json();
            if (data.data) {
                setClient(data.data);
                setEditForm({ name: data.data.name, email: data.data.email || '', phone: data.data.phone || '' });
            } else {
                showToast('Cliente não encontrado', 'error');
                router.push('/admin/clients');
            }
        } finally { setLoading(false); }
    };

    useEffect(() => { loadClient(); }, [clientId]);

    const handleSave = async () => {
        if (!editForm.name.trim()) { showToast('Nome é obrigatório', 'warning'); return; }
        setSaving(true);
        try {
            if (isNew) {
                const body: Record<string, unknown> = {
                    name: editForm.name.trim(),
                    email: editForm.email || undefined,
                    phone: editForm.phone || undefined,
                };
                const res = await fetch('/api/admin/clients', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (data.data) {
                    showToast('Cliente criado com sucesso!', 'success');
                    router.replace(`/admin/clients/${data.data.id}`);
                } else {
                    showToast(data.error || 'Erro ao criar', 'error');
                }
            } else {
                await fetch(`/api/admin/clients/${clientId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: editForm.name.trim(),
                        email: editForm.email || undefined,
                        phone: editForm.phone || undefined,
                    }),
                });
                showToast('Cliente atualizado!', 'success');
                setEditing(false);
                loadClient();
            }
        } finally { setSaving(false); }
    };

    const handleDelete = async () => {
        const ok = await showConfirm({
            title: 'Excluir Cliente',
            message: 'Tem certeza? Todos os projetos, arquivos e faturas vinculados serão removidos permanentemente.',
            confirmText: 'Excluir',
            variant: 'danger',
        });
        if (!ok) return;
        await fetch(`/api/admin/clients/${clientId}`, { method: 'DELETE' });
        showToast('Cliente excluído!', 'success');
        router.push('/admin/clients');
    };

    // --- User link ---
    const openLinkUser = () => {
        setLinkEmail('');
        setShowUserModal(true);
    };

    const handleLinkUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setSavingUser(true);
        try {
            const res = await fetch('/api/admin/client-users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clientId, email: linkEmail }),
            });
            const data = await res.json();
            if (!res.ok) {
                showToast(data.error || 'Erro ao vincular', 'error');
                return;
            }
            showToast('Acesso vinculado!', 'success');
            setShowUserModal(false);
            loadClient();
        } finally { setSavingUser(false); }
    };

    // --- Helpers ---
    const getInitials = (name: string) => {
        const parts = name.trim().split(/\s+/);
        return parts.length >= 2 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
    };
    const avatarColors = [
        '#6366f1', '#8b5cf6', '#a855f7', '#ec4899', '#f43f5e',
        '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
        '#06b6d4', '#3b82f6', '#6d28d9', '#db2777',
    ];
    const getColor = (name: string) => { let h = 0; for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h); return avatarColors[Math.abs(h) % avatarColors.length]; };

    const statusLabel = (s: string) => {
        const m: Record<string, string> = { DRAFT: 'Rascunho', IN_PRODUCTION: 'Em Produção', IN_REVIEW: 'Em Revisão', DELIVERED: 'Entregue', ARCHIVED: 'Arquivado' };
        return m[s] || s;
    };
    const statusColor = (s: string) => {
        const m: Record<string, string> = { DRAFT: '#9ca3af', IN_PRODUCTION: '#3b82f6', IN_REVIEW: '#f59e0b', DELIVERED: '#10b981', ARCHIVED: '#6b7280' };
        return m[s] || '#9ca3af';
    };

    if (loading) return <div className="page-content"><div className="card animate-pulse" style={{ height: 400 }} /></div>;

    const displayName = isNew ? 'Novo Cliente' : client?.name || '';
    const color = getColor(displayName);

    return (
        <div>
            {/* Header */}
            <div style={{
                background: `linear-gradient(135deg, ${color}15, transparent)`,
                borderBottom: '1px solid var(--color-border)', padding: 'var(--space-5) var(--space-6)',
            }}>
                <button onClick={() => router.push('/admin/clients')} className="btn btn-secondary" style={{ marginBottom: 'var(--space-4)', padding: '6px 14px', fontSize: '0.8rem' }}>
                    <ArrowLeft size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Voltar
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                    {!isNew && (
                        <div style={{
                            width: 64, height: 64, borderRadius: '50%', background: color,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#fff', fontWeight: 700, fontSize: '1.4rem', flexShrink: 0,
                        }}>
                            {getInitials(displayName)}
                        </div>
                    )}
                    <div style={{ flex: 1 }}>
                        {editing ? (
                            <input className="form-input" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                placeholder="Nome do cliente" style={{ fontWeight: 700, fontSize: '1.2rem', maxWidth: 400 }} autoFocus />
                        ) : (
                            <h1 style={{ margin: 0, fontSize: '1.4rem' }}>{displayName}</h1>
                        )}
                        {!isNew && (
                            <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 6, flexWrap: 'wrap' }}>
                                <span className={`badge ${client?.isActive ? 'badge-success' : 'badge-gray'}`}>
                                    {client?.isActive ? 'Ativo' : 'Inativo'}
                                </span>
                                <span className="text-xs text-muted" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <Calendar size={11} /> Desde {new Date(client?.createdAt || '').toLocaleDateString('pt-BR')}
                                </span>
                            </div>
                        )}
                    </div>
                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                        {editing ? (
                            <>
                                {!isNew && <button className="btn btn-secondary" onClick={() => { setEditing(false); if (client) setEditForm({ name: client.name, email: client.email || '', phone: client.phone || '' }); }} style={{ padding: '8px 16px' }}>Cancelar</button>}
                                <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ padding: '8px 16px' }}>
                                    {saving ? <Loader2 size={16} className="animate-spin" /> : <><Save size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />{isNew ? 'Criar' : 'Salvar'}</>}
                                </button>
                            </>
                        ) : (
                            <>
                                <button className="btn btn-secondary" onClick={() => setEditing(true)} style={{ padding: '8px 16px' }}>
                                    <Pencil size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Editar
                                </button>
                                <button className="btn btn-danger" onClick={handleDelete} style={{ padding: '8px 16px' }}>
                                    <Trash2 size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Excluir
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <div className="page-content" style={{ padding: 'var(--space-5) var(--space-6)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-5)' }}>
                    {/* Left Column: Info + Login */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
                        {/* Contact Info */}
                        <div className="card" style={{ padding: 'var(--space-5)' }}>
                            <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Users size={16} style={{ color: 'var(--color-primary)' }} /> Informações
                            </h3>
                            {editing ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label">Email</label>
                                        <input className="form-input" type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} placeholder="email@cliente.com" />
                                    </div>
                                    <div className="form-group" style={{ marginBottom: 0 }}>
                                        <label className="form-label">Telefone</label>
                                        <input className="form-input" value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} placeholder="(11) 99999-9999" />
                                    </div>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.88rem' }}>
                                        <Mail size={15} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{client?.email || '—'}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.88rem' }}>
                                        <Phone size={15} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                                        <span>{client?.phone || '—'}</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Login Access */}
                        {!isNew && (
                            <div className="card" style={{ padding: 'var(--space-5)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
                                    <h3 style={{ fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                                        <Shield size={16} style={{ color: '#8b5cf6' }} /> Acessos de Login
                                    </h3>
                                    <button className="btn btn-sm btn-secondary" onClick={openLinkUser} style={{ padding: '4px 12px', fontSize: '0.75rem' }}>
                                        <Link size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} /> Vincular
                                    </button>
                                </div>

                                {client?.clientUsers.length === 0 ? (
                                    <p className="text-sm text-muted" style={{ textAlign: 'center', padding: 'var(--space-3)' }}>
                                        Nenhum acesso de login cadastrado.
                                    </p>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                                        {client?.clientUsers.map(u => (
                                            <div key={u.id} style={{
                                                display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                                                padding: 'var(--space-3)', borderRadius: 'var(--radius-md)',
                                                background: 'var(--color-bg-secondary)',
                                            }}>
                                                <div style={{
                                                    width: 32, height: 32, borderRadius: '50%', background: '#8b5cf6',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    color: '#fff', fontWeight: 700, fontSize: '0.7rem', flexShrink: 0,
                                                }}>
                                                    {getInitials(u.name)}
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{u.name}</div>
                                                    <div className="text-xs text-muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
                                                </div>
                                                <span className={`badge ${u.isActive ? 'badge-success' : 'badge-gray'}`} style={{ fontSize: '0.6rem', flexShrink: 0 }}>
                                                    {u.isActive ? 'Ativo' : 'Inativo'}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Right Column: Projects */}
                    {!isNew && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
                            <div className="card" style={{ padding: 'var(--space-5)' }}>
                                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <FolderKanban size={16} style={{ color: 'var(--color-primary)' }} /> Projetos ({(client?.projects || []).length})
                                </h3>

                                {(client?.projects || []).length === 0 ? (
                                    <p className="text-sm text-muted" style={{ textAlign: 'center', padding: 'var(--space-3)' }}>
                                        Nenhum projeto vinculado.
                                    </p>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                                        {(client?.projects || []).map(p => (
                                            <div
                                                key={p.id}
                                                onClick={() => router.push(`/admin/projects/${p.id}`)}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                                                    padding: 'var(--space-3)', borderRadius: 'var(--radius-md)',
                                                    background: 'var(--color-bg-secondary)', cursor: 'pointer',
                                                    transition: 'background 0.15s',
                                                }}
                                                onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg-tertiary)'}
                                                onMouseLeave={e => e.currentTarget.style.background = 'var(--color-bg-secondary)'}
                                            >
                                                <FolderKanban size={18} style={{ color: statusColor(p.status), flexShrink: 0 }} />
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontWeight: 600, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                                                    <div className="text-xs text-muted">{p._count.files} arquivo(s)</div>
                                                </div>
                                                <span style={{
                                                    fontSize: '0.65rem', fontWeight: 600, padding: '2px 8px',
                                                    borderRadius: 8, background: `${statusColor(p.status)}18`, color: statusColor(p.status),
                                                }}>
                                                    {statusLabel(p.status)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Summary Stats */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                                <div className="card" style={{ padding: 'var(--space-4)', textAlign: 'center' }}>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-primary)' }}>{(client?.projects || []).length}</div>
                                    <div className="text-xs text-muted">Projetos</div>
                                </div>
                                <div className="card" style={{ padding: 'var(--space-4)', textAlign: 'center' }}>
                                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f59e0b' }}>{client?._count.invoices || 0}</div>
                                    <div className="text-xs text-muted">Faturas</div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Link User Modal */}
            {showUserModal && (
                <div className="modal-overlay" onClick={() => setShowUserModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
                        <div className="modal-header">
                            <h2>Vincular Acesso</h2>
                            <button onClick={() => setShowUserModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleLinkUser}>
                            <div className="modal-body">
                                <p className="text-sm text-muted" style={{ marginBottom: 'var(--space-4)' }}>
                                    Digite o email de um usuário já cadastrado para vincular o acesso a este cliente.
                                </p>
                                <div className="form-group">
                                    <label className="form-label">Email do usuário</label>
                                    <input className="form-input" type="email" value={linkEmail} onChange={e => setLinkEmail(e.target.value)} required placeholder="usuario@email.com" autoFocus />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowUserModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" disabled={savingUser}>
                                    {savingUser ? 'Vinculando...' : 'Vincular Acesso'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
