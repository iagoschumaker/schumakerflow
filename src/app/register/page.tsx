'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Zap, ArrowLeft, Eye, EyeOff } from 'lucide-react';

export default function RegisterPage() {
    const router = useRouter();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPw, setShowPw] = useState(false);
    const [showPwConfirm, setShowPwConfirm] = useState(false);

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (password !== confirmPassword) {
            setError('As senhas não coincidem');
            return;
        }

        setLoading(true);

        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || 'Erro ao criar conta');
                return;
            }

            setSuccess('Conta criada com sucesso! Redirecionando para o login...');
            setTimeout(() => router.push('/login'), 2000);
        } catch {
            setError('Erro de conexão. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-banner">
                <img src="/icons/login-banner.png" alt="SFlow" />
            </div>
            <div className="login-side">
                <div className="login-card">
                    <div className="login-logo">
                        <img src="/icons/favicon-512-white.png" alt="SFlow" />
                        <h1>SFlow</h1>
                        <p>Crie sua conta</p>
                    </div>

                    <form onSubmit={handleRegister} autoComplete="off">
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

                        {success && (
                            <div style={{
                                background: 'var(--color-success-light)',
                                color: 'var(--color-success)',
                                padding: 'var(--space-3)',
                                borderRadius: 'var(--radius-md)',
                                fontSize: 'var(--font-size-sm)',
                                marginBottom: 'var(--space-4)',
                            }}>
                                {success}
                            </div>
                        )}

                        <div className="form-group">
                            <label className="form-label" htmlFor="reg-name">Nome</label>
                            <input
                                id="reg-name"
                                type="text"
                                className="form-input"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Seu nome"
                                required
                                autoFocus
                                autoComplete="off"
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label" htmlFor="reg-email">Email</label>
                            <input
                                id="reg-email"
                                type="email"
                                className="form-input"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="seu@email.com"
                                required
                                autoComplete="off"
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label" htmlFor="reg-password">Senha</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    id="reg-password"
                                    type={showPw ? 'text' : 'password'}
                                    className="form-input"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Mínimo 8 caracteres"
                                    required
                                    minLength={8}
                                    autoComplete="new-password"
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

                        <div className="form-group">
                            <label className="form-label" htmlFor="reg-confirmPassword">Confirmar Senha</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    id="reg-confirmPassword"
                                    type={showPwConfirm ? 'text' : 'password'}
                                    className="form-input"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Repita a senha"
                                    required
                                    minLength={8}
                                    autoComplete="new-password"
                                    style={{ paddingRight: 40 }}
                                />
                                <button type="button" onClick={() => setShowPwConfirm(!showPwConfirm)} style={{
                                    position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                                    background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: 'var(--color-text-muted)',
                                }}>
                                    {showPwConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="btn btn-primary btn-lg w-full"
                            disabled={loading}
                            style={{ marginTop: 'var(--space-2)' }}
                        >
                            {loading ? 'Criando conta...' : 'Criar Conta'}
                        </button>

                        <div className="text-center mt-4">
                            <button
                                type="button"
                                onClick={() => router.push('/login')}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--color-primary)',
                                    cursor: 'pointer',
                                    fontSize: 'var(--font-size-sm)',
                                    fontFamily: 'var(--font-family)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.25rem',
                                }}
                            >
                                <ArrowLeft size={14} /> Voltar ao login
                            </button>
                        </div>
                    </form>

                    <div style={{ textAlign: 'center', marginTop: 'var(--space-6)', fontSize: 'var(--font-size-xs)', color: 'rgba(255,255,255,0.3)' }}>
                        © {new Date().getFullYear()} SFlow. Todos os direitos reservados.
                    </div>
                </div>
            </div>
        </div>
    );
}
