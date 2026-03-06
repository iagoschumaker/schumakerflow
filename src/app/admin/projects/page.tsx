'use client';

import { useEffect, useState, useRef } from 'react';
import { useToast } from '@/components/Toast';
import { useRouter } from 'next/navigation';
import { X, Pencil, Trash2, FolderKanban, Loader2, Search, FolderOpen, Plus, FilePlus, ChevronDown, Upload } from 'lucide-react';
import FloatingActionButton from '@/components/FloatingActionButton';

interface Project {
    id: string;
    name: string;
    description: string | null;
    status: string;
    createdAt: string;
    client: { name: string };
    _count: { files: number };
}

interface Client { id: string; name: string }

const emptyForm = { clientId: '', name: '', description: '', status: 'DRAFT' };

export default function ProjectsPage() {
    const router = useRouter();
    const [projects, setProjects] = useState<Project[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [clientSearch, setClientSearch] = useState('');
    const [showClientDropdown, setShowClientDropdown] = useState(false);
    const clientDropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown on click outside
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (clientDropdownRef.current && !clientDropdownRef.current.contains(e.target as Node)) {
                setShowClientDropdown(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const loadData = async () => {
        const [projRes, clientRes] = await Promise.all([
            fetch('/api/admin/projects'),
            fetch('/api/admin/clients'),
        ]);
        const projData = await projRes.json();
        const clientData = await clientRes.json();
        setProjects(projData.data || []);
        setClients(clientData.data || []);
        setLoading(false);
    };

    useEffect(() => { loadData(); }, []);

    const openCreate = () => { setEditingId(null); setForm(emptyForm); setClientSearch(''); setShowModal(true); };

    const openEdit = (p: Project) => {
        setEditingId(p.id);
        setForm({ clientId: '', name: p.name, description: p.description || '', status: p.status });
        setShowModal(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (editingId) {
                await fetch(`/api/admin/projects/${editingId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: form.name, description: form.description || undefined, status: form.status }),
                });
            } else {
                await fetch('/api/admin/projects', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ clientId: form.clientId, name: form.name, description: form.description || undefined, status: form.status }),
                });
            }
            setShowModal(false);
            setForm(emptyForm);
            setEditingId(null);
            loadData();
        } finally { setSaving(false); }
    };

    const { showToast, showConfirm } = useToast();

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const ok = await showConfirm({
            title: 'Excluir Projeto',
            message: 'Tem certeza que deseja excluir este projeto? Todos os arquivos serão removidos do Drive também.',
            confirmText: 'Excluir',
            variant: 'danger',
        });
        if (!ok) return;
        setDeleting(id);
        try {
            await fetch(`/api/admin/projects/${id}`, { method: 'DELETE' });
            showToast('Projeto excluído com sucesso!', 'success');
            loadData();
        } finally { setDeleting(null); }
    };

    const statusLabel = (s: string) => {
        const map: Record<string, string> = { DRAFT: 'Rascunho', IN_PRODUCTION: 'Em Produção', IN_REVIEW: 'Em Revisão', DELIVERED: 'Entregue', ARCHIVED: 'Arquivado' };
        return map[s] || s;
    };

    const statusColor = (s: string) => {
        const map: Record<string, string> = { DRAFT: '#9ca3af', IN_PRODUCTION: '#3b82f6', IN_REVIEW: '#f59e0b', DELIVERED: '#10b981', ARCHIVED: '#6b7280' };
        return map[s] || '#9ca3af';
    };

    const filtered = projects.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.client.name.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1>Projetos</h1>
                    <p>Navegue nos projetos como pastas</p>
                </div>
            </div>

            <div className="page-content">
                {/* Search bar */}
                <div style={{ position: 'relative', marginBottom: 'var(--space-5)' }}>
                    <Search size={18} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', pointerEvents: 'none' }} />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Buscar projetos, clientes..."
                        style={{
                            width: '100%', padding: '12px 14px 12px 44px',
                            border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)',
                            fontSize: '0.9rem', background: 'var(--color-bg)', outline: 'none', color: 'var(--color-text)',
                            transition: 'border-color 0.2s, box-shadow 0.2s',
                        }}
                        onFocus={(e) => { e.target.style.borderColor = 'var(--color-primary)'; }}
                        onBlur={(e) => { e.target.style.borderColor = 'var(--color-border)'; }}
                    />
                    {search && (
                        <button
                            onClick={() => setSearch('')}
                            style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: 'var(--color-text-muted)', padding: 4 }}
                        ><X size={16} /></button>
                    )}
                </div>

                {loading ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 'var(--space-4)' }}>
                        {[1, 2, 3, 4].map(i => <div key={i} className="card animate-pulse" style={{ height: 180 }} />)}
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="card empty-state">
                        <div className="empty-icon"><FolderKanban size={40} /></div>
                        <h3>{search ? 'Nenhum projeto encontrado' : 'Nenhum projeto criado'}</h3>
                        <p className="text-sm text-muted">{search ? 'Tente outra busca.' : 'Crie o primeiro projeto para começar.'}</p>
                        {!search && <p className="text-sm text-muted mt-2">Use o botão + para criar o primeiro.</p>}
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 'var(--space-4)' }}>
                        {filtered.map((p) => (
                            <div
                                key={p.id}
                                onClick={() => router.push(`/admin/projects/${p.id}`)}
                                style={{
                                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                                    padding: 'var(--space-5) var(--space-3) var(--space-3)',
                                    borderRadius: 'var(--radius-lg)', cursor: 'pointer',
                                    transition: 'all 0.2s ease', background: 'var(--color-bg)',
                                    border: '1px solid transparent', position: 'relative', textAlign: 'center',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'var(--color-bg-secondary)';
                                    e.currentTarget.style.borderColor = 'var(--color-border)';
                                    e.currentTarget.style.transform = 'translateY(-2px)';
                                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'var(--color-bg)';
                                    e.currentTarget.style.borderColor = 'transparent';
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = 'none';
                                }}
                            >
                                {/* Actions */}
                                <div style={{ position: 'absolute', top: 6, right: 6, display: 'flex', gap: 2, opacity: 0, transition: 'opacity 0.2s' }} className="folder-actions">
                                    <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); openEdit(p); }} title="Editar" style={{ padding: '3px 6px', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 4 }}><Pencil size={12} /></button>
                                    <button className="btn btn-sm" onClick={(e) => handleDelete(p.id, e)} disabled={deleting === p.id} title="Excluir" style={{ padding: '3px 6px', background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 4, color: '#ef4444' }}>
                                        {deleting === p.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                                    </button>
                                </div>

                                {/* Folder icon */}
                                <div style={{ width: 72, height: 60, marginBottom: 'var(--space-3)', position: 'relative' }}>
                                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 48, background: statusColor(p.status), borderRadius: '0 8px 8px 8px', opacity: 0.85 }} />
                                    <div style={{ position: 'absolute', bottom: 44, left: 0, height: 14, width: 28, background: statusColor(p.status), borderRadius: '6px 6px 0 0', opacity: 0.85 }} />
                                    <div style={{ position: 'absolute', bottom: 0, left: 2, right: 2, height: 40, background: statusColor(p.status), borderRadius: '0 6px 6px 6px', opacity: 0.7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {p._count.files > 0 ? (
                                            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#fff' }}>{p._count.files}</span>
                                        ) : (
                                            <FolderOpen size={18} style={{ color: '#fff', opacity: 0.7 }} />
                                        )}
                                    </div>
                                </div>

                                {/* Project name */}
                                <div style={{ fontWeight: 600, fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%', marginBottom: 2 }} title={p.name}>{p.name}</div>

                                {/* Client name */}
                                <div className="text-xs text-muted" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }} title={p.client.name}>
                                    {p.client.name}
                                </div>

                                {/* Status */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, fontSize: '0.65rem', color: statusColor(p.status), fontWeight: 600 }}>
                                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor(p.status) }} />
                                    {statusLabel(p.status)}
                                </div>
                            </div>
                        ))}

                    </div>
                )}
            </div>

            <style>{`div:hover > .folder-actions { opacity: 1 !important; }`}</style>

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editingId ? 'Editar Projeto' : 'Novo Projeto'}</h2>
                            <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSave}>
                            <div className="modal-body">
                                {!editingId && (
                                    <div className="form-group">
                                        <label className="form-label">Cliente *</label>
                                        <div ref={clientDropdownRef} style={{ position: 'relative' }}>
                                            <div style={{ position: 'relative' }}>
                                                <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', pointerEvents: 'none' }} />
                                                <input
                                                    className="form-input"
                                                    value={clientSearch}
                                                    onChange={(e) => {
                                                        setClientSearch(e.target.value);
                                                        setShowClientDropdown(true);
                                                        if (!e.target.value) setForm({ ...form, clientId: '' });
                                                    }}
                                                    onFocus={() => setShowClientDropdown(true)}
                                                    placeholder="Buscar cliente..."
                                                    style={{ paddingLeft: 34, paddingRight: 30 }}
                                                    autoComplete="off"
                                                />
                                                <ChevronDown size={16} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', pointerEvents: 'none' }} />
                                            </div>
                                            {showClientDropdown && (
                                                <div style={{
                                                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                                                    background: 'var(--color-bg)', border: '1px solid var(--color-border)',
                                                    borderRadius: 'var(--radius-md)', marginTop: 4,
                                                    maxHeight: 200, overflowY: 'auto',
                                                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                                                }}>
                                                    {clients
                                                        .filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase()))
                                                        .map(c => (
                                                            <div
                                                                key={c.id}
                                                                onClick={() => {
                                                                    setForm({ ...form, clientId: c.id });
                                                                    setClientSearch(c.name);
                                                                    setShowClientDropdown(false);
                                                                }}
                                                                style={{
                                                                    padding: '10px 14px', cursor: 'pointer',
                                                                    fontSize: '0.9rem',
                                                                    background: form.clientId === c.id ? 'var(--color-primary-light)' : 'transparent',
                                                                    fontWeight: form.clientId === c.id ? 600 : 400,
                                                                    borderBottom: '1px solid var(--color-border-light)',
                                                                    transition: 'background 0.15s',
                                                                }}
                                                                onMouseEnter={(e) => { if (form.clientId !== c.id) e.currentTarget.style.background = 'var(--color-bg-secondary)'; }}
                                                                onMouseLeave={(e) => { if (form.clientId !== c.id) e.currentTarget.style.background = 'transparent'; }}
                                                            >
                                                                {c.name}
                                                            </div>
                                                        ))}
                                                    {clients.filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase())).length === 0 && (
                                                        <div style={{ padding: '12px 14px', color: 'var(--color-text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>
                                                            Nenhum cliente encontrado
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            {/* Hidden required input for form validation */}
                                            <input type="hidden" value={form.clientId} required />
                                        </div>
                                    </div>
                                )}
                                <div className="form-group">
                                    <label className="form-label">Nome do Projeto *</label>
                                    <input className="form-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Descrição</label>
                                    <textarea className="form-textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Status</label>
                                    <select className="form-input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                                        <option value="DRAFT">Rascunho</option>
                                        <option value="IN_PRODUCTION">Em Produção</option>
                                        <option value="IN_REVIEW">Em Revisão</option>
                                        <option value="DELIVERED">Entregue</option>
                                        <option value="ARCHIVED">Arquivado</option>
                                    </select>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    {saving ? 'Salvando...' : editingId ? 'Salvar Alterações' : 'Criar Projeto'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            <FloatingActionButton actions={[
                { label: 'Novo Projeto', icon: <FolderKanban size={18} />, onClick: openCreate },
                { label: 'Upload de Arquivos', icon: <Upload size={18} />, onClick: () => router.push('/admin/files'), color: '#06b6d4' },
            ]} />
        </div>
    );
}
