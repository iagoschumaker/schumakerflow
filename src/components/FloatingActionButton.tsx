'use client';

import { useState, useEffect, useRef, ReactNode } from 'react';
import { Plus, X } from 'lucide-react';

export interface FABAction {
    label: string;
    icon: ReactNode;
    onClick: () => void;
    color?: string;
}

interface FABProps {
    actions: FABAction[];
}

export default function FloatingActionButton({ actions }: FABProps) {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        if (open) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [open]);

    // Close on Escape
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, []);

    // Single action: just fire directly
    const isSingle = actions.length === 1;

    const handleMainClick = () => {
        if (isSingle) {
            actions[0].onClick();
        } else {
            setOpen(!open);
        }
    };

    return (
        <>
            {/* Backdrop when open */}
            {open && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 999,
                    background: 'rgba(0,0,0,0.15)', backdropFilter: 'blur(1px)',
                    animation: 'fabFadeIn 0.2s ease',
                }} onClick={() => setOpen(false)} />
            )}

            <div ref={containerRef} style={{ position: 'fixed', bottom: 88, right: 24, zIndex: 1000 }}>
                {/* Expanded Actions */}
                {open && actions.length > 1 && (
                    <div style={{
                        position: 'absolute', bottom: 68, right: 0,
                        display: 'flex', flexDirection: 'column', gap: 10,
                        animation: 'fabSlideUp 0.25s ease',
                    }}>
                        {actions.map((action, idx) => (
                            <button
                                key={idx}
                                onClick={() => { action.onClick(); setOpen(false); }}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 10,
                                    background: 'var(--color-bg)',
                                    border: '1px solid var(--color-border)',
                                    borderRadius: 'var(--radius-lg)',
                                    padding: '10px 18px 10px 14px',
                                    cursor: 'pointer',
                                    boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                                    whiteSpace: 'nowrap',
                                    fontSize: '0.88rem',
                                    fontWeight: 600,
                                    color: 'var(--color-text)',
                                    transition: 'transform 0.15s, box-shadow 0.15s',
                                    animationDelay: `${idx * 50}ms`,
                                    animationFillMode: 'both',
                                    animation: 'fabItemIn 0.2s ease',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'translateX(-4px)';
                                    e.currentTarget.style.boxShadow = '0 6px 24px rgba(0,0,0,0.18)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'translateX(0)';
                                    e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.12)';
                                }}
                            >
                                <span style={{
                                    width: 36, height: 36, borderRadius: '50%',
                                    background: action.color || 'var(--color-primary)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: '#fff', flexShrink: 0,
                                }}>
                                    {action.icon}
                                </span>
                                {action.label}
                            </button>
                        ))}
                    </div>
                )}

                {/* Main FAB Button */}
                <button
                    onClick={handleMainClick}
                    aria-label={isSingle ? actions[0].label : 'Abrir opções'}
                    title={isSingle ? actions[0].label : undefined}
                    style={{
                        width: 56, height: 56, borderRadius: '50%',
                        background: 'var(--color-primary)',
                        color: '#fff',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 6px 24px rgba(0,0,0,0.25)',
                        transition: 'transform 0.25s ease, background 0.2s',
                        transform: open ? 'rotate(45deg)' : 'rotate(0deg)',
                    }}
                    onMouseEnter={(e) => {
                        if (!open) e.currentTarget.style.transform = 'scale(1.08)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = open ? 'rotate(45deg)' : 'rotate(0deg)';
                    }}
                >
                    {open ? <X size={24} /> : <Plus size={24} />}
                </button>
            </div>

            <style>{`
                @keyframes fabFadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes fabSlideUp {
                    from { opacity: 0; transform: translateY(16px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes fabItemIn {
                    from { opacity: 0; transform: translateY(8px) translateX(8px); }
                    to { opacity: 1; transform: translateY(0) translateX(0); }
                }
            `}</style>
        </>
    );
}
