'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Building2, Users, ChevronRight, LogOut } from 'lucide-react';

interface ContextOption {
    type: 'superadmin' | 'tenant' | 'client';
    tenantId?: string;
    tenantName?: string;
    tenantSlug?: string;
    clientId?: string;
    clientName?: string;
    role?: string;
}

export default function SelectContextPage() {
    const router = useRouter();
    const [contexts, setContexts] = useState<ContextOption[]>([]);
    const [userName, setUserName] = useState('');
    const [userEmail, setUserEmail] = useState('');
    const [loading, setLoading] = useState<string | null>(null);

    useEffect(() => {
        const stored = sessionStorage.getItem('login_contexts');
        if (!stored) {
            router.push('/login');
            return;
        }
        const data = JSON.parse(stored);
        setContexts(data.contexts || []);
        setUserName(data.name || '');
        setUserEmail(data.email || '');
    }, [router]);

    const selectContext = async (ctx: ContextOption) => {
        setLoading(ctx.type + (ctx.tenantId || '') + (ctx.clientId || ''));
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: userEmail,
                    password: sessionStorage.getItem('login_password') || '',
                    context: {
                        type: ctx.type,
                        tenantId: ctx.tenantId,
                        clientId: ctx.clientId,
                    },
                }),
            });

            const data = await res.json();
            if (!res.ok) return;

            sessionStorage.removeItem('login_contexts');
            sessionStorage.removeItem('login_password');

            const { role } = data.data;
            if (role === 'SUPERADMIN') router.push('/superadmin');
            else if (role === 'CLIENT_USER') router.push('/portal');
            else router.push('/admin');
        } catch {
            setLoading(null);
        }
    };

    const handleLogout = () => {
        sessionStorage.removeItem('login_contexts');
        sessionStorage.removeItem('login_password');
        router.push('/login');
    };

    const getIcon = (type: string) => {
        if (type === 'superadmin') return <Shield size={22} />;
        if (type === 'tenant') return <Building2 size={22} />;
        return <Users size={22} />;
    };

    const getColor = (type: string) => {
        if (type === 'superadmin') return '#7c3aed';
        if (type === 'tenant') return '#3b82f6';
        return '#10b981';
    };

    const getLabel = (ctx: ContextOption) => {
        if (ctx.type === 'superadmin') return 'Super Admin';
        if (ctx.type === 'tenant') return ctx.tenantName || 'Flow';
        return ctx.clientName || 'Portal do Cliente';
    };

    const getSub = (ctx: ContextOption) => {
        if (ctx.type === 'superadmin') return 'Gerenciamento global da plataforma';
        if (ctx.type === 'tenant') return `${ctx.role === 'TENANT_ADMIN' ? 'Administrador' : 'Equipe'} • ${ctx.tenantSlug}`;
        return `Cliente • ${ctx.tenantName}`;
    };

    return (
        <div className="login-container">
            <div className="login-card" style={{ maxWidth: 460 }}>
                <div className="login-logo">
                    <p style={{ marginTop: 4 }}>Olá, <strong>{userName}</strong></p>
                </div>

                <div style={{
                    fontSize: '0.85rem',
                    color: 'var(--color-text-muted)',
                    textAlign: 'center',
                    marginBottom: 'var(--space-5)',
                }}>
                    Selecione em qual sessão deseja entrar:
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    {contexts.map((ctx, i) => {
                        const color = getColor(ctx.type);
                        const key = ctx.type + (ctx.tenantId || '') + (ctx.clientId || '');
                        return (
                            <button
                                key={i}
                                onClick={() => selectContext(ctx)}
                                disabled={!!loading}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 'var(--space-3)',
                                    padding: 'var(--space-4)',
                                    borderRadius: 'var(--radius-lg)',
                                    border: '1px solid var(--color-border)',
                                    background: 'var(--color-surface)',
                                    cursor: loading ? 'not-allowed' : 'pointer',
                                    textAlign: 'left',
                                    transition: 'all 0.2s ease',
                                    opacity: loading && loading !== key ? 0.5 : 1,
                                    fontFamily: 'var(--font-family)',
                                    width: '100%',
                                }}
                                onMouseEnter={(e) => {
                                    if (!loading) {
                                        e.currentTarget.style.borderColor = color;
                                        e.currentTarget.style.boxShadow = `0 4px 16px ${color}18`;
                                        e.currentTarget.style.transform = 'translateY(-1px)';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.borderColor = 'var(--color-border)';
                                    e.currentTarget.style.boxShadow = 'none';
                                    e.currentTarget.style.transform = 'translateY(0)';
                                }}
                            >
                                <div style={{
                                    width: 44, height: 44, borderRadius: 12,
                                    background: `${color}14`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color, flexShrink: 0,
                                }}>
                                    {getIcon(ctx.type)}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--color-text)' }}>
                                        {getLabel(ctx)}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                                        {getSub(ctx)}
                                    </div>
                                </div>
                                <ChevronRight size={18} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                            </button>
                        );
                    })}
                </div>

                <div className="text-center mt-6">
                    <button
                        onClick={handleLogout}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--color-text-muted)',
                            cursor: 'pointer',
                            fontSize: 'var(--font-size-sm)',
                            fontFamily: 'var(--font-family)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                        }}
                    >
                        <LogOut size={14} /> Sair
                    </button>
                </div>

                <div className="text-center mt-4 text-xs text-muted">
                    © {new Date().getFullYear()} SFlow. Todos os direitos reservados.
                </div>
            </div>
        </div>
    );
}
