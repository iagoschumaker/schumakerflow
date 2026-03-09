'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LayoutDashboard, Users, FolderKanban, FileText, Download, DollarSign, Settings, Shield, Zap, LogOut, Menu, ChevronDown, Receipt, TrendingUp, CreditCard } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';
import { ToastProvider } from '@/components/Toast';

interface UserInfo {
    userId: string;
    name: string;
    email: string;
    role: string;
    tenantId?: string;
}

interface MenuItem {
    href: string;
    label: string;
    icon: React.ReactNode;
    children?: { href: string; label: string; icon: React.ReactNode }[];
}

const adminMenu: MenuItem[] = [
    { href: '/admin', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { href: '/admin/clients', label: 'Clientes', icon: <Users size={18} /> },
    { href: '/admin/projects', label: 'Projetos', icon: <FolderKanban size={18} /> },
    { href: '/admin/files', label: 'Arquivos', icon: <FileText size={18} /> },
    { href: '/admin/downloads', label: 'Downloads', icon: <Download size={18} /> },
    {
        href: '/admin/finance', label: 'Financeiro', icon: <DollarSign size={18} />,
        children: [
            { href: '/admin/finance/receivables', label: 'Recebíveis', icon: <Receipt size={16} /> },
            { href: '/admin/finance/expenses', label: 'Despesas', icon: <CreditCard size={16} /> },
            { href: '/admin/finance/cashflow', label: 'Fluxo Financeiro', icon: <TrendingUp size={16} /> },
        ],
    },
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
    const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set(pathname.startsWith('/admin/finance') ? ['/admin/finance'] : []));

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
                        <h1><img src="/icons/favicon-512-white.png" alt="SF" style={{ width: 'auto', height: 28, display: 'inline', verticalAlign: 'middle', marginRight: '8px' }} />SFlow</h1>
                        <span className="brand-sub">Gestão de Mídia</span>
                    </div>

                    <nav className="sidebar-nav">
                        <div className="sidebar-section">
                            <div className="sidebar-section-title">Menu Principal</div>
                            {adminMenu.map((item) => {
                                if (item.children) {
                                    const isExpanded = expandedMenus.has(item.href);
                                    const isActive = pathname.startsWith(item.href);
                                    return (
                                        <div key={item.href}>
                                            <button
                                                className={`sidebar-link ${isActive ? 'active' : ''}`}
                                                onClick={() => setExpandedMenus(prev => {
                                                    const next = new Set(prev);
                                                    if (next.has(item.href)) next.delete(item.href); else next.add(item.href);
                                                    return next;
                                                })}
                                                style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', font: 'inherit', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                                            >
                                                <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                    <span className="icon">{item.icon}</span>
                                                    {item.label}
                                                </span>
                                                <ChevronDown size={14} style={{ transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', opacity: 0.5 }} />
                                            </button>
                                            {isExpanded && (
                                                <div style={{ paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 2, marginTop: 2 }}>
                                                    {item.children.map(sub => (
                                                        <a
                                                            key={sub.href}
                                                            href={sub.href}
                                                            className={`sidebar-link ${pathname === sub.href ? 'active' : ''}`}
                                                            onClick={() => setSidebarOpen(false)}
                                                            style={{ fontSize: '0.85rem', padding: '6px 12px' }}
                                                        >
                                                            <span className="icon">{sub.icon}</span>
                                                            {sub.label}
                                                        </a>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                }
                                return (
                                    <a
                                        key={item.href}
                                        href={item.href}
                                        className={`sidebar-link ${pathname === item.href ? 'active' : ''}`}
                                        onClick={() => setSidebarOpen(false)}
                                    >
                                        <span className="icon">{item.icon}</span>
                                        {item.label}
                                    </a>
                                );
                            })}
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
                        <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>SFlow</span>
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
