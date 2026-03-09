'use client';

import { useEffect, useState } from 'react';
import jsPDF from 'jspdf';
import { SFLOW_LOGO_BASE64 } from '@/lib/finance/logo-base64';
import {
    TrendingUp, TrendingDown, DollarSign, ChevronLeft, ChevronRight,
    Calendar, Loader2, ArrowUpCircle, ArrowDownCircle, FileDown,
    User, ClipboardList, FileText, ChevronDown, ChevronUp
} from 'lucide-react';

interface TransactionItem {
    description: string;
    quantity: number;
    unitPrice: number;
    totalAmount: number;
    type: string;
}

interface Transaction {
    id: string;
    type: 'income' | 'expense';
    description: string;
    client: string | null;
    clientPhone: string | null;
    amount: number;
    date: string;
    dueDate: string | null;
    paidAt: string | null;
    referenceMonth: string | null;
    notes: string | null;
    category: string | null;
    contractName: string | null;
    contractType: string | null;
    items: TransactionItem[];
}

interface CashflowData {
    month: string;
    totalIncome: number;
    totalExpenses: number;
    balance: number;
    incomeCount: number;
    expenseCount: number;
    transactions: Transaction[];
}

const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const MONTH_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const CATEGORY_LABELS: Record<string, string> = {
    SOFTWARE: 'Software', EQUIPMENT: 'Equipamento', MARKETING: 'Marketing',
    OFFICE: 'Escritório', SALARY: 'Salário', FREELANCER: 'Freelancer',
    TAX: 'Imposto', OTHER: 'Outro',
};

const TYPE_LABELS: Record<string, string> = {
    MONTHLY: 'Mensal', PER_VIDEO: 'Por Arquivo', PER_PROJECT: 'Por Projeto', ONE_OFF: 'Avulso',
};

export default function CashflowPage() {
    const now = new Date();
    const [currentMonth, setCurrentMonth] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
    const [data, setData] = useState<CashflowData | null>(null);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'ALL' | 'income' | 'expense'>('ALL');
    const [expandedId, setExpandedId] = useState<string | null>(null);

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
    const fDate = (d: string) => new Date(d).toLocaleDateString('pt-BR');
    const fMonth = (m: string | null) => { if (!m) return ''; const [y, mo] = m.split('-'); return `${MONTH_SHORT[parseInt(mo) - 1]}/${y}`; };

    const filteredTransactions = data?.transactions.filter(t => filter === 'ALL' || t.type === filter) || [];

    // ── PDF generation ──
    const generateCashflowPdf = () => {
        if (!data) return;
        const doc = new jsPDF();

        // Colors
        const D: [number, number, number] = [17, 20, 39];
        const T: [number, number, number] = [40, 42, 55];
        const M: [number, number, number] = [130, 135, 155];
        const B: [number, number, number] = [215, 218, 228];
        const BG: [number, number, number] = [245, 246, 250];
        const GR: [number, number, number] = [34, 197, 94];
        const RD: [number, number, number] = [239, 68, 68];

        // ── Header ──
        doc.setFillColor(...D);
        doc.rect(0, 0, 5, 297, 'F');
        try { doc.addImage(SFLOW_LOGO_BASE64, 'PNG', 14, 10, 16, 16); } catch { /* */ }
        doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(...D);
        doc.text('SFlow', 34, 18);
        doc.setFontSize(6.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...M);
        doc.text('Gestão de Mídia', 34, 23);
        doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(...D);
        doc.text('FLUXO FINANCEIRO', 195, 20, { align: 'right' });
        doc.setDrawColor(...B); doc.setLineWidth(0.3); doc.line(14, 32, 195, 32);

        let y = 38;

        // ── Period ──
        doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...D);
        doc.text(`Período: ${MONTH_NAMES[currentMonth.month - 1]} ${currentMonth.year}`, 14, y);
        doc.setFontSize(7); doc.setFont('helvetica', 'normal'); doc.setTextColor(...M);
        doc.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 195, y, { align: 'right' });
        y += 10;

        // ── Bar Chart ──
        const chartW = 170;
        const chartH = 50;
        const chartX = 14;
        const chartY = y;
        const maxVal = Math.max(data.totalIncome, data.totalExpenses, 1);

        // Background
        doc.setFillColor(...BG);
        doc.roundedRect(chartX, chartY, chartW + 11, chartH + 20, 3, 3, 'F');

        // Chart title
        doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(...D);
        doc.text('RESUMO MENSAL', chartX + 6, chartY + 8);

        // Bars
        const barY = chartY + 14;
        const barMaxH = chartH - 6;
        const barW = 35;
        const gap = 25;
        const startX = chartX + 30;

        // Income bar
        const incomeH = Math.max((data.totalIncome / maxVal) * barMaxH, 2);
        doc.setFillColor(...GR);
        doc.roundedRect(startX, barY + barMaxH - incomeH, barW, incomeH, 2, 2, 'F');
        doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...GR);
        doc.text(formatCurrency(data.totalIncome), startX + barW / 2, barY + barMaxH - incomeH - 3, { align: 'center' });
        doc.setFontSize(7); doc.setTextColor(...M);
        doc.text('Entradas', startX + barW / 2, barY + barMaxH + 6, { align: 'center' });
        doc.setFontSize(6);
        doc.text(`${data.incomeCount} fatura(s)`, startX + barW / 2, barY + barMaxH + 11, { align: 'center' });

        // Expense bar
        const expX = startX + barW + gap;
        const expenseH = Math.max((data.totalExpenses / maxVal) * barMaxH, 2);
        doc.setFillColor(...RD);
        doc.roundedRect(expX, barY + barMaxH - expenseH, barW, expenseH, 2, 2, 'F');
        doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(...RD);
        doc.text(formatCurrency(data.totalExpenses), expX + barW / 2, barY + barMaxH - expenseH - 3, { align: 'center' });
        doc.setFontSize(7); doc.setTextColor(...M);
        doc.text('Saídas', expX + barW / 2, barY + barMaxH + 6, { align: 'center' });
        doc.setFontSize(6);
        doc.text(`${data.expenseCount} despesa(s)`, expX + barW / 2, barY + barMaxH + 11, { align: 'center' });

        // Balance
        const balX = expX + barW + gap;
        const balColor = data.balance >= 0 ? GR : RD;
        doc.setFillColor(balColor[0], balColor[1], balColor[2], 0.1);
        doc.roundedRect(balX, barY, barW + 5, barMaxH, 3, 3, 'F');
        doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(...M);
        doc.text('SALDO', balX + (barW + 5) / 2, barY + barMaxH / 2 - 5, { align: 'center' });
        doc.setFontSize(12); doc.setTextColor(...balColor);
        doc.text(formatCurrency(data.balance), balX + (barW + 5) / 2, barY + barMaxH / 2 + 5, { align: 'center' });

        y = chartY + chartH + 24;

        // ── Transactions table ──
        // Section: Income
        if (data.transactions.filter(t => t.type === 'income').length > 0) {
            doc.setFillColor(...GR); doc.roundedRect(14, y, 2.5, 9, 1, 1, 'F');
            doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(...GR);
            doc.text('ENTRADAS', 21, y + 6.5);
            y += 12;

            // Header row
            doc.setFillColor(...BG); doc.rect(14, y, 181, 7, 'F');
            doc.setFontSize(6); doc.setFont('helvetica', 'bold'); doc.setTextColor(...M);
            doc.text('CLIENTE', 20, y + 5);
            doc.text('CONTRATO/DESCRIÇÃO', 70, y + 5);
            doc.text('DATA PGTO', 135, y + 5);
            doc.text('VALOR', 190, y + 5, { align: 'right' });
            y += 10;

            doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...T);
            for (const t of data.transactions.filter(t => t.type === 'income')) {
                if (y > 260) { doc.addPage(); y = 20; }
                doc.text((t.client || '').substring(0, 25), 20, y);
                doc.text((t.contractName || t.description).substring(0, 30), 70, y);
                doc.text(t.paidAt ? fDate(t.paidAt) : '—', 135, y);
                doc.setFont('helvetica', 'bold');
                doc.text(formatCurrency(t.amount), 190, y, { align: 'right' });
                doc.setFont('helvetica', 'normal');
                doc.setDrawColor(238, 238, 244); doc.setLineWidth(0.15); doc.line(20, y + 2.5, 190, y + 2.5);

                // Show items if any
                if (t.items.length > 0) {
                    for (const item of t.items) {
                        y += 5;
                        if (y > 260) { doc.addPage(); y = 20; }
                        doc.setFontSize(6); doc.setTextColor(...M);
                        doc.text(`  · ${item.description.substring(0, 40)}  ×${item.quantity}`, 26, y);
                        doc.text(formatCurrency(item.totalAmount), 190, y, { align: 'right' });
                    }
                    doc.setFontSize(7.5); doc.setTextColor(...T);
                }
                y += 7;
            }
            y += 5;
        }

        // Section: Expenses
        if (data.transactions.filter(t => t.type === 'expense').length > 0) {
            if (y > 240) { doc.addPage(); y = 20; }
            doc.setFillColor(...RD); doc.roundedRect(14, y, 2.5, 9, 1, 1, 'F');
            doc.setFontSize(7); doc.setFont('helvetica', 'bold'); doc.setTextColor(...RD);
            doc.text('SAÍDAS', 21, y + 6.5);
            y += 12;

            doc.setFillColor(...BG); doc.rect(14, y, 181, 7, 'F');
            doc.setFontSize(6); doc.setFont('helvetica', 'bold'); doc.setTextColor(...M);
            doc.text('DESCRIÇÃO', 20, y + 5);
            doc.text('CATEGORIA', 110, y + 5);
            doc.text('DATA', 150, y + 5);
            doc.text('VALOR', 190, y + 5, { align: 'right' });
            y += 10;

            doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); doc.setTextColor(...T);
            for (const t of data.transactions.filter(t => t.type === 'expense')) {
                if (y > 260) { doc.addPage(); y = 20; }
                doc.text(t.description.substring(0, 40), 20, y);
                doc.text(t.category ? (CATEGORY_LABELS[t.category] || t.category) : '', 110, y);
                doc.text(fDate(t.date), 150, y);
                doc.setFont('helvetica', 'bold');
                doc.text(formatCurrency(t.amount), 190, y, { align: 'right' });
                doc.setFont('helvetica', 'normal');
                doc.setDrawColor(238, 238, 244); doc.setLineWidth(0.15); doc.line(20, y + 2.5, 190, y + 2.5);
                y += 7;
            }
            y += 5;
        }

        // ── Totals ──
        if (y > 250) { doc.addPage(); y = 20; }
        doc.setDrawColor(...D); doc.setLineWidth(0.5); doc.line(100, y, 195, y);
        y += 8;
        doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(...M);
        doc.text('Entradas:', 130, y); doc.setFont('helvetica', 'bold'); doc.setTextColor(...GR);
        doc.text(formatCurrency(data.totalIncome), 190, y, { align: 'right' });
        y += 6;
        doc.setFont('helvetica', 'normal'); doc.setTextColor(...M);
        doc.text('Saídas:', 130, y); doc.setFont('helvetica', 'bold'); doc.setTextColor(...RD);
        doc.text(formatCurrency(data.totalExpenses), 190, y, { align: 'right' });
        y += 8;
        doc.setDrawColor(...D); doc.setLineWidth(0.3); doc.line(125, y - 2, 195, y - 2);
        doc.setFontSize(10); doc.setFont('helvetica', 'bold');
        const bc = data.balance >= 0 ? GR : RD;
        doc.setTextColor(...bc);
        doc.text(`Saldo: ${formatCurrency(data.balance)}`, 190, y + 4, { align: 'right' });

        // ── Footer ──
        const h = doc.internal.pageSize.getHeight();
        doc.setDrawColor(...B); doc.setLineWidth(0.2); doc.line(14, h - 16, 195, h - 16);
        doc.setFontSize(6); doc.setTextColor(...M);
        doc.text('Gerado automaticamente por SFlow — schumaker.com.br', 105, h - 10, { align: 'center' });
        doc.text(`Emissão: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 105, h - 6, { align: 'center' });

        doc.save(`fluxo_financeiro_${MONTH_NAMES[currentMonth.month - 1].toLowerCase()}_${currentMonth.year}.pdf`);
    };

    return (
        <div className="finance-page">
            <style>{`
                .cashflow-card { padding: 14px 18px; transition: box-shadow 0.2s; cursor: pointer; }
                .cashflow-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.08); }
                .cashflow-expand { padding: 0 18px 14px 54px; background: var(--color-bg-secondary); border-radius: 0 0 var(--radius-md) var(--radius-md); margin-top: -4px; }
                @media (max-width: 600px) {
                    .cashflow-card { padding: 12px 14px; }
                    .cashflow-expand { padding: 0 14px 12px 14px; }
                }
            `}</style>

            <div className="page-header">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                    <div>
                        <h1>Fluxo Financeiro</h1>
                        <p>Entradas e saídas detalhadas por mês</p>
                    </div>
                    {data && (
                        <button className="btn btn-secondary" onClick={generateCashflowPdf} style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                            <FileDown size={16} /> Exportar PDF
                        </button>
                    )}
                </div>
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
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                                    <TrendingUp size={18} style={{ color: '#22c55e' }} />
                                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Entradas</span>
                                </div>
                                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#22c55e' }}>{formatCurrency(data.totalIncome)}</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: 2 }}>{data.incomeCount} fatura(s) paga(s)</div>
                            </div>
                            <div className="card" style={{ padding: '16px 20px', borderLeft: '4px solid #ef4444' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                                    <TrendingDown size={18} style={{ color: '#ef4444' }} />
                                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Saídas</span>
                                </div>
                                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#ef4444' }}>{formatCurrency(data.totalExpenses)}</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: 2 }}>{data.expenseCount} despesa(s)</div>
                            </div>
                            <div className="card" style={{ padding: '16px 20px', borderLeft: `4px solid ${data.balance >= 0 ? '#22c55e' : '#ef4444'}` }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                                    <DollarSign size={18} style={{ color: data.balance >= 0 ? '#22c55e' : '#ef4444' }} />
                                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Saldo</span>
                                </div>
                                <div style={{ fontSize: '1.3rem', fontWeight: 800, color: data.balance >= 0 ? '#22c55e' : '#ef4444' }}>{formatCurrency(data.balance)}</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                                    {data.balance >= 0 ? 'Lucro' : 'Prejuízo'} no mês
                                </div>
                            </div>
                        </div>

                        {/* Visual bar chart */}
                        {(data.totalIncome > 0 || data.totalExpenses > 0) && (
                            <div className="card" style={{ padding: 20, marginBottom: 20 }}>
                                <div style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: 12, color: 'var(--color-text)' }}>Comparativo</div>
                                {[
                                    { label: 'Entradas', value: data.totalIncome, color: '#22c55e' },
                                    { label: 'Saídas', value: data.totalExpenses, color: '#ef4444' },
                                ].map((bar, i) => {
                                    const maxBar = Math.max(data.totalIncome, data.totalExpenses);
                                    const pct = maxBar > 0 ? (bar.value / maxBar) * 100 : 0;
                                    return (
                                        <div key={i} style={{ marginBottom: 10 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: 4 }}>
                                                <span style={{ color: 'var(--color-text-muted)' }}>{bar.label}</span>
                                                <span style={{ fontWeight: 700, color: bar.color }}>{formatCurrency(bar.value)}</span>
                                            </div>
                                            <div style={{ height: 10, background: 'var(--color-bg-secondary)', borderRadius: 5, overflow: 'hidden' }}>
                                                <div style={{ width: `${pct}%`, height: '100%', background: bar.color, borderRadius: 5, transition: 'width 0.5s ease' }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Filter tabs */}
                        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                            {[
                                { key: 'ALL' as const, label: 'Todas', count: data.transactions.length },
                                { key: 'income' as const, label: 'Entradas', count: data.incomeCount },
                                { key: 'expense' as const, label: 'Saídas', count: data.expenseCount },
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
                                {filteredTransactions.map(t => {
                                    const isExpanded = expandedId === `${t.type}-${t.id}`;
                                    const isIncome = t.type === 'income';
                                    const color = isIncome ? '#22c55e' : '#ef4444';
                                    return (
                                        <div key={`${t.type}-${t.id}`}>
                                            <div
                                                className="card cashflow-card"
                                                onClick={() => setExpandedId(isExpanded ? null : `${t.type}-${t.id}`)}
                                                style={{ display: 'flex', alignItems: 'center', gap: 14, borderLeft: `3px solid ${color}`, borderRadius: isExpanded ? 'var(--radius-md) var(--radius-md) 0 0' : undefined }}
                                            >
                                                <div style={{
                                                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                                                    background: `${color}12`,
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                }}>
                                                    {isIncome ? <ArrowUpCircle size={18} style={{ color }} /> : <ArrowDownCircle size={18} style={{ color }} />}
                                                </div>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                                        <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>{t.description}</span>
                                                        {t.contractName && (
                                                            <span style={{ fontSize: '0.6rem', fontWeight: 600, padding: '1px 6px', borderRadius: 6, background: '#6366f115', color: '#6366f1' }}>
                                                                {t.contractType ? TYPE_LABELS[t.contractType] || t.contractType : 'Contrato'}
                                                            </span>
                                                        )}
                                                        {t.category && (
                                                            <span style={{ fontSize: '0.6rem', fontWeight: 600, padding: '1px 6px', borderRadius: 6, background: `${color}12`, color }}>
                                                                {CATEGORY_LABELS[t.category] || t.category}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 2 }}>
                                                        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                                            <Calendar size={10} /> {fDate(t.date)}
                                                        </span>
                                                        {t.client && (
                                                            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                                                <User size={10} /> {t.client}
                                                            </span>
                                                        )}
                                                        {t.contractName && (
                                                            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                                                <ClipboardList size={10} /> {t.contractName}
                                                            </span>
                                                        )}
                                                        {t.referenceMonth && (
                                                            <span>Ref: {fMonth(t.referenceMonth)}</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                                    <div style={{ fontWeight: 800, fontSize: '1rem', color }}>
                                                        {isIncome ? '+' : '-'} {formatCurrency(t.amount)}
                                                    </div>
                                                    {isExpanded ? <ChevronUp size={14} style={{ color: 'var(--color-text-muted)' }} /> : <ChevronDown size={14} style={{ color: 'var(--color-text-muted)' }} />}
                                                </div>
                                            </div>
                                            {/* Expanded details */}
                                            {isExpanded && (
                                                <div className="card cashflow-expand">
                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginTop: 12 }}>
                                                        {t.dueDate && (
                                                            <div>
                                                                <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Vencimento</div>
                                                                <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{fDate(t.dueDate)}</div>
                                                            </div>
                                                        )}
                                                        {t.paidAt && (
                                                            <div>
                                                                <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Data Pagamento</div>
                                                                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#22c55e' }}>{fDate(t.paidAt)}</div>
                                                            </div>
                                                        )}
                                                        {t.client && (
                                                            <div>
                                                                <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Cliente</div>
                                                                <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{t.client}</div>
                                                                {t.clientPhone && <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>{t.clientPhone}</div>}
                                                            </div>
                                                        )}
                                                        {t.contractName && (
                                                            <div>
                                                                <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Contrato</div>
                                                                <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{t.contractName}</div>
                                                            </div>
                                                        )}
                                                        {t.referenceMonth && (
                                                            <div>
                                                                <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Referência</div>
                                                                <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{fMonth(t.referenceMonth)}</div>
                                                            </div>
                                                        )}
                                                    </div>
                                                    {/* Invoice items */}
                                                    {t.items.length > 0 && (
                                                        <div style={{ marginTop: 12 }}>
                                                            <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 }}>Itens da Fatura</div>
                                                            <div style={{ background: 'var(--color-surface)', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                                                                {t.items.map((item, idx) => (
                                                                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 12px', borderBottom: idx < t.items.length - 1 ? '1px solid var(--color-border)' : 'none', fontSize: '0.8rem' }}>
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                            <FileText size={12} style={{ color: 'var(--color-text-muted)' }} />
                                                                            <span>{item.description}</span>
                                                                            <span style={{ color: 'var(--color-text-muted)', fontSize: '0.7rem' }}>×{item.quantity}</span>
                                                                        </div>
                                                                        <span style={{ fontWeight: 700 }}>{formatCurrency(item.totalAmount)}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                    {t.notes && (
                                                        <div style={{ marginTop: 8, fontSize: '0.78rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                                                            Obs: {t.notes}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
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
