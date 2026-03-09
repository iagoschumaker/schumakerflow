'use client';

import { useRouter } from 'next/navigation';
import { Zap, LogOut } from 'lucide-react';

export default function NoAccessPage() {
    const router = useRouter();

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/login');
    };

    return (
        <div className="login-container">
            <div className="login-card">
                <div className="login-logo">
                    <img src="/icons/favicon-512-white.png" alt="Schumaker Flow" style={{ width: 64, height: 64, marginBottom: '0.5rem' }} />
                    <h1>SFlow</h1>
                </div>

                <div style={{
                    textAlign: 'center',
                    padding: 'var(--space-6) 0',
                }}>
                    <div style={{
                        fontSize: '3rem',
                        marginBottom: 'var(--space-4)',
                    }}>
                        👋
                    </div>
                    <h2 style={{
                        fontSize: 'var(--font-size-xl)',
                        fontWeight: 600,
                        marginBottom: 'var(--space-3)',
                        color: 'var(--color-text)',
                    }}>
                        Conta criada com sucesso!
                    </h2>
                    <p style={{
                        color: 'var(--color-muted)',
                        fontSize: 'var(--font-size-sm)',
                        lineHeight: 1.6,
                        marginBottom: 'var(--space-6)',
                    }}>
                        Sua conta ainda não está vinculada a nenhum Flow.
                        <br />
                        Aguarde um administrador vincular seu acesso, ou contrate um plano para criar seu próprio Flow.
                    </p>

                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 'var(--space-3)',
                    }}>
                        <button
                            className="btn btn-primary btn-lg w-full"
                            disabled
                            style={{ opacity: 0.6, cursor: 'not-allowed' }}
                        >
                            Contratar Flow (em breve)
                        </button>

                        <button
                            className="btn btn-secondary w-full"
                            onClick={handleLogout}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem',
                            }}
                        >
                            <LogOut size={16} /> Sair
                        </button>
                    </div>
                </div>

                <div className="text-center mt-6 text-xs text-muted">
                    © {new Date().getFullYear()} Schumaker Flow. Todos os direitos reservados.
                </div>
            </div>
        </div>
    );
}
