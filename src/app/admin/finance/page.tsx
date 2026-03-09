'use client';

import { useEffect, useState, useRef } from 'react';
import { useToast } from '@/components/Toast';
import {
    FileText, ClipboardList, CreditCard, Search, X, Plus,
    Loader2, DollarSign, Receipt, Pencil, Trash2, Check, Ban,
    Calendar, ArrowRight, User, MessageCircle, QrCode, Copy
} from 'lucide-react';
import FloatingActionButton from '@/components/FloatingActionButton';

interface Invoice {
    id: string;
    dueDate: string;
    totalAmount: string;
    status: string;
    paidAt: string | null;
    referenceMonth: string | null;
    notes: string | null;
    client: { name: string; phone: string | null };
    contract?: { name: string } | null;
    _count: { payments: number };
}

interface Contract {
    id: string;
    name: string;
    type: string;
    status: string;
    description: string | null;
    monthlyAmount: string | null;
    perVideoAmount: string | null;
    perProjectAmount: string | null;
    oneOffAmount: string | null;
    billingDay: number | null;
    client: { name: string };
    clientId: string;
    startDate: string;
    endDate: string | null;
    _count: { invoices: number };
}

interface ClientOption { id: string; name: string; }

export default function FinancePage() {
    const { showToast, showConfirm } = useToast();
    const [tab, setTab] = useState<'contracts' | 'invoices'>('contracts');
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [contracts, setContracts] = useState<Contract[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [clients, setClients] = useState<ClientOption[]>([]);
    const [pixSettings, setPixSettings] = useState<{ pixKey: string; pixKeyType: string; pixReceiverName: string } | null>(null);
    const [qrModal, setQrModal] = useState<{ qrDataUrl: string; payload: string; invoices: Invoice[]; totalAmount: number; msg: string; phone: string } | null>(null);
    const [qrLoading, setQrLoading] = useState(false);
    const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());

    // Sub-tab filters
    const [invoiceFilter, setInvoiceFilter] = useState<'ALL' | 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED'>('ALL');
    const [contractFilter, setContractFilter] = useState<'ALL' | 'ACTIVE' | 'PAUSED' | 'CANCELLED'>('ALL');

    // Modals
    const [showContractModal, setShowContractModal] = useState(false);
    const [showInvoiceModal, setShowInvoiceModal] = useState(false);
    const [editingContract, setEditingContract] = useState<Contract | null>(null);
    const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
    const [saving, setSaving] = useState(false);

    // Client search
    const [clientSearch, setClientSearch] = useState('');
    const [clientDropdownOpen, setClientDropdownOpen] = useState(false);
    const clientDropdownRef = useRef<HTMLDivElement>(null);

    // Contract form
    const emptyContractForm = {
        clientId: '', type: 'MONTHLY', name: '', description: '',
        monthlyAmount: '', perVideoAmount: '', perProjectAmount: '', oneOffAmount: '',
        billingDay: '5', startDate: new Date().toISOString().slice(0, 10), endDate: '',
        status: 'ACTIVE',
    };
    const [contractForm, setContractForm] = useState(emptyContractForm);

    // Invoice form
    const emptyInvoiceForm = {
        clientId: '', contractId: '', dueDate: '', notes: '', referenceMonth: '',
        items: [{ description: '', quantity: '1', unitPrice: '', type: 'ONE_OFF' }] as { description: string; quantity: string; unitPrice: string; type: string }[],
    };
    const [invoiceForm, setInvoiceForm] = useState(emptyInvoiceForm);

    // Edit invoice form
    const [editInvoiceForm, setEditInvoiceForm] = useState({ dueDate: '', notes: '', status: '', referenceMonth: '' });

    // ==== Data loading ====
    const loadData = async () => {
        setLoading(true);
        const [invRes, conRes] = await Promise.all([
            fetch('/api/admin/finance?tab=invoices'),
            fetch('/api/admin/finance?tab=contracts'),
        ]);
        const [invData, conData] = await Promise.all([invRes.json(), conRes.json()]);
        setInvoices(invData.data || []);
        setContracts(conData.data || []);
        setLoading(false);
    };

    const loadClients = async () => {
        const res = await fetch('/api/admin/clients');
        const d = await res.json();
        setClients((d.data || []).map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })));
    };

    const loadPixSettings = () => {
        fetch('/api/admin/settings/pix')
            .then(r => { if (!r.ok) throw new Error(); return r.json(); })
            .then(d => { if (d.data?.pixKey) setPixSettings(d.data); })
            .catch(() => { });
    };

    useEffect(() => { loadData(); loadClients(); loadPixSettings(); }, []);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (clientDropdownRef.current && !clientDropdownRef.current.contains(e.target as Node)) setClientDropdownOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // ==== Helpers ====
    const typeLabel = (t: string) => ({ MONTHLY: 'Mensal', PER_VIDEO: 'Por Arquivo', PER_PROJECT: 'Por Projeto', ONE_OFF: 'Avulso' }[t] || t);
    const statusLabel = (s: string) => ({ PENDING: 'Pendente', PAID: 'Pago', OVERDUE: 'Atrasado', CANCELLED: 'Cancelado', ACTIVE: 'Ativo', PAUSED: 'Pausado', FINISHED: 'Finalizado' }[s] || s);
    const typeColor = (t: string) => ({ MONTHLY: '#6366f1', PER_VIDEO: '#06b6d4', PER_PROJECT: '#f59e0b', ONE_OFF: '#8b5cf6' }[t] || '#9ca3af');
    const statusColor = (s: string) => ({ PENDING: '#f59e0b', PAID: '#22c55e', OVERDUE: '#ef4444', CANCELLED: '#9ca3af', ACTIVE: '#22c55e', PAUSED: '#f59e0b', FINISHED: '#9ca3af' }[s] || '#9ca3af');
    const contractValue = (c: Contract) => Number(c.monthlyAmount || c.perVideoAmount || c.perProjectAmount || c.oneOffAmount || 0);
    const formatCurrency = (v: number | string) => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    const formatMonth = (m: string | null) => {
        if (!m) return '—';
        const [y, mo] = m.split('-');
        const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        return `${months[parseInt(mo) - 1]} ${y}`;
    };

    // ==== API ====
    const apiPost = async (body: Record<string, unknown>) => {
        const res = await fetch('/api/admin/finance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        return res.json();
    };

    const handleMarkPaid = async (invoiceId: string) => {
        const ok = await showConfirm({ title: 'Confirmar Pagamento', message: 'Marcar esta fatura como paga?', confirmText: 'Confirmar', variant: 'default' });
        if (!ok) return;
        await apiPost({ action: 'mark_paid', invoiceId });
        showToast('Fatura marcada como paga!', 'success');
        loadData();
    };

    const handleCancelInvoice = async (invoiceId: string) => {
        const ok = await showConfirm({ title: 'Cancelar Fatura', message: 'Cancelar esta fatura?', confirmText: 'Cancelar', variant: 'danger' });
        if (!ok) return;
        await apiPost({ action: 'cancel_invoice', invoiceId });
        showToast('Fatura cancelada', 'success');
        loadData();
    };

    const handleDeleteInvoice = async (invoiceId: string) => {
        const ok = await showConfirm({ title: 'Excluir Fatura', message: 'Excluir permanentemente?', confirmText: 'Excluir', variant: 'danger' });
        if (!ok) return;
        await apiPost({ action: 'delete_invoice', invoiceId });
        showToast('Fatura excluída', 'success');
        loadData();
    };

    const handleDeleteContract = async (contractId: string) => {
        const ok = await showConfirm({ title: 'Excluir Contrato', message: 'Excluir permanentemente?', confirmText: 'Excluir', variant: 'danger' });
        if (!ok) return;
        await apiPost({ action: 'delete_contract', contractId });
        showToast('Contrato excluído', 'success');
        loadData();
    };

    const handleCreateContract = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!contractForm.clientId) { showToast('Selecione um cliente', 'warning'); return; }
        if (!contractForm.name.trim()) { showToast('Nome é obrigatório', 'warning'); return; }
        setSaving(true);
        try {
            const body: Record<string, unknown> = {
                action: editingContract ? 'update_contract' : 'create_contract',
                ...(editingContract && { contractId: editingContract.id }),
                clientId: contractForm.clientId, type: contractForm.type,
                name: contractForm.name.trim(), description: contractForm.description || undefined,
                billingDay: parseInt(contractForm.billingDay) || 5,
                startDate: contractForm.startDate, endDate: contractForm.endDate || undefined,
                status: contractForm.status,
            };
            if (contractForm.type === 'MONTHLY' && contractForm.monthlyAmount) body.monthlyAmount = parseFloat(contractForm.monthlyAmount);
            if (contractForm.type === 'PER_VIDEO' && contractForm.perVideoAmount) body.perVideoAmount = parseFloat(contractForm.perVideoAmount);
            if (contractForm.type === 'PER_PROJECT' && contractForm.perProjectAmount) body.perProjectAmount = parseFloat(contractForm.perProjectAmount);
            if (contractForm.type === 'ONE_OFF' && contractForm.oneOffAmount) body.oneOffAmount = parseFloat(contractForm.oneOffAmount);

            const data = await apiPost(body);
            if (data.data) {
                showToast(editingContract ? 'Contrato atualizado!' : 'Contrato criado!', 'success');
                setShowContractModal(false); setEditingContract(null); loadData();
            } else showToast(data.error || 'Erro', 'error');
        } finally { setSaving(false); }
    };

    const handleCreateInvoice = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!invoiceForm.clientId) { showToast('Selecione um cliente', 'warning'); return; }
        if (!invoiceForm.dueDate) { showToast('Vencimento é obrigatório', 'warning'); return; }
        const validItems = invoiceForm.items.filter(i => i.description && i.unitPrice);
        if (validItems.length === 0) { showToast('Adicione pelo menos um item', 'warning'); return; }
        setSaving(true);
        try {
            const data = await apiPost({
                action: 'create_invoice', clientId: invoiceForm.clientId,
                contractId: invoiceForm.contractId || undefined, dueDate: invoiceForm.dueDate,
                notes: invoiceForm.notes || undefined,
                items: validItems.map(i => ({ description: i.description, quantity: parseInt(i.quantity) || 1, unitPrice: parseFloat(i.unitPrice), type: i.type })),
            });
            if (data.data) {
                showToast('Fatura criada!', 'success'); setShowInvoiceModal(false); setTab('invoices'); loadData();
            } else showToast(data.error || 'Erro', 'error');
        } finally { setSaving(false); }
    };

    const handleUpdateInvoice = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingInvoice) return;
        setSaving(true);
        try {
            const data = await apiPost({
                action: 'update_invoice', invoiceId: editingInvoice.id,
                dueDate: editInvoiceForm.dueDate || undefined, notes: editInvoiceForm.notes || undefined,
                status: editInvoiceForm.status || undefined, referenceMonth: editInvoiceForm.referenceMonth || undefined,
            });
            if (data.data) { showToast('Fatura atualizada!', 'success'); setEditingInvoice(null); loadData(); }
            else showToast(data.error || 'Erro', 'error');
        } finally { setSaving(false); }
    };

    // Open edit modals
    const openEditContract = (c: Contract) => {
        setEditingContract(c);
        setContractForm({
            clientId: c.clientId, type: c.type, name: c.name, description: c.description || '',
            monthlyAmount: c.monthlyAmount ? String(Number(c.monthlyAmount)) : '',
            perVideoAmount: c.perVideoAmount ? String(Number(c.perVideoAmount)) : '',
            perProjectAmount: c.perProjectAmount ? String(Number(c.perProjectAmount)) : '',
            oneOffAmount: c.oneOffAmount ? String(Number(c.oneOffAmount)) : '',
            billingDay: String(c.billingDay || 5), startDate: c.startDate.slice(0, 10),
            endDate: c.endDate ? c.endDate.slice(0, 10) : '', status: c.status,
        });
        setClientSearch(''); setShowContractModal(true);
    };

    const openEditInvoice = (inv: Invoice) => {
        setEditingInvoice(inv);
        setEditInvoiceForm({ dueDate: inv.dueDate.slice(0, 10), notes: inv.notes || '', status: inv.status, referenceMonth: inv.referenceMonth || '' });
    };

    // Invoice item helpers
    const addInvoiceItem = () => setInvoiceForm({ ...invoiceForm, items: [...invoiceForm.items, { description: '', quantity: '1', unitPrice: '', type: 'ONE_OFF' }] });
    const removeInvoiceItem = (idx: number) => setInvoiceForm({ ...invoiceForm, items: invoiceForm.items.filter((_, i) => i !== idx) });
    const updateInvoiceItem = (idx: number, field: string, value: string) => { const items = [...invoiceForm.items]; items[idx] = { ...items[idx], [field]: value }; setInvoiceForm({ ...invoiceForm, items }); };
    const invoiceTotal = invoiceForm.items.reduce((s, i) => s + (parseInt(i.quantity) || 0) * (parseFloat(i.unitPrice) || 0), 0);

    // ==== Filters ====
    const filteredInvoices = invoices
        .filter(inv => invoiceFilter === 'ALL' || inv.status === invoiceFilter)
        .filter(inv => inv.client.name.toLowerCase().includes(search.toLowerCase()) || (inv.referenceMonth && inv.referenceMonth.includes(search)));

    const filteredContracts = contracts
        .filter(c => contractFilter === 'ALL' || c.status === contractFilter)
        .filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.client.name.toLowerCase().includes(search.toLowerCase()));

    // Stats
    const totalPending = invoices.filter(i => i.status === 'PENDING').reduce((s, i) => s + Number(i.totalAmount), 0);
    const totalPaid = invoices.filter(i => i.status === 'PAID').reduce((s, i) => s + Number(i.totalAmount), 0);
    const totalOverdue = invoices.filter(i => i.status === 'OVERDUE').reduce((s, i) => s + Number(i.totalAmount), 0);
    const activeContracts = contracts.filter(c => c.status === 'ACTIVE').length;

    // Client picker render function (NOT a component - avoids re-mount/focus-loss)
    const renderClientPicker = (value: string, onChange: (id: string) => void) => (
        <div className="form-group" style={{ position: 'relative' }} ref={clientDropdownRef}>
            <label className="form-label">Cliente *</label>
            <input className="form-input" placeholder="Buscar cliente..." autoComplete="off"
                value={clientSearch || clients.find(c => c.id === value)?.name || ''}
                onChange={e => { setClientSearch(e.target.value); setClientDropdownOpen(true); if (!e.target.value) onChange(''); }}
                onFocus={() => { setClientDropdownOpen(true); setClientSearch(''); }}
            />
            {clientDropdownOpen && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', maxHeight: 180, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}>
                    {clients.filter(c => !clientSearch || c.name.toLowerCase().includes(clientSearch.toLowerCase())).length === 0 ? (
                        <div style={{ padding: '10px 14px', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Nenhum cliente</div>
                    ) : clients.filter(c => !clientSearch || c.name.toLowerCase().includes(clientSearch.toLowerCase())).map(c => (
                        <div key={c.id} onClick={() => { onChange(c.id); setClientSearch(''); setClientDropdownOpen(false); }}
                            style={{ padding: '8px 14px', cursor: 'pointer', fontSize: '0.85rem', background: value === c.id ? 'rgba(99,102,241,0.1)' : 'transparent' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg-secondary)'}
                            onMouseLeave={e => e.currentTarget.style.background = value === c.id ? 'rgba(99,102,241,0.1)' : 'transparent'}
                        >{c.name}</div>
                    ))}
                </div>
            )}
        </div>
    );

    // Filter pill
    const Pill = ({ label, active, count, onClick }: { label: string; active: boolean; count: number; onClick: () => void }) => (
        <button onClick={onClick} style={{
            padding: '5px 14px', fontSize: '0.78rem', fontWeight: active ? 700 : 500,
            border: active ? 'none' : '1px solid var(--color-border)', borderRadius: 20, cursor: 'pointer',
            background: active ? 'var(--color-primary)' : 'transparent',
            color: active ? '#fff' : 'var(--color-text-muted)', transition: 'all 0.2s',
        }}>
            {label} <span style={{ opacity: 0.7, marginLeft: 2 }}>{count}</span>
        </button>
    );

    return (
        <div className="finance-page">
            <style>{`
                .finance-page .stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 24px; }
                .finance-page .main-tabs { display: flex; border-bottom: 2px solid var(--color-border); margin-bottom: 16px; gap: 0; }
                .finance-page .filter-bar { display: flex; gap: 8px; margin-bottom: 14px; flex-wrap: wrap; align-items: center; }
                .finance-page .filter-bar .search-box { position: relative; margin-left: auto; flex: 0 1 260px; }
                .finance-page .item-card { padding: 14px 18px; display: flex; align-items: center; gap: 14px; transition: box-shadow 0.2s; }
                .finance-page .item-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.08); }
                .finance-page .item-card .card-value { text-align: right; flex-shrink: 0; }
                .finance-page .item-card .card-actions { display: flex; gap: 4px; flex-shrink: 0; }
                .finance-page .item-card .card-info { flex: 1; min-width: 0; }
                .finance-page .item-card .card-bar { width: 4px; align-self: stretch; border-radius: 4px; flex-shrink: 0; }
                .finance-page .item-card .card-icon { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
                @media (max-width: 600px) {
                    .finance-page .stat-grid { grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 16px; }
                    .finance-page .main-tabs { border-bottom: none; gap: 4px; }
                    .finance-page .main-tabs button { margin-bottom: 0 !important; }
                    .finance-page .filter-bar { gap: 6px; }
                    .finance-page .filter-bar .search-box { flex: 1 1 100%; margin-left: 0; margin-top: 4px; }
                    .finance-page .item-card { flex-wrap: wrap; padding: 12px 14px; gap: 10px; position: relative; padding-right: 80px; }
                    .finance-page .item-card .card-icon { width: 32px; height: 32px; }
                    .finance-page .item-card .card-info { flex-basis: calc(100% - 56px); }
                    .finance-page .item-card .card-value { position: absolute; top: 12px; right: 14px; }
                    .finance-page .item-card .card-actions { position: absolute; bottom: 10px; right: 14px; }
                    .finance-page .item-card .card-actions .btn { padding: 3px 6px !important; }
                    .finance-page .item-card .card-actions .btn svg { width: 11px; height: 11px; }
                }
            `}</style>
            <div className="page-header">
                <h1>Financeiro</h1>
                <p>Gerencie contratos e faturas</p>
            </div>

            <div className="page-content">
                {/* ==== SUMMARY CARDS ==== */}
                <div className="stat-grid">
                    {[
                        { icon: <ClipboardList size={18} />, color: '#6366f1', value: String(activeContracts), label: 'Contratos Ativos', sub: `de ${contracts.length} total` },
                        { icon: <DollarSign size={18} />, color: '#f59e0b', value: formatCurrency(totalPending), label: 'A Receber', sub: `${invoices.filter(i => i.status === 'PENDING').length} fatura(s)` },
                        { icon: <CreditCard size={18} />, color: '#22c55e', value: formatCurrency(totalPaid), label: 'Recebido', sub: `${invoices.filter(i => i.status === 'PAID').length} fatura(s)` },
                        { icon: <Receipt size={18} />, color: totalOverdue > 0 ? '#ef4444' : '#9ca3af', value: formatCurrency(totalOverdue), label: 'Atrasado', sub: `${invoices.filter(i => i.status === 'OVERDUE').length} fatura(s)` },
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

                {/* ==== MAIN TABS ==== */}
                <div className="main-tabs">
                    {([
                        { key: 'contracts' as const, label: 'Contratos', icon: <ClipboardList size={15} />, count: contracts.length },
                        { key: 'invoices' as const, label: 'Faturas', icon: <FileText size={15} />, count: invoices.length },
                    ]).map(t => (
                        <button key={t.key} onClick={() => { setTab(t.key); setSearch(''); }}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px',
                                background: 'none', border: 'none', borderBottom: tab === t.key ? '2px solid var(--color-primary)' : '2px solid transparent',
                                color: tab === t.key ? 'var(--color-primary)' : 'var(--color-text-muted)',
                                fontWeight: tab === t.key ? 700 : 500, fontSize: '0.9rem', cursor: 'pointer',
                                marginBottom: -2, transition: 'all 0.2s',
                            }}
                        >{t.icon} {t.label} <span style={{ fontSize: '0.7rem', background: tab === t.key ? 'var(--color-primary)' : 'var(--color-bg-secondary)', color: tab === t.key ? '#fff' : 'var(--color-text-muted)', padding: '1px 7px', borderRadius: 10, fontWeight: 600 }}>{t.count}</span></button>
                    ))}
                </div>

                {/* ==== FILTERS + SEARCH ==== */}
                <div className="filter-bar">
                    {tab === 'invoices' ? (
                        <>
                            <Pill label="Todas" active={invoiceFilter === 'ALL'} count={invoices.length} onClick={() => setInvoiceFilter('ALL')} />
                            <Pill label="Pendentes" active={invoiceFilter === 'PENDING'} count={invoices.filter(i => i.status === 'PENDING').length} onClick={() => setInvoiceFilter('PENDING')} />
                            <Pill label="Pagas" active={invoiceFilter === 'PAID'} count={invoices.filter(i => i.status === 'PAID').length} onClick={() => setInvoiceFilter('PAID')} />
                            <Pill label="Atrasadas" active={invoiceFilter === 'OVERDUE'} count={invoices.filter(i => i.status === 'OVERDUE').length} onClick={() => setInvoiceFilter('OVERDUE')} />
                            <Pill label="Canceladas" active={invoiceFilter === 'CANCELLED'} count={invoices.filter(i => i.status === 'CANCELLED').length} onClick={() => setInvoiceFilter('CANCELLED')} />
                        </>
                    ) : (
                        <>
                            <Pill label="Todos" active={contractFilter === 'ALL'} count={contracts.length} onClick={() => setContractFilter('ALL')} />
                            <Pill label="Ativos" active={contractFilter === 'ACTIVE'} count={contracts.filter(c => c.status === 'ACTIVE').length} onClick={() => setContractFilter('ACTIVE')} />
                            <Pill label="Pausados" active={contractFilter === 'PAUSED'} count={contracts.filter(c => c.status === 'PAUSED').length} onClick={() => setContractFilter('PAUSED')} />
                            <Pill label="Cancelados" active={contractFilter === 'CANCELLED'} count={contracts.filter(c => c.status === 'CANCELLED').length} onClick={() => setContractFilter('CANCELLED')} />
                        </>
                    )}
                    <div className="search-box">
                        <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', pointerEvents: 'none' }} />
                        <input className="form-input" value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="Buscar..." style={{ paddingLeft: 32, fontSize: '0.82rem', height: 34 }} />
                        {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex' }}><X size={14} /></button>}
                    </div>
                </div>

                {/* ==== CONTENT ==== */}
                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Loader2 size={28} className="animate-spin" style={{ color: 'var(--color-primary)' }} /></div>
                ) : tab === 'contracts' ? (
                    /* ===== CONTRACTS LIST (Cards) ===== */
                    filteredContracts.length === 0 ? (
                        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
                            <ClipboardList size={36} style={{ color: 'var(--color-text-muted)', margin: '0 auto 10px' }} />
                            <p className="text-muted">Nenhum contrato {contractFilter !== 'ALL' ? statusLabel(contractFilter).toLowerCase() : 'encontrado'}</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {filteredContracts.map(c => (
                                <div key={c.id} className="card item-card">
                                    {/* Color bar left */}
                                    <div className="card-bar" style={{ background: statusColor(c.status) }} />

                                    {/* Type icon */}
                                    <div className="card-icon" style={{ background: `${typeColor(c.type)}12` }}>
                                        <ClipboardList size={18} style={{ color: typeColor(c.type) }} />
                                    </div>

                                    {/* Info */}
                                    <div className="card-info">
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                            <span style={{ fontWeight: 700, fontSize: '0.92rem' }}>{c.name}</span>
                                            <span style={{ fontSize: '0.65rem', fontWeight: 600, padding: '1px 8px', borderRadius: 6, background: `${typeColor(c.type)}15`, color: typeColor(c.type) }}>{typeLabel(c.type)}</span>
                                            <span style={{ fontSize: '0.65rem', fontWeight: 600, padding: '1px 8px', borderRadius: 6, background: `${statusColor(c.status)}15`, color: statusColor(c.status) }}>{statusLabel(c.status)}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4, fontSize: '0.78rem', color: 'var(--color-text-muted)', flexWrap: 'wrap' }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><User size={12} /> {c.client.name}</span>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Calendar size={12} /> {new Date(c.startDate).toLocaleDateString('pt-BR')}{c.endDate ? ` → ${new Date(c.endDate).toLocaleDateString('pt-BR')}` : ' → Indeterminado'}</span>
                                            {c.type === 'MONTHLY' && <span>Dia {c.billingDay || 5}</span>}
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><FileText size={12} /> {c._count.invoices} fatura(s)</span>
                                        </div>
                                    </div>

                                    {/* Value */}
                                    <div className="card-value">
                                        <div style={{ fontSize: '1.05rem', fontWeight: 800, color: typeColor(c.type) }}>{formatCurrency(contractValue(c))}</div>
                                        <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>{c.type === 'MONTHLY' ? '/mês' : c.type === 'PER_VIDEO' ? '/arquivo' : c.type === 'PER_PROJECT' ? '/projeto' : 'avulso'}</div>
                                    </div>

                                    {/* Actions */}
                                    <div className="card-actions">
                                        <button className="btn btn-secondary btn-sm" onClick={() => openEditContract(c)} style={{ padding: '5px 8px' }} title="Editar"><Pencil size={13} /></button>
                                        <button className="btn btn-danger btn-sm" onClick={() => handleDeleteContract(c.id)} style={{ padding: '5px 8px' }} title="Excluir"><Trash2 size={13} /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                ) : (
                    /* ===== INVOICES LIST (Cards) ===== */
                    filteredInvoices.length === 0 ? (
                        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
                            <FileText size={36} style={{ color: 'var(--color-text-muted)', margin: '0 auto 10px' }} />
                            <p className="text-muted">Nenhuma fatura {invoiceFilter !== 'ALL' ? statusLabel(invoiceFilter).toLowerCase() : 'encontrada'}</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {filteredInvoices.map(inv => (
                                <div key={inv.id} className="card item-card" style={{ cursor: (inv.status === 'PENDING' || inv.status === 'OVERDUE') ? 'pointer' : undefined, outline: selectedInvoices.has(inv.id) ? '2px solid var(--color-primary)' : 'none' }}
                                    onClick={() => {
                                        if (inv.status !== 'PENDING' && inv.status !== 'OVERDUE') return;
                                        setSelectedInvoices(prev => {
                                            const next = new Set(prev);
                                            if (next.has(inv.id)) next.delete(inv.id); else next.add(inv.id);
                                            return next;
                                        });
                                    }}
                                >
                                    {/* Status bar */}
                                    <div className="card-bar" style={{ background: statusColor(inv.status) }} />

                                    {/* Status icon */}
                                    <div className="card-icon" style={{ background: `${statusColor(inv.status)}12` }}>
                                        {inv.status === 'PAID' ? <Check size={18} style={{ color: '#22c55e' }} /> :
                                            inv.status === 'OVERDUE' ? <Receipt size={18} style={{ color: '#ef4444' }} /> :
                                                inv.status === 'CANCELLED' ? <Ban size={18} style={{ color: '#9ca3af' }} /> :
                                                    <FileText size={18} style={{ color: '#f59e0b' }} />}
                                    </div>

                                    {/* Info */}
                                    <div className="card-info">
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                            <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{inv.client.name}</span>
                                            <span style={{ fontSize: '0.65rem', fontWeight: 600, padding: '1px 8px', borderRadius: 6, background: `${statusColor(inv.status)}15`, color: statusColor(inv.status) }}>{statusLabel(inv.status)}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 3, fontSize: '0.76rem', color: 'var(--color-text-muted)', flexWrap: 'wrap' }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Calendar size={11} /> Venc: {new Date(inv.dueDate).toLocaleDateString('pt-BR')}</span>
                                            {inv.contract?.name && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><ClipboardList size={11} /> {inv.contract.name}</span>}
                                            {inv.paidAt && <span style={{ color: '#22c55e' }}>Pago em {new Date(inv.paidAt).toLocaleDateString('pt-BR')}</span>}
                                        </div>
                                    </div>

                                    {/* Value */}
                                    <div className="card-value">
                                        <div style={{ fontSize: '1.05rem', fontWeight: 800, color: statusColor(inv.status) }}>{formatCurrency(inv.totalAmount)}</div>
                                    </div>

                                    {/* Actions */}
                                    <div className="card-actions" onClick={e => e.stopPropagation()}>
                                        {(inv.status === 'PENDING' || inv.status === 'OVERDUE') && (
                                            <button className="btn btn-success btn-sm" onClick={() => handleMarkPaid(inv.id)} style={{ padding: '5px 8px' }} title="Marcar Pago"><Check size={14} /></button>
                                        )}
                                        {(inv.status === 'PENDING' || inv.status === 'OVERDUE') && (
                                            <button className="btn btn-sm" onClick={() => handleCancelInvoice(inv.id)} style={{ padding: '5px 8px', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }} title="Cancelar"><Ban size={13} /></button>
                                        )}
                                        <button className="btn btn-secondary btn-sm" onClick={() => openEditInvoice(inv)} style={{ padding: '5px 8px' }} title="Editar"><Pencil size={13} /></button>
                                        <button className="btn btn-danger btn-sm" onClick={() => handleDeleteInvoice(inv.id)} style={{ padding: '5px 8px' }} title="Excluir"><Trash2 size={13} /></button>
                                        {(inv.status === 'PENDING' || inv.status === 'OVERDUE') && (
                                            <button
                                                className="btn btn-sm"
                                                disabled={qrLoading}
                                                style={{ padding: '5px 8px', background: '#25D366', border: '1px solid #25D366', color: '#fff' }}
                                                title="Enviar via WhatsApp"
                                                onClick={async () => {
                                                    const phone = (inv.client.phone || '').replace(/\D/g, '');
                                                    if (!phone) {
                                                        showToast('Este cliente não tem telefone cadastrado.', 'error');
                                                        return;
                                                    }
                                                    const valor = formatCurrency(inv.totalAmount);
                                                    const venc = new Date(inv.dueDate).toLocaleDateString('pt-BR');
                                                    let msg = `*Fatura - ${inv.client.name}*\n\n`;
                                                    msg += `Valor: *${valor}*\n`;
                                                    msg += `Vencimento: *${venc}*\n`;
                                                    const desc = inv.contract?.name || inv.notes || null;
                                                    if (desc) msg += `${inv.contract?.name ? 'Contrato' : 'Descri\u00e7\u00e3o'}: ${desc}\n`;
                                                    if (inv.referenceMonth) msg += `Ref: ${formatMonth(inv.referenceMonth)}\n`;
                                                    if (pixSettings) {
                                                        msg += `\n*Dados para pagamento PIX:*\n`;
                                                        msg += `Tipo: ${pixSettings.pixKeyType}\n`;
                                                        msg += `Chave: *${pixSettings.pixKey}*\n`;
                                                        msg += `Nome: ${pixSettings.pixReceiverName}\n`;
                                                    }
                                                    msg += `\nObrigado!`;

                                                    // Try to generate QR code
                                                    if (pixSettings) {
                                                        setQrLoading(true);
                                                        try {
                                                            const res = await fetch('/api/admin/finance/pix-qr', {
                                                                method: 'POST',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({ amount: Number(inv.totalAmount), clientName: inv.client.name, invoiceId: inv.id }),
                                                            });
                                                            if (res.ok) {
                                                                const d = await res.json();
                                                                setQrModal({ qrDataUrl: d.data.qrDataUrl, payload: d.data.payload, invoices: [inv], totalAmount: Number(inv.totalAmount), msg, phone });
                                                                setQrLoading(false);
                                                                return;
                                                            }
                                                        } catch { /* fallback to direct send */ }
                                                        setQrLoading(false);
                                                    }
                                                    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
                                                }}
                                            >
                                                {qrLoading ? <Loader2 size={13} className="animate-spin" /> : <MessageCircle size={13} />}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                )}

                {/* Floating selection bar */}
                {selectedInvoices.size > 0 && (() => {
                    const selInvs = invoices.filter(i => selectedInvoices.has(i.id));
                    const total = selInvs.reduce((s, i) => s + Number(i.totalAmount), 0);
                    const clientNames = [...new Set(selInvs.map(i => i.client.name))];
                    return (
                        <div style={{
                            position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
                            background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                            borderRadius: 'var(--radius-lg)', padding: '10px 20px',
                            display: 'flex', alignItems: 'center', gap: 16,
                            boxShadow: '0 8px 32px rgba(0,0,0,0.18)', zIndex: 50,
                            fontSize: '0.88rem',
                        }}>
                            <span><strong>{selInvs.length}</strong> fatura(s)</span>
                            <span style={{ color: 'var(--color-text-muted)' }}>|</span>
                            <span style={{ fontWeight: 800, color: 'var(--color-primary)' }}>{formatCurrency(total)}</span>
                            <button
                                className="btn btn-sm"
                                disabled={qrLoading}
                                style={{ background: '#25D366', border: 'none', color: '#fff', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px' }}
                                onClick={async () => {
                                    // Check all selected invoices have same client phone
                                    const phones = [...new Set(selInvs.map(i => (i.client.phone || '').replace(/\D/g, '')))];
                                    const phone = phones[0];
                                    if (!phone) {
                                        showToast('Cliente(s) sem telefone cadastrado.', 'error');
                                        return;
                                    }
                                    if (clientNames.length > 1) {
                                        showToast('Selecione faturas do mesmo cliente.', 'error');
                                        return;
                                    }

                                    let msg = `*Cobran\u00e7a - ${clientNames[0]}*\n\n`;
                                    selInvs.forEach((inv, idx) => {
                                        const label = inv.contract?.name || inv.notes || 'Fatura avulsa';
                                        msg += `${idx + 1}. ${label} - *${formatCurrency(inv.totalAmount)}*`;
                                        msg += ` (venc: ${new Date(inv.dueDate).toLocaleDateString('pt-BR')})`;
                                        if (inv.referenceMonth) msg += ` ref: ${formatMonth(inv.referenceMonth)}`;
                                        msg += `\n`;
                                    });
                                    msg += `\n*Total: ${formatCurrency(total)}*\n`;
                                    if (pixSettings) {
                                        msg += `\n*Dados para pagamento PIX:*\n`;
                                        msg += `Tipo: ${pixSettings.pixKeyType}\n`;
                                        msg += `Chave: *${pixSettings.pixKey}*\n`;
                                        msg += `Nome: ${pixSettings.pixReceiverName}\n`;
                                    }
                                    msg += `\nObrigado!`;

                                    if (pixSettings) {
                                        setQrLoading(true);
                                        try {
                                            const res = await fetch('/api/admin/finance/pix-qr', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ amount: total, clientName: clientNames[0] }),
                                            });
                                            if (res.ok) {
                                                const d = await res.json();
                                                setQrModal({ qrDataUrl: d.data.qrDataUrl, payload: d.data.payload, invoices: selInvs, totalAmount: total, msg, phone });
                                                setQrLoading(false);
                                                return;
                                            }
                                        } catch { /* fallback */ }
                                        setQrLoading(false);
                                    }
                                    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
                                }}
                            >
                                {qrLoading ? <Loader2 size={14} className="animate-spin" /> : <MessageCircle size={14} />}
                                Enviar {selInvs.length > 1 ? 'juntas' : ''} via WhatsApp
                            </button>
                            <button
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '6px 10px' }}
                                onClick={() => setSelectedInvoices(new Set())}
                            >
                                <X size={14} />
                            </button>
                        </div>
                    );
                })()}
            </div>

            {/* FAB */}
            <FloatingActionButton actions={[
                { label: 'Novo Contrato', icon: <ClipboardList size={18} />, onClick: () => { setEditingContract(null); setContractForm(emptyContractForm); setClientSearch(''); setShowContractModal(true); } },
                { label: 'Nova Fatura', icon: <FileText size={18} />, onClick: () => { setInvoiceForm(emptyInvoiceForm); setClientSearch(''); setShowInvoiceModal(true); } },
            ]} />

            {/* ==== CONTRACT MODAL ==== */}
            {showContractModal && (
                <div className="modal-overlay" onClick={() => setShowContractModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
                        <div className="modal-header">
                            <h2>{editingContract ? 'Editar Contrato' : 'Novo Contrato'}</h2>
                            <button onClick={() => setShowContractModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: 'var(--color-text)' }}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleCreateContract}>
                            <div className="modal-body">
                                {renderClientPicker(contractForm.clientId, (id: string) => setContractForm({ ...contractForm, clientId: id }))}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                                    <div className="form-group">
                                        <label className="form-label">Nome *</label>
                                        <input className="form-input" value={contractForm.name} onChange={e => setContractForm({ ...contractForm, name: e.target.value })} placeholder="Ex: Pacote Mensal" required />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Tipo</label>
                                        <select className="form-input" value={contractForm.type} onChange={e => setContractForm({ ...contractForm, type: e.target.value })}>
                                            <option value="MONTHLY">Mensal</option>
                                            <option value="PER_VIDEO">Por Arquivo</option>
                                            <option value="PER_PROJECT">Por Projeto</option>
                                            <option value="ONE_OFF">Avulso</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Descrição</label>
                                    <textarea className="form-input" value={contractForm.description} onChange={e => setContractForm({ ...contractForm, description: e.target.value })} rows={2} placeholder="Detalhes..." />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                                    {contractForm.type === 'MONTHLY' && <div className="form-group"><label className="form-label">Valor Mensal (R$)</label><input className="form-input" type="number" step="0.01" min="0" value={contractForm.monthlyAmount} onChange={e => setContractForm({ ...contractForm, monthlyAmount: e.target.value })} placeholder="0.00" /></div>}
                                    {contractForm.type === 'PER_VIDEO' && <div className="form-group"><label className="form-label">Valor por Arquivo (R$)</label><input className="form-input" type="number" step="0.01" min="0" value={contractForm.perVideoAmount} onChange={e => setContractForm({ ...contractForm, perVideoAmount: e.target.value })} placeholder="0.00" /></div>}
                                    {contractForm.type === 'PER_PROJECT' && <div className="form-group"><label className="form-label">Valor por Projeto (R$)</label><input className="form-input" type="number" step="0.01" min="0" value={contractForm.perProjectAmount} onChange={e => setContractForm({ ...contractForm, perProjectAmount: e.target.value })} placeholder="0.00" /></div>}
                                    {contractForm.type === 'ONE_OFF' && <div className="form-group"><label className="form-label">Valor Avulso (R$)</label><input className="form-input" type="number" step="0.01" min="0" value={contractForm.oneOffAmount} onChange={e => setContractForm({ ...contractForm, oneOffAmount: e.target.value })} placeholder="0.00" /></div>}
                                    {contractForm.type === 'MONTHLY' && <div className="form-group"><label className="form-label">Dia da Cobrança</label><input className="form-input" type="number" min="1" max="28" value={contractForm.billingDay} onChange={e => setContractForm({ ...contractForm, billingDay: e.target.value })} /></div>}
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: editingContract ? '1fr 1fr 1fr' : '1fr 1fr', gap: 'var(--space-3)' }}>
                                    <div className="form-group"><label className="form-label">Início</label><input className="form-input" type="date" value={contractForm.startDate} onChange={e => setContractForm({ ...contractForm, startDate: e.target.value })} required /></div>
                                    <div className="form-group"><label className="form-label">Fim (opcional)</label><input className="form-input" type="date" value={contractForm.endDate} onChange={e => setContractForm({ ...contractForm, endDate: e.target.value })} /></div>
                                    {editingContract && <div className="form-group"><label className="form-label">Status</label><select className="form-input" value={contractForm.status} onChange={e => setContractForm({ ...contractForm, status: e.target.value })}><option value="ACTIVE">Ativo</option><option value="PAUSED">Pausado</option><option value="CANCELLED">Cancelado</option><option value="FINISHED">Finalizado</option></select></div>}
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowContractModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? <Loader2 size={16} className="animate-spin" /> : editingContract ? 'Salvar' : 'Criar Contrato'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ==== INVOICE CREATE MODAL ==== */}
            {showInvoiceModal && (
                <div className="modal-overlay" onClick={() => setShowInvoiceModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 580 }}>
                        <div className="modal-header">
                            <h2>Nova Fatura</h2>
                            <button onClick={() => setShowInvoiceModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: 'var(--color-text)' }}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleCreateInvoice}>
                            <div className="modal-body">
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                                    {renderClientPicker(invoiceForm.clientId, (id: string) => setInvoiceForm({ ...invoiceForm, clientId: id }))}
                                    <div className="form-group"><label className="form-label">Vencimento *</label><input className="form-input" type="date" value={invoiceForm.dueDate} onChange={e => setInvoiceForm({ ...invoiceForm, dueDate: e.target.value })} required /></div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Contrato (opcional)</label>
                                    <select className="form-input" value={invoiceForm.contractId} onChange={e => setInvoiceForm({ ...invoiceForm, contractId: e.target.value })}>
                                        <option value="">Fatura avulsa</option>
                                        {contracts.filter(c => c.status === 'ACTIVE').map(c => (<option key={c.id} value={c.id}>{c.name} — {c.client.name}</option>))}
                                    </select>
                                </div>
                                <div style={{ marginBottom: 'var(--space-3)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                        <label className="form-label" style={{ margin: 0, fontWeight: 700 }}>Itens *</label>
                                        <button type="button" onClick={addInvoiceItem} className="btn btn-secondary btn-sm" style={{ padding: '2px 10px', fontSize: '0.7rem' }}><Plus size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 2 }} /> Item</button>
                                    </div>
                                    {invoiceForm.items.map((item, idx) => (
                                        <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 55px 90px 28px', gap: 6, marginBottom: 6, alignItems: 'end' }}>
                                            <input className="form-input" value={item.description} onChange={e => updateInvoiceItem(idx, 'description', e.target.value)} placeholder="Descrição" style={{ fontSize: '0.8rem' }} />
                                            <input className="form-input" type="number" min="1" value={item.quantity} onChange={e => updateInvoiceItem(idx, 'quantity', e.target.value)} placeholder="Qtd" style={{ fontSize: '0.8rem', textAlign: 'center' }} />
                                            <input className="form-input" type="number" step="0.01" min="0" value={item.unitPrice} onChange={e => updateInvoiceItem(idx, 'unitPrice', e.target.value)} placeholder="R$" style={{ fontSize: '0.8rem' }} />
                                            {invoiceForm.items.length > 1 && <button type="button" onClick={() => removeInvoiceItem(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 2 }}><X size={14} /></button>}
                                        </div>
                                    ))}
                                    <div style={{ textAlign: 'right', fontWeight: 700, fontSize: '0.92rem', paddingTop: 8, borderTop: '1px solid var(--color-border)', color: 'var(--color-primary)' }}>Total: {formatCurrency(invoiceTotal)}</div>
                                </div>
                                <div className="form-group"><label className="form-label">Observações</label><textarea className="form-input" value={invoiceForm.notes} onChange={e => setInvoiceForm({ ...invoiceForm, notes: e.target.value })} rows={2} placeholder="Notas..." /></div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowInvoiceModal(false)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? <Loader2 size={16} className="animate-spin" /> : `Criar (${formatCurrency(invoiceTotal)})`}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ==== INVOICE EDIT MODAL ==== */}
            {editingInvoice && (
                <div className="modal-overlay" onClick={() => setEditingInvoice(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
                        <div className="modal-header">
                            <h2>Editar Fatura</h2>
                            <button onClick={() => setEditingInvoice(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: 'var(--color-text)' }}><X size={20} /></button>
                        </div>
                        <form onSubmit={handleUpdateInvoice}>
                            <div className="modal-body">
                                <div style={{ padding: '10px 14px', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)', marginBottom: 14, fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <strong>{editingInvoice.client.name}</strong>
                                    <span style={{ fontWeight: 800, color: 'var(--color-primary)' }}>{formatCurrency(editingInvoice.totalAmount)}</span>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                                    <div className="form-group"><label className="form-label">Vencimento</label><input className="form-input" type="date" value={editInvoiceForm.dueDate} onChange={e => setEditInvoiceForm({ ...editInvoiceForm, dueDate: e.target.value })} /></div>
                                    <div className="form-group"><label className="form-label">Status</label><select className="form-input" value={editInvoiceForm.status} onChange={e => setEditInvoiceForm({ ...editInvoiceForm, status: e.target.value })}><option value="PENDING">Pendente</option><option value="PAID">Pago</option><option value="OVERDUE">Atrasado</option><option value="CANCELLED">Cancelado</option></select></div>
                                </div>
                                <div className="form-group"><label className="form-label">Referência</label><input className="form-input" type="month" value={editInvoiceForm.referenceMonth} onChange={e => setEditInvoiceForm({ ...editInvoiceForm, referenceMonth: e.target.value })} /></div>
                                <div className="form-group"><label className="form-label">Observações</label><textarea className="form-input" value={editInvoiceForm.notes} onChange={e => setEditInvoiceForm({ ...editInvoiceForm, notes: e.target.value })} rows={2} /></div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setEditingInvoice(null)}>Cancelar</button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? <Loader2 size={16} className="animate-spin" /> : 'Salvar'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ==== PIX QR CODE MODAL ==== */}
            {qrModal && (
                <div className="modal-overlay" onClick={() => { setQrModal(null); setSelectedInvoices(new Set()); }}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
                        <div className="modal-header">
                            <h2>PIX - {qrModal.invoices[0]?.client.name}</h2>
                            <button onClick={() => { setQrModal(null); setSelectedInvoices(new Set()); }} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: 'var(--color-text)' }}><X size={20} /></button>
                        </div>
                        <div className="modal-body" style={{ textAlign: 'center' }}>
                            {/* Total Amount */}
                            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--color-primary)', marginBottom: 4 }}>
                                {formatCurrency(qrModal.totalAmount)}
                            </div>
                            {qrModal.invoices.length > 1 && (
                                <div className="text-sm text-muted" style={{ marginBottom: 8 }}>
                                    {qrModal.invoices.length} faturas selecionadas
                                </div>
                            )}

                            {/* Invoice list */}
                            <div style={{
                                marginBottom: 16, textAlign: 'left',
                                background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)',
                                padding: '8px 12px', fontSize: '0.8rem',
                            }}>
                                {qrModal.invoices.map((inv, idx) => (
                                    <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: idx < qrModal.invoices.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                                        <span>{inv.contract?.name || inv.notes || 'Fatura avulsa'} {inv.referenceMonth ? `(${formatMonth(inv.referenceMonth)})` : ''}</span>
                                        <span style={{ fontWeight: 700 }}>{formatCurrency(inv.totalAmount)}</span>
                                    </div>
                                ))}
                            </div>

                            {/* QR Code */}
                            <div style={{
                                padding: 16, background: '#fff', borderRadius: 'var(--radius-lg)',
                                display: 'inline-block', marginBottom: 16,
                                boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
                            }}>
                                <img src={qrModal.qrDataUrl} alt="PIX QR Code" style={{ width: 240, height: 240 }} />
                            </div>

                            {/* Copia e Cola */}
                            <div style={{ marginBottom: 16 }}>
                                <label className="form-label" style={{ textAlign: 'left', display: 'block', marginBottom: 4 }}>PIX Copia e Cola</label>
                                <div style={{ display: 'flex', gap: 4, alignItems: 'stretch' }}>
                                    <input
                                        className="form-input"
                                        readOnly
                                        value={qrModal.payload}
                                        style={{ flex: 1, fontSize: '0.72rem', fontFamily: 'monospace' }}
                                        onClick={e => (e.target as HTMLInputElement).select()}
                                    />
                                    <button
                                        className="btn btn-secondary"
                                        style={{ padding: '0 12px', flexShrink: 0 }}
                                        onClick={() => {
                                            navigator.clipboard.writeText(qrModal.payload);
                                            showToast('PIX Copia e Cola copiado!', 'success');
                                        }}
                                        title="Copiar"
                                    >
                                        <Copy size={14} />
                                    </button>
                                </div>
                            </div>

                            {/* PIX info */}
                            <div style={{
                                padding: '10px 14px', background: 'var(--color-bg-secondary)',
                                borderRadius: 'var(--radius-md)', marginBottom: 16,
                                fontSize: '0.8rem', textAlign: 'left',
                            }}>
                                <div><strong>Chave:</strong> {pixSettings?.pixKey}</div>
                                <div><strong>Tipo:</strong> {pixSettings?.pixKeyType}</div>
                                <div><strong>Nome:</strong> {pixSettings?.pixReceiverName}</div>
                            </div>
                        </div>
                        <div className="modal-footer" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {/* Row 1: Send invoice text via WhatsApp */}
                            <button
                                className="btn"
                                style={{ width: '100%', background: '#25D366', border: 'none', color: '#fff', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                                onClick={() => {
                                    window.open(`https://wa.me/${qrModal.phone}?text=${encodeURIComponent(qrModal.msg)}`, '_blank');
                                }}
                            >
                                <MessageCircle size={16} /> 1. Enviar Cobrança
                            </button>
                            {/* Row 2: Send Copia e Cola separately */}
                            <button
                                className="btn"
                                style={{ width: '100%', background: '#25D366', border: 'none', color: '#fff', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: 0.85 }}
                                onClick={() => {
                                    window.open(`https://wa.me/${qrModal.phone}?text=${encodeURIComponent(qrModal.payload)}`, '_blank');
                                }}
                            >
                                <Copy size={16} /> 2. Enviar Código Copia e Cola
                            </button>
                            {/* Row 3: Download QR as PNG */}
                            <button
                                className="btn btn-secondary"
                                style={{ width: '100%', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                                onClick={() => {
                                    const link = document.createElement('a');
                                    link.href = qrModal.qrDataUrl;
                                    link.download = `pix-qrcode-${qrModal.invoices[0]?.client.name.replace(/\s+/g, '_')}.png`;
                                    link.click();
                                }}
                            >
                                <QrCode size={16} /> 3. Baixar QR Code (PNG)
                            </button>
                            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', textAlign: 'center', marginTop: 4 }}>
                                Envie a cobrança, depois o código copia e cola, e por último o QR Code como imagem
                            </div>
                            <button className="btn btn-secondary" style={{ width: '100%', marginTop: 4 }} onClick={() => { setQrModal(null); setSelectedInvoices(new Set()); }}>Fechar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
