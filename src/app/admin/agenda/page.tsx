'use client';

import { useEffect, useState } from 'react';
import {
    Calendar as CalendarIcon, ChevronLeft, ChevronRight, Loader2,
    Receipt, CreditCard, Package, Clock
} from 'lucide-react';

interface AgendaEvent {
    id: string;
    date: string;
    type: 'invoice_due' | 'invoice_paid' | 'expense' | 'delivery';
    title: string;
    subtitle: string | null;
    amount: number | null;
    color: string;
    status: string | null;
}

interface AgendaData {
    month: string;
    events: AgendaEvent[];
    summary: { invoices: number; expenses: number; deliveries: number };
}

const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const TYPE_ICONS: Record<string, React.ReactNode> = {
    invoice_due: <Receipt size={12} />,
    invoice_paid: <Receipt size={12} />,
    expense: <CreditCard size={12} />,
    delivery: <Package size={12} />,
};

const TYPE_LABELS: Record<string, string> = {
    invoice_due: 'Fatura',
    expense: 'Despesa',
    delivery: 'Entrega',
};

const STATUS_LABELS: Record<string, string> = {
    PAID: 'Pago',
    PENDING: 'Pendente',
    OVERDUE: 'Atrasada',
    CANCELLED: 'Cancelada',
    DRAFT: 'Rascunho',
    IN_PRODUCTION: 'Em Produção',
    DELIVERED: 'Entregue',
};

export default function AgendaPage() {
    const now = new Date();
    const [currentMonth, setCurrentMonth] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 });
    const [data, setData] = useState<AgendaData | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedDay, setSelectedDay] = useState<string | null>(null);

    const monthKey = `${currentMonth.year}-${String(currentMonth.month).padStart(2, '0')}`;

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/agenda?month=${monthKey}`);
            const d = await res.json();
            setData(d.data || null);
        } catch { /* */ }
        setLoading(false);
    };

    useEffect(() => { loadData(); setSelectedDay(null); }, [monthKey]);

    const prevMonth = () => setCurrentMonth(p => p.month === 1 ? { year: p.year - 1, month: 12 } : { ...p, month: p.month - 1 });
    const nextMonth = () => setCurrentMonth(p => p.month === 12 ? { year: p.year + 1, month: 1 } : { ...p, month: p.month + 1 });

    const formatCurrency = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

    // Build calendar grid
    const firstDay = new Date(currentMonth.year, currentMonth.month - 1, 1).getDay();
    const daysInMonth = new Date(currentMonth.year, currentMonth.month, 0).getDate();
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    // Group events by day
    const eventsByDay: Record<string, AgendaEvent[]> = {};
    if (data) {
        for (const ev of data.events) {
            const day = ev.date;
            if (!eventsByDay[day]) eventsByDay[day] = [];
            eventsByDay[day].push(ev);
        }
    }

    const selectedEvents = selectedDay ? (eventsByDay[selectedDay] || []) : [];

    return (
        <div className="finance-page">
            <style>{`
                .cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }
                .cal-header { text-align: center; font-size: 0.7rem; font-weight: 700; color: var(--color-text-muted); padding: 8px 0; text-transform: uppercase; }
                .cal-day {
                    min-height: 70px; padding: 4px; border-radius: var(--radius-md);
                    background: var(--color-bg); border: 1px solid var(--color-border-light);
                    cursor: pointer; transition: all 0.15s; position: relative;
                }
                .cal-day:hover { background: var(--color-bg-secondary); border-color: var(--color-primary); transform: translateY(-1px); }
                .cal-day.today { border-color: var(--color-primary); box-shadow: 0 0 0 1px var(--color-primary); }
                .cal-day.selected { background: var(--color-primary-light); border-color: var(--color-primary); }
                .cal-day.empty { background: transparent; border-color: transparent; cursor: default; min-height: 0; }
                .cal-day.empty:hover { transform: none; }
                .cal-day-num { font-size: 0.78rem; font-weight: 700; margin-bottom: 3px; }
                .cal-dots { display: flex; flex-wrap: wrap; gap: 2px; }
                .cal-dot { width: 7px; height: 7px; border-radius: 50%; }
                .event-card { display: flex; align-items: center; gap: 10px; padding: 10px 14px; border-radius: var(--radius-md); border-left: 3px solid; background: var(--color-bg); margin-bottom: 4px; transition: all 0.15s; }
                .event-card:hover { background: var(--color-bg-secondary); transform: translateX(2px); }
                @media (max-width: 600px) {
                    .cal-day { min-height: 50px; padding: 3px; }
                    .cal-day-num { font-size: 0.7rem; }
                    .cal-header { font-size: 0.6rem; padding: 5px 0; }
                }
            `}</style>

            <div className="page-header">
                <div>
                    <h1>Agenda</h1>
                    <p>Calendário de faturas, despesas e entregas</p>
                </div>
            </div>

            <div className="page-content">
                {/* Month navigation */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 20, padding: '10px 0' }}>
                    <button onClick={prevMonth} className="btn btn-secondary btn-sm" style={{ padding: '6px 10px' }}><ChevronLeft size={18} /></button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 200, justifyContent: 'center' }}>
                        <CalendarIcon size={16} style={{ color: 'var(--color-primary)' }} />
                        <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>{MONTH_NAMES[currentMonth.month - 1]} {currentMonth.year}</span>
                    </div>
                    <button onClick={nextMonth} className="btn btn-secondary btn-sm" style={{ padding: '6px 10px' }}><ChevronRight size={18} /></button>
                </div>

                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><Loader2 size={28} className="animate-spin" style={{ color: 'var(--color-primary)' }} /></div>
                ) : data ? (
                    <>
                        {/* Summary pills */}
                        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 12px', borderRadius: 20, background: '#f59e0b15', color: '#f59e0b', fontSize: '0.78rem', fontWeight: 600 }}>
                                <Receipt size={13} /> {data.summary.invoices} fatura(s)
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 12px', borderRadius: 20, background: '#ef444415', color: '#ef4444', fontSize: '0.78rem', fontWeight: 600 }}>
                                <CreditCard size={13} /> {data.summary.expenses} despesa(s)
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 12px', borderRadius: 20, background: '#3b82f615', color: '#3b82f6', fontSize: '0.78rem', fontWeight: 600 }}>
                                <Package size={13} /> {data.summary.deliveries} entrega(s)
                            </div>
                        </div>

                        {/* Calendar grid */}
                        <div className="card" style={{ padding: 12, marginBottom: 16 }}>
                            <div className="cal-grid">
                                {DAY_NAMES.map(d => <div key={d} className="cal-header">{d}</div>)}

                                {/* Empty slots before first day */}
                                {Array.from({ length: firstDay }, (_, i) => (
                                    <div key={`empty-${i}`} className="cal-day empty" />
                                ))}

                                {/* Days */}
                                {Array.from({ length: daysInMonth }, (_, i) => {
                                    const day = i + 1;
                                    const dateStr = `${currentMonth.year}-${String(currentMonth.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                    const dayEvents = eventsByDay[dateStr] || [];
                                    const isToday = dateStr === todayStr;
                                    const isSelected = dateStr === selectedDay;

                                    return (
                                        <div
                                            key={day}
                                            className={`cal-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`}
                                            onClick={() => setSelectedDay(isSelected ? null : dateStr)}
                                        >
                                            <div className="cal-day-num" style={{ color: isToday ? 'var(--color-primary)' : 'var(--color-text)' }}>{day}</div>
                                            <div className="cal-dots">
                                                {dayEvents.slice(0, 5).map((ev, idx) => (
                                                    <div key={idx} className="cal-dot" style={{ background: ev.color }} title={ev.title} />
                                                ))}
                                                {dayEvents.length > 5 && (
                                                    <span style={{ fontSize: '0.55rem', color: 'var(--color-text-muted)', fontWeight: 700 }}>+{dayEvents.length - 5}</span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Legend */}
                        <div style={{ display: 'flex', gap: 14, marginBottom: 16, justifyContent: 'center', flexWrap: 'wrap', fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} /> Fatura pendente</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }} /> Pago</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} /> Atrasado/Despesa</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#3b82f6' }} /> Entrega</span>
                        </div>

                        {/* Selected day events */}
                        {selectedDay && (
                            <div>
                                <div style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <Clock size={15} style={{ color: 'var(--color-primary)' }} />
                                    {selectedDay.split('-').reverse().join('/')}
                                    <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--color-text-muted)' }}>
                                        — {selectedEvents.length} evento(s)
                                    </span>
                                </div>

                                {selectedEvents.length === 0 ? (
                                    <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                                        Nenhum evento neste dia
                                    </div>
                                ) : (
                                    selectedEvents.map(ev => (
                                        <div key={ev.id} className="event-card" style={{ borderLeftColor: ev.color }}>
                                            <div style={{
                                                width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                                                background: `${ev.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ev.color,
                                            }}>
                                                {TYPE_ICONS[ev.type]}
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{ev.title}</div>
                                                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
                                                    <span style={{ padding: '1px 6px', borderRadius: 4, background: `${ev.color}15`, color: ev.color, fontWeight: 600 }}>
                                                        {TYPE_LABELS[ev.type] || ev.type}
                                                    </span>
                                                    {ev.status && (
                                                        <span>{STATUS_LABELS[ev.status] || ev.status}</span>
                                                    )}
                                                    {ev.subtitle && <span>{ev.subtitle}</span>}
                                                </div>
                                            </div>
                                            {ev.amount !== null && (
                                                <div style={{ fontWeight: 800, fontSize: '0.9rem', color: ev.color, flexShrink: 0 }}>
                                                    {formatCurrency(ev.amount)}
                                                </div>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {/* If no day selected, show upcoming events */}
                        {!selectedDay && data.events.length > 0 && (
                            <div>
                                <div style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <Clock size={15} style={{ color: 'var(--color-primary)' }} />
                                    Próximos eventos
                                </div>
                                {data.events.slice(0, 10).map(ev => (
                                    <div key={ev.id} className="event-card" style={{ borderLeftColor: ev.color }}>
                                        <div style={{
                                            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                                            background: `${ev.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ev.color,
                                        }}>
                                            {TYPE_ICONS[ev.type]}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{ev.title}</div>
                                            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                                    <CalendarIcon size={10} /> {ev.date.split('-').reverse().join('/')}
                                                </span>
                                                <span style={{ padding: '1px 6px', borderRadius: 4, background: `${ev.color}15`, color: ev.color, fontWeight: 600 }}>
                                                    {TYPE_LABELS[ev.type] || ev.type}
                                                </span>
                                                {ev.status && <span>{STATUS_LABELS[ev.status] || ev.status}</span>}
                                            </div>
                                        </div>
                                        {ev.amount !== null && (
                                            <div style={{ fontWeight: 800, fontSize: '0.9rem', color: ev.color, flexShrink: 0 }}>
                                                {formatCurrency(ev.amount)}
                                            </div>
                                        )}
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
