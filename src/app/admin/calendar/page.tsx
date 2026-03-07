'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useToast } from '@/components/Toast';
import {
    Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, X, Trash2,
    Edit2, Clock, MapPin, Loader2, ExternalLink, Bell, ArrowLeft
} from 'lucide-react';

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
    id: string; summary: string; description: string;
    start: string; end: string; allDay: boolean;
    color: string | null; htmlLink: string; location: string;
}

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const HOUR_HEIGHT = 60; // px per hour in day view
const DAY_START_HOUR = 6;
const DAY_END_HOUR = 23;

function getMonthDays(year: number, month: number) {
    const fd = new Date(year, month, 1).getDay();
    const firstDay = fd === 0 ? 6 : fd - 1;
    const dim = new Date(year, month + 1, 0).getDate();
    const prev = new Date(year, month, 0).getDate();
    const days: { date: Date; current: boolean }[] = [];
    for (let i = firstDay - 1; i >= 0; i--) days.push({ date: new Date(year, month - 1, prev - i), current: false });
    for (let i = 1; i <= dim; i++) days.push({ date: new Date(year, month, i), current: true });
    const rem = 42 - days.length;
    for (let i = 1; i <= rem; i++) days.push({ date: new Date(year, month + 1, i), current: false });
    return days;
}

function isSameDay(a: Date, b: Date) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatTime(dateStr: string) {
    if (!dateStr || !dateStr.includes('T')) return '';
    return new Date(dateStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function dateToStr(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getEventTopAndHeight(ev: CalEvent) {
    const s = new Date(ev.start);
    const e = new Date(ev.end || ev.start);
    const startMin = s.getHours() * 60 + s.getMinutes();
    const endMin = e.getHours() * 60 + e.getMinutes();
    const top = (startMin - DAY_START_HOUR * 60) * (HOUR_HEIGHT / 60);
    const height = Math.max((endMin - startMin) * (HOUR_HEIGHT / 60), 20);
    return { top, height, startMin, endMin };
}

function minToTime(min: number) {
    const h = String(Math.floor(min / 60)).padStart(2, '0');
    const m = String(Math.round(min % 60 / 15) * 15 % 60).padStart(2, '0');
    return `${h}:${m}`;
}

export default function CalendarPage() {
    const { showToast } = useToast();
    const [events, setEvents] = useState<CalEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const today = new Date();
    const [year, setYear] = useState(today.getFullYear());
    const [month, setMonth] = useState(today.getMonth());

    // Views: 'month' or 'day'
    const [viewMode, setViewMode] = useState<'month' | 'day'>('month');
    const [viewDate, setViewDate] = useState<Date>(today);

    // Modal
    const [modal, setModal] = useState<'create' | 'edit' | 'view' | null>(null);
    const [selectedEvent, setSelectedEvent] = useState<CalEvent | null>(null);

    // Form
    const [form, setForm] = useState({ summary: '', description: '', startDate: '', startTime: '09:00', endDate: '', endTime: '10:00', allDay: false, reminders: [10] as number[] });

    // Day view drag
    const [dragging, setDragging] = useState<{ ev: CalEvent; startY: number; origMin: number; currentMin: number } | null>(null);
    const dayGridRef = useRef<HTMLDivElement>(null);

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

    const prevMonth = () => { if (month === 0) { setYear((y: number) => y - 1); setMonth(11); } else setMonth((m: number) => m - 1); };
    const nextMonth = () => { if (month === 11) { setYear((y: number) => y + 1); setMonth(0); } else setMonth((m: number) => m + 1); };
    const goToday = () => { setYear(today.getFullYear()); setMonth(today.getMonth()); };

    const openDay = (date: Date) => {
        setViewDate(date);
        setViewMode('day');
    };

    const openCreate = (date: Date, time?: string) => {
        const ds = dateToStr(date);
        const st = time || '09:00';
        const [h, m] = st.split(':').map(Number);
        const endH = String(Math.min(h + 1, 23)).padStart(2, '0');
        const endM = String(m).padStart(2, '0');
        setForm({ summary: '', description: '', startDate: ds, startTime: st, endDate: ds, endTime: `${endH}:${endM}`, allDay: false, reminders: [10] });
        setModal('create');
    };

    const openView = (ev: CalEvent) => { setSelectedEvent(ev); setModal('view'); };

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
                summary: form.summary, description: form.description,
                allDay: form.allDay, reminders: form.reminders.filter((r: number) => r > 0),
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

    // ─── Day View Drag ────────────────────────────────
    const handleDragMouseDown = (ev: CalEvent, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const s = new Date(ev.start);
        const origMin = s.getHours() * 60 + s.getMinutes();
        setDragging({ ev, startY: e.clientY, origMin, currentMin: origMin });

        const onMove = (me: MouseEvent) => {
            const dy = me.clientY - e.clientY;
            const dMin = Math.round(dy / (HOUR_HEIGHT / 60) / 15) * 15; // snap 15min
            const newMin = Math.max(DAY_START_HOUR * 60, Math.min((DAY_END_HOUR - 1) * 60, origMin + dMin));
            setDragging((prev) => prev ? { ...prev, currentMin: newMin } : null);
        };

        const onUp = async (me: MouseEvent) => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            const dy = me.clientY - e.clientY;
            const dMin = Math.round(dy / (HOUR_HEIGHT / 60) / 15) * 15;
            const newMin = Math.max(DAY_START_HOUR * 60, Math.min((DAY_END_HOUR - 1) * 60, origMin + dMin));
            setDragging(null);

            if (newMin === origMin) return; // no change

            const endEv = new Date(ev.end || ev.start);
            const startEv = new Date(ev.start);
            const duration = endEv.getTime() - startEv.getTime();
            const ds = dateToStr(viewDate);
            const newStart = `${ds}T${minToTime(newMin)}:00`;
            const newEndMin = newMin + duration / 60000;
            const newEnd = `${ds}T${minToTime(newEndMin)}:00`;

            try {
                await fetch('/api/admin/calendar', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ eventId: ev.id, start: newStart, end: newEnd, allDay: false }),
                });
                showToast(`"${ev.summary}" movido para ${minToTime(newMin)}`, 'success');
                fetchEvents();
            } catch {
                showToast('Erro ao mover evento', 'error');
            }
        };

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    };

    // Touch drag for mobile
    const handleDragTouchStart = (ev: CalEvent, e: React.TouchEvent) => {
        e.stopPropagation();
        const touch = e.touches[0];
        const s = new Date(ev.start);
        const origMin = s.getHours() * 60 + s.getMinutes();
        setDragging({ ev, startY: touch.clientY, origMin, currentMin: origMin });

        const onMove = (te: TouchEvent) => {
            te.preventDefault();
            const t = te.touches[0];
            const dy = t.clientY - touch.clientY;
            const dMin = Math.round(dy / (HOUR_HEIGHT / 60) / 15) * 15;
            const newMin = Math.max(DAY_START_HOUR * 60, Math.min((DAY_END_HOUR - 1) * 60, origMin + dMin));
            setDragging((prev) => prev ? { ...prev, currentMin: newMin } : null);
        };

        const onEnd = async (te: TouchEvent) => {
            window.removeEventListener('touchmove', onMove);
            window.removeEventListener('touchend', onEnd);
            const lastTouch = te.changedTouches[0];
            const dy = lastTouch.clientY - touch.clientY;
            const dMin = Math.round(dy / (HOUR_HEIGHT / 60) / 15) * 15;
            const newMin = Math.max(DAY_START_HOUR * 60, Math.min((DAY_END_HOUR - 1) * 60, origMin + dMin));
            setDragging(null);

            if (newMin === origMin) return;

            const endEv = new Date(ev.end || ev.start);
            const startEv = new Date(ev.start);
            const duration = endEv.getTime() - startEv.getTime();
            const ds = dateToStr(viewDate);
            const newStart = `${ds}T${minToTime(newMin)}:00`;
            const newEndMin = newMin + duration / 60000;
            const newEnd = `${ds}T${minToTime(newEndMin)}:00`;

            try {
                await fetch('/api/admin/calendar', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ eventId: ev.id, start: newStart, end: newEnd, allDay: false }),
                });
                showToast(`"${ev.summary}" movido para ${minToTime(newMin)}`, 'success');
                fetchEvents();
            } catch {
                showToast('Erro ao mover evento', 'error');
            }
        };

        window.addEventListener('touchmove', onMove, { passive: false });
        window.addEventListener('touchend', onEnd);
    };

    const getEventsForDay = (date: Date) => events.filter((ev: CalEvent) => isSameDay(new Date(ev.start), date));

    const dayViewPrev = () => { const d = new Date(viewDate); d.setDate(d.getDate() - 1); setViewDate(d); };
    const dayViewNext = () => { const d = new Date(viewDate); d.setDate(d.getDate() + 1); setViewDate(d); };

    const hours: number[] = [];
    for (let h = DAY_START_HOUR; h <= DAY_END_HOUR; h++) hours.push(h);
    const totalHeight = (DAY_END_HOUR - DAY_START_HOUR) * HOUR_HEIGHT;

    const dayEvents = getEventsForDay(viewDate).filter((ev: CalEvent) => !ev.allDay);
    const allDayEvents = getEventsForDay(viewDate).filter((ev: CalEvent) => ev.allDay);

    // ─── RENDER ───────────────────────────────────────
    return (
        <div className="page-content" style={{ padding: 'var(--space-5)' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 'var(--space-5)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {viewMode === 'day' && (
                        <button className="btn btn-secondary btn-sm" onClick={() => setViewMode('month')} style={{ marginRight: 4 }}>
                            <ArrowLeft size={16} />
                        </button>
                    )}
                    <CalendarIcon size={24} style={{ color: 'var(--color-primary)' }} />
                    <div>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>Agenda</h1>
                        <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Google Calendar integrado</p>
                    </div>
                </div>
                <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                    onClick={() => openCreate(viewMode === 'day' ? viewDate : today)}>
                    <Plus size={16} /> Novo Evento
                </button>
            </div>

            {/* ── MONTH VIEW ── */}
            {viewMode === 'month' && (
                <>
                    {/* Month Navigation */}
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)',
                        padding: '12px 20px', marginBottom: 'var(--space-4)',
                        border: '1px solid var(--color-border)',
                    }}>
                        <button className="btn btn-secondary btn-sm" onClick={prevMonth}><ChevronLeft size={16} /></button>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>{MONTHS[month]} {year}</h2>
                            <button className="btn btn-secondary btn-sm" onClick={goToday} style={{ fontSize: '0.75rem', padding: '4px 10px' }}>Hoje</button>
                        </div>
                        <button className="btn btn-secondary btn-sm" onClick={nextMonth}><ChevronRight size={16} /></button>
                    </div>

                    {/* Calendar Grid */}
                    <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', borderBottom: '1px solid var(--color-border)' }}>
                            {WEEKDAYS.map(d => (
                                <div key={d} style={{ padding: '10px 0', textAlign: 'center', fontWeight: 700, fontSize: '0.8rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{d}</div>
                            ))}
                        </div>
                        {loading ? (
                            <div style={{ padding: 60, textAlign: 'center', color: 'var(--color-text-muted)' }}>
                                <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 8px' }} />
                                Carregando agenda...
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
                                {days.map((day, idx) => {
                                    const isToday = isSameDay(day.date, today);
                                    const dayEvs = getEventsForDay(day.date);
                                    return (
                                        <div key={idx} onClick={() => openDay(day.date)}
                                            style={{
                                                minHeight: 90, padding: '6px 8px',
                                                borderRight: (idx + 1) % 7 !== 0 ? '1px solid var(--color-border)' : 'none',
                                                borderBottom: idx < 35 ? '1px solid var(--color-border)' : 'none',
                                                cursor: 'pointer', overflow: 'hidden',
                                                opacity: day.current ? 1 : 0.35,
                                                background: isToday ? 'color-mix(in srgb, var(--color-primary) 8%, transparent)' : 'transparent',
                                                transition: 'background 0.15s',
                                            }}
                                            onMouseEnter={(e: React.MouseEvent) => { if (!isToday) (e.currentTarget as HTMLElement).style.background = 'color-mix(in srgb, var(--color-primary) 4%, transparent)'; }}
                                            onMouseLeave={(e: React.MouseEvent) => { if (!isToday) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                        >
                                            <div style={{
                                                fontWeight: isToday ? 800 : 600, fontSize: '0.85rem',
                                                color: isToday ? '#fff' : 'var(--color-text)',
                                                marginBottom: 4, width: 26, height: 26,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                borderRadius: '50%', background: isToday ? 'var(--color-primary)' : 'transparent',
                                            }}>{day.date.getDate()}</div>
                                            {dayEvs.slice(0, 3).map((ev: CalEvent) => (
                                                <div key={ev.id}
                                                    onClick={(e: React.MouseEvent) => { e.stopPropagation(); openView(ev); }}
                                                    style={{
                                                        fontSize: '0.7rem', padding: '2px 5px', marginBottom: 2,
                                                        borderRadius: 4, background: 'var(--color-primary)', color: '#fff',
                                                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                                        cursor: 'pointer', fontWeight: 600,
                                                    }}
                                                    title={ev.summary}
                                                >
                                                    {!ev.allDay && formatTime(ev.start) ? `${formatTime(ev.start)} ` : ''}{ev.summary}
                                                </div>
                                            ))}
                                            {dayEvs.length > 3 && (
                                                <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                                                    +{dayEvs.length - 3} mais
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* ── DAY VIEW ── */}
            {viewMode === 'day' && (
                <>
                    {/* Day Navigation */}
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)',
                        padding: '12px 20px', marginBottom: 'var(--space-4)',
                        border: '1px solid var(--color-border)',
                    }}>
                        <button className="btn btn-secondary btn-sm" onClick={dayViewPrev}><ChevronLeft size={16} /></button>
                        <div style={{ textAlign: 'center' }}>
                            <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
                                {viewDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                            </h2>
                        </div>
                        <button className="btn btn-secondary btn-sm" onClick={dayViewNext}><ChevronRight size={16} /></button>
                    </div>

                    {/* All-day events */}
                    {allDayEvents.length > 0 && (
                        <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', padding: '8px 12px', marginBottom: 'var(--space-3)' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, marginBottom: 4 }}>DIA INTEIRO</div>
                            {allDayEvents.map((ev: CalEvent) => (
                                <div key={ev.id} onClick={() => openView(ev)}
                                    style={{ padding: '6px 10px', background: 'var(--color-primary)', color: '#fff', borderRadius: 6, marginBottom: 4, cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>
                                    {ev.summary}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Time grid */}
                    <div style={{
                        background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)',
                        border: '1px solid var(--color-border)', overflow: 'auto', maxHeight: 'calc(100vh - 280px)',
                    }}>
                        <div ref={dayGridRef} style={{ position: 'relative', height: totalHeight, minWidth: 300 }}>
                            {/* Hour lines */}
                            {hours.map(h => (
                                <div key={h}
                                    onClick={() => openCreate(viewDate, `${String(h).padStart(2, '0')}:00`)}
                                    style={{
                                        position: 'absolute', left: 0, right: 0,
                                        top: (h - DAY_START_HOUR) * HOUR_HEIGHT,
                                        height: HOUR_HEIGHT,
                                        borderBottom: '1px solid var(--color-border)',
                                        display: 'flex', cursor: 'pointer',
                                    }}
                                    onMouseEnter={(e: React.MouseEvent) => (e.currentTarget as HTMLElement).style.background = 'color-mix(in srgb, var(--color-primary) 3%, transparent)'}
                                    onMouseLeave={(e: React.MouseEvent) => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                                >
                                    <div style={{
                                        width: 55, flexShrink: 0, padding: '2px 8px 0 0',
                                        fontSize: '0.75rem', color: 'var(--color-text-muted)',
                                        textAlign: 'right', fontWeight: 500,
                                        borderRight: '1px solid var(--color-border)',
                                    }}>
                                        {String(h).padStart(2, '0')}:00
                                    </div>
                                </div>
                            ))}

                            {/* Current time indicator */}
                            {isSameDay(viewDate, today) && (() => {
                                const now = new Date();
                                const nowMin = now.getHours() * 60 + now.getMinutes();
                                const top = (nowMin - DAY_START_HOUR * 60) * (HOUR_HEIGHT / 60);
                                if (top < 0 || top > totalHeight) return null;
                                return (
                                    <div style={{
                                        position: 'absolute', left: 50, right: 0, top,
                                        height: 2, background: '#ef4444', zIndex: 5, pointerEvents: 'none',
                                    }}>
                                        <div style={{ position: 'absolute', left: -4, top: -4, width: 10, height: 10, borderRadius: '50%', background: '#ef4444' }} />
                                    </div>
                                );
                            })()}

                            {/* Events */}
                            {dayEvents.map((ev: CalEvent) => {
                                const isDragging = dragging?.ev.id === ev.id;
                                const pos = isDragging
                                    ? { top: (dragging!.currentMin - DAY_START_HOUR * 60) * (HOUR_HEIGHT / 60), height: getEventTopAndHeight(ev).height }
                                    : getEventTopAndHeight(ev);

                                return (
                                    <div key={ev.id}
                                        onMouseDown={(e) => handleDragMouseDown(ev, e)}
                                        onTouchStart={(e) => handleDragTouchStart(ev, e)}
                                        onClick={(e: React.MouseEvent) => { if (!isDragging) { e.stopPropagation(); openView(ev); } }}
                                        style={{
                                            position: 'absolute', left: 60, right: 8,
                                            top: pos.top, height: pos.height,
                                            background: isDragging ? 'color-mix(in srgb, var(--color-primary) 90%, transparent)' : 'var(--color-primary)',
                                            color: '#fff', borderRadius: 6, padding: '4px 8px',
                                            fontSize: '0.8rem', fontWeight: 600,
                                            cursor: isDragging ? 'grabbing' : 'grab',
                                            zIndex: isDragging ? 20 : 10,
                                            boxShadow: isDragging ? '0 4px 16px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.15)',
                                            opacity: isDragging ? 0.9 : 1,
                                            overflow: 'hidden', transition: isDragging ? 'none' : 'box-shadow 0.15s',
                                            userSelect: 'none', touchAction: 'none',
                                            borderLeft: '3px solid rgba(255,255,255,0.4)',
                                        }}
                                        title="Arraste para alterar o horário"
                                    >
                                        <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {ev.summary}
                                        </div>
                                        <div style={{ fontSize: '0.7rem', opacity: 0.85 }}>
                                            {isDragging ? minToTime(dragging!.currentMin) : formatTime(ev.start)} – {formatTime(ev.end)}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </>
            )}

            {/* ── VIEW MODAL ── */}
            {modal === 'view' && selectedEvent && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setModal(null)}>
                    <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)', maxWidth: 480, width: '100%', border: '1px solid var(--color-border)', maxHeight: '90vh', overflowY: 'auto' }}
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>{selectedEvent.summary}</h3>
                            <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}><X size={18} /></button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
                                <Clock size={15} />
                                {selectedEvent.allDay
                                    ? <span>Dia inteiro — {new Date(selectedEvent.start).toLocaleDateString('pt-BR')}</span>
                                    : <span>{new Date(selectedEvent.start).toLocaleDateString('pt-BR')} {formatTime(selectedEvent.start)} — {formatTime(selectedEvent.end)}</span>}
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
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
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

            {/* ── CREATE / EDIT MODAL ── (centered, matching system style) */}
            {(modal === 'create' || modal === 'edit') && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={() => setModal(null)}>
                    <div style={{ background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)', maxWidth: 480, width: '100%', border: '1px solid var(--color-border)', maxHeight: '90vh', overflowY: 'auto' }}
                        onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>{modal === 'edit' ? 'Editar Evento' : 'Novo Evento'}</h3>
                            <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}><X size={18} /></button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            <div>
                                <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 4, display: 'block' }}>Título *</label>
                                <input className="input" value={form.summary} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, summary: e.target.value })} placeholder="Nome do evento" autoFocus />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 4, display: 'block' }}>Descrição</label>
                                <textarea className="input" value={form.description} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm({ ...form, description: e.target.value })} placeholder="Detalhes do evento" rows={3} style={{ resize: 'vertical' }} />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <input type="checkbox" id="allDay" checked={form.allDay} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, allDay: e.target.checked })} />
                                <label htmlFor="allDay" style={{ fontSize: '0.85rem' }}>Dia inteiro</label>
                            </div>

                            {/* Date/Time — responsive */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    <div style={{ flex: '1 1 140px', minWidth: 0 }}>
                                        <label style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: 2, display: 'block' }}>Início</label>
                                        <input className="input" type="date" value={form.startDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, startDate: e.target.value })} style={{ width: '100%' }} />
                                    </div>
                                    {!form.allDay && (
                                        <div style={{ flex: '0 1 110px', minWidth: 90 }}>
                                            <label style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: 2, display: 'block' }}>Hora</label>
                                            <input className="input" type="time" value={form.startTime} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, startTime: e.target.value })} style={{ width: '100%' }} />
                                        </div>
                                    )}
                                </div>
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    <div style={{ flex: '1 1 140px', minWidth: 0 }}>
                                        <label style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: 2, display: 'block' }}>Fim</label>
                                        <input className="input" type="date" value={form.endDate} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, endDate: e.target.value })} style={{ width: '100%' }} />
                                    </div>
                                    {!form.allDay && (
                                        <div style={{ flex: '0 1 110px', minWidth: 90 }}>
                                            <label style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: 2, display: 'block' }}>Hora</label>
                                            <input className="input" type="time" value={form.endTime} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, endTime: e.target.value })} style={{ width: '100%' }} />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Reminders */}
                            <div>
                                <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <Bell size={14} /> Lembretes
                                </label>
                                {form.reminders.map((rem: number, i: number) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                        <select className="input" value={rem}
                                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                                                const nr = [...form.reminders]; nr[i] = Number(e.target.value);
                                                setForm({ ...form, reminders: nr });
                                            }} style={{ flex: 1 }}>
                                            {REMINDER_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                        </select>
                                        {form.reminders.length > 1 && (
                                            <button type="button" onClick={() => setForm({ ...form, reminders: form.reminders.filter((_: number, j: number) => j !== i) })}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', padding: 4 }}>
                                                <X size={14} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                                {form.reminders.length < 5 && (
                                    <button type="button" className="btn btn-secondary btn-sm"
                                        onClick={() => setForm({ ...form, reminders: [...form.reminders, 30] })}
                                        style={{ marginTop: 4, fontSize: '0.75rem' }}>
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
