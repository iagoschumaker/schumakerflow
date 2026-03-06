'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/components/Toast';
import { Building2, Users, FileText, X, Loader2, Pencil, Trash2, Search, ChevronRight, Eye, EyeOff, DollarSign, KeyRound } from 'lucide-react';
import FloatingActionButton from '@/components/FloatingActionButton';

interface Tenant {
    id: string;
    name: string;
    slug: string;
    subdomain: string | null;
    status: string;
    currency: string;
    createdAt: string;
    _count: { clients: number; members: number; invoices: number };
}

const emptyForm = { name: '', slug: '', subdomain: '', adminName: '', adminEmail: '', adminPassword: '' };
const emptyEditForm = { name: '', status: 'ACTIVE', resetPassword: '' };

export default function SuperAdminTenantsPage() {
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [form, setForm] = useState(emptyForm);
    const [editForm, setEditForm] = useState(emptyEditForm);
    const [showPw, setShowPw] = useState(false);
    const [emailExists, setEmailExists] = useState(false);
    const [checkingEmail, setCheckingEmail] = useState(false);
    const [showEditPw, setShowEditPw] = useState(false);
    const { showToast, showConfirm } = useToast();

    useEffect(() => { loadTenants(); }, []);

    // Check if admin email already exists (debounced)
    useEffect(() => {
        const email = form.adminEmail.trim();
        if (!email || !email.includes('@') || !email.includes('.')) {
            setEmailExists(false);
            return;
        }
        setCheckingEmail(true);
        const timer = setTimeout(async () => {
            try {
                const res = await fetch(`/api/superadmin/tenants/check-email?email=${encodeURIComponent(email)}`);
                if (res.ok) {
                    const data = await res.json();
                    setEmailExists(data.exists);
                } else {
                    setEmailExists(false);
                }
            } catch {
                setEmailExists(false);
            } finally {
                setCheckingEmail(false);
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [form.adminEmail]);

    const loadTenants = () => {
        fetch('/api/superadmin/tenants')
            .then((r) => {
                if (!r.ok) throw new Error('Failed to load tenants');
                return r.json();
            })
            .then((d) => setTenants(d.data || []))
            .catch((err) => console.error('Error loading tenants:', err))
            .finally(() => setLoading(false));
    };

    const filtered = tenants.filter(t =>
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.slug.toLowerCase().includes(search.toLowerCase())
    );

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreating(true);
        try {
            const res = await fetch('/api/superadmin/tenants', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            if (res.ok) {
                showToast('Tenant criado com sucesso!', 'success');
                setShowModal(false);
                setForm(emptyForm);
                loadTenants();
            } else {
                const data = await res.json();
                showToast(data.error || 'Erro ao criar tenant', 'error');
            }
        } finally { setCreating(false); }
    };

    const openEdit = (t: Tenant) => {
        setEditingId(t.id);
        setEditForm({ name: t.name, status: t.status, resetPassword: '' });
        setShowEditPw(false);
        setShowEditModal(true);
    };

    const handleEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingId) return;
        setSaving(true);
        try {
            const payload: Record<string, string> = { name: editForm.name, status: editForm.status };
            if (editForm.resetPassword) payload.resetPassword = editForm.resetPassword;
            await fetch(`/api/superadmin/tenants/${editingId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            showToast('Flow atualizado!', 'success');
            setShowEditModal(false);
            setEditingId(null);
            loadTenants();
        } finally { setSaving(false); }
    };

    const handleDelete = async (id: string, name: string) => {
        const ok = await showConfirm({
            title: 'Excluir Flow',
            message: `Tem certeza que deseja excluir "${name}"? Todos os dados serão removidos permanentemente.`,
            confirmText: 'Excluir Permanentemente',
            variant: 'danger',
        });
        if (!ok) return;
        setDeleting(id);
        try {
            await fetch(`/api/superadmin/tenants/${id}`, { method: 'DELETE' });
            showToast('Flow excluído com sucesso!', 'success');
            loadTenants();
        } finally { setDeleting(null); }
    };

    const statusColor = (s: string) => {
        const map: Record<string, string> = { ACTIVE: '#22c55e', SUSPENDED: '#ef4444', TRIAL: '#3b82f6' };
        return map[s] || '#9ca3af';
    };
    const statusLabel = (s: string) => {
        const map: Record<string, string> = { ACTIVE: 'Ativo', SUSPENDED: 'Suspenso', TRIAL: 'Trial' };
        return map[s] || s;
    };

    const tenantColors = [
        '#6366f1', '#8b5cf6', '#a855f7', '#ec4899', '#f43f5e',
        '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
        '#06b6d4', '#3b82f6', '#6d28d9', '#db2777',
    ];
    const getColor = (name: string) => {
        let hash = 0;
        for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
        return tenantColors[Math.abs(hash) % tenantColors.length];
    };
    const getInitials = (name: string) => {
        const parts = name.trim().split(/\s+/);
        return parts.length >= 2
            ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
            : name.slice(0, 2).toUpperCase();
    };

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1>Flows</h1>
                    <p>Gerencie todos os flows da plataforma</p>
                </div>
            </div>

            <div className="page-content">
                {/* Search */}
                <div style={{ position: 'relative', marginBottom: 'var(--space-5)' }}>
                    <Search size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', pointerEvents: 'none' }} />
                    <input
                        className="form-input"
                        placeholder="Buscar por nome ou slug..."
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
                        <Building2 size={16} style={{ color: 'var(--color-primary)' }} />
                        <span style={{ fontWeight: 700 }}>{tenants.length}</span>
                        <span className="text-muted">flows</span>
                    </div>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '8px 16px', borderRadius: 'var(--radius-md)',
                        background: 'var(--color-bg-secondary)', fontSize: '0.85rem',
                    }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }} />
                        <span style={{ fontWeight: 700 }}>{tenants.filter(t => t.status === 'ACTIVE').length}</span>
                        <span className="text-muted">ativos</span>
                    </div>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '8px 16px', borderRadius: 'var(--radius-md)',
                        background: 'var(--color-bg-secondary)', fontSize: '0.85rem',
                    }}>
                        <Users size={16} style={{ color: '#06b6d4' }} />
                        <span style={{ fontWeight: 700 }}>{tenants.reduce((s, t) => s + t._count.members, 0)}</span>
                        <span className="text-muted">membros</span>
                    </div>
                </div>

                {/* Cards Grid */}
                {loading ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="card animate-pulse" style={{ height: 140 }} />
                        ))}
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="card empty-state">
                        <div className="empty-icon"><Building2 size={32} /></div>
                        <h3>{search ? 'Nenhum flow encontrado' : 'Nenhum flow cadastrado'}</h3>
                        <p className="text-sm text-muted">
                            {search ? 'Tente outra busca.' : 'Use o botão + para criar o primeiro.'}
                        </p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
                        {filtered.map((tenant) => {
                            const color = getColor(tenant.name);
                            return (
                                <div
                                    key={tenant.id}
                                    style={{
                                        background: 'var(--color-surface)',
                                        borderRadius: 'var(--radius-lg)',
                                        padding: 'var(--space-4)',
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
                                        background: statusColor(tenant.status),
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
                                            {getInitials(tenant.name)}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: 700, fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {tenant.name}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                                                <span className={`badge ${tenant.status === 'ACTIVE' ? 'badge-success' : tenant.status === 'SUSPENDED' ? 'badge-danger' : 'badge-info'}`} style={{ fontSize: '0.65rem', padding: '1px 8px' }}>
                                                    {statusLabel(tenant.status)}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Action buttons */}
                                        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                                            <button onClick={(e) => { e.stopPropagation(); openEdit(tenant); }} className="btn btn-sm btn-secondary" title="Editar" style={{ padding: '4px 8px' }}>
                                                <Pencil size={13} />
                                            </button>
                                            <button onClick={(e) => { e.stopPropagation(); handleDelete(tenant.id, tenant.name); }} disabled={deleting === tenant.id} className="btn btn-sm btn-danger" title="Excluir" style={{ padding: '4px 8px' }}>
                                                {deleting === tenant.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Info */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 'var(--space-3)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                                            <span style={{ fontWeight: 600 }}>Slug:</span> {tenant.slug}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                                            <span style={{ fontWeight: 600 }}>Moeda:</span> {tenant.currency}
                                        </div>
                                    </div>

                                    {/* Stats row */}
                                    <div style={{
                                        display: 'flex', gap: 'var(--space-3)',
                                        paddingTop: 'var(--space-3)',
                                        borderTop: '1px solid var(--color-border)',
                                        fontSize: '0.78rem',
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }} title="Clientes">
                                            <Users size={13} style={{ color: 'var(--color-primary)' }} />
                                            <span style={{ fontWeight: 700 }}>{tenant._count.clients}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }} title="Membros">
                                            <Building2 size={13} style={{ color: '#06b6d4' }} />
                                            <span style={{ fontWeight: 700 }}>{tenant._count.members}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }} title="Faturas">
                                            <DollarSign size={13} style={{ color: '#f59e0b' }} />
                                            <span style={{ fontWeight: 700 }}>{tenant._count.invoices}</span>
                                        </div>
                                        <div style={{ flex: 1, textAlign: 'right', color: 'var(--color-text-muted)', fontSize: '0.72rem' }}>
                                            {new Date(tenant.createdAt).toLocaleDateString('pt-BR')}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <FloatingActionButton actions={[
                { label: 'Novo Flow', icon: <Building2 size={18} />, onClick: () => { setForm(emptyForm); setShowPw(false); setEmailExists(false); setShowModal(true); } },
            ]} />

            {/* Create Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Novo Flow</h2>
                            <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleCreate}>
                            <div className="modal-body">
                                <div style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)' }}>
                                    Informações do Flow
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Nome do Flow</label>
                                    <input className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="Ex: Minha Empresa" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Slug (URL)</label>
                                    <input className="form-input" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })} required placeholder="minha-empresa" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Subdomínio (opcional)</label>
                                    <input className="form-input" value={form.subdomain} onChange={(e) => setForm({ ...form, subdomain: e.target.value })} placeholder="minhaempresa" />
                                </div>
                                <div style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
                                    Administrador do Flow
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Nome do Admin</label>
                                    <input className="form-input" value={form.adminName} onChange={(e) => setForm({ ...form, adminName: e.target.value })} required placeholder="João Silva" />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Email do Admin</label>
                                    <input className="form-input" type="email" value={form.adminEmail} onChange={(e) => setForm({ ...form, adminEmail: e.target.value })} required placeholder="admin@empresa.com" />
                                    {checkingEmail && (
                                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4, display: 'block' }}>Verificando email...</span>
                                    )}
                                    {emailExists && !checkingEmail && (
                                        <span style={{ fontSize: '0.75rem', color: '#22c55e', marginTop: 4, display: 'block', fontWeight: 600 }}>✓ Usuário já existe — será vinculado automaticamente ao novo Flow</span>
                                    )}
                                </div>
                                {!emailExists && (
                                    <div className="form-group">
                                        <label className="form-label">Senha do Admin</label>
                                        <div style={{ position: 'relative' }}>
                                            <input className="form-input" type={showPw ? 'text' : 'password'} value={form.adminPassword} onChange={(e) => setForm({ ...form, adminPassword: e.target.value })} required minLength={8} placeholder="Mínimo 8 caracteres" style={{ paddingRight: 40 }} />
                                            <button type="button" onClick={() => setShowPw(!showPw)} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: 'var(--color-text-muted)' }}>
                                                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                    </div>
                                )}

                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" disabled={creating}>
                                    {creating ? <><Loader2 size={14} className="animate-spin" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Criando...</> : 'Criar Flow'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {showEditModal && (
                <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Editar Flow</h2>
                            <button onClick={() => setShowEditModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleEdit}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Nome</label>
                                    <input className="form-input" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Status</label>
                                    <select className="form-input" value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
                                        <option value="ACTIVE">Ativo</option>
                                        <option value="TRIAL">Trial</option>
                                        <option value="SUSPENDED">Suspenso</option>
                                    </select>
                                </div>

                                <div style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
                                    <KeyRound size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Resetar Senha do Admin
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Nova Senha (deixe vazio para não alterar)</label>
                                    <div style={{ position: 'relative' }}>
                                        <input className="form-input" type={showEditPw ? 'text' : 'password'} value={editForm.resetPassword} onChange={(e) => setEditForm({ ...editForm, resetPassword: e.target.value })} minLength={8} placeholder="Mínimo 8 caracteres" style={{ paddingRight: 40 }} />
                                        <button type="button" onClick={() => setShowEditPw(!showEditPw)} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: 'var(--color-text-muted)' }}>
                                            {showEditPw ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowEditModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    {saving ? 'Salvando...' : 'Salvar Alterações'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
