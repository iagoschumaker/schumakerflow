'use client';

import { useEffect, useState } from 'react';
import {
    TrendingUp, TrendingDown, DollarSign, ChevronLeft, ChevronRight,
    Calendar, Loader2, ArrowUpCircle, ArrowDownCircle
} from 'lucide-react';

interface Transaction {
    id: string;
    type: 'income' | 'expense';
    description: string;
    client: string | null;
    amount: number;
    date: string;
    category: string | null;
}

interface CashflowData {
    month: string;
    totalIncome: number;
    totalExpenses: number;
    balance: number;
    transactions: Transaction[];
}

const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const CATEGORY_LABELS: Record<string, string> = {
    SOFTWARE: 'Software', EQUIPMENT: 'Equipamento', MARKETING: 'Marketing',
    OFFICE: 'Escritório', SALARY: 'Salário', FREELANCER: 'Freelancer',
    TAX: 'Imposto', OTHER: 'Outro',
};

export default function CashflowPage() {
    const now = new Date();
    const [currentMonth, setCurrentMonth] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
    const [data, setData] = useState<CashflowData | null>(null);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'ALL' | 'income' | 'expense'>('ALL');

    const monthKey = `${currentMonth.year}-${String(currentMonth.month).padStart(2, '0')}`;

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/finance/cashflow?month=${monthKey}`);
            const d = await res.json();
            setData(d.data || null);
        } catch { /* */ }
        setLoading(false);
    };

    useEffect(() => { loadData(); }, [monthKey]);

    const prevMonth = () => setCurrentMonth(p => p.month === 1 ? { year: p.year - 1, month: 12 } : { ...p, month: p.month - 1 });
    const nextMonth = () => setCurrentMonth(p => p.month === 12 ? { year: p.year + 1, month: 1 } : { ...p, month: p.month + 1 });

    const formatCurrency = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

    const filteredTransactions = data?.transactions.filter(t => filter === 'ALL' || t.type === filter) || [];

    return (
        <div className="finance-page">
            <div className="page-header">
                <h1>Fluxo Financeiro</h1>
                <p>Entradas e saídas por mês</p>
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

                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Loader2 size={28} className="animate-spin" style={{ color: 'var(--color-primary)' }} /></div>
                ) : data ? (
                    <>
                        {/* Summary cards */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
                            <div className="card" style={{ padding: '16px 20px', borderLeft: '4px solid #22c55e' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                                    <TrendingUp size={18} style={{ color: '#22c55e' }} />
                                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Entradas</span>
                                </div>
                                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#22c55e' }}>{formatCurrency(data.totalIncome)}</div>
                            </div>
                            <div className="card" style={{ padding: '16px 20px', borderLeft: '4px solid #ef4444' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                                    <TrendingDown size={18} style={{ color: '#ef4444' }} />
                                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Saídas</span>
                                </div>
                                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#ef4444' }}>{formatCurrency(data.totalExpenses)}</div>
                            </div>
                            <div className="card" style={{ padding: '16px 20px', borderLeft: `4px solid ${data.balance >= 0 ? '#22c55e' : '#ef4444'}` }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                                    <DollarSign size={18} style={{ color: data.balance >= 0 ? '#22c55e' : '#ef4444' }} />
                                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Saldo</span>
                                </div>
                                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: data.balance >= 0 ? '#22c55e' : '#ef4444' }}>{formatCurrency(data.balance)}</div>
                            </div>
                        </div>

                        {/* Filter tabs */}
                        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                            {[
                                { key: 'ALL' as const, label: 'Todas', count: data.transactions.length },
                                { key: 'income' as const, label: 'Entradas', count: data.transactions.filter(t => t.type === 'income').length },
                                { key: 'expense' as const, label: 'Saídas', count: data.transactions.filter(t => t.type === 'expense').length },
                            ].map(f => (
                                <button key={f.key} onClick={() => setFilter(f.key)} style={{
                                    padding: '5px 14px', fontSize: '0.78rem', fontWeight: filter === f.key ? 700 : 500,
                                    border: filter === f.key ? 'none' : '1px solid var(--color-border)', borderRadius: 20, cursor: 'pointer',
                                    background: filter === f.key ? 'var(--color-primary)' : 'transparent',
                                    color: filter === f.key ? '#fff' : 'var(--color-text-muted)', transition: 'all 0.2s',
                                }}>
                                    {f.label} <span style={{ opacity: 0.7, marginLeft: 2 }}>{f.count}</span>
                                </button>
                            ))}
                        </div>

                        {/* Transaction list */}
                        {filteredTransactions.length === 0 ? (
                            <div className="card" style={{ padding: 40, textAlign: 'center' }}>
                                <DollarSign size={36} style={{ color: 'var(--color-text-muted)', margin: '0 auto 10px' }} />
                                <p className="text-muted">Nenhuma movimentação encontrada neste mês</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {filteredTransactions.map(t => (
                                    <div key={`${t.type}-${t.id}`} className="card" style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
                                        <div style={{
                                            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                                            background: t.type === 'income' ? '#22c55e12' : '#ef444412',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}>
                                            {t.type === 'income' ? <ArrowUpCircle size={18} style={{ color: '#22c55e' }} /> : <ArrowDownCircle size={18} style={{ color: '#ef4444' }} />}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{t.description}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 2 }}>
                                                <span>{new Date(t.date).toLocaleDateString('pt-BR')}</span>
                                                {t.client && <span>{t.client}</span>}
                                                {t.category && <span>{CATEGORY_LABELS[t.category] || t.category}</span>}
                                            </div>
                                        </div>
                                        <div style={{ fontWeight: 800, fontSize: '1rem', color: t.type === 'income' ? '#22c55e' : '#ef4444', flexShrink: 0 }}>
                                            {t.type === 'income' ? '+' : '-'} {formatCurrency(t.amount)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                ) : (
                    <div className="card" style={{ padding: 40, textAlign: 'center' }}>
                        <p className="text-muted">Erro ao carregar dados</p>
                    </div>
                )}
            </div>
        </div>
    );
}
