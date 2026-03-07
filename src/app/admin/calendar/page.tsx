'use client';

import { useEffect, useState, useCallback } from 'react';
import { useToast } from '@/components/Toast';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, X, Trash2, Edit2, Clock, MapPin, Loader2, ExternalLink, Bell } from 'lucide-react';

const REMINDER_OPTIONS = [
    { label: 'Sem lembrete', value: -1 },
    { label: '5 minutos antes', value: 5 },
    { label: '10 minutos antes', value: 10 },
    { label: '15 minutos antes', value: 15 },
    { label: '30 minutos antes', value: 30 },
    { label: '1 hora antes', value: 60 },
    { label: '2 horas antes', value: 120 },
    { label: '1 dia antes', value: 1440 },
    { label: '2 dias antes', value: 2880 },
];

interface CalEvent {
    id: string;
    summary: string;
    description: string;
    start: string;
    end: string;
    allDay: boolean;
    color: string | null;
    htmlLink: string;
    location: string;
}

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

function getMonthDays(year: number, month: number) {
    const firstDaySun = new Date(year, month, 1).getDay(); // 0=Sun
    const firstDay = firstDaySun === 0 ? 6 : firstDaySun - 1; // Convert to Mon=0
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevDays = new Date(year, month, 0).getDate();

    const days: { date: Date; current: boolean }[] = [];

    // Previous month fill
    for (let i = firstDay - 1; i >= 0; i--) {
        days.push({ date: new Date(year, month - 1, prevDays - i), current: false });
    }
    // Current month
    for (let i = 1; i <= daysInMonth; i++) {
        days.push({ date: new Date(year, month, i), current: true });
    }
    // Next month fill
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
        days.push({ date: new Date(year, month + 1, i), current: false });
    }
    return days;
}

function isSameDay(a: Date, b: Date) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatTime(dateStr: string) {
    if (!dateStr || !dateStr.includes('T')) return '';
    const d = new Date(dateStr);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function toLocalISO(date: Date, time?: string) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}T${time || '09:00'}:00`;
}

export default function CalendarPage() {
    const { showToast } = useToast();
    const [events, setEvents] = useState<CalEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const today = new Date();
    const [year, setYear] = useState(today.getFullYear());
    const [month, setMonth] = useState(today.getMonth());

    // Modal
    const [modal, setModal] = useState<'create' | 'edit' | 'view' | null>(null);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [selectedEvent, setSelectedEvent] = useState<CalEvent | null>(null);

    // Form
    const [form, setForm] = useState({ summary: '', description: '', startDate: '', startTime: '09:00', endDate: '', endTime: '10:00', allDay: false, reminders: [10] as number[] });

    const fetchEvents = useCallback(async () => {
        setLoading(true);
        try {
            const start = new Date(year, month, 1).toISOString();
            const end = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
            const res = await fetch(`/api/admin/calendar?start=${start}&end=${end}`);
            const d = await res.json();
            if (d.data) setEvents(d.data);
            else if (d.error) showToast(d.error, 'error');
        } catch {
            showToast('Erro ao carregar agenda', 'error');
        }
        setLoading(false);
    }, [year, month, showToast]);

    useEffect(() => { fetchEvents(); }, [fetchEvents]);

    const days = getMonthDays(year, month);

    const prevMonth = () => {
        if (month === 0) { setYear(y => y - 1); setMonth(11); }
        else setMonth(m => m - 1);
    };
    const nextMonth = () => {
        if (month === 11) { setYear(y => y + 1); setMonth(0); }
        else setMonth(m => m + 1);
    };
    const goToday = () => { setYear(today.getFullYear()); setMonth(today.getMonth()); };

    const openCreate = (date: Date) => {
        const ds = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        setForm({ summary: '', description: '', startDate: ds, startTime: '09:00', endDate: ds, endTime: '10:00', allDay: false, reminders: [10] });
        setSelectedDate(date);
        setModal('create');
    };

    const openView = (ev: CalEvent) => {
        setSelectedEvent(ev);
        setModal('view');
    };

    const openEdit = (ev: CalEvent) => {
        const sDate = ev.start.split('T')[0];
        const eDate = (ev.end || ev.start).split('T')[0];
        const sTime = ev.allDay ? '09:00' : formatTime(ev.start);
        const eTime = ev.allDay ? '10:00' : formatTime(ev.end);
        setForm({ summary: ev.summary, description: ev.description, startDate: sDate, startTime: sTime, endDate: eDate, endTime: eTime, allDay: ev.allDay, reminders: [10] });
        setSelectedEvent(ev);
        setModal('edit');
    };

    const handleSave = async () => {
        if (!form.summary.trim()) { showToast('Título é obrigatório', 'error'); return; }
        setSaving(true);
        try {
            const payload: any = {
                summary: form.summary,
                description: form.description,
                allDay: form.allDay,
                reminders: form.reminders.filter(r => r > 0),
            };
            if (form.allDay) {
                payload.start = form.startDate;
                payload.end = form.endDate || form.startDate;
            } else {
                payload.start = `${form.startDate}T${form.startTime}:00`;
                payload.end = `${form.endDate || form.startDate}T${form.endTime}:00`;
            }

            if (modal === 'edit' && selectedEvent) {
                payload.eventId = selectedEvent.id;
                await fetch('/api/admin/calendar', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                showToast('Evento atualizado!', 'success');
            } else {
                await fetch('/api/admin/calendar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                showToast('Evento criado!', 'success');
            }
            setModal(null);
            fetchEvents();
        } catch {
            showToast('Erro ao salvar evento', 'error');
        }
        setSaving(false);
    };

    const handleDelete = async (ev: CalEvent) => {
        if (!confirm(`Deletar "${ev.summary}"?`)) return;
        try {
            await fetch('/api/admin/calendar', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventId: ev.id }) });
            showToast('Evento deletado!', 'success');
            setModal(null);
            fetchEvents();
        } catch {
            showToast('Erro ao deletar', 'error');
        }
    };

    const getEventsForDay = (date: Date) => events.filter(ev => {
        const evDate = new Date(ev.start);
        return isSameDay(evDate, date);
    });

    return (
        <div className="page-content" style={{ padding: 'var(--space-5)' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 'var(--space-5)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <CalendarIcon size={24} style={{ color: 'var(--color-primary)' }} />
                    <div>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>Agenda</h1>
                        <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Google Calendar integrado</p>
                    </div>
                </div>
                <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => openCreate(today)}>
                    <Plus size={16} /> Novo Evento
                </button>
            </div>

            {/* Month Navigation */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)',
                padding: '12px 20px', marginBottom: 'var(--space-4)',
                border: '1px solid var(--color-border)',
            }}>
                <button className="btn btn-secondary btn-sm" onClick={prevMonth}><ChevronLeft size={16} /></button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
                        {MONTHS[month]} {year}
                    </h2>
                    <button className="btn btn-secondary btn-sm" onClick={goToday} style={{ fontSize: '0.75rem', padding: '4px 10px' }}>Hoje</button>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={nextMonth}><ChevronRight size={16} /></button>
            </div>

            {/* Calendar Grid */}
            <div style={{
                background: 'var(--color-surface)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--color-border)',
                overflow: 'hidden',
            }}>
                {/* Weekday headers */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', borderBottom: '1px solid var(--color-border)' }}>
                    {WEEKDAYS.map(d => (
                        <div key={d} style={{
                            padding: '10px 0', textAlign: 'center', fontWeight: 700,
                            fontSize: '0.8rem', color: 'var(--color-text-muted)',
                            textTransform: 'uppercase', letterSpacing: '0.05em',
                        }}>{d}</div>
                    ))}
                </div>

                {/* Day cells */}
                {loading ? (
                    <div style={{ padding: 60, textAlign: 'center', color: 'var(--color-text-muted)' }}>
                        <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 8px' }} />
                        Carregando agenda...
                    </div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
                        {days.map((day, idx) => {
                            const isToday = isSameDay(day.date, today);
                            const dayEvents = getEventsForDay(day.date);
                            return (
                                <div
                                    key={idx}
                                    onClick={() => openCreate(day.date)}
                                    style={{
                                        minHeight: 90,
                                        padding: '6px 8px',
                                        borderRight: (idx + 1) % 7 !== 0 ? '1px solid var(--color-border)' : 'none',
                                        borderBottom: idx < 35 ? '1px solid var(--color-border)' : 'none',
                                        cursor: 'pointer',
                                        opacity: day.current ? 1 : 0.35,
                                        background: isToday ? 'color-mix(in srgb, var(--color-primary) 8%, transparent)' : 'transparent',
                                        transition: 'background 0.15s',
                                        overflow: 'hidden',
                                    }}
                                    onMouseEnter={(e) => { if (!isToday) (e.currentTarget as HTMLElement).style.background = 'color-mix(in srgb, var(--color-primary) 4%, transparent)'; }}
                                    onMouseLeave={(e) => { if (!isToday) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                >
                                    <div style={{
                                        fontWeight: isToday ? 800 : 600,
                                        fontSize: '0.85rem',
                                        color: isToday ? 'var(--color-primary)' : 'var(--color-text)',
                                        marginBottom: 4,
                                        width: 26, height: 26,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        borderRadius: '50%',
                                        background: isToday ? 'var(--color-primary)' : 'transparent',
                                        ...(isToday ? { color: '#fff' } : {}),
                                    }}>
                                        {day.date.getDate()}
                                    </div>
                                    {dayEvents.slice(0, 3).map(ev => (
                                        <div
                                            key={ev.id}
                                            onClick={(e) => { e.stopPropagation(); openView(ev); }}
                                            style={{
                                                fontSize: '0.7rem',
                                                padding: '2px 5px',
                                                marginBottom: 2,
                                                borderRadius: 4,
                                                background: 'var(--color-primary)',
                                                color: '#fff',
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                cursor: 'pointer',
                                                fontWeight: 600,
                                            }}
                                            title={ev.summary}
                                        >
                                            {!ev.allDay && formatTime(ev.start) ? `${formatTime(ev.start)} ` : ''}{ev.summary}
                                        </div>
                                    ))}
                                    {dayEvents.length > 3 && (
                                        <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                                            +{dayEvents.length - 3} mais
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* View Modal */}
            {modal === 'view' && selectedEvent && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setModal(null)}>
                    <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)', maxWidth: 480, width: '100%', border: '1px solid var(--color-border)' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>{selectedEvent.summary}</h3>
                            <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}><X size={18} /></button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
                                <Clock size={15} />
                                {selectedEvent.allDay ? (
                                    <span>Dia inteiro — {new Date(selectedEvent.start).toLocaleDateString('pt-BR')}</span>
                                ) : (
                                    <span>
                                        {new Date(selectedEvent.start).toLocaleDateString('pt-BR')} {formatTime(selectedEvent.start)}
                                        {' — '}
                                        {formatTime(selectedEvent.end)}
                                    </span>
                                )}
                            </div>
                            {selectedEvent.location && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
                                    <MapPin size={15} /> {selectedEvent.location}
                                </div>
                            )}
                            {selectedEvent.description && (
                                <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-text)', whiteSpace: 'pre-wrap' }}>{selectedEvent.description}</p>
                            )}
                        </div>

                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                            {selectedEvent.htmlLink && (
                                <a href={selectedEvent.htmlLink} target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <ExternalLink size={13} /> Google
                                </a>
                            )}
                            <button className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => openEdit(selectedEvent)}>
                                <Edit2 size={13} /> Editar
                            </button>
                            <button className="btn btn-sm" style={{ background: 'var(--color-danger)', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => handleDelete(selectedEvent)}>
                                <Trash2 size={13} /> Deletar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create / Edit Modal */}
            {(modal === 'create' || modal === 'edit') && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setModal(null)}>
                    <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)', maxWidth: 480, width: '100%', border: '1px solid var(--color-border)' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>{modal === 'edit' ? 'Editar Evento' : 'Novo Evento'}</h3>
                            <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}><X size={18} /></button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div>
                                <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 4, display: 'block' }}>Título *</label>
                                <input className="input" value={form.summary} onChange={e => setForm({ ...form, summary: e.target.value })} placeholder="Nome do evento" autoFocus />
                            </div>

                            <div>
                                <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 4, display: 'block' }}>Descrição</label>
                                <textarea className="input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Detalhes do evento" rows={3} style={{ resize: 'vertical' }} />
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <input type="checkbox" id="allDay" checked={form.allDay} onChange={e => setForm({ ...form, allDay: e.target.checked })} />
                                <label htmlFor="allDay" style={{ fontSize: '0.85rem' }}>Dia inteiro</label>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: form.allDay ? '1fr 1fr' : '1fr auto 1fr auto', gap: 10 }}>
                                <div>
                                    <label style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: 2, display: 'block' }}>Início</label>
                                    <input className="input" type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
                                </div>
                                {!form.allDay && (
                                    <div>
                                        <label style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: 2, display: 'block' }}>Hora</label>
                                        <input className="input" type="time" value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} />
                                    </div>
                                )}
                                <div>
                                    <label style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: 2, display: 'block' }}>Fim</label>
                                    <input className="input" type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} />
                                </div>
                                {!form.allDay && (
                                    <div>
                                        <label style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: 2, display: 'block' }}>Hora</label>
                                        <input className="input" type="time" value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })} />
                                    </div>
                                )}
                            </div>

                            {/* Reminders */}
                            <div>
                                <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <Bell size={14} /> Lembretes
                                </label>
                                {form.reminders.map((rem, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                        <select
                                            className="input"
                                            value={rem}
                                            onChange={e => {
                                                const newReminders = [...form.reminders];
                                                newReminders[i] = Number(e.target.value);
                                                setForm({ ...form, reminders: newReminders });
                                            }}
                                            style={{ flex: 1 }}
                                        >
                                            {REMINDER_OPTIONS.map(opt => (
                                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                                            ))}
                                        </select>
                                        {form.reminders.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => setForm({ ...form, reminders: form.reminders.filter((_, j) => j !== i) })}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', padding: 4 }}
                                                title="Remover lembrete"
                                            >
                                                <X size={14} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                                {form.reminders.length < 5 && (
                                    <button
                                        type="button"
                                        className="btn btn-secondary btn-sm"
                                        onClick={() => setForm({ ...form, reminders: [...form.reminders, 30] })}
                                        style={{ marginTop: 4, fontSize: '0.75rem' }}
                                    >
                                        + Adicionar lembrete
                                    </button>
                                )}
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
                            <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
                            <button className="btn btn-primary" disabled={saving} onClick={handleSave} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                                {modal === 'edit' ? 'Salvar' : 'Criar Evento'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
