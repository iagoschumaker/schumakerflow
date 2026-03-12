'use client';

import { useEffect, useState } from 'react';
import { Download, X, Share } from 'lucide-react';

/**
 * PWA Install Banner
 * - Android/Desktop: Uses beforeinstallprompt event
 * - iOS: Shows manual instructions (Add to Home Screen)
 * - Respects dismiss for 3 days
 */
export default function PWAInstallBanner() {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [showBanner, setShowBanner] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [isStandalone, setIsStandalone] = useState(false);

    useEffect(() => {
        // Check if already running as PWA
        const standalone = window.matchMedia('(display-mode: standalone)').matches
            || (window.navigator as any).standalone === true;
        setIsStandalone(standalone);
        if (standalone) return;

        // Check dismiss
        const dismissed = localStorage.getItem('pwa_dismiss');
        if (dismissed) {
            const dismissedAt = parseInt(dismissed);
            const threeDays = 3 * 24 * 60 * 60 * 1000;
            if (Date.now() - dismissedAt < threeDays) return;
            localStorage.removeItem('pwa_dismiss');
        }

        // Detect iOS
        const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
        setIsIOS(ios);

        if (ios) {
            // iOS doesn't support beforeinstallprompt, show manual banner
            setTimeout(() => setShowBanner(true), 3000);
        }

        // Android/Desktop: listen for beforeinstallprompt
        const handler = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setShowBanner(true);
        };
        window.addEventListener('beforeinstallprompt', handler);

        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstall = async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const result = await deferredPrompt.userChoice;
            if (result.outcome === 'accepted') {
                setShowBanner(false);
            }
            setDeferredPrompt(null);
        }
    };

    const handleDismiss = () => {
        setShowBanner(false);
        localStorage.setItem('pwa_dismiss', String(Date.now()));
    };

    if (!showBanner || isStandalone) return null;

    return (
        <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
            background: 'linear-gradient(135deg, #1e1b4b, #312e81)',
            padding: '12px 16px',
            display: 'flex', alignItems: 'center', gap: 12,
            boxShadow: '0 -4px 20px rgba(0,0,0,0.3)',
            animation: 'slideUp 0.3s ease-out',
        }}>
            <style>{`
                @keyframes slideUp {
                    from { transform: translateY(100%); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            `}</style>

            <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: 'rgba(99, 102, 241, 0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
            }}>
                <Download size={20} style={{ color: '#a5b4fc' }} />
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#fff' }}>
                    Instalar SFlow
                </div>
                <div style={{ fontSize: '0.72rem', color: '#a5b4fc', marginTop: 1 }}>
                    {isIOS
                        ? <>Toque em <Share size={11} style={{ display: 'inline', verticalAlign: 'middle' }} /> e depois &quot;Adicionar à Tela Inicio&quot;</>
                        : 'Acesse rápido direto da tela inicial'
                    }
                </div>
            </div>

            {!isIOS && deferredPrompt && (
                <button
                    onClick={handleInstall}
                    style={{
                        padding: '6px 14px', borderRadius: 8, border: 'none',
                        background: '#6366f1', color: '#fff', fontWeight: 700,
                        fontSize: '0.8rem', cursor: 'pointer', flexShrink: 0,
                    }}
                >
                    Instalar
                </button>
            )}

            <button
                onClick={handleDismiss}
                style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#a5b4fc', padding: 4, display: 'flex', flexShrink: 0,
                }}
            >
                <X size={18} />
            </button>
        </div>
    );
}
