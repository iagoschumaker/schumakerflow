'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, X } from 'lucide-react';

interface Option {
    value: string;
    label: string;
    sublabel?: string;
}

interface SearchableSelectProps {
    options: Option[];
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
}

export default function SearchableSelect({ options, value, onChange, placeholder = 'Selecione...', disabled }: SearchableSelectProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const ref = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const selected = options.find(o => o.value === value);

    const filtered = options.filter(o =>
        o.label.toLowerCase().includes(search.toLowerCase()) ||
        (o.sublabel && o.sublabel.toLowerCase().includes(search.toLowerCase()))
    );

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    useEffect(() => {
        if (open) {
            setSearch('');
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [open]);

    return (
        <div ref={ref} style={{ position: 'relative' }}>
            <button
                type="button"
                disabled={disabled}
                onClick={() => !disabled && setOpen(!open)}
                style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 12px', border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)', background: 'var(--color-bg)',
                    cursor: disabled ? 'not-allowed' : 'pointer', fontSize: '0.875rem',
                    color: selected ? 'var(--color-text)' : 'var(--color-text-muted)',
                    opacity: disabled ? 0.6 : 1, textAlign: 'left', gap: 8,
                }}
            >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {selected ? selected.label : placeholder}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    {value && (
                        <span
                            onClick={(e) => { e.stopPropagation(); onChange(''); setOpen(false); }}
                            style={{ display: 'flex', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 2 }}
                        >
                            <X size={14} />
                        </span>
                    )}
                    <ChevronDown size={16} style={{ color: 'var(--color-text-muted)' }} />
                </div>
            </button>

            {open && (
                <div style={{
                    position: 'absolute', left: 0, right: 0, top: 'calc(100% + 4px)',
                    zIndex: 100, background: 'var(--color-bg)',
                    border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.15)', overflow: 'hidden',
                    maxHeight: 280,
                }}>
                    <div style={{ padding: '8px', borderBottom: '1px solid var(--color-border)', position: 'sticky', top: 0, background: 'var(--color-bg)', zIndex: 1 }}>
                        <div style={{ position: 'relative' }}>
                            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                            <input
                                ref={inputRef}
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Buscar..."
                                style={{
                                    width: '100%', padding: '6px 10px 6px 30px',
                                    border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
                                    fontSize: '0.8rem', background: 'var(--color-bg-secondary)',
                                    outline: 'none', color: 'var(--color-text)',
                                }}
                            />
                        </div>
                    </div>
                    <div style={{ overflowY: 'auto', maxHeight: 220 }}>
                        {filtered.length === 0 ? (
                            <div style={{ padding: '12px 16px', fontSize: '0.8rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>
                                Nenhum resultado
                            </div>
                        ) : (
                            filtered.map(o => (
                                <div
                                    key={o.value}
                                    onClick={() => { onChange(o.value); setOpen(false); }}
                                    style={{
                                        padding: '8px 16px', cursor: 'pointer',
                                        background: o.value === value ? 'var(--color-primary-light)' : 'transparent',
                                        transition: 'background 0.1s',
                                        fontSize: '0.85rem',
                                    }}
                                    onMouseEnter={(e) => { if (o.value !== value) e.currentTarget.style.background = 'var(--color-bg-secondary)'; }}
                                    onMouseLeave={(e) => { if (o.value !== value) e.currentTarget.style.background = 'transparent'; }}
                                >
                                    <div style={{ fontWeight: o.value === value ? 600 : 400 }}>{o.label}</div>
                                    {o.sublabel && <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 1 }}>{o.sublabel}</div>}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
