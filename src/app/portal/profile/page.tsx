'use client';

import { useState, useEffect } from 'react';
import { User, Mail } from 'lucide-react';

export default function PortalProfilePage() {
    const [user, setUser] = useState<{ name: string; email: string } | null>(null);

    useEffect(() => {
        fetch('/api/auth/me')
            .then(r => r.json())
            .then(d => setUser(d.data));
    }, []);

    return (
        <div>
            <div className="page-header">
                <h1>Meus Dados</h1>
                <p>Visualize suas informações</p>
            </div>

            <div className="page-content">
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
            </div>
        </div>
    );
}
