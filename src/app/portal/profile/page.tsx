'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/components/Toast';
import { User, Lock, Loader2, Mail } from 'lucide-react';

export default function PortalProfilePage() {
    const [user, setUser] = useState<{ name: string; email: string } | null>(null);
    const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
    const [pwSaving, setPwSaving] = useState(false);
    const { showToast } = useToast();

    useEffect(() => {
        fetch('/api/auth/me')
            .then(r => r.json())
            .then(d => setUser(d.data));
    }, []);

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (pwForm.newPassword !== pwForm.confirmPassword) {
            showToast('As senhas não coincidem', 'error');
            return;
        }
        setPwSaving(true);
        try {
            const res = await fetch('/api/auth/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword }),
            });
            const data = await res.json();
            if (res.ok) {
                showToast('Senha alterada com sucesso!', 'success');
                setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
            } else {
                showToast(data.error || 'Erro ao alterar senha', 'error');
            }
        } finally { setPwSaving(false); }
    };

    return (
        <div>
            <div className="page-header">
                <h1>Meus Dados</h1>
                <p>Visualize suas informações e altere sua senha</p>
            </div>

            <div className="page-content">
                {/* User info card */}
                <div className="card" style={{ marginBottom: 16 }}>
                    <div className="card-header">
                        <h2 className="card-title"><User size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />Informações</h2>
                    </div>
                    <div style={{ padding: 'var(--space-4)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--color-primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', fontWeight: 700, flexShrink: 0 }}>
                                {user?.name?.charAt(0).toUpperCase() || '?'}
                            </div>
                            <div>
                                <div style={{ fontWeight: 700, fontSize: '1rem' }}>{user?.name || 'Carregando...'}</div>
                                <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                                    <Mail size={13} /> {user?.email || '...'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Password change */}
                <div className="card">
                    <div className="card-header">
                        <h2 className="card-title"><Lock size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />Alterar Senha</h2>
                    </div>
                    <div style={{ padding: 'var(--space-4)' }}>
                        <form onSubmit={handleChangePassword}>
                            <div className="form-group">
                                <label className="form-label">Senha Atual</label>
                                <input className="form-input" type="password" value={pwForm.currentPassword} onChange={e => setPwForm({ ...pwForm, currentPassword: e.target.value })} required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Nova Senha</label>
                                <input className="form-input" type="password" value={pwForm.newPassword} onChange={e => setPwForm({ ...pwForm, newPassword: e.target.value })} required minLength={8} placeholder="Mínimo 8 caracteres" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Confirmar Nova Senha</label>
                                <input className="form-input" type="password" value={pwForm.confirmPassword} onChange={e => setPwForm({ ...pwForm, confirmPassword: e.target.value })} required minLength={8} />
                            </div>
                            <button type="submit" className="btn btn-primary" disabled={pwSaving} style={{ marginTop: 8 }}>
                                {pwSaving ? <><Loader2 size={14} className="animate-spin" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Salvando...</> : 'Alterar Senha'}
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
