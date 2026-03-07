'use client';

import { useEffect, useState } from 'react';
import { Download, X, Share } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPrompt() {
    const [show, setShow] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

    useEffect(() => {
        // Register service worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').catch(() => { });
        }

        // Check if already installed (standalone mode)
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches
            || (navigator as any).standalone === true;

        if (isStandalone) return; // Already installed

        // Check if user dismissed recently (don't show for 7 days)
        const dismissed = localStorage.getItem('pwa-install-dismissed');
        if (dismissed) {
            const diff = Date.now() - Number(dismissed);
            if (diff < 7 * 24 * 60 * 60 * 1000) return;
        }

        // Detect iOS
        const ua = navigator.userAgent;
        const isiOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

        if (isiOS) {
            // Only show on Safari (other browsers on iOS can't add to home screen either)
            const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS|EdgiOS/.test(ua);
            if (isSafari) {
                setIsIOS(true);
                setTimeout(() => setShow(true), 2000);
            }
            return;
        }

        // Android / Desktop — use beforeinstallprompt
        const handler = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e as BeforeInstallPromptEvent);
            setTimeout(() => setShow(true), 2000);
        };

        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstall = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setShow(false);
        }
        setDeferredPrompt(null);
    };

    const handleDismiss = () => {
        setShow(false);
        localStorage.setItem('pwa-install-dismissed', String(Date.now()));
    };

    if (!show) return null;

    return (
        <div style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 9999,
            padding: '0 16px 16px',
            animation: 'slideUp 0.35s ease-out',
        }}>
            <style>{`
                @keyframes slideUp {
                    from { transform: translateY(100%); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            `}</style>
            <div style={{
                maxWidth: 420,
                margin: '0 auto',
                background: 'var(--color-card)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg, 16px)',
                padding: '16px',
                boxShadow: '0 -4px 24px rgba(0,0,0,0.25)',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
            }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <img
                        src="/icons/icon-192.png"
                        alt="SFlow"
                        style={{ width: 48, height: 48, borderRadius: 12, flexShrink: 0 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: 2 }}>
                            Instalar SFlow
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
                            {isIOS
                                ? 'Adicione na sua tela inicial para acesso rápido e experiência de app nativo.'
                                : 'Instale o app para acesso rápido e notificações no celular.'
                            }
                        </div>
                    </div>
                    <button
                        onClick={handleDismiss}
                        style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: 'var(--color-text-muted)', padding: 4, flexShrink: 0,
                        }}
                    >
                        <X size={18} />
                    </button>
                </div>

                {isIOS ? (
                    <div style={{
                        background: 'var(--color-bg)',
                        borderRadius: 'var(--radius-md, 10px)',
                        padding: '12px 14px',
                        fontSize: '0.8rem',
                        color: 'var(--color-text-muted)',
                        lineHeight: 1.5,
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, fontWeight: 600, color: 'var(--color-text)' }}>
                            <Share size={14} /> Como instalar:
                        </div>
                        <ol style={{ margin: 0, paddingLeft: 18 }}>
                            <li>Toque no botão <strong>Compartilhar</strong> <Share size={12} style={{ verticalAlign: 'middle' }} /> na barra do Safari</li>
                            <li>Selecione <strong>&quot;Adicionar à Tela de Início&quot;</strong></li>
                            <li>Toque em <strong>&quot;Adicionar&quot;</strong></li>
                        </ol>
                    </div>
                ) : (
                    <button
                        onClick={handleInstall}
                        className="btn btn-primary"
                        style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                            fontSize: '0.9rem',
                            fontWeight: 700,
                            padding: '10px 16px',
                        }}
                    >
                        <Download size={16} />
                        Instalar App
                    </button>
                )}
            </div>
        </div>
    );
}
