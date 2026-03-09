'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Shield, Building2, BarChart3, Zap, LogOut, Menu, Settings, ArrowLeftRight } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';
import { ToastProvider } from '@/components/Toast';

interface UserInfo {
    userId: string;
    name: string;
    email: string;
    role: string;
}

const superMenu = [
    { href: '/superadmin', label: 'Dashboard', icon: <BarChart3 size={18} /> },
    { href: '/superadmin/tenants', label: 'Flows', icon: <Building2 size={18} /> },
    { href: '/superadmin/settings', label: 'Configurações', icon: <Settings size={18} /> },
];

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const [user, setUser] = useState<UserInfo | null>(null);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    useEffect(() => {
        fetch('/api/auth/me')
            .then((r) => r.json())
            .then((d) => {
                if (d.data?.role === 'SUPERADMIN') setUser(d.data);
                else router.push('/login');
            })
            .catch(() => router.push('/login'));
    }, [router]);

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/login');
    };

    return (
        <ToastProvider>
            <div className="app-layout">
                {/* Mobile overlay */}
                {sidebarOpen && (
                    <div
                        style={{
                            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
                            zIndex: 30,
                        }}
                        onClick={() => setSidebarOpen(false)}
                    />
                )}

                {/* Sidebar */}
                <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
                    <div className="sidebar-brand">
                        <h1><img src="/icons/favicon-512-white.png" alt="SF" style={{ width: 32, height: 32, display: 'inline', verticalAlign: 'middle', marginRight: '8px' }} />SFlow</h1>
                        <span className="brand-sub">SuperAdmin</span>
                    </div>

                    <nav className="sidebar-nav">
                        <div className="sidebar-section">
                            <div className="sidebar-section-title">Gestão Global</div>
                            {superMenu.map((item) => (
                                <a
                                    key={item.href}
                                    href={item.href}
                                    className={`sidebar-link ${pathname === item.href ? 'active' : ''}`}
                                    onClick={() => setSidebarOpen(false)}
                                >
                                    <span className="icon">{item.icon}</span>
                                    {item.label}
                                </a>
                            ))}
                        </div>

                        <div className="sidebar-section">
                            <div className="sidebar-section-title">Sessão</div>
                            <a
                                href="#"
                                className="sidebar-link"
                                onClick={async (e) => {
                                    e.preventDefault();
                                    await fetch('/api/auth/logout', { method: 'POST' });
                                    router.push('/login');
                                }}
                            >
                                <span className="icon"><ArrowLeftRight size={18} /></span>
                                Trocar Sessão
                            </a>
                        </div>
                    </nav>

                    <div className="sidebar-user">
                        <div className="sidebar-user-avatar">
                            {user?.name?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <div className="sidebar-user-info">
                            <div className="sidebar-user-name">{user?.name || 'Carregando...'}</div>
                            <div className="sidebar-user-role">SUPERADMIN</div>
                        </div>
                        <ThemeToggle />
                        <button
                            onClick={handleLogout}
                            title="Sair"
                            style={{
                                background: 'none', border: 'none', color: 'var(--sidebar-text)',
                                cursor: 'pointer', fontSize: '1.2rem', padding: '4px',
                            }}
                        >
                            <LogOut size={18} />
                        </button>
                    </div>
                </aside>

                {/* Main content */}
                <main className="main-content">
                    {/* Mobile header */}
                    <div style={{
                        display: 'none',
                        padding: 'var(--space-3) var(--space-4)',
                        background: 'var(--sidebar-bg)',
                        color: 'white',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        position: 'sticky',
                        top: 0,
                        zIndex: 20,
                    }} className="mobile-header">
                        <button
                            onClick={() => setSidebarOpen(true)}
                            style={{ background: 'none', border: 'none', color: 'white', fontSize: '1.5rem', cursor: 'pointer', padding: '8px', minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                            <Menu size={22} />
                        </button>
                        <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>SuperAdmin</span>
                        <div style={{ width: '44px' }} />
                    </div>

                    {children}
                </main>

                <style>{`
        @media (max-width: 768px) {
          .mobile-header { display: flex !important; }
        }
      `}</style>
            </div>
        </ToastProvider>
    );
}
