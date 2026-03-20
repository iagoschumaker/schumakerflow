'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Download, FileText, Film, Image, File, Clock, AlertTriangle, Loader2 } from 'lucide-react';

interface ShareFile {
    id: string;
    name: string;
    kind: string;
    mimeType: string | null;
    sizeBytes: number;
    createdAt: string;
}

interface ShareData {
    project: { name: string; clientName: string };
    tenant: { name: string; logoUrl: string | null; primaryColor: string | null };
    files: ShareFile[];
    label: string;
    expiresAt: string;
}

export default function SharePage() {
    const params = useParams();
    const token = params.token as string;

    const [data, setData] = useState<ShareData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [downloading, setDownloading] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`/api/share/${token}`);
                if (!res.ok) {
                    const d = await res.json().catch(() => ({}));
                    setError(d.error || 'Link inválido.');
                    setLoading(false);
                    return;
                }
                const d = await res.json();
                setData(d);
            } catch {
                setError('Erro ao carregar.');
            }
            setLoading(false);
        })();
    }, [token]);

    const formatSize = (bytes: number) => {
        if (!bytes) return '—';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
        return (bytes / 1073741824).toFixed(2) + ' GB';
    };

    const getIcon = (mime: string | null) => {
        if (!mime) return <File size={20} />;
        if (mime.startsWith('video/')) return <Film size={20} />;
        if (mime.startsWith('image/')) return <Image size={20} />;
        if (mime.includes('pdf')) return <FileText size={20} />;
        return <File size={20} />;
    };

    const kindLabel = (k: string) => {
        const map: Record<string, string> = { PREVIEW: 'Preview', FINAL: 'Final', RAW: 'Bruto', OTHER: 'Outro' };
        return map[k] || k;
    };

    const kindColor = (k: string) => {
        const map: Record<string, string> = { PREVIEW: '#f59e0b', FINAL: '#10b981', RAW: '#6366f1', OTHER: '#6b7280' };
        return map[k] || '#6b7280';
    };

    const handleDownload = async (file: ShareFile) => {
        setDownloading(file.id);
        try {
            // Use window.open for iOS compatibility
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
            if (isIOS) {
                window.open(`/api/files/${file.id}/download?share=${token}`, '_blank');
            } else {
                const res = await fetch(`/api/files/${file.id}/download?share=${token}`);
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = file.name;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }
        } catch { /* */ }
        setDownloading(null);
    };

    const primaryColor = data?.tenant?.primaryColor || '#6366f1';

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0f' }}>
                <Loader2 size={32} className="animate-spin" style={{ color: '#6366f1' }} />
            </div>
        );
    }

    if (error || !data) {
        return (
            <div style={{
                minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: '#0a0a0f', color: '#fff', textAlign: 'center', padding: 20,
            }}>
                <div>
                    <AlertTriangle size={48} style={{ color: '#ef4444', marginBottom: 16 }} />
                    <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 8 }}>
                        {error || 'Link inválido'}
                    </h2>
                    <p style={{ color: '#9ca3af', fontSize: '0.85rem' }}>
                        Este link pode ter expirado ou sido desativado.
                    </p>
                </div>
            </div>
        );
    }

    const expiresDate = data.expiresAt ? new Date(data.expiresAt) : null;
    const daysLeft = expiresDate ? Math.max(0, Math.ceil((expiresDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : null;

    return (
        <div style={{ minHeight: '100vh', background: '#0a0a0f', color: '#fff', padding: '20px 16px' }}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
                .share-page * { font-family: 'Inter', system-ui, sans-serif; box-sizing: border-box; }
                .share-file { background: #15151f; border: 1px solid #1f1f2e; border-radius: 12px; padding: 14px 16px; display: flex; align-items: center; gap: 14px; transition: all 0.15s; cursor: default; }
                .share-file:hover { background: #1a1a28; border-color: ${primaryColor}40; transform: translateY(-1px); }
                .share-dl-btn { background: ${primaryColor}; color: #fff; border: none; border-radius: 8px; padding: 8px 16px; font-weight: 600; font-size: 0.8rem; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all 0.15s; flex-shrink: 0; }
                .share-dl-btn:hover { filter: brightness(1.15); transform: scale(1.02); }
                .share-dl-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
                @media (max-width: 600px) { .share-file { flex-wrap: wrap; gap: 10px; } .share-dl-btn { width: 100%; justify-content: center; } }
            `}</style>

            <div className="share-page" style={{ maxWidth: 700, margin: '0 auto' }}>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                    {data.tenant?.logoUrl && (
                        <img src={data.tenant.logoUrl} alt={data.tenant.name} style={{ height: 40, marginBottom: 12, borderRadius: 8 }} />
                    )}
                    <h1 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 4 }}>
                        {data.project.name}
                    </h1>
                    <p style={{ color: '#9ca3af', fontSize: '0.85rem', marginBottom: 8 }}>
                        {data.project.clientName && `${data.project.clientName} • `}{data.tenant?.name}
                    </p>
                    {expiresDate && (
                        <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            padding: '4px 14px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 600,
                            background: daysLeft! <= 1 ? '#ef444420' : '#f59e0b18',
                            color: daysLeft! <= 1 ? '#ef4444' : '#f59e0b',
                        }}>
                            <Clock size={12} />
                            {daysLeft! <= 0 ? 'Expira hoje' : `Expira em ${daysLeft} dia(s)`}
                        </div>
                    )}
                </div>

                {/* Files */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#9ca3af', marginBottom: 4 }}>
                        {data.files.length} arquivo(s) disponíveis
                    </div>

                    {data.files.map(file => (
                        <div key={file.id} className="share-file">
                            <div style={{
                                width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                                background: `${kindColor(file.kind)}15`, display: 'flex',
                                alignItems: 'center', justifyContent: 'center', color: kindColor(file.kind),
                            }}>
                                {getIcon(file.mimeType)}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 600, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {file.name}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: '#6b7280', display: 'flex', gap: 10, marginTop: 2 }}>
                                    <span style={{ padding: '1px 6px', borderRadius: 4, background: `${kindColor(file.kind)}15`, color: kindColor(file.kind), fontWeight: 600 }}>
                                        {kindLabel(file.kind)}
                                    </span>
                                    <span>{formatSize(Number(file.sizeBytes))}</span>
                                </div>
                            </div>
                            <button
                                className="share-dl-btn"
                                onClick={() => handleDownload(file)}
                                disabled={downloading === file.id}
                            >
                                {downloading === file.id
                                    ? <Loader2 size={14} className="animate-spin" />
                                    : <Download size={14} />
                                }
                                Baixar
                            </button>
                        </div>
                    ))}

                    {data.files.length === 0 && (
                        <div style={{ textAlign: 'center', padding: 40, color: '#6b7280', fontSize: '0.85rem' }}>
                            Nenhum arquivo disponível.
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{ textAlign: 'center', marginTop: 40, color: '#4b5563', fontSize: '0.7rem' }}>
                    Powered by {data.tenant?.name}
                </div>
            </div>
        </div>
    );
}
