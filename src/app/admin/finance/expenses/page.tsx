'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/components/Toast';
import {
    CreditCard, Search, X, Plus, Loader2, Pencil, Trash2,
    ChevronLeft, ChevronRight, Calendar
} from 'lucide-react';
import FloatingActionButton from '@/components/FloatingActionButton';

interface Expense {
    id: string;
    description: string;
    amount: string;
    category: string;
    date: string;
    referenceMonth: string | null;
    notes: string | null;
    recurring: boolean;
}

const CATEGORIES: Record<string, { label: string; color: string }> = {
    SOFTWARE: { label: 'Software', color: '#6366f1' },
    EQUIPMENT: { label: 'Equipamento', color: '#06b6d4' },
    MARKETING: { label: 'Marketing', color: '#f59e0b' },
    OFFICE: { label: 'Escritório', color: '#8b5cf6' },
    SALARY: { label: 'Salário', color: '#22c55e' },
    FREELANCER: { label: 'Freelancer', color: '#ec4899' },
    TAX: { label: 'Imposto', color: '#ef4444' },
    OTHER: { label: 'Outro', color: '#9ca3af' },
};

const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export default function ExpensesPage() {
    const { showToast, showConfirm } = useToast();
    const now = new Date();
    const [currentMonth, setCurrentMonth] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterCategory, setFilterCategory] = useState('ALL');

    // Modal
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState<Expense | null>(null);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        description: '', amount: '', category: 'OTHER', date: '', notes: '', recurring: false,
    });

    const monthKey = `${currentMonth.year}-${String(currentMonth.month).padStart(2, '0')}`;

    const loadExpenses = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/finance/expenses?month=${monthKey}`);
            const d = await res.json();
            setExpenses(d.data || []);
        } catch { /* */ }
        setLoading(false);
    };

    useEffect(() => { loadExpenses(); }, [monthKey]);

    const prevMonth = () => setCurrentMonth(p => p.month === 1 ? { year: p.year - 1, month: 12 } : { ...p, month: p.month - 1 });
    const nextMonth = () => setCurrentMonth(p => p.month === 12 ? { year: p.year + 1, month: 1 } : { ...p, month: p.month + 1 });

    const formatCurrency = (v: number | string) => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

    const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);

    const filtered = expenses
        .filter(e => filterCategory === 'ALL' || e.category === filterCategory)
        .filter(e => e.description.toLowerCase().includes(search.toLowerCase()));

    const openNew = () => {
        setEditing(null);
        setForm({ description: '', amount: '', category: 'OTHER', date: new Date().toISOString().slice(0, 10), notes: '', recurring: false });
        setShowModal(true);
    };

    const openEdit = (e: Expense) => {
        setEditing(e);
        setForm({
            description: e.description, amount: String(Number(e.amount)),
            category: e.category, date: e.date.slice(0, 10),
            notes: e.notes || '', recurring: e.recurring,
        });
        setShowModal(true);
    };

    const handleSave = async (ev: React.FormEvent) => {
        ev.preventDefault();
        if (!form.description.trim()) { showToast('Descrição é obrigatória', 'warning'); return; }
        if (!form.amount || Number(form.amount) <= 0) { showToast('Valor inválido', 'warning'); return; }
        if (!form.date) { showToast('Data é obrigatória', 'warning'); return; }
        setSaving(true);
        try {
            const body = {
                description: form.description.trim(),
                amount: Number(form.amount),
                category: form.category,
                date: form.date,
                notes: form.notes || undefined,
                recurring: form.recurring,
            };
            const url = editing ? `/api/admin/finance/expenses/${editing.id}` : '/api/admin/finance/expenses';
            const res = await fetch(url, {
                method: editing ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const d = await res.json();
            if (d.data) {
                showToast(editing ? 'Despesa atualizada!' : 'Despesa criada!', 'success');
                setShowModal(false);
                loadExpenses();
            } else showToast(d.error || 'Erro', 'error');
        } finally { setSaving(false); }
    };

    const handleDelete = async (id: string) => {
        const ok = await showConfirm({ title: 'Excluir Despesa', message: 'Excluir permanentemente?', confirmText: 'Excluir', variant: 'danger' });
        if (!ok) return;
        await fetch(`/api/admin/finance/expenses/${id}`, { method: 'DELETE' });
        showToast('Despesa excluída', 'success');
        loadExpenses();
    };

    return (
        <div className="finance-page">
            <style>{`
                .finance-page .item-card { padding: 14px 18px; display: flex; align-items: center; gap: 14px; transition: box-shadow 0.2s; }
                .finance-page .item-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.08); }
                .finance-page .item-card .card-bar { width: 4px; align-self: stretch; border-radius: 4px; flex-shrink: 0; }
                .finance-page .item-card .card-info { flex: 1; min-width: 0; }
                .finance-page .item-card .card-value { text-align: right; flex-shrink: 0; }
                .finance-page .item-card .card-actions { display: flex; gap: 4px; flex-shrink: 0; }
                @media (max-width: 600px) {
                    .finance-page .item-card { flex-wrap: wrap; padding: 12px 14px; gap: 8px; }
                    .finance-page .item-card .card-info { flex: 1; min-width: 0; }
                    .finance-page .item-card .card-value { margin-left: auto; flex-shrink: 0; }
                    .finance-page .item-card .card-actions { width: 100%; display: flex; gap: 4px; flex-wrap: wrap; justify-content: flex-end; border-top: 1px solid var(--color-border); padding-top: 8px; margin-top: 2px; }
                    .finance-page .item-card .card-actions .btn { padding: 4px 8px !important; font-size: 0.7rem !important; }
                }
            `}</style>

            <div className="page-header">
                <h1>Despesas</h1>
                <p>Gerencie suas despesas mensais</p>
            </div>

            <div className="page-content">
                {/* Month navigation */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 20, padding: '10px 0' }}>
                    <button onClick={prevMonth} className="btn btn-secondary btn-sm" style={{ padding: '6px 10px' }}><ChevronLeft size={18} /></button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 180, justifyContent: 'center' }}>
                        <Calendar size={16} style={{ color: 'var(--color-primary)' }} />
                        <span style={{ fontWeight: 700, fontSize: '1.05rem' }}>{MONTH_NAMES[currentMonth.month - 1]} {currentMonth.year}</span>
                    </div>
                    <button onClick={nextMonth} className="btn btn-secondary btn-sm" style={{ padding: '6px 10px' }}><ChevronRight size={18} /></button>
                </div>

                {/* Summary */}
                <div className="card" style={{ padding: '16px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14, borderLeft: '4px solid #ef4444' }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: '#ef444412', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', flexShrink: 0 }}>
                        <CreditCard size={20} />
                    </div>
                    <div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ef4444' }}>{formatCurrency(totalExpenses)}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Total de despesas em {MONTH_NAMES[currentMonth.month - 1]}</div>
                    </div>
                    <div style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                        {expenses.length} despesa(s)
                    </div>
                </div>

                {/* Filters */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                    {[{ key: 'ALL', label: 'Todas' }, ...Object.entries(CATEGORIES).map(([k, v]) => ({ key: k, label: v.label }))].map(f => (
                        <button key={f.key} onClick={() => setFilterCategory(f.key)} style={{
                            padding: '5px 14px', fontSize: '0.78rem', fontWeight: filterCategory === f.key ? 700 : 500,
                            border: filterCategory === f.key ? 'none' : '1px solid var(--color-border)', borderRadius: 20, cursor: 'pointer',
                            background: filterCategory === f.key ? 'var(--color-primary)' : 'transparent',
                            color: filterCategory === f.key ? '#fff' : 'var(--color-text-muted)', transition: 'all 0.2s',
                        }}>
                            {f.label} <span style={{ opacity: 0.7, marginLeft: 2 }}>{f.key === 'ALL' ? expenses.length : expenses.filter(e => e.category === f.key).length}</span>
                        </button>
                    ))}
                    <div style={{ position: 'relative', marginLeft: 'auto', flex: '0 1 260px' }}>
                        <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', pointerEvents: 'none' }} />
                        <input className="form-input" value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="Buscar..." style={{ paddingLeft: 32, fontSize: '0.82rem', height: 34 }} />
                        {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex' }}><X size={14} /></button>}
                    </div>
                </div>

                {/* List */}
                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Loader2 size={28} className="animate-spin" style={{ color: 'var(--color-primary)' }} /></div>
                ) : filtered.length === 0 ? (
                    <div className="card" style={{ padding: 40, textAlign: 'center' }}>
                        <CreditCard size={36} style={{ color: 'var(--color-text-muted)', margin: '0 auto 10px' }} />
                        <p className="text-muted">Nenhuma despesa encontrada neste mês</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {filtered.map(exp => {
                            const cat = CATEGORIES[exp.category] || CATEGORIES.OTHER;
                            return (
                                <div key={exp.id} className="card item-card">
                                    <div className="card-bar" style={{ background: cat.color }} />
                                    <div style={{ width: 40, height: 40, borderRadius: 10, background: `${cat.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: cat.color, flexShrink: 0 }}>
                                        <CreditCard size={18} />
                                    </div>
                                    <div className="card-info">
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                            <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{exp.description}</span>
                                            <span style={{ fontSize: '0.65rem', fontWeight: 600, padding: '1px 8px', borderRadius: 6, background: `${cat.color}15`, color: cat.color }}>{cat.label}</span>
                                            {exp.recurring && <span style={{ fontSize: '0.6rem', fontWeight: 600, padding: '1px 6px', borderRadius: 6, background: '#6366f115', color: '#6366f1' }}>Recorrente</span>}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 3, fontSize: '0.76rem', color: 'var(--color-text-muted)' }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Calendar size={11} /> {new Date(exp.date).toLocaleDateString('pt-BR')}</span>
                                            {exp.notes && <span>{exp.notes}</span>}
                                        </div>
                                    </div>
                                    <div className="card-value">
                                        <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#ef4444' }}>{formatCurrency(exp.amount)}</div>
                                    </div>
                                    <div className="card-actions">
                                        <button className="btn btn-secondary btn-sm" onClick={() => openEdit(exp)} style={{ padding: '5px 8px' }} title="Editar"><Pencil size={13} /></button>
                                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(exp.id)} style={{ padding: '5px 8px' }} title="Excluir"><Trash2 size={13} /></button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <FloatingActionButton actions={[
                { label: 'Nova Despesa', icon: <CreditCard size={18} />, onClick: openNew },
            ]} />

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
                        <div className="modal-header">
                            <h2>{editing ? 'Editar Despesa' : 'Nova Despesa'}</h2>
                            <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: 'var(--color-text)' }}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSave}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Descrição *</label>
                                    <input className="form-input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Ex: Adobe Creative Cloud" required />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                                    <div className="form-group">
                                        <label className="form-label">Valor (R$) *</label>
                                        <input className="form-input" type="number" step="0.01" min="0" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0.00" required />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Categoria</label>
                                        <select className="form-input" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                                            {Object.entries(CATEGORIES).map(([k, v]) => (
                                                <option key={k} value={k}>{v.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                                    <div className="form-group">
                                        <label className="form-label">Data *</label>
                                        <input className="form-input" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required />
                                    </div>
                                    <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 24 }}>
                                        <input type="checkbox" id="recurring" checked={form.recurring} onChange={e => setForm({ ...form, recurring: e.target.checked })} />
                                        <label htmlFor="recurring" style={{ fontSize: '0.85rem', cursor: 'pointer' }}>Recorrente</label>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Observações</label>
                                    <textarea className="form-input" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Notas..." />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    {saving ? <Loader2 size={16} className="animate-spin" /> : editing ? 'Salvar' : 'Criar Despesa'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
