'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showReset, setShowReset] = useState(false);
    const [resetEmail, setResetEmail] = useState('');
    const [resetMessage, setResetMessage] = useState('');
    const [showPw, setShowPw] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || 'Falha no login');
                return;
            }

            if (data.data.noAccess) {
                router.push('/no-access');
                return;
            }

            if (data.data.requireContext) {
                sessionStorage.setItem('login_contexts', JSON.stringify(data.data));
                sessionStorage.setItem('login_password', password);
                router.push('/select-context');
                return;
            }

            const { role } = data.data;
            if (role === 'CLIENT_USER') router.push('/portal');
            else if (role === 'SUPERADMIN') router.push('/superadmin');
            else router.push('/admin');
        } catch {
            setError('Erro de conexão. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <div className="login-split">
                {/* Left: Banner */}
                <div className="login-split-banner">
                    <img src="/icons/login-banner.png" alt="" className="login-banner-img" />
                    <div className="login-banner-overlay">
                        <img src="/icons/favicon-512-white.png" alt="SFlow" style={{ width: 120, height: 'auto', marginBottom: 24 }} />
                        <div style={{ fontSize: '1.1rem', color: 'rgba(255,255,255,0.6)', fontWeight: 400, maxWidth: 280, lineHeight: 1.5 }}>Gestão de Clientes, Mídia, Agenda e Financeiro</div>
                    </div>
                </div>

                {/* Right: Form */}
                <div className="login-split-form">
                    <div className="login-card" style={{ boxShadow: 'none', border: 'none', maxWidth: 400, width: '100%' }}>
                        <div className="login-logo">
                            <div style={{ marginBottom: '0.5rem' }}>
                                <img src="/icons/favicon-512-black.png" alt="SFlow" className="login-logo-light" style={{ width: 56, height: 'auto' }} />
                                <img src="/icons/favicon-512-white.png" alt="SFlow" className="login-logo-dark" style={{ width: 56, height: 'auto' }} />
                            </div>
                            <h1>SFlow</h1>
                            <p>Gestão de Clientes, Mídia, Agenda e Financeiro</p>
                        </div>

                        {!showReset ? (
                            <form onSubmit={handleLogin}>
                                {error && (
                                    <div style={{
                                        background: 'var(--color-danger-light)',
                                        color: 'var(--color-danger)',
                                        padding: 'var(--space-3)',
                                        borderRadius: 'var(--radius-md)',
                                        fontSize: 'var(--font-size-sm)',
                                        marginBottom: 'var(--space-4)',
                                    }}>
                                        {error}
                                    </div>
                                )}

                                <div className="form-group">
                                    <label className="form-label" htmlFor="email">Email</label>
                                    <input
                                        id="email"
                                        type="email"
                                        className="form-input"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="seu@email.com"
                                        required
                                        autoFocus
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="form-label" htmlFor="password">Senha</label>
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            id="password"
                                            type={showPw ? 'text' : 'password'}
                                            className="form-input"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder="••••••••"
                                            required
                                            style={{ paddingRight: 40 }}
                                        />
                                        <button type="button" onClick={() => setShowPw(!showPw)} style={{
                                            position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                                            background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: 'var(--color-text-muted)',
                                        }}>
                                            {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                                        </button>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    className="btn btn-primary btn-lg w-full"
                                    disabled={loading}
                                    style={{ marginTop: 'var(--space-2)' }}
                                >
                                    {loading ? 'Entrando...' : 'Entrar'}
                                </button>

                                <div className="text-center mt-4" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                                    <button
                                        type="button"
                                        onClick={() => setShowReset(true)}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            color: 'var(--color-primary)',
                                            cursor: 'pointer',
                                            fontSize: 'var(--font-size-sm)',
                                            fontFamily: 'var(--font-family)',
                                        }}
                                    >
                                        Esqueceu a senha?
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => router.push('/register')}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            color: 'var(--color-muted)',
                                            cursor: 'pointer',
                                            fontSize: 'var(--font-size-sm)',
                                            fontFamily: 'var(--font-family)',
                                        }}
                                    >
                                        Não tem conta? <span style={{ color: 'var(--color-primary)' }}>Cadastre-se</span>
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <div>
                                <p className="text-sm text-secondary mb-4">
                                    Para redefinir sua senha, entre em contato pelo WhatsApp:
                                </p>

                                <button
                                    type="button"
                                    className="btn btn-primary btn-lg w-full"
                                    style={{ background: '#25D366', borderColor: '#25D366', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                                    onClick={() => {
                                        const msg = encodeURIComponent(`Olá, preciso redefinir minha senha no SFlow. Meu email: ${resetEmail || '(informe seu email)'}`);
                                        window.open(`https://wa.me/5517997635564?text=${msg}`, '_blank');
                                    }}
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                                    Conversar no WhatsApp
                                </button>

                                <div className="text-center mt-4">
                                    <button
                                        type="button"
                                        onClick={() => setShowReset(false)}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            color: 'var(--color-primary)',
                                            cursor: 'pointer',
                                            fontSize: 'var(--font-size-sm)',
                                            fontFamily: 'var(--font-family)',
                                        }}
                                    >
                                        Voltar ao login
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="text-center mt-6 text-xs text-muted">
                            © {new Date().getFullYear()} SFlow. Todos os direitos reservados.
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
