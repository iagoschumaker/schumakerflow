'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LayoutDashboard, Users, FolderKanban, FileText, Download, DollarSign, Settings, Shield, Zap, LogOut, Menu } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';
import { ToastProvider } from '@/components/Toast';

interface UserInfo {
    userId: string;
    name: string;
    email: string;
    role: string;
    tenantId?: string;
}

const adminMenu = [
    { href: '/admin', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { href: '/admin/clients', label: 'Clientes', icon: <Users size={18} /> },
    { href: '/admin/projects', label: 'Projetos', icon: <FolderKanban size={18} /> },
    { href: '/admin/files', label: 'Arquivos', icon: <FileText size={18} /> },
    { href: '/admin/downloads', label: 'Downloads', icon: <Download size={18} /> },
    { href: '/admin/finance', label: 'Financeiro', icon: <DollarSign size={18} /> },
    { href: '/admin/settings', label: 'Configurações', icon: <Settings size={18} /> },
];

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const router = useRouter();
    const [user, setUser] = useState<UserInfo | null>(null);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    useEffect(() => {
        fetch('/api/auth/me')
            .then((r) => r.json())
            .then((d) => {
                if (d.data) setUser(d.data);
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
                        <h1><Zap size={20} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />Schumaker Flow</h1>
                        <span className="brand-sub">Client, Media & Finance Management</span>
                    </div>

                    <nav className="sidebar-nav">
                        <div className="sidebar-section">
                            <div className="sidebar-section-title">Menu Principal</div>
                            {adminMenu.map((item) => (
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

                        {user?.role === 'SUPERADMIN' && (
                            <div className="sidebar-section">
                                <div className="sidebar-section-title">Super Admin</div>
                                <a
                                    href="/superadmin"
                                    className={`sidebar-link ${pathname.startsWith('/superadmin') ? 'active' : ''}`}
                                >
                                    <span className="icon"><Shield size={18} /></span>
                                    Painel SuperAdmin
                                </a>
                            </div>
                        )}
                    </nav>

                    <div className="sidebar-user">
                        <div className="sidebar-user-avatar">
                            {user?.name?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <div className="sidebar-user-info">
                            <div className="sidebar-user-name">{user?.name || 'Carregando...'}</div>
                            <div className="sidebar-user-role">{user?.role?.replace('_', ' ') || ''}</div>
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
                        <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Schumaker Flow</span>
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
        </ToastProvider >
    );
}
