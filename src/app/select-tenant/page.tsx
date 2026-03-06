'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Zap, Building2, Shield, LogOut, ArrowRight, Loader2 } from 'lucide-react';

interface TenantOption {
    tenantId: string;
    tenantName: string;
    tenantSlug: string;
    role: string;
    _count?: { clients: number; members: number };
}

interface UserInfo {
    userId: string;
    name: string;
    email: string;
    role: string;
    tenantMembers?: TenantOption[];
}

export default function SelectTenantPage() {
    const router = useRouter();
    const [user, setUser] = useState<UserInfo | null>(null);
    const [tenants, setTenants] = useState<TenantOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [selecting, setSelecting] = useState<string | null>(null);

    useEffect(() => {
        async function loadData() {
            try {
                const meRes = await fetch('/api/auth/me');
                const meData = await meRes.json();
                if (!meData.data) {
                    router.push('/login');
                    return;
                }
                setUser(meData.data);

                // If SUPERADMIN, also load all tenants from superadmin API
                if (meData.data.role === 'SUPERADMIN') {
                    try {
                        const tenantsRes = await fetch('/api/superadmin/tenants');
                        const tenantsData = await tenantsRes.json();
                        if (tenantsData.data) {
                            setTenants(tenantsData.data.map((t: { id: string; name: string; slug: string; _count?: { clients: number; members: number } }) => ({
                                tenantId: t.id,
                                tenantName: t.name,
                                tenantSlug: t.slug,
                                role: 'SUPERADMIN',
                                _count: t._count,
                            })));
                        }
                    } catch {
                        // If superadmin API fails, use tenant members from session
                    }
                }

                // If regular user, check how many tenants
                if (meData.data.role !== 'SUPERADMIN') {
                    // Single tenant — auto redirect
                    if (meData.data.tenantId) {
                        router.push('/admin');
                        return;
                    }
                }
            } catch {
                router.push('/login');
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, [router]);

    const handleSelectTenant = async (tenantSlug: string) => {
        setSelecting(tenantSlug);
        try {
            // Re-login with the selected tenant slug to set the session cookie properly
            // We'll use a select-tenant API endpoint
            const res = await fetch('/api/auth/select-tenant', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tenantSlug }),
            });
            if (res.ok) {
                router.push('/admin');
            }
        } catch {
            setSelecting(null);
        }
    };

    const handleGoSuperAdmin = () => {
        router.push('/superadmin');
    };

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/login');
    };

    if (loading) {
        return (
            <div className="login-container">
                <div className="login-card" style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
                    <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto', color: 'var(--color-primary)' }} />
                    <p className="text-muted" style={{ marginTop: 'var(--space-4)' }}>Carregando...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="login-container">
            <div style={{ width: '100%', maxWidth: '440px', padding: 'var(--space-4)' }}>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: 'var(--space-5)' }}>
                    <div style={{ color: 'var(--color-primary)', marginBottom: 'var(--space-2)' }}>
                        <Zap size={36} />
                    </div>
                    <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-text)' }}>
                        Schumaker Flow
                    </h1>
                    <p className="text-muted" style={{ marginTop: 'var(--space-1)' }}>
                        Olá, <strong>{user?.name}</strong>! Selecione uma opção para continuar.
                    </p>
                </div>

                {/* SuperAdmin card */}
                {user?.role === 'SUPERADMIN' && (
                    <button
                        onClick={handleGoSuperAdmin}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 'var(--space-4)',
                            width: '100%', padding: 'var(--space-4)',
                            background: 'linear-gradient(135deg, #007AFF, #5856D6)',
                            border: 'none', borderRadius: 'var(--radius-lg)',
                            color: 'white', cursor: 'pointer', marginBottom: 'var(--space-3)',
                            transition: 'transform 0.15s, box-shadow 0.15s',
                            boxShadow: '0 4px 12px rgba(0, 122, 255, 0.25)',
                            textAlign: 'left',
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = '0 8px 20px rgba(0, 122, 255, 0.35)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 122, 255, 0.25)';
                        }}
                    >
                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: '48px', height: '48px', borderRadius: 'var(--radius-md)',
                            background: 'rgba(255,255,255,0.15)', flexShrink: 0,
                        }}>
                            <Shield size={24} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>Painel SuperAdmin</div>
                            <div style={{ opacity: 0.8, fontSize: '0.85rem', marginTop: '2px' }}>
                                Gerenciar tenants, usuários e configurações globais
                            </div>
                        </div>
                        <ArrowRight size={20} style={{ opacity: 0.7 }} />
                    </button>
                )}

                {/* Tenant selection */}
                {tenants.length > 0 && (
                    <>
                        <div style={{
                            fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase',
                            letterSpacing: '0.05em', color: 'var(--color-text-muted)',
                            marginBottom: 'var(--space-3)', marginTop: 'var(--space-2)',
                        }}>
                            Flows Disponíveis
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                            {tenants.map((t) => (
                                <button
                                    key={t.tenantId}
                                    onClick={() => handleSelectTenant(t.tenantSlug)}
                                    disabled={selecting === t.tenantSlug}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 'var(--space-4)',
                                        width: '100%', padding: 'var(--space-3) var(--space-4)',
                                        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                                        borderRadius: 'var(--radius-lg)', cursor: 'pointer',
                                        transition: 'transform 0.15s, box-shadow 0.15s, border-color 0.15s',
                                        textAlign: 'left',
                                        opacity: selecting && selecting !== t.tenantSlug ? 0.5 : 1,
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.transform = 'translateY(-1px)';
                                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)';
                                        e.currentTarget.style.borderColor = 'var(--color-primary)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = 'none';
                                        e.currentTarget.style.borderColor = 'var(--color-border)';
                                    }}
                                >
                                    <div style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        width: '44px', height: '44px', borderRadius: 'var(--radius-md)',
                                        background: 'var(--color-primary-light)', color: 'var(--color-primary)',
                                        flexShrink: 0,
                                    }}>
                                        <Building2 size={22} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>{t.tenantName}</div>
                                        <div className="text-muted" style={{ fontSize: '0.8rem', marginTop: '2px' }}>
                                            {t.tenantSlug}
                                            {t._count && ` · ${t._count.clients} clientes · ${t._count.members} membros`}
                                        </div>
                                    </div>
                                    {selecting === t.tenantSlug ? (
                                        <Loader2 size={18} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
                                    ) : (
                                        <ArrowRight size={18} style={{ color: 'var(--color-text-muted)' }} />
                                    )}
                                </button>
                            ))}
                        </div>
                    </>
                )}

                {tenants.length === 0 && user?.role !== 'SUPERADMIN' && (
                    <div style={{
                        textAlign: 'center', padding: 'var(--space-6)',
                        background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)',
                        border: '1px solid var(--color-border)',
                    }}>
                        <Building2 size={32} style={{ color: 'var(--color-text-muted)', margin: '0 auto' }} />
                        <h3 style={{ marginTop: 'var(--space-3)' }}>Nenhum Flow vinculado</h3>
                        <p className="text-muted text-sm" style={{ marginTop: 'var(--space-2)' }}>
                            Seu usuário não está vinculado a nenhum Flow. Contate o administrador.
                        </p>
                    </div>
                )}

                {/* Logout */}
                <div style={{ textAlign: 'center', marginTop: 'var(--space-6)' }}>
                    <button
                        onClick={handleLogout}
                        style={{
                            background: 'none', border: 'none', color: 'var(--color-text-muted)',
                            cursor: 'pointer', fontSize: '0.85rem', display: 'inline-flex',
                            alignItems: 'center', gap: '6px', fontFamily: 'var(--font-family)',
                        }}
                    >
                        <LogOut size={14} /> Sair
                    </button>
                </div>

                <div className="text-center text-xs text-muted" style={{ marginTop: 'var(--space-4)' }}>
                    © {new Date().getFullYear()} Schumaker Flow. Todos os direitos reservados.
                </div>
            </div>
        </div>
    );
}
