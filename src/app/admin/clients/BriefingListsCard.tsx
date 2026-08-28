'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/components/Toast';
import { ListChecks, Plus, Pencil, Trash2, X } from 'lucide-react';

interface ClientList {
    id: string;
    key: string;
    name: string;
    items: string[];
}

function slugifyKey(input: string): string {
    return input
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/(^_|_$)/g, '') || 'lista';
}

export default function BriefingListsCard({ clientId }: { clientId: string }) {
    const { showToast, showConfirm } = useToast();
    const [lists, setLists] = useState<ClientList[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState<ClientList | null>(null);
    const [name, setName] = useState('');
    const [key, setKey] = useState('');
    const [itemsText, setItemsText] = useState('');
    const [saving, setSaving] = useState(false);

    const load = () => {
        fetch('/api/admin/briefings/client-lists', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'list', clientId }),
        })
            .then((r) => r.json())
            .then((data) => { setLists(data.data || []); setLoading(false); })
            .catch(() => setLoading(false));
    };

    useEffect(load, [clientId]);

    const openNew = () => {
        setEditing(null);
        setName('');
        setKey('');
        setItemsText('');
        setShowModal(true);
    };

    const openEdit = (list: ClientList) => {
        setEditing(list);
        setName(list.name);
        setKey(list.key);
        setItemsText(list.items.join('\n'));
        setShowModal(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        const items = itemsText.split('\n').map((s) => s.trim()).filter(Boolean);
        if (!name.trim()) { showToast('Dê um nome à lista', 'warning'); return; }
        if (items.length === 0) { showToast('Adicione ao menos um item', 'warning'); return; }

        setSaving(true);
        try {
            const body = editing
                ? { action: 'update', id: editing.id, name: name.trim(), items }
                : { action: 'create', clientId, key: key.trim() || slugifyKey(name), name: name.trim(), items };
            const res = await fetch('/api/admin/briefings/client-lists', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) { showToast(data.error || 'Erro ao salvar', 'error'); return; }
            showToast(editing ? 'Lista atualizada!' : 'Lista criada!', 'success');
            setShowModal(false);
            load();
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (list: ClientList) => {
        const ok = await showConfirm({
            title: 'Excluir lista',
            message: `Excluir "${list.name}"? Campos de modelo que referenciam a chave "${list.key}" passam a pedir texto livre.`,
            confirmText: 'Excluir',
            variant: 'danger',
        });
        if (!ok) return;
        await fetch('/api/admin/briefings/client-lists', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete', id: list.id }),
        });
        showToast('Lista excluída', 'success');
        load();
    };

    return (
        <div className="card" style={{ padding: 'var(--space-5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                    <ListChecks size={16} style={{ color: 'var(--color-primary)' }} /> Listas de briefing
                </h3>
                <button className="btn btn-sm btn-secondary" onClick={openNew} style={{ padding: '4px 12px', fontSize: '0.75rem' }}>
                    <Plus size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} /> Nova lista
                </button>
            </div>

            {loading ? (
                <div className="animate-pulse" style={{ height: 60, borderRadius: 'var(--radius-md)', background: 'var(--color-bg)' }} />
            ) : lists.length === 0 ? (
                <p className="text-sm text-muted" style={{ textAlign: 'center', padding: 'var(--space-3)' }}>
                    Nenhuma lista cadastrada. Uma lista dá ao cliente opções fixas para marcar em vez de digitar (unidades, áreas, linhas de produto...).
                </p>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                    {lists.map((list) => (
                        <div key={list.id} style={{
                            display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                            padding: 'var(--space-3)', borderRadius: 'var(--radius-md)',
                            background: 'var(--color-bg-secondary)',
                        }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{list.name}</div>
                                <div className="text-xs text-muted">
                                    chave: <code>{list.key}</code> · {list.items.length} item(ns)
                                </div>
                            </div>
                            <button onClick={() => openEdit(list)} title="Editar" style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: 'var(--color-text-muted)', padding: 4 }}>
                                <Pencil size={15} />
                            </button>
                            <button onClick={() => handleDelete(list)} title="Excluir" style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: 'var(--color-danger)', padding: 4 }}>
                                <Trash2 size={15} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
                        <div className="modal-header">
                            <h2>{editing ? 'Editar lista' : 'Nova lista'}</h2>
                            <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSave}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Nome</label>
                                    <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Unidades" autoFocus />
                                </div>
                                {!editing && (
                                    <div className="form-group">
                                        <label className="form-label">Chave (avançado, usada pelo modelo)</label>
                                        <input className="form-input" value={key} onChange={(e) => setKey(e.target.value)} placeholder={name ? slugifyKey(name) : 'ex: unidades'} />
                                        <span className="text-xs text-muted" style={{ marginTop: 4, display: 'block' }}>Deixe em branco para gerar a partir do nome. Não muda depois de criada.</span>
                                    </div>
                                )}
                                <div className="form-group" style={{ marginBottom: 0 }}>
                                    <label className="form-label">Itens (um por linha)</label>
                                    <textarea className="form-input" value={itemsText} onChange={(e) => setItemsText(e.target.value)} rows={6} placeholder={'Jales\nSanta Fé\nFernandópolis'} />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    {saving ? 'Salvando...' : editing ? 'Salvar' : 'Criar lista'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
