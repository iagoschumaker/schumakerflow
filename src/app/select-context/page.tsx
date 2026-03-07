'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Building2, Users, ChevronRight, LogOut, Lock, Loader2, Eye, EyeOff, ChevronDown } from 'lucide-react';

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
    const [showPw, setShowPw] = useState(false);
    const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
    const [pwSaving, setPwSaving] = useState(false);
    const [pwMessage, setPwMessage] = useState('');
    const [pwError, setPwError] = useState('');
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);

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

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setPwMessage('');
        setPwError('');
        if (pwForm.newPassword !== pwForm.confirmPassword) {
            setPwError('As senhas não coincidem');
            return;
        }
        setPwSaving(true);
        try {
            // First login to get a session, then change password
            const loginRes = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: userEmail,
                    password: pwForm.currentPassword,
                    context: contexts[0] ? { type: contexts[0].type, tenantId: contexts[0].tenantId, clientId: contexts[0].clientId } : undefined,
                }),
            });
            if (!loginRes.ok) {
                setPwError('Senha atual incorreta');
                setPwSaving(false);
                return;
            }

            const res = await fetch('/api/auth/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword }),
            });
            const data = await res.json();
            if (res.ok) {
                setPwMessage('Senha alterada com sucesso!');
                setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                // Update stored password
                sessionStorage.setItem('login_password', pwForm.newPassword);
                // Logout so session is clean
                await fetch('/api/auth/logout', { method: 'POST' });
            } else {
                setPwError(data.error || 'Erro ao alterar senha');
            }
        } catch {
            setPwError('Erro de conexão');
        } finally {
            setPwSaving(false);
        }
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
                <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
                    <div style={{ fontSize: '2rem', marginBottom: 'var(--space-2)' }}>👋</div>
                    <h1 style={{
                        fontSize: 'var(--font-size-xl)',
                        fontWeight: 700,
                        color: 'var(--color-text)',
                        marginBottom: 'var(--space-1)',
                    }}>
                        Olá, {userName.split(' ')[0]}!
                    </h1>
                    <p style={{
                        fontSize: 'var(--font-size-sm)',
                        color: 'var(--color-text-muted)',
                    }}>
                        Escolha como deseja acessar o sistema
                    </p>
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

                {/* Minha Conta - Collapsible password change */}
                <div style={{ marginTop: 'var(--space-5)' }}>
                    <button
                        onClick={() => setShowPw(!showPw)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.4rem',
                            background: 'none',
                            border: 'none',
                            color: 'var(--color-text-muted)',
                            cursor: 'pointer',
                            fontSize: 'var(--font-size-sm)',
                            fontFamily: 'var(--font-family)',
                            width: '100%',
                            padding: 'var(--space-2)',
                        }}
                    >
                        <Lock size={14} /> Alterar Senha
                        <ChevronDown size={14} style={{ transform: showPw ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }} />
                    </button>

                    {showPw && (
                        <form onSubmit={handleChangePassword} style={{
                            marginTop: 'var(--space-3)',
                            padding: 'var(--space-4)',
                            borderRadius: 'var(--radius-lg)',
                            border: '1px solid var(--color-border)',
                            background: 'var(--color-surface)',
                        }}>
                            <div style={{ marginBottom: 'var(--space-3)' }}>
                                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>Senha Atual</label>
                                <div style={{ position: 'relative' }}>
                                    <input className="form-input" type={showCurrent ? 'text' : 'password'} value={pwForm.currentPassword} onChange={e => setPwForm({ ...pwForm, currentPassword: e.target.value })} required style={{ paddingRight: 36, fontSize: '0.85rem' }} />
                                    <button type="button" onClick={() => setShowCurrent(!showCurrent)} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: 'var(--color-text-muted)' }}>
                                        {showCurrent ? <EyeOff size={14} /> : <Eye size={14} />}
                                    </button>
                                </div>
                            </div>
                            <div style={{ marginBottom: 'var(--space-3)' }}>
                                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>Nova Senha</label>
                                <div style={{ position: 'relative' }}>
                                    <input className="form-input" type={showNew ? 'text' : 'password'} value={pwForm.newPassword} onChange={e => setPwForm({ ...pwForm, newPassword: e.target.value })} required minLength={8} placeholder="Mínimo 8 caracteres" style={{ paddingRight: 36, fontSize: '0.85rem' }} />
                                    <button type="button" onClick={() => setShowNew(!showNew)} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: 'var(--color-text-muted)' }}>
                                        {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
                                    </button>
                                </div>
                            </div>
                            <div style={{ marginBottom: 'var(--space-3)' }}>
                                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>Confirmar Nova Senha</label>
                                <input className="form-input" type="password" value={pwForm.confirmPassword} onChange={e => setPwForm({ ...pwForm, confirmPassword: e.target.value })} required minLength={8} style={{ fontSize: '0.85rem' }} />
                            </div>
                            {pwError && <div style={{ fontSize: '0.78rem', color: '#ef4444', marginBottom: 8 }}>{pwError}</div>}
                            {pwMessage && <div style={{ fontSize: '0.78rem', color: '#22c55e', marginBottom: 8 }}>{pwMessage}</div>}
                            <button type="submit" className="btn btn-primary" disabled={pwSaving} style={{ width: '100%', fontSize: '0.85rem' }}>
                                {pwSaving ? <><Loader2 size={14} className="animate-spin" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Salvando...</> : 'Alterar Senha'}
                            </button>
                        </form>
                    )}
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
