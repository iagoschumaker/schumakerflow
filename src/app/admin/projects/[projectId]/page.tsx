'use client';

import { useEffect, useState } from 'react';
import { useToast } from '@/components/Toast';
import { useParams, useRouter } from 'next/navigation';
import {
    ArrowLeft, Film, Image, FileText, FileSpreadsheet, File, Trash2,
    Loader2, Eye, EyeOff, Download, ExternalLink, Clock, Calendar,
    FolderOpen, ChevronDown, ChevronUp, Search, Filter, X, Upload, CheckCircle,
    Link2, Copy, Trash
} from 'lucide-react';

interface FileItem {
    id: string;
    name: string;
    kind: string;
    mimeType: string | null;
    driveFileId: string | null;
    sizeBytes: number;
    isVisible: boolean;
    createdAt: string;
    publishedAt: string | null;
    _count: { downloadEvents: number };
}

interface ProjectDetail {
    id: string;
    name: string;
    description: string | null;
    status: string;
    createdAt: string;
    driveFolderId: string | null;
    client: { name: string };
    files: FileItem[];
    _count: { files: number };
}

type FilterPreset = 'all' | 'today' | 'week' | 'month' | 'year' | 'custom';

export default function ProjectDetailPage() {
    const params = useParams();
    const router = useRouter();
    const projectId = params.projectId as string;

    const [project, setProject] = useState<ProjectDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [expandedFile, setExpandedFile] = useState<string | null>(null);
    const [searchText, setSearchText] = useState('');

    // Upload state
    const [uploadFiles, setUploadFiles] = useState<File[]>([]);
    const [uploadKind, setUploadKind] = useState('FINAL');
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
    const [dragOver, setDragOver] = useState(false);
    const fileInputRef = useState<HTMLInputElement | null>(null);

    const handleUpload = async () => {
        if (!uploadFiles.length || !project) return;
        setUploading(true);
        const results: string[] = [];

        for (const file of uploadFiles) {
            setUploadProgress(prev => ({ ...prev, [file.name]: 0 }));
            try {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('projectId', project.id);
                formData.append('kind', uploadKind);
                formData.append('isVisible', 'true');

                const xhr = new XMLHttpRequest();
                await new Promise<void>((resolve, reject) => {
                    xhr.upload.onprogress = (e) => {
                        if (e.lengthComputable) {
                            setUploadProgress(prev => ({ ...prev, [file.name]: Math.round((e.loaded / e.total) * 100) }));
                        }
                    };
                    xhr.onload = () => {
                        if (xhr.status >= 200 && xhr.status < 300) {
                            results.push(file.name);
                            resolve();
                        } else {
                            reject(new Error(`Upload failed: ${xhr.statusText}`));
                        }
                    };
                    xhr.onerror = () => reject(new Error('Upload failed'));
                    xhr.open('POST', '/api/admin/files');
                    xhr.send(formData);
                });
            } catch (e) {
                showToast(`Erro no upload de ${file.name}`, 'error');
            }
        }

        if (results.length > 0) {
            showToast(`${results.length} arquivo(s) enviado(s) com sucesso!`, 'success');
        }
        setUploadFiles([]);
        setUploadProgress({});
        setUploading(false);
        loadProject();
    };

    const handleFileDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const files = Array.from(e.dataTransfer.files);
        if (files.length) setUploadFiles(prev => [...prev, ...files]);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length) setUploadFiles(prev => [...prev, ...files]);
        e.target.value = '';
    };

    // Date filter — default: current month
    const now = new Date();
    const [filterPreset, setFilterPreset] = useState<FilterPreset>('month');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');

    const loadProject = async () => {
        const res = await fetch(`/api/admin/projects/${projectId}`);
        const data = await res.json();
        if (data.data) setProject(data.data);
        setLoading(false);
    };

    useEffect(() => { loadProject(); loadShareLinks(); }, [projectId]);

    const { showToast, showConfirm } = useToast();

    // Share link state
    const [shareLinks, setShareLinks] = useState<Array<{ id: string; token: string; label: string | null; expiresAt: string; isActive: boolean; downloadCount: number; viewCount: number; shareUrl?: string }>>([]);
    const [shareLoading, setShareLoading] = useState(false);
    const [showSharePanel, setShowSharePanel] = useState(false);

    const loadShareLinks = async () => {
        try {
            const res = await fetch(`/api/admin/projects/${projectId}/share`);
            const d = await res.json();
            if (d.data) setShareLinks(d.data.filter((l: any) => l.isActive));
        } catch { /* */ }
    };

    const generateShareLink = async (days: number = 7) => {
        setShareLoading(true);
        try {
            const res = await fetch(`/api/admin/projects/${projectId}/share`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ expiresInDays: days }),
            });
            const d = await res.json();
            if (d.data?.shareUrl) {
                await navigator.clipboard.writeText(d.data.shareUrl);
                showToast('Link copiado para a área de transferência!', 'success');
                loadShareLinks();
            }
        } catch {
            showToast('Erro ao gerar link', 'error');
        }
        setShareLoading(false);
    };

    const deactivateShareLink = async (linkId: string) => {
        await fetch(`/api/admin/projects/${projectId}/share?id=${linkId}`, { method: 'DELETE' });
        showToast('Link desativado', 'success');
        loadShareLinks();
    };

    const handleDelete = async (fileId: string) => {
        const ok = await showConfirm({
            title: 'Excluir Arquivo',
            message: 'Tem certeza? O arquivo será removido do sistema e do Google Drive.',
            confirmText: 'Excluir',
            variant: 'danger',
        });
        if (!ok) return;
        setDeleting(fileId);
        try {
            await fetch(`/api/admin/files/${fileId}`, { method: 'DELETE' });
            showToast('Arquivo excluído com sucesso!', 'success');
            loadProject();
        } finally { setDeleting(null); }
    };

    const toggleVisibility = async (f: FileItem) => {
        await fetch(`/api/admin/files/${f.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isVisible: !f.isVisible }),
        });
        loadProject();
    };

    const formatSize = (bytes: number) => {
        if (!bytes) return '—';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
        return (bytes / 1073741824).toFixed(2) + ' GB';
    };

    const kindLabel = (k: string) => {
        const map: Record<string, string> = { PREVIEW: 'Preview', FINAL: 'Final', RAW: 'Bruto', OTHER: 'Outro' };
        return map[k] || k;
    };

    const kindColor = (k: string) => {
        const map: Record<string, string> = {
            PREVIEW: '#f59e0b', FINAL: '#10b981', RAW: '#6366f1', OTHER: '#6b7280'
        };
        return map[k] || '#6b7280';
    };

    const statusLabel = (s: string) => {
        const map: Record<string, string> = { DRAFT: 'Rascunho', IN_PRODUCTION: 'Em Produção', IN_REVIEW: 'Em Revisão', DELIVERED: 'Entregue', ARCHIVED: 'Arquivado' };
        return map[s] || s;
    };

    const statusColor = (s: string) => {
        const map: Record<string, string> = { DRAFT: '#6b7280', IN_PRODUCTION: '#3b82f6', IN_REVIEW: '#f59e0b', DELIVERED: '#10b981', ARCHIVED: '#6b7280' };
        return map[s] || '#6b7280';
    };

    const getFileIcon = (mimeType: string | null) => {
        const mime = mimeType || '';
        if (mime.startsWith('video/')) return <Film size={22} style={{ color: '#8b5cf6' }} />;
        if (mime.startsWith('image/')) return <Image size={22} style={{ color: '#06b6d4' }} />;
        if (mime.includes('spreadsheet') || mime.includes('excel')) return <FileSpreadsheet size={22} style={{ color: '#10b981' }} />;
        if (mime.includes('pdf') || mime.includes('document') || mime.includes('word')) return <FileText size={22} style={{ color: '#ef4444' }} />;
        return <File size={22} style={{ color: '#6b7280' }} />;
    };

    const getPreviewUrl = (f: FileItem) => {
        if (f.driveFileId && !f.driveFileId.startsWith('mock_')) {
            return `https://drive.google.com/thumbnail?id=${f.driveFileId}&sz=w600`;
        }
        return null;
    };

    const getDriveUrl = (f: FileItem) => {
        if (f.driveFileId && !f.driveFileId.startsWith('mock_')) {
            return `https://drive.google.com/file/d/${f.driveFileId}/view`;
        }
        return null;
    };

    const formatDate = (d: string) => {
        const date = new Date(d);
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const formatTime = (d: string) => {
        const date = new Date(d);
        return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    };

    // Date range calculation
    const getDateRange = (): { from: Date | null; to: Date | null } => {
        switch (filterPreset) {
            case 'all': return { from: null, to: null };
            case 'today': {
                const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const end = new Date(d); end.setDate(end.getDate() + 1);
                return { from: d, to: end };
            }
            case 'week': {
                const d = new Date(now);
                d.setDate(d.getDate() - d.getDay()); // Sunday
                d.setHours(0, 0, 0, 0);
                const end = new Date(d); end.setDate(end.getDate() + 7);
                return { from: d, to: end };
            }
            case 'month': {
                const d = new Date(now.getFullYear(), now.getMonth(), 1);
                const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
                return { from: d, to: end };
            }
            case 'year': {
                const d = new Date(now.getFullYear(), 0, 1);
                const end = new Date(now.getFullYear() + 1, 0, 1);
                return { from: d, to: end };
            }
            case 'custom': {
                const from = customFrom ? new Date(customFrom + 'T00:00:00') : null;
                const to = customTo ? new Date(customTo + 'T23:59:59') : null;
                return { from, to };
            }
            default: return { from: null, to: null };
        }
    };

    // Filter files
    const filterFiles = (files: FileItem[]) => {
        const { from, to } = getDateRange();
        return files.filter(f => {
            const d = f.publishedAt ? new Date(f.publishedAt) : new Date(f.createdAt);
            if (from && d < from) return false;
            if (to && d > to) return false;
            if (searchText) {
                const s = searchText.toLowerCase();
                if (!f.name.toLowerCase().includes(s) && !kindLabel(f.kind).toLowerCase().includes(s)) return false;
            }
            return true;
        });
    };

    const filteredFiles = project ? filterFiles(project.files) : [];

    // Group filtered files by date
    const groupedFiles: Record<string, FileItem[]> = {};
    for (const file of filteredFiles) {
        const dateSource = file.publishedAt || file.createdAt;
        const key = new Date(dateSource).toLocaleDateString('pt-BR');
        if (!groupedFiles[key]) groupedFiles[key] = [];
        groupedFiles[key].push(file);
    }

    const presetLabel = (p: FilterPreset) => {
        const map: Record<FilterPreset, string> = {
            all: 'Todos', today: 'Hoje', week: 'Semana', month: 'Este Mês', year: 'Este Ano', custom: 'Personalizado'
        };
        return map[p];
    };

    if (loading) return <div className="page-content"><div className="card animate-pulse" style={{ height: 400 }} /></div>;
    if (!project) return <div className="page-content"><div className="card"><p>Projeto não encontrado.</p></div></div>;

    return (
        <div>
            {/* Header */}
            <div className="page-header">
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                    <button
                        onClick={() => router.push('/admin/projects')}
                        className="btn btn-secondary"
                        style={{ padding: '8px 12px', flexShrink: 0 }}
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                            <h1 style={{ margin: 0 }}>{project.name}</h1>
                            <span style={{
                                padding: '3px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600,
                                backgroundColor: `${statusColor(project.status)}18`, color: statusColor(project.status),
                            }}>
                                {statusLabel(project.status)}
                            </span>
                            <button
                                onClick={() => setShowSharePanel(!showSharePanel)}
                                className="btn btn-sm"
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px',
                                    background: '#8b5cf620', border: '1px solid #8b5cf640', color: '#8b5cf6', fontWeight: 600, fontSize: '0.78rem',
                                }}
                            >
                                <Link2 size={14} /> Compartilhar
                            </button>
                        </div>
                        <p className="text-muted" style={{ marginTop: 4 }}>
                            {project.client?.name} • {project._count.files} arquivo(s)
                        </p>

                        {/* Share Panel */}
                        {showSharePanel && (
                            <div style={{
                                marginTop: 12, padding: 14, borderRadius: 'var(--radius-md)',
                                background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                                    <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Links temporários</span>
                                    <button
                                        onClick={() => generateShareLink(7)}
                                        disabled={shareLoading}
                                        className="btn btn-sm"
                                        style={{
                                            background: '#8b5cf6', border: 'none', color: '#fff', fontWeight: 600,
                                            display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', fontSize: '0.78rem',
                                        }}
                                    >
                                        {shareLoading ? <Loader2 size={13} className="animate-spin" /> : <Link2 size={13} />}
                                        Gerar link (7 dias)
                                    </button>
                                    <button
                                        onClick={() => generateShareLink(30)}
                                        disabled={shareLoading}
                                        className="btn btn-sm"
                                        style={{
                                            background: '#6366f1', border: 'none', color: '#fff', fontWeight: 600,
                                            display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', fontSize: '0.78rem',
                                        }}
                                    >
                                        30 dias
                                    </button>
                                </div>

                                {shareLinks.length > 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        {shareLinks.map(link => {
                                            const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
                                            const url = `${baseUrl}/share/${link.token}`;
                                            const expires = new Date(link.expiresAt);
                                            const daysLeft = Math.max(0, Math.ceil((expires.getTime() - Date.now()) / (86400000)));
                                            const expired = daysLeft <= 0;

                                            return (
                                                <div key={link.id} style={{
                                                    display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem',
                                                    padding: '8px 10px', borderRadius: 8, background: 'var(--color-bg)',
                                                    border: '1px solid var(--color-border)', flexWrap: 'wrap',
                                                }}>
                                                    <Link2 size={13} style={{ color: expired ? '#ef4444' : '#8b5cf6', flexShrink: 0 }} />
                                                    <span style={{
                                                        flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                        color: expired ? '#6b7280' : 'var(--color-text)', minWidth: 100,
                                                    }}>
                                                        {url}
                                                    </span>
                                                    <span style={{
                                                        fontSize: '0.7rem', fontWeight: 600, flexShrink: 0,
                                                        color: expired ? '#ef4444' : daysLeft <= 2 ? '#f59e0b' : '#22c55e',
                                                    }}>
                                                        {expired ? 'Expirado' : `${daysLeft}d restante(s)`}
                                                    </span>
                                                    <span style={{ fontSize: '0.68rem', color: '#6b7280', flexShrink: 0 }}>
                                                        {link.viewCount} visita(s) • {link.downloadCount} download(s)
                                                    </span>
                                                    <button
                                                        onClick={async () => {
                                                            await navigator.clipboard.writeText(url);
                                                            showToast('Link copiado!', 'success');
                                                        }}
                                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8b5cf6', padding: 3, display: 'flex', flexShrink: 0 }}
                                                        title="Copiar link"
                                                    >
                                                        <Copy size={13} />
                                                    </button>
                                                    <button
                                                        onClick={() => deactivateShareLink(link.id)}
                                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 3, display: 'flex', flexShrink: 0 }}
                                                        title="Desativar link"
                                                    >
                                                        <Trash size={13} />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: 0 }}>
                                        Nenhum link ativo. Gere um link para compartilhar com clientes sem conta.
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="page-content">
                {/* Upload Zone */}
                <div
                    className="card"
                    style={{
                        marginBottom: 'var(--space-4)', padding: 'var(--space-3) var(--space-4)',
                        border: dragOver ? '2px dashed var(--color-primary)' : '2px dashed var(--color-border)',
                        background: dragOver ? 'rgba(99,102,241,0.05)' : 'transparent',
                        transition: 'all 0.2s',
                    }}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleFileDrop}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
                        <Upload size={18} style={{ color: 'var(--color-primary)' }} />
                        <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Upload para este projeto</span>

                        <select
                            value={uploadKind}
                            onChange={(e) => setUploadKind(e.target.value)}
                            style={{
                                padding: '4px 10px', borderRadius: 6, fontSize: '0.78rem', fontWeight: 600,
                                border: '1px solid var(--color-border)', background: 'var(--color-bg)',
                                color: 'var(--color-text)', cursor: 'pointer',
                            }}
                        >
                            <option value="PREVIEW">Preview</option>
                            <option value="FINAL">Final</option>
                            <option value="RAW">Bruto</option>
                            <option value="OTHER">Outro</option>
                        </select>

                        <label
                            style={{
                                padding: '5px 14px', borderRadius: 'var(--radius-md)', cursor: 'pointer',
                                background: 'var(--color-primary)', color: '#fff', fontWeight: 600,
                                fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 5,
                            }}
                        >
                            <Upload size={14} /> Escolher arquivos
                            <input type="file" multiple hidden onChange={handleFileSelect} />
                        </label>

                        {uploadFiles.length > 0 && !uploading && (
                            <button
                                className="btn btn-sm"
                                onClick={handleUpload}
                                style={{
                                    background: '#22c55e', border: 'none', color: '#fff', fontWeight: 700,
                                    display: 'flex', alignItems: 'center', gap: 5, padding: '5px 14px',
                                }}
                            >
                                <CheckCircle size={14} /> Enviar {uploadFiles.length}
                            </button>
                        )}

                        {uploading && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.8rem', color: 'var(--color-primary)' }}>
                                <Loader2 size={14} className="animate-spin" /> Enviando...
                            </span>
                        )}
                    </div>

                    {/* Queued files */}
                    {uploadFiles.length > 0 && (
                        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {uploadFiles.map((f, i) => (
                                <div key={i} style={{
                                    display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem',
                                    padding: '4px 8px', borderRadius: 6, background: 'var(--color-bg-secondary)',
                                }}>
                                    <File size={12} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                                    <span style={{ color: 'var(--color-text-muted)', fontSize: '0.7rem', flexShrink: 0 }}>
                                        {(f.size / (1024 * 1024)).toFixed(1)} MB
                                    </span>
                                    {uploadProgress[f.name] !== undefined && uploadProgress[f.name] < 100 && (
                                        <div style={{ width: 60, height: 5, borderRadius: 3, background: 'var(--color-border)', overflow: 'hidden', flexShrink: 0 }}>
                                            <div style={{ width: `${uploadProgress[f.name]}%`, height: '100%', background: 'var(--color-primary)', transition: 'width 0.2s' }} />
                                        </div>
                                    )}
                                    {uploadProgress[f.name] === 100 && (
                                        <CheckCircle size={13} style={{ color: '#22c55e', flexShrink: 0 }} />
                                    )}
                                    {!uploading && (
                                        <button
                                            onClick={() => setUploadFiles(prev => prev.filter((_, j) => j !== i))}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 2, display: 'flex', flexShrink: 0 }}
                                        >
                                            <X size={12} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {uploadFiles.length === 0 && (
                        <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', margin: '6px 0 0', textAlign: 'center' }}>
                            Arraste arquivos aqui ou clique em &quot;Escolher arquivos&quot;
                        </p>
                    )}
                </div>

                {/* Filter bar */}
                <div className="card" style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-3) var(--space-4)' }}>
                    {/* Preset buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: filterPreset === 'custom' ? 'var(--space-3)' : 0 }}>
                        <Filter size={16} style={{ color: 'var(--color-text-muted)', marginRight: 4 }} />
                        {(['all', 'today', 'week', 'month', 'year', 'custom'] as FilterPreset[]).map(p => (
                            <button
                                key={p}
                                onClick={() => setFilterPreset(p)}
                                style={{
                                    padding: '4px 12px', borderRadius: 20, fontSize: '0.78rem', fontWeight: 600,
                                    border: filterPreset === p ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                                    background: filterPreset === p ? 'var(--color-primary)' : 'transparent',
                                    color: filterPreset === p ? '#fff' : 'var(--color-text-muted)',
                                    cursor: 'pointer', transition: 'all 0.15s',
                                }}
                            >
                                {presetLabel(p)}
                            </button>
                        ))}

                        <div style={{ flex: 1 }} />

                        {/* Search within files */}
                        <div style={{ position: 'relative', minWidth: 140, flex: '1 1 140px' }}>
                            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', pointerEvents: 'none' }} />
                            <input
                                value={searchText}
                                onChange={(e) => setSearchText(e.target.value)}
                                placeholder="Buscar arquivos..."
                                style={{
                                    width: '100%', padding: '5px 10px 5px 30px',
                                    border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
                                    fontSize: '0.8rem', background: 'var(--color-bg)', outline: 'none', color: 'var(--color-text)',
                                }}
                                onFocus={(e) => { e.target.style.borderColor = 'var(--color-primary)'; }}
                                onBlur={(e) => { e.target.style.borderColor = 'var(--color-border)'; }}
                            />
                            {searchText && <button onClick={() => setSearchText('')} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: 'var(--color-text-muted)', padding: 2 }}><X size={12} /></button>}
                        </div>

                        {/* Count */}
                        <span className="text-xs text-muted" style={{ whiteSpace: 'nowrap' }}>
                            {filteredFiles.length} de {project.files.length} arquivo(s)
                        </span>
                    </div>

                    {/* Custom date range */}
                    {filterPreset === 'custom' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                            <label className="text-sm" style={{ fontWeight: 500 }}>De:</label>
                            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="form-input" style={{ width: 'auto', padding: '4px 8px', fontSize: '0.8rem' }} />
                            <label className="text-sm" style={{ fontWeight: 500 }}>Até:</label>
                            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="form-input" style={{ width: 'auto', padding: '4px 8px', fontSize: '0.8rem' }} />
                            {(customFrom || customTo) && (
                                <button onClick={() => { setCustomFrom(''); setCustomTo(''); }} className="btn btn-sm btn-secondary" style={{ padding: '3px 8px', fontSize: '0.75rem' }}>Limpar</button>
                            )}
                        </div>
                    )}
                </div>

                {/* Empty state */}
                {filteredFiles.length === 0 ? (
                    <div className="card empty-state">
                        <div className="empty-icon"><FolderOpen size={40} /></div>
                        <h3>{project.files.length === 0 ? 'Nenhum arquivo neste projeto' : 'Nenhum arquivo neste período'}</h3>
                        <p className="text-sm text-muted" style={{ marginBottom: 16 }}>
                            {project.files.length === 0 ? 'Faça upload de arquivos na página de Upload.' : 'Tente mudar o filtro de período ou busca.'}
                        </p>
                        {project.files.length === 0 ? (
                            <button className="btn btn-primary" onClick={() => router.push('/admin/files')}>Ir para Upload</button>
                        ) : (
                            <button className="btn btn-secondary" onClick={() => { setFilterPreset('all'); setSearchText(''); }}>Limpar Filtros</button>
                        )}
                    </div>
                ) : (
                    /* Timeline */
                    <div style={{ position: 'relative' }}>
                        {/* Timeline line */}
                        <div style={{
                            position: 'absolute', left: 20, top: 0, bottom: 0, width: 2,
                            background: 'linear-gradient(to bottom, var(--color-primary), var(--color-border))',
                            borderRadius: 1,
                        }} />

                        {Object.entries(groupedFiles).map(([dateStr, files]) => (
                            <div key={dateStr} style={{ position: 'relative', marginBottom: 'var(--space-6)' }}>
                                {/* Date label */}
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                                    marginBottom: 'var(--space-4)', position: 'relative', zIndex: 1,
                                }}>
                                    <div style={{
                                        width: 42, height: 42, borderRadius: '50%',
                                        background: 'var(--color-primary)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        flexShrink: 0, boxShadow: '0 0 0 4px var(--color-bg)',
                                    }}>
                                        <Calendar size={18} style={{ color: '#fff' }} />
                                    </div>
                                    <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-text)' }}>
                                        {dateStr}
                                    </span>
                                    <span className="text-sm text-muted">({files.length} arquivo{files.length > 1 ? 's' : ''})</span>
                                </div>

                                {/* Files for this date */}
                                <div style={{ marginLeft: 56 }}>
                                    {files.map((file) => {
                                        const previewUrl = getPreviewUrl(file);
                                        const driveUrl = getDriveUrl(file);
                                        const isExpanded = expandedFile === file.id;

                                        return (
                                            <div
                                                key={file.id}
                                                className="card"
                                                style={{
                                                    marginBottom: 'var(--space-3)',
                                                    padding: 0,
                                                    overflow: 'hidden',
                                                    borderLeft: `4px solid ${kindColor(file.kind)}`,
                                                    transition: 'box-shadow 0.2s ease',
                                                }}
                                            >
                                                {/* Main row */}
                                                <div
                                                    style={{
                                                        display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                                                        padding: 'var(--space-3) var(--space-4)',
                                                        cursor: 'pointer',
                                                    }}
                                                    onClick={() => setExpandedFile(isExpanded ? null : file.id)}
                                                >
                                                    {/* File icon */}
                                                    <div style={{
                                                        width: 44, height: 44, borderRadius: 'var(--radius-md)',
                                                        background: 'var(--color-bg-secondary)',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        flexShrink: 0,
                                                    }}>
                                                        {getFileIcon(file.mimeType)}
                                                    </div>

                                                    {/* File info */}
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ fontWeight: 600, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                            {file.name}
                                                        </div>
                                                        <div className="text-xs text-muted" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                                                            <Clock size={12} /> {formatTime(file.publishedAt || file.createdAt)}
                                                            <span>•</span>
                                                            {formatSize(file.sizeBytes)}
                                                            <span>•</span>
                                                            {file._count.downloadEvents} download{file._count.downloadEvents !== 1 ? 's' : ''}
                                                        </div>
                                                    </div>

                                                    {/* Badges & Actions */}
                                                    <span style={{
                                                        padding: '2px 10px', borderRadius: 12, fontSize: '0.7rem', fontWeight: 600,
                                                        backgroundColor: `${kindColor(file.kind)}18`, color: kindColor(file.kind),
                                                    }}>
                                                        {kindLabel(file.kind)}
                                                    </span>

                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); toggleVisibility(file); }}
                                                        style={{
                                                            background: 'none', border: 'none', cursor: 'pointer', display: 'flex',
                                                            color: file.isVisible ? '#10b981' : '#9ca3af', padding: 4,
                                                        }}
                                                        title={file.isVisible ? 'Visível ao cliente' : 'Oculto do cliente'}
                                                    >
                                                        {file.isVisible ? <Eye size={16} /> : <EyeOff size={16} />}
                                                    </button>

                                                    {isExpanded ? <ChevronUp size={16} style={{ color: '#9ca3af' }} /> : <ChevronDown size={16} style={{ color: '#9ca3af' }} />}
                                                </div>

                                                {/* Expanded preview */}
                                                {isExpanded && (
                                                    <div style={{
                                                        borderTop: '1px solid var(--color-border)',
                                                        background: 'var(--color-bg-secondary)',
                                                    }}>
                                                        {/* Preview area */}
                                                        {file.driveFileId && !file.driveFileId.startsWith('mock_') && (
                                                            <div style={{
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                overflow: 'hidden', background: '#000',
                                                                ...(file.mimeType?.startsWith('video/') ? {} : { maxHeight: 280 }),
                                                            }}>
                                                                {file.mimeType?.startsWith('video/') ? (
                                                                    <video
                                                                        controls
                                                                        preload="metadata"
                                                                        style={{ width: '100%', maxHeight: 500, background: '#000' }}
                                                                        playsInline
                                                                    >
                                                                        <source src={`/api/files/${file.id}/stream`} type={file.mimeType || 'video/mp4'} />
                                                                        Seu navegador não suporta reprodução de vídeo.
                                                                    </video>
                                                                ) : file.mimeType?.startsWith('image/') ? (
                                                                    <img
                                                                        src={`https://lh3.googleusercontent.com/d/${file.driveFileId}`}
                                                                        alt={file.name}
                                                                        style={{ maxWidth: '100%', maxHeight: 280, objectFit: 'contain' }}
                                                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                                    />
                                                                ) : (
                                                                    <iframe
                                                                        src={`https://drive.google.com/file/d/${file.driveFileId}/preview`}
                                                                        style={{ width: '100%', height: 280, border: 'none' }}
                                                                    />
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* Actions bar */}
                                                        <div style={{
                                                            display: 'flex', gap: 'var(--space-2)', padding: 'var(--space-3) var(--space-4)',
                                                            flexWrap: 'wrap',
                                                        }}>
                                                            {driveUrl && (
                                                                <a
                                                                    href={driveUrl}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="btn btn-sm btn-secondary"
                                                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none', padding: '6px 12px' }}
                                                                >
                                                                    <ExternalLink size={14} /> Abrir no Drive
                                                                </a>
                                                            )}
                                                            <a
                                                                href={`/api/files/${file.id}/download`}
                                                                className="btn btn-sm btn-secondary"
                                                                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, textDecoration: 'none', padding: '6px 12px' }}
                                                            >
                                                                <Download size={14} /> Baixar
                                                            </a>
                                                            <div style={{ flex: 1 }} />
                                                            <button
                                                                className="btn btn-sm btn-danger"
                                                                onClick={() => handleDelete(file.id)}
                                                                disabled={deleting === file.id}
                                                                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px' }}
                                                            >
                                                                {deleting === file.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                                                Excluir
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
