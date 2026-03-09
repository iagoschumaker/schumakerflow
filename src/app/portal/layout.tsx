'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Home, FolderKanban, DollarSign, Zap, LogOut, Menu, User } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';
import { ToastProvider } from '@/components/Toast';

interface UserInfo {
    name: string;
    email: string;
    role: string;
    clientId?: string;
}

const portalMenu = [
    { href: '/portal', label: 'Início', icon: <Home size={18} /> },
    { href: '/portal/projects', label: 'Projetos', icon: <FolderKanban size={18} /> },
    { href: '/portal/finance', label: 'Financeiro', icon: <DollarSign size={18} /> },
    { href: '/portal/profile', label: 'Meus Dados', icon: <User size={18} /> },
];

export default function PortalLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const [user, setUser] = useState<UserInfo | null>(null);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    useEffect(() => {
        fetch('/api/auth/me')
            .then((r) => r.json())
            .then((d) => { if (d.data) setUser(d.data); else router.push('/login'); })
            .catch(() => router.push('/login'));
    }, [router]);

    const handleLogout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        router.push('/login');
    };

    return (
        <ToastProvider>
            <div className="app-layout">
                {sidebarOpen && (
                    <div
                        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 30 }}
                        onClick={() => setSidebarOpen(false)}
                    />
                )}

                <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
                    <div className="sidebar-brand">
                        <h1><img src="/icons/favicon-512-white.png" alt="SF" style={{ width: 40, height: 40, display: 'inline', verticalAlign: 'middle', marginRight: '8px' }} />SFlow</h1>
                        <span className="brand-sub">Portal do Cliente</span>
                    </div>

                    <nav className="sidebar-nav">
                        <div className="sidebar-section">
                            {portalMenu.map((item) => (
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
                    </nav>

                    <div className="sidebar-user">
                        <div className="sidebar-user-avatar">
                            {user?.name?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <div className="sidebar-user-info">
                            <div className="sidebar-user-name">{user?.name || ''}</div>
                            <div className="sidebar-user-role">Cliente</div>
                        </div>
                        <ThemeToggle />
                        <button onClick={handleLogout} title="Sair" style={{ background: 'none', border: 'none', color: 'var(--sidebar-text)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><LogOut size={18} /></button>
                    </div>
                </aside>

                <main className="main-content">
                    <div className="mobile-header" style={{ display: 'none', padding: 'var(--space-3) var(--space-4)', background: 'var(--sidebar-bg)', color: 'var(--sidebar-text)', alignItems: 'center', justifyContent: 'space-between' }}>
                        <button onClick={() => setSidebarOpen(true)} style={{ background: 'none', border: 'none', color: 'var(--sidebar-text)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><Menu size={22} /></button>
                        <span style={{ fontWeight: 600 }}>Portal</span>
                        <div style={{ width: '24px' }} />
                    </div>
                    {children}
                </main>

                <style>{`@media (max-width: 768px) { .mobile-header { display: flex !important; } }`}</style>
            </div>
        </ToastProvider>
    );
}
