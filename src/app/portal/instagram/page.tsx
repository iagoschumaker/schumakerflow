'use client';

import { useEffect, useState } from 'react';
import { Instagram, Plus, Trash2, Loader2, CheckCircle2, ExternalLink } from 'lucide-react';
import { useToast } from '@/components/Toast';

interface IgAccount {
    id: string;
    username: string;
    igUserId: string;
    createdAt: string;
}

export default function PortalInstagramPage() {
    const [accounts, setAccounts] = useState<IgAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const { showToast } = useToast();

    const loadAccounts = async () => {
        setLoading(true);
        try {
            const r = await fetch('/api/portal/instagram/status');
            if (r.ok) {
                const d = await r.json();
                setAccounts(d.data?.accounts || []);
            }
        } catch { /* ignore */ }
        setLoading(false);
    };

    useEffect(() => {
        loadAccounts();
        const params = new URLSearchParams(window.location.search);
        const igParam = params.get('instagram');
        if (igParam === 'connected') {
            showToast('Instagram conectado com sucesso!', 'success');
            window.history.replaceState({}, '', '/portal/instagram');
            loadAccounts();
        } else if (igParam === 'no_pages') {
            showToast('Nenhuma Página do Facebook encontrada. Vincule uma Página ao seu Instagram Profissional.', 'error');
            window.history.replaceState({}, '', '/portal/instagram');
        } else if (igParam === 'no_instagram') {
            showToast('Nenhuma conta Instagram Profissional encontrada nas suas Páginas do Facebook.', 'error');
            window.history.replaceState({}, '', '/portal/instagram');
        } else if (igParam === 'error') {
            showToast('Erro ao conectar Instagram. Tente novamente.', 'error');
            window.history.replaceState({}, '', '/portal/instagram');
        }
    }, []);

    const handleDisconnect = async (account: IgAccount) => {
        if (!confirm(`Desconectar @${account.username}?`)) return;
        try {
            const r = await fetch(`/api/portal/instagram/status?id=${account.id}`, { method: 'DELETE' });
            if (r.ok) {
                showToast(`@${account.username} desconectado`, 'success');
                loadAccounts();
            } else {
                showToast('Erro ao desconectar', 'error');
            }
        } catch {
            showToast('Erro ao desconectar', 'error');
        }
    };

    return (
        <div>
            <div className="page-header">
                <h1>Instagram</h1>
                <p>Gerencie suas contas conectadas para postar direto do portal</p>
            </div>

            <div className="page-content">
                {/* Connect buttons */}
                <div style={{ marginBottom: 24, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <button
                        className="btn btn-primary"
                        onClick={() => { window.location.href = '/api/portal/instagram/connect?source=ig'; }}
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: 8,
                            background: 'linear-gradient(135deg, #833AB4, #C13584, #E1306C)',
                            borderColor: 'transparent', fontSize: '0.9rem', padding: '10px 20px',
                        }}
                    >
                        <Plus size={16} /> Conectar com Instagram
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={() => { window.location.href = '/api/portal/instagram/connect?source=fb'; }}
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: 8,
                            background: 'linear-gradient(135deg, #1877F2, #42A5F5)',
                            borderColor: 'transparent', fontSize: '0.9rem', padding: '10px 20px',
                        }}
                    >
                        <Plus size={16} /> Conectar via Facebook
                    </button>
                </div>

                {/* Accounts list */}
                {loading ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-text-muted)', padding: 20 }}>
                        <Loader2 size={18} className="animate-spin" /> Carregando contas...
                    </div>
                ) : accounts.length === 0 ? (
                    <div className="card" style={{ padding: 32, textAlign: 'center' }}>
                        <Instagram size={48} style={{ color: 'var(--color-text-muted)', marginBottom: 12 }} />
                        <h3 style={{ marginBottom: 8, color: 'var(--color-text-secondary)' }}>Nenhuma conta conectada</h3>
                        <p className="text-sm text-muted" style={{ maxWidth: 400, margin: '0 auto', lineHeight: 1.6 }}>
                            Conecte sua conta Instagram para postar fotos e vídeos diretamente dos seus projetos.
                        </p>
                    </div>
                ) : (
                    <div style={{ display: 'grid', gap: 12 }}>
                        {accounts.map(acc => (
                            <div key={acc.id} className="card" style={{
                                padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16,
                                borderLeft: '3px solid #E1306C',
                            }}>
                                <div style={{
                                    width: 48, height: 48, borderRadius: '50%',
                                    background: 'linear-gradient(135deg, #833AB4, #C13584, #E1306C, #F77737, #FCAF45)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                }}>
                                    <Instagram size={22} style={{ color: '#fff' }} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-text)' }}>
                                        @{acc.username}
                                    </div>
                                    <div className="text-sm text-muted" style={{ marginTop: 2 }}>
                                        <CheckCircle2 size={12} style={{ color: '#22c55e', verticalAlign: 'middle', marginRight: 4 }} />
                                        Conectado
                                        {acc.createdAt && (
                                            <span style={{ marginLeft: 8 }}>
                                                · desde {new Date(acc.createdAt).toLocaleDateString('pt-BR')}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                    <a href={`https://instagram.com/${acc.username}`} target="_blank" rel="noopener noreferrer"
                                        className="btn btn-sm btn-secondary"
                                        style={{ display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
                                        <ExternalLink size={12} /> Perfil
                                    </a>
                                    <button className="btn btn-sm btn-danger"
                                        onClick={() => handleDisconnect(acc)}
                                        style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <Trash2 size={12} /> Desconectar
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Instructions */}
                <div className="card" style={{ marginTop: 24, padding: 20, borderLeft: '3px solid #833AB4' }}>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Instagram size={16} style={{ color: '#833AB4' }} /> Como funciona
                    </h3>
                    <ul className="text-sm text-muted" style={{ lineHeight: 1.8, paddingLeft: 20 }}>
                        <li><strong>Conectar com Instagram</strong> — login direto na sua conta Instagram (precisa ser conta Profissional)</li>
                        <li><strong>Conectar via Facebook</strong> — encontra o Instagram vinculado às suas Páginas do Facebook</li>
                        <li>Abra um projeto e clique em <strong>"Copy IA"</strong> em qualquer arquivo</li>
                        <li>Converse com a IA para gerar a legenda perfeita</li>
                        <li>Selecione a copy e clique em <strong>"Postar"</strong> — a foto/vídeo será publicada!</li>
                    </ul>
                </div>
            </div>
        </div>
    );
}
