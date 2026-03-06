'use client';

import { useEffect, useState } from 'react';
import {
    DollarSign, AlertTriangle, CreditCard, CheckCircle, Copy,
    Calendar, FileText, Ban, Loader2, Receipt
} from 'lucide-react';

interface InvoiceItem {
    description: string;
    quantity: number;
    unitPrice: number;
    totalAmount: number;
    type: string;
}

interface Invoice {
    id: string;
    dueDate: string;
    totalAmount: number;
    status: string;
    pixPayload: string | null;
    pixQrCode: string | null;
    paidAt: string | null;
    referenceMonth: string | null;
    items: InvoiceItem[];
}

interface FinanceData {
    invoices: Invoice[];
    overdueCount: number;
    isBlocked: boolean;
}

const formatCurrency = (v: number | string) => `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
const statusColor = (s: string) => ({ PENDING: '#f59e0b', PAID: '#22c55e', OVERDUE: '#ef4444', CANCELLED: '#9ca3af' }[s] || '#9ca3af');
const statusLabel = (s: string) => ({ PENDING: 'Pendente', PAID: 'Pago', OVERDUE: 'Atrasada', CANCELLED: 'Cancelada', REFUNDED: 'Reembolsada' }[s] || s);

export default function PortalFinancePage() {
    const [data, setData] = useState<FinanceData | null>(null);
    const [loading, setLoading] = useState(true);
    const [expandedInvoice, setExpandedInvoice] = useState<string | null>(null);
    const [copiedPix, setCopiedPix] = useState<string | null>(null);
    const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'PAID' | 'OVERDUE'>('ALL');

    useEffect(() => {
        fetch('/api/portal/invoices')
            .then((r) => r.json())
            .then((d) => setData(d.data || null))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const copyPixPayload = (invoiceId: string, payload: string) => {
        navigator.clipboard.writeText(payload);
        setCopiedPix(invoiceId);
        setTimeout(() => setCopiedPix(null), 3000);
    };

    const invoices = data?.invoices || [];
    const totalPending = invoices.filter(i => i.status === 'PENDING').reduce((s, i) => s + Number(i.totalAmount), 0);
    const totalPaid = invoices.filter(i => i.status === 'PAID').reduce((s, i) => s + Number(i.totalAmount), 0);
    const totalOverdue = invoices.filter(i => i.status === 'OVERDUE').reduce((s, i) => s + Number(i.totalAmount), 0);
    const filtered = invoices.filter(i => filter === 'ALL' || i.status === filter);

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
        <div className="portal-finance">
            <style>{`
                .portal-finance .item-card { padding: 14px 16px; display: flex; align-items: center; gap: 12px; transition: box-shadow 0.2s; cursor: pointer; }
                .portal-finance .item-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.08); }
                .portal-finance .item-card .card-bar { width: 4px; align-self: stretch; border-radius: 4px; flex-shrink: 0; }
                .portal-finance .item-card .card-icon { width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
                .portal-finance .item-card .card-info { flex: 1; min-width: 0; }
                .portal-finance .item-card .card-value { text-align: right; flex-shrink: 0; }
                @media (max-width: 600px) {
                    .portal-finance .stat-grid { grid-template-columns: 1fr 1fr !important; gap: 8px !important; }
                    .portal-finance .item-card { position: relative; padding-right: 90px; }
                    .portal-finance .item-card .card-value { position: absolute; top: 14px; right: 14px; }
                    .portal-finance .item-card .card-icon { width: 30px; height: 30px; }
                }
            `}</style>

            <div className="page-header">
                <h1>Financeiro</h1>
                <p>Suas faturas e pagamentos</p>
            </div>

            <div className="page-content">
                {/* Block Warning */}
                {data?.isBlocked && (
                    <div className="card" style={{
                        background: 'rgba(239,68,68,0.08)', border: '1px solid #ef4444',
                        marginBottom: 20, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12,
                    }}>
                        <AlertTriangle size={22} style={{ color: '#ef4444', flexShrink: 0 }} />
                        <div>
                            <div style={{ fontWeight: 700, color: '#ef4444', fontSize: '0.9rem' }}>
                                Acesso restrito — {data.overdueCount} fatura(s) em atraso
                            </div>
                            <div style={{ fontSize: '0.78rem', color: '#ef4444', opacity: 0.8 }}>
                                Regularize suas pendências para restaurar o acesso completo.
                            </div>
                        </div>
                    </div>
                )}

                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Loader2 size={28} className="animate-spin" style={{ color: 'var(--color-primary)' }} /></div>
                ) : (
                    <>
                        {/* Summary Cards */}
                        <div className="stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
                            {[
                                { icon: <DollarSign size={18} />, color: '#f59e0b', value: formatCurrency(totalPending), label: 'A Pagar', sub: `${invoices.filter(i => i.status === 'PENDING').length} fatura(s)` },
                                { icon: <CheckCircle size={18} />, color: '#22c55e', value: formatCurrency(totalPaid), label: 'Pago', sub: `${invoices.filter(i => i.status === 'PAID').length} fatura(s)` },
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

                        {/* Filter pills */}
                        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                            <Pill label="Todas" active={filter === 'ALL'} count={invoices.length} onClick={() => setFilter('ALL')} />
                            <Pill label="Pendentes" active={filter === 'PENDING'} count={invoices.filter(i => i.status === 'PENDING').length} onClick={() => setFilter('PENDING')} />
                            <Pill label="Pagas" active={filter === 'PAID'} count={invoices.filter(i => i.status === 'PAID').length} onClick={() => setFilter('PAID')} />
                            <Pill label="Atrasadas" active={filter === 'OVERDUE'} count={invoices.filter(i => i.status === 'OVERDUE').length} onClick={() => setFilter('OVERDUE')} />
                        </div>

                        {/* Invoice cards */}
                        {filtered.length === 0 ? (
                            <div className="card" style={{ padding: 40, textAlign: 'center' }}>
                                <DollarSign size={32} style={{ color: 'var(--color-text-muted)', margin: '0 auto 8px' }} />
                                <p className="text-muted" style={{ fontSize: '0.85rem' }}>Nenhuma fatura encontrada</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {filtered.map((inv) => (
                                    <div key={inv.id}>
                                        <div className="card item-card"
                                            onClick={() => setExpandedInvoice(expandedInvoice === inv.id ? null : inv.id)}
                                            style={{ borderLeft: `3px solid ${statusColor(inv.status)}`, borderBottom: expandedInvoice === inv.id ? 'none' : undefined, borderRadius: expandedInvoice === inv.id ? 'var(--radius-md) var(--radius-md) 0 0' : undefined }}
                                        >
                                            {/* Status icon */}
                                            <div className="card-icon" style={{ background: `${statusColor(inv.status)}12` }}>
                                                {inv.status === 'PAID' ? <CheckCircle size={16} style={{ color: '#22c55e' }} /> :
                                                    inv.status === 'OVERDUE' ? <Receipt size={16} style={{ color: '#ef4444' }} /> :
                                                        inv.status === 'CANCELLED' ? <Ban size={16} style={{ color: '#9ca3af' }} /> :
                                                            <FileText size={16} style={{ color: '#f59e0b' }} />}
                                            </div>

                                            {/* Info */}
                                            <div className="card-info">
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                                    <span style={{ fontSize: '0.65rem', fontWeight: 600, padding: '1px 8px', borderRadius: 6, background: `${statusColor(inv.status)}15`, color: statusColor(inv.status) }}>{statusLabel(inv.status)}</span>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 3, fontSize: '0.76rem', color: 'var(--color-text-muted)', flexWrap: 'wrap' }}>
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Calendar size={11} /> Venc: {new Date(inv.dueDate).toLocaleDateString('pt-BR')}</span>
                                                    {inv.paidAt && <span style={{ color: '#22c55e' }}>Pago: {new Date(inv.paidAt).toLocaleDateString('pt-BR')}</span>}
                                                </div>
                                            </div>

                                            {/* Value */}
                                            <div className="card-value">
                                                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: statusColor(inv.status) }}>{formatCurrency(inv.totalAmount)}</div>
                                                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', textAlign: 'right' }}>
                                                    {expandedInvoice === inv.id ? '▲' : '▼'}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Expanded Details */}
                                        {expandedInvoice === inv.id && (
                                            <div className="card" style={{ borderTop: '1px solid var(--color-border)', borderRadius: '0 0 var(--radius-md) var(--radius-md)', borderLeft: `3px solid ${statusColor(inv.status)}` }}>
                                                {/* Items */}
                                                {inv.items.length > 0 && (
                                                    <div style={{ padding: '14px 16px' }}>
                                                        <div style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: 8 }}>Itens</div>
                                                        {inv.items.map((item, idx) => (
                                                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: idx < inv.items.length - 1 ? '1px solid var(--color-border)' : 'none', fontSize: '0.82rem' }}>
                                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                                    <span>{item.description}</span>
                                                                    {item.quantity > 1 && <span className="text-muted" style={{ marginLeft: 6 }}>x{item.quantity}</span>}
                                                                </div>
                                                                <span style={{ fontWeight: 700, flexShrink: 0, marginLeft: 12 }}>{formatCurrency(item.totalAmount)}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                {/* PIX */}
                                                {(inv.status === 'PENDING' || inv.status === 'OVERDUE') && inv.pixPayload && (
                                                    <div style={{ padding: '14px 16px', background: 'var(--color-bg-secondary)', borderTop: '1px solid var(--color-border)' }}>
                                                        <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                                                            <CreditCard size={14} /> Pagar com PIX
                                                        </div>
                                                        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                                                            {inv.pixQrCode && (
                                                                <div style={{ background: 'white', padding: 10, borderRadius: 8, border: '1px solid var(--color-border)' }}>
                                                                    <img src={`data:image/png;base64,${inv.pixQrCode}`} alt="QR Code PIX" style={{ width: 150, height: 150 }} />
                                                                </div>
                                                            )}
                                                            <div style={{ flex: 1, minWidth: 180 }}>
                                                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: 6 }}>PIX Copia e Cola:</div>
                                                                <div style={{ background: 'white', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--color-border)', wordBreak: 'break-all', fontSize: '0.72rem', fontFamily: 'monospace', maxHeight: 100, overflow: 'auto', color: '#333' }}>
                                                                    {inv.pixPayload}
                                                                </div>
                                                                <button className="btn btn-primary btn-sm" style={{ marginTop: 8, fontSize: '0.78rem' }}
                                                                    onClick={(e) => { e.stopPropagation(); copyPixPayload(inv.id, inv.pixPayload!); }}
                                                                >
                                                                    {copiedPix === inv.id ? <><CheckCircle size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Copiado!</> : <><Copy size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Copiar código</>}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
