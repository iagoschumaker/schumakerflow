'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { X, CheckCircle2, AlertTriangle, XCircle, Info } from 'lucide-react';

/* ─── Toast Types ─── */
type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
    id: string;
    message: string;
    type: ToastType;
}

interface ToastContextType {
    showToast: (message: string, type?: ToastType) => void;
    showConfirm: (opts: ConfirmOptions) => Promise<boolean>;
}

interface ConfirmOptions {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'default';
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used within ToastProvider');
    return ctx;
}

/* ─── Provider ─── */
export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [confirm, setConfirm] = useState<{ opts: ConfirmOptions; resolve: (v: boolean) => void } | null>(null);

    const showToast = useCallback((message: string, type: ToastType = 'success') => {
        const id = `${Date.now()}-${Math.random()}`;
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 4000);
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const showConfirm = useCallback((opts: ConfirmOptions): Promise<boolean> => {
        return new Promise((resolve) => {
            setConfirm({ opts, resolve });
        });
    }, []);

    const handleConfirm = (result: boolean) => {
        confirm?.resolve(result);
        setConfirm(null);
    };

    const iconMap = {
        success: <CheckCircle2 size={18} />,
        error: <XCircle size={18} />,
        warning: <AlertTriangle size={18} />,
        info: <Info size={18} />,
    };

    const colorMap = {
        success: { bg: '#059669', border: '#10b981' },
        error: { bg: '#dc2626', border: '#ef4444' },
        warning: { bg: '#d97706', border: '#f59e0b' },
        info: { bg: '#2563eb', border: '#3b82f6' },
    };

    const confirmVariantColors = {
        danger: { bg: '#dc2626', hover: '#b91c1c' },
        warning: { bg: '#d97706', hover: '#b45309' },
        default: { bg: 'var(--color-primary)', hover: 'var(--color-primary-hover)' },
    };

    return (
        <ToastContext.Provider value={{ showToast, showConfirm }}>
            {children}

            {/* Confirm Dialog */}
            {confirm && (
                <div
                    style={{
                        position: 'fixed', inset: 0, zIndex: 10000,
                        background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        animation: 'fadeIn 0.15s ease',
                    }}
                    onClick={() => handleConfirm(false)}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            background: 'var(--color-bg)', borderRadius: 'var(--radius-lg)',
                            padding: 0, width: '100%', maxWidth: 420,
                            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
                            animation: 'scaleIn 0.2s ease',
                            overflow: 'hidden',
                        }}
                    >
                        <div style={{ padding: '24px 24px 16px' }}>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>
                                {confirm.opts.title}
                            </h3>
                            <p style={{ margin: '12px 0 0', color: 'var(--color-text-muted)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                                {confirm.opts.message}
                            </p>
                        </div>
                        <div style={{
                            display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-2)',
                            padding: '16px 24px', borderTop: '1px solid var(--color-border)',
                            background: 'var(--color-bg-secondary)',
                        }}>
                            <button
                                className="btn btn-secondary"
                                onClick={() => handleConfirm(false)}
                                style={{ padding: '8px 20px' }}
                            >
                                {confirm.opts.cancelText || 'Cancelar'}
                            </button>
                            <button
                                className="btn"
                                onClick={() => handleConfirm(true)}
                                style={{
                                    padding: '8px 20px', color: '#fff', border: 'none',
                                    background: confirmVariantColors[confirm.opts.variant || 'default'].bg,
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = confirmVariantColors[confirm.opts.variant || 'default'].hover}
                                onMouseLeave={(e) => e.currentTarget.style.background = confirmVariantColors[confirm.opts.variant || 'default'].bg}
                            >
                                {confirm.opts.confirmText || 'Confirmar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast Container — bottom right */}
            <div style={{
                position: 'fixed', bottom: 20, right: 20, zIndex: 10001,
                display: 'flex', flexDirection: 'column-reverse', gap: 8,
                pointerEvents: 'none', maxWidth: 380,
            }}>
                {toasts.map((toast) => {
                    const colors = colorMap[toast.type];
                    return (
                        <div
                            key={toast.id}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 10,
                                padding: '12px 16px', borderRadius: 'var(--radius-md)',
                                background: 'var(--color-bg)', color: 'var(--color-text)',
                                boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
                                borderLeft: `4px solid ${colors.border}`,
                                pointerEvents: 'auto',
                                animation: 'slideInRight 0.3s ease',
                                fontSize: '0.88rem', lineHeight: 1.4,
                            }}
                        >
                            <span style={{ color: colors.bg, flexShrink: 0 }}>{iconMap[toast.type]}</span>
                            <span style={{ flex: 1 }}>{toast.message}</span>
                            <button
                                onClick={() => removeToast(toast.id)}
                                style={{
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    color: 'var(--color-text-muted)', padding: 2, flexShrink: 0,
                                    display: 'flex',
                                }}
                            >
                                <X size={14} />
                            </button>
                        </div>
                    );
                })}
            </div>

            {/* Animations */}
            <style>{`
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes scaleIn {
                    from { transform: scale(0.95); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
            `}</style>
        </ToastContext.Provider>
    );
}
