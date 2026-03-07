'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/components/Toast';
import { Settings, HardDrive, CheckCircle2, XCircle, Loader2, LogOut, ExternalLink, Lock, QrCode, DollarSign, MessageCircle, RefreshCw } from 'lucide-react';

interface TenantInfo {
    id: string;
    name: string;
    slug: string;
    subdomain: string | null;
    status: string;
    currency: string;
    blockAfterDays: number;
    blockMode: string;
    driveRootFolderId: string | null;
    createdAt: string;
}

interface DriveStatus {
    connected: boolean;
    email: string | null;
    rootFolderId: string | null;
    tokenExpired: boolean;
}

export default function SettingsPage() {
    const [tenant, setTenant] = useState<TenantInfo | null>(null);
    const [driveStatus, setDriveStatus] = useState<DriveStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [driveLoading, setDriveLoading] = useState(true);
    const [disconnecting, setDisconnecting] = useState(false);
    const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
    const [pwSaving, setPwSaving] = useState(false);
    const [pixForm, setPixForm] = useState({ pixKey: '', pixKeyType: 'CPF', pixReceiverName: '' });
    const [pixSaving, setPixSaving] = useState(false);
    const [pixConfigured, setPixConfigured] = useState(false);

    // WhatsApp / Evolution API
    const [wpConnecting, setWpConnecting] = useState(false);
    const [wpStatus, setWpStatus] = useState<{ configured: boolean; connected: boolean; phone?: string; error?: string } | null>(null);
    const [wpLoading, setWpLoading] = useState(true);
    const [wpModalOpen, setWpModalOpen] = useState(false);
    const [wpQrCode, setWpQrCode] = useState<string | null>(null);
    const [wpQrLoading, setWpQrLoading] = useState(false);
    const wpPollRef = { current: null as ReturnType<typeof setInterval> | null };

    // Check URL params for drive connection result
    const [driveMessage, setDriveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const driveParam = params.get('drive');
        if (driveParam === 'connected') {
            setDriveMessage({ type: 'success', text: 'Google Drive conectado com sucesso!' });
            // Clean URL
            window.history.replaceState({}, '', '/admin/settings');
        } else if (driveParam === 'error') {
            setDriveMessage({ type: 'error', text: 'Erro ao conectar o Google Drive. Tente novamente.' });
            window.history.replaceState({}, '', '/admin/settings');
        }
    }, []);

    useEffect(() => {
        fetch('/api/auth/me')
            .then((r) => r.json())
            .then(async (d) => {
                if (d.data?.tenantId) {
                    setTenant({
                        id: d.data.tenantId,
                        name: d.data.tenantName || 'Seu Tenant',
                        slug: d.data.tenantSlug || '',
                        subdomain: d.data.tenantSubdomain || null,
                        status: 'ACTIVE',
                        currency: 'BRL',
                        blockAfterDays: 7,
                        blockMode: 'BLOCK_FINAL_ONLY',
                        driveRootFolderId: null,
                        createdAt: '',
                    });
                }
            })
            .finally(() => setLoading(false));

        // Load Drive status
        fetch('/api/admin/settings/drive/status')
            .then((r) => r.json())
            .then((d) => setDriveStatus(d.data || null))
            .finally(() => setDriveLoading(false));

        // Load PIX settings
        fetch('/api/admin/settings/pix')
            .then(r => { if (!r.ok) throw new Error('PIX not available'); return r.json(); })
            .then(d => {
                if (d.data?.pixKey) {
                    setPixForm({ pixKey: d.data.pixKey, pixKeyType: d.data.pixKeyType || 'CPF', pixReceiverName: d.data.pixReceiverName || '' });
                    setPixConfigured(true);
                }
            })
            .catch(() => { /* PIX not configured yet, ignore */ });

        // Load WhatsApp status
        fetch('/api/admin/settings/whatsapp')
            .then(r => { if (!r.ok) throw new Error(); return r.json(); })
            .then(d => { if (d.data) setWpStatus(d.data); })
            .catch(() => { })
            .finally(() => setWpLoading(false));
    }, []);

    const handleConnect = () => {
        window.location.href = '/api/admin/settings/drive/connect';
    };

    const { showToast, showConfirm } = useToast();

    const handleDisconnect = async () => {
        const ok = await showConfirm({
            title: 'Desconectar Google Drive',
            message: 'Seus arquivos no Drive NÃO serão apagados. Os registros no sistema serão mantidos. Apenas a autenticação será removida. Deseja continuar?',
            confirmText: 'Desconectar',
            variant: 'warning',
        });
        if (!ok) return;
        setDisconnecting(true);
        try {
            await fetch('/api/admin/settings/drive/disconnect', { method: 'POST' });
            setDriveStatus({ connected: false, email: null, rootFolderId: null, tokenExpired: false });
            showToast('Google Drive desconectado com sucesso.', 'success');
        } finally {
            setDisconnecting(false);
        }
    };

    const blockLabel = (m: string) => {
        const map: Record<string, string> = {
            BLOCK_FINAL_ONLY: 'Bloquear apenas finais',
            BLOCK_ALL: 'Bloquear todos',
        };
        return map[m] || m;
    };

    if (loading) {
        return (
            <div>
                <div className="page-header">
                    <h1>Configurações</h1>
                    <p>Informações do seu tenant</p>
                </div>
                <div className="page-content">
                    <div className="card animate-pulse" style={{ height: 300 }} />
                </div>
            </div>
        );
    }

    return (
        <div>
            <div className="page-header">
                <h1>Configurações</h1>
                <p>Informações e configurações do seu tenant</p>
            </div>

            <div className="page-content">
                {/* Drive Message Toast */}
                {driveMessage && (
                    <div
                        style={{
                            padding: 'var(--space-3) var(--space-4)',
                            borderRadius: 'var(--radius-md)',
                            marginBottom: 'var(--space-4)',
                            background: driveMessage.type === 'success' ? 'var(--color-success-light)' : 'var(--color-danger-light)',
                            color: driveMessage.type === 'success' ? '#059669' : '#dc2626',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--space-2)',
                            fontSize: 'var(--font-size-sm)',
                            fontWeight: 500,
                        }}
                    >
                        {driveMessage.type === 'success' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                        {driveMessage.text}
                        <button
                            onClick={() => setDriveMessage(null)}
                            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5, fontSize: '1.2rem' }}
                        >×</button>
                    </div>
                )}


                {/* Google Drive Connection */}
                <div className="card" style={{ marginTop: 'var(--space-4)' }}>
                    <div className="card-header">
                        <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                            <HardDrive size={18} /> Google Drive
                        </h2>
                    </div>
                    <div style={{ padding: 'var(--space-4)' }}>
                        {driveLoading ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--color-text-muted)' }}>
                                <Loader2 size={16} className="animate-spin" /> Verificando conexão...
                            </div>
                        ) : driveStatus?.connected ? (
                            /* Connected State */
                            <div>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 'var(--space-3)',
                                    padding: 'var(--space-4)',
                                    background: 'var(--color-success-light)',
                                    borderRadius: 'var(--radius-lg)',
                                    marginBottom: 'var(--space-4)',
                                }}>
                                    <CheckCircle2 size={24} style={{ color: '#059669', flexShrink: 0 }} />
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 600, color: '#059669' }}>Google Drive Conectado</div>
                                        <div className="text-sm" style={{ color: '#047857', marginTop: 2 }}>
                                            {driveStatus.email}
                                        </div>
                                    </div>
                                    <span className="badge badge-success">Ativo</span>
                                </div>

                                <div className="grid-2" style={{ gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                                    <div>
                                        <div className="text-sm text-muted" style={{ marginBottom: '4px' }}>Conta conectada</div>
                                        <div className="font-semibold">{driveStatus.email}</div>
                                    </div>
                                    <div>
                                        <div className="text-sm text-muted" style={{ marginBottom: '4px' }}>Pasta raiz</div>
                                        <div className="font-semibold">
                                            {driveStatus.rootFolderId ? (
                                                <a
                                                    href={`https://drive.google.com/drive/folders/${driveStatus.rootFolderId}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--color-primary)' }}
                                                >
                                                    Abrir no Drive <ExternalLink size={12} />
                                                </a>
                                            ) : '—'}
                                        </div>
                                    </div>
                                </div>

                                <p className="text-sm text-muted" style={{ marginBottom: 'var(--space-3)' }}>
                                    Os uploads de arquivos serão salvos automaticamente no Google Drive desta conta,
                                    organizados por projeto.
                                </p>

                                <button
                                    className="btn btn-danger"
                                    onClick={handleDisconnect}
                                    disabled={disconnecting}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}
                                >
                                    {disconnecting ? (
                                        <><Loader2 size={14} className="animate-spin" /> Desconectando...</>
                                    ) : (
                                        <><LogOut size={14} /> Desconectar Google Drive</>
                                    )}
                                </button>
                            </div>
                        ) : (
                            /* Disconnected State */
                            <div>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 'var(--space-3)',
                                    padding: 'var(--space-4)',
                                    background: 'var(--color-border-light)',
                                    borderRadius: 'var(--radius-lg)',
                                    marginBottom: 'var(--space-4)',
                                }}>
                                    <XCircle size={24} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                                    <div>
                                        <div style={{ fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                                            Google Drive não conectado
                                        </div>
                                        <div className="text-sm text-muted" style={{ marginTop: 2 }}>
                                            Conecte sua conta do Google para armazenar os arquivos automaticamente no Drive.
                                        </div>
                                    </div>
                                </div>

                                <p className="text-sm text-muted" style={{ marginBottom: 'var(--space-4)' }}>
                                    Ao conectar, uma pasta raiz será criada no seu Google Drive para organizar todos os
                                    arquivos dos projetos. Os arquivos enviados serão salvos automaticamente.
                                </p>

                                <button
                                    className="btn btn-primary"
                                    onClick={handleConnect}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}
                                >
                                    <HardDrive size={16} />
                                    Conectar Google Drive
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Billing Config */}
                <div className="card" style={{ marginTop: 'var(--space-4)' }}>
                    <div className="card-header">
                        <h2 className="card-title">Configurações de Cobrança</h2>
                    </div>
                    <div style={{ padding: 'var(--space-4)' }}>
                        <div className="grid-2" style={{ gap: 'var(--space-6)' }}>
                            <div>
                                <div className="text-sm text-muted" style={{ marginBottom: '4px' }}>Moeda</div>
                                <div className="font-semibold">{tenant?.currency}</div>
                            </div>
                            <div>
                                <div className="text-sm text-muted" style={{ marginBottom: '4px' }}>Bloquear após (dias)</div>
                                <div className="font-semibold">{tenant?.blockAfterDays} dias</div>
                            </div>
                            <div>
                                <div className="text-sm text-muted" style={{ marginBottom: '4px' }}>Modo de bloqueio</div>
                                <div className="font-semibold">{blockLabel(tenant?.blockMode || '')}</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* PIX Settings */}
                <div className="card" style={{ marginTop: 'var(--space-4)' }}>
                    <div className="card-header">
                        <h2 className="card-title"><QrCode size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />Configuração PIX</h2>
                    </div>
                    <div style={{ padding: 'var(--space-4)' }}>
                        {pixConfigured && (
                            <div style={{
                                display: 'flex', alignItems: 'center', gap: 10,
                                padding: 'var(--space-3)', borderRadius: 'var(--radius-md)',
                                background: 'rgba(34,197,94,0.08)', marginBottom: 'var(--space-4)',
                                border: '1px solid rgba(34,197,94,0.2)',
                            }}>
                                <CheckCircle2 size={18} style={{ color: '#22c55e' }} />
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#22c55e' }}>PIX configurado</div>
                                    <div className="text-sm text-muted">{pixForm.pixKeyType}: {pixForm.pixKey}</div>
                                </div>
                            </div>
                        )}
                        <form onSubmit={async (e) => {
                            e.preventDefault();
                            setPixSaving(true);
                            try {
                                const res = await fetch('/api/admin/settings/pix', {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify(pixForm),
                                });
                                if (res.ok) {
                                    showToast('PIX configurado com sucesso!', 'success');
                                    setPixConfigured(true);
                                } else {
                                    try {
                                        const data = await res.json();
                                        showToast(data.error || 'Erro ao salvar PIX', 'error');
                                    } catch {
                                        showToast('Erro ao salvar PIX', 'error');
                                    }
                                }
                            } finally { setPixSaving(false); }
                        }}>
                            <div className="form-group">
                                <label className="form-label">Tipo de Chave</label>
                                <select className="form-input" value={pixForm.pixKeyType} onChange={e => setPixForm({ ...pixForm, pixKeyType: e.target.value })}>
                                    <option value="CPF">CPF</option>
                                    <option value="CNPJ">CNPJ</option>
                                    <option value="EMAIL">Email</option>
                                    <option value="PHONE">Telefone</option>
                                    <option value="RANDOM">Chave Aleatória</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Chave PIX</label>
                                <input className="form-input" value={pixForm.pixKey} onChange={e => setPixForm({ ...pixForm, pixKey: e.target.value })} required placeholder="Digite sua chave PIX" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Nome do Recebedor</label>
                                <input className="form-input" value={pixForm.pixReceiverName} onChange={e => setPixForm({ ...pixForm, pixReceiverName: e.target.value })} required placeholder="Nome que aparecerá no pagamento" />
                            </div>
                            <button type="submit" className="btn btn-primary" disabled={pixSaving} style={{ marginTop: 8 }}>
                                {pixSaving ? <><Loader2 size={14} className="animate-spin" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Salvando...</> : <><DollarSign size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} /> Salvar PIX</>}
                            </button>
                        </form>
                    </div>
                </div>

                {/* WhatsApp */}
                <div className="card" style={{ marginTop: 'var(--space-4)' }}>
                    <div className="card-header">
                        <h2 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                            <MessageCircle size={18} style={{ color: '#25D366' }} /> WhatsApp
                        </h2>
                    </div>
                    <div style={{ padding: 'var(--space-4)' }}>
                        {wpLoading ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--color-text-muted)' }}>
                                <Loader2 size={16} className="animate-spin" /> Verificando conexão...
                            </div>
                        ) : wpStatus?.connected ? (
                            /* Connected State */
                            <div>
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                                    padding: 'var(--space-4)', background: 'rgba(37,211,102,0.08)',
                                    borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-4)',
                                    border: '1px solid rgba(37,211,102,0.2)',
                                }}>
                                    <CheckCircle2 size={24} style={{ color: '#25D366', flexShrink: 0 }} />
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 600, color: '#25D366' }}>WhatsApp Conectado</div>
                                        <div className="text-sm" style={{ color: '#1a9e4a', marginTop: 2 }}>
                                            {wpStatus.phone || 'Sessão ativa'}
                                        </div>
                                    </div>
                                    <span className="badge badge-success">Ativo</span>
                                </div>
                                <p className="text-sm text-muted" style={{ marginBottom: 'var(--space-3)' }}>
                                    Mensagens automáticas de cobrança serão enviadas via este WhatsApp.
                                </p>
                                <button
                                    className="btn btn-danger"
                                    onClick={async () => {
                                        const ok = confirm('Desconectar WhatsApp? As mensagens automáticas serão interrompidas.');
                                        if (!ok) return;
                                        await fetch('/api/admin/settings/whatsapp', { method: 'DELETE' });
                                        setWpStatus({ configured: false, connected: false });
                                        showToast('WhatsApp desconectado', 'success');
                                    }}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)' }}
                                >
                                    <LogOut size={14} /> Desconectar WhatsApp
                                </button>
                            </div>
                        ) : (
                            /* Not connected — show connect button */
                            <div>
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                                    padding: 'var(--space-4)', background: 'var(--color-border-light)',
                                    borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-4)',
                                }}>
                                    <XCircle size={24} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                                    <div>
                                        <div style={{ fontWeight: 600, color: 'var(--color-text-secondary)' }}>WhatsApp não conectado</div>
                                        <div className="text-sm text-muted" style={{ marginTop: 2 }}>Conecte seu WhatsApp para enviar cobranças automáticas aos clientes.</div>
                                    </div>
                                </div>
                                {wpStatus?.error && (
                                    <div style={{ padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', fontSize: '0.82rem', marginBottom: 'var(--space-4)' }}>
                                        Erro: {wpStatus.error}
                                    </div>
                                )}
                                <button
                                    className="btn btn-primary"
                                    disabled={wpConnecting}
                                    onClick={async () => {
                                        setWpConnecting(true);
                                        try {
                                            const res = await fetch('/api/admin/settings/whatsapp', {
                                                method: 'PUT',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({}),
                                            });
                                            const d = await res.json();
                                            if (res.ok && d.data) {
                                                // Instance created — open modal and start polling for QR
                                                setWpQrCode(null);
                                                setWpModalOpen(true);
                                                // Start polling for QR code
                                                const poll = setInterval(async () => {
                                                    try {
                                                        const qrRes = await fetch('/api/admin/settings/whatsapp/qr');
                                                        const qrData = await qrRes.json();
                                                        if (qrData.data?.connected) {
                                                            clearInterval(poll);
                                                            wpPollRef.current = null;
                                                            setWpModalOpen(false);
                                                            setWpStatus({ configured: true, connected: true, phone: qrData.data.phone });
                                                            showToast('WhatsApp conectado com sucesso!', 'success');
                                                        } else if (qrData.data?.qrCode) {
                                                            setWpQrCode(qrData.data.qrCode);
                                                        }
                                                    } catch { /* ignore poll errors */ }
                                                }, 3000);
                                                wpPollRef.current = poll;
                                            } else {
                                                showToast(d.error || 'Erro ao conectar WhatsApp', 'error');
                                            }
                                        } finally { setWpConnecting(false); }
                                    }}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', background: '#25D366', borderColor: '#25D366' }}
                                >
                                    {wpConnecting ? <><Loader2 size={14} className="animate-spin" /> Conectando...</> : <><MessageCircle size={14} /> Conectar WhatsApp</>}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* WhatsApp QR Code Modal */}
                {wpModalOpen && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', zIndex: 9999,
                    }} onClick={() => { if (wpPollRef.current) clearInterval(wpPollRef.current); setWpModalOpen(false); }}>
                        <div style={{
                            background: 'var(--color-bg)', borderRadius: 'var(--radius-xl)',
                            padding: 'var(--space-6)', maxWidth: 400, width: '90%', textAlign: 'center',
                            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
                        }} onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 'var(--space-4)' }}>
                                <MessageCircle size={24} style={{ color: '#25D366' }} />
                                <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Conectar WhatsApp</h3>
                            </div>
                            {wpQrCode ? (
                                <div>
                                    <img
                                        src={wpQrCode.startsWith('data:') ? wpQrCode : `data:image/png;base64,${wpQrCode}`}
                                        alt="QR Code WhatsApp"
                                        style={{ maxWidth: 260, margin: '0 auto', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}
                                    />
                                    <p className="text-sm text-muted" style={{ marginTop: 12 }}>
                                        Abra o WhatsApp → Dispositivos conectados → Conectar dispositivo
                                    </p>
                                    <p className="text-sm" style={{ color: '#25D366', marginTop: 4 }}>
                                        <Loader2 size={12} className="animate-spin" style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
                                        Aguardando leitura do QR Code...
                                    </p>
                                </div>
                            ) : (
                                <div style={{ padding: 'var(--space-8) 0' }}>
                                    <Loader2 size={40} className="animate-spin" style={{ color: '#25D366', margin: '0 auto' }} />
                                    <p className="text-sm text-muted" style={{ marginTop: 16 }}>Gerando QR Code...</p>
                                </div>
                            )}
                            <button
                                className="btn btn-secondary"
                                onClick={() => { if (wpPollRef.current) clearInterval(wpPollRef.current); setWpModalOpen(false); }}
                                style={{ marginTop: 'var(--space-4)' }}
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                )}
                {/* Password Change */}
                <div className="card" style={{ marginTop: 'var(--space-4)' }}>
                    <div className="card-header">
                        <h2 className="card-title"><Lock size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />Alterar Senha</h2>
                    </div>
                    <div style={{ padding: 'var(--space-4)' }}>
                        <form onSubmit={async (e) => {
                            e.preventDefault();
                            if (pwForm.newPassword !== pwForm.confirmPassword) {
                                showToast('As senhas não coincidem', 'error'); return;
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
                        }}>
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
