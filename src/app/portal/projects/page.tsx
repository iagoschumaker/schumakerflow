'use client';

import { useEffect, useState } from 'react';
import {
    FolderKanban, Sparkles, CheckCircle, Download, Loader2,
    Film, Image, FileText, FileSpreadsheet, File, Clock, Calendar,
    ChevronDown, ChevronUp, Search, Filter, X, Share2
} from 'lucide-react';
import { useToast } from '@/components/Toast';

interface FileItem {
    id: string;
    name: string;
    kind: string;
    mimeType: string | null;
    driveFileId: string | null;
    publishedAt: string | null;
    sizeBytes: string | null;
    isNew: boolean;
    lastDownload: { completedAt: string } | null;
}

interface Project {
    id: string;
    name: string;
    status: string;
    createdAt: string;
    client: { name: string };
    files: FileItem[];
    _count: { files: number };
}

type FilterPreset = 'all' | 'today' | 'week' | 'month' | 'year';

function formatSize(bytes: string | null) {
    if (!bytes) return '—';
    const n = Number(bytes);
    if (n < 1024) return `${n} B`;
    if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
    if (n < 1073741824) return `${(n / 1048576).toFixed(1)} MB`;
    return `${(n / 1073741824).toFixed(2)} GB`;
}

export default function PortalProjectsPage() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedProject, setExpandedProject] = useState<string | null>(null);
    const [expandedFile, setExpandedFile] = useState<string | null>(null);
    const [downloading, setDownloading] = useState<string | null>(null);
    const [sharing, setSharing] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [searchText, setSearchText] = useState('');
    const [filterPreset, setFilterPreset] = useState<FilterPreset>('all');

    const loadData = async () => {
        setLoading(true);
        const projRes = await fetch('/api/portal/projects');
        const projData = await projRes.json();
        setProjects(projData.data || []);
        setLoading(false);
    };

    useEffect(() => { loadData(); }, []);

    const { showToast } = useToast();

    const handleDownload = async (fileId: string) => {
        setDownloading(fileId);
        try {
            const res = await fetch(`/api/files/${fileId}/download`);
            if (!res.ok) {
                const err = await res.json();
                showToast(err.error || 'Erro ao baixar arquivo', 'error');
                return;
            }
            const blob = await res.blob();
            const contentDisposition = res.headers.get('content-disposition');
            let filename = 'download';
            if (contentDisposition) {
                const match = contentDisposition.match(/filename="?(.+?)"?$/);
                if (match) filename = match[1];
            }
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            URL.revokeObjectURL(url);
            showToast('Download concluído!', 'success');
            setTimeout(loadData, 1000);
        } catch {
            showToast('Erro ao baixar arquivo', 'error');
        } finally {
            setDownloading(null);
        }
    };

    const handleShare = async (file: FileItem) => {
        setSharing(file.id);
        try {
            // Download the file
            const res = await fetch(`/api/files/${file.id}/stream`);
            if (!res.ok) {
                showToast('Erro ao preparar arquivo para compartilhamento', 'error');
                return;
            }
            const blob = await res.blob();
            const extension = file.name.split('.').pop() || 'jpg';
            const fileObj = new window.File([blob], file.name, { type: file.mimeType || `image/${extension}` });

            // Try native share with file
            if (navigator.share && navigator.canShare && navigator.canShare({ files: [fileObj] })) {
                await navigator.share({
                    files: [fileObj],
                    title: file.name,
                });
                showToast('Arquivo compartilhado!', 'success');
            } else if (navigator.share) {
                // Fallback: share without file (link only)
                await navigator.share({
                    title: file.name,
                    text: `Confira: ${file.name}`,
                });
            } else {
                // Desktop fallback: just download
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = file.name;
                a.click();
                URL.revokeObjectURL(url);
                showToast('Arquivo baixado! Abra o Instagram e poste manualmente.', 'info');
            }
        } catch (err: any) {
            if (err?.name !== 'AbortError') {
                showToast('Erro ao compartilhar', 'error');
            }
        } finally {
            setSharing(null);
        }
    };

    const getFileIcon = (mimeType: string | null) => {
        const mime = mimeType || '';
        if (mime.startsWith('video/')) return <Film size={22} style={{ color: '#8b5cf6' }} />;
        if (mime.startsWith('image/')) return <Image size={22} style={{ color: '#06b6d4' }} />;
        if (mime.includes('spreadsheet') || mime.includes('excel')) return <FileSpreadsheet size={22} style={{ color: '#10b981' }} />;
        if (mime.includes('pdf') || mime.includes('document') || mime.includes('word')) return <FileText size={22} style={{ color: '#ef4444' }} />;
        return <File size={22} style={{ color: '#6b7280' }} />;
    };

    const kindColor = (k: string) => ({ FINAL: '#10b981', PREVIEW: '#f59e0b', OTHER: '#6b7280' }[k] || '#6b7280');
    const kindLabel = (k: string) => ({ PREVIEW: 'Preview', FINAL: 'Final', RAW: 'Bruto', OTHER: 'Outro' }[k] || k);

    const formatDate = (d: string) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
    const formatTime = (d: string) => new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const statusColor = (s: string) => ({ DRAFT: '#6b7280', IN_PRODUCTION: '#3b82f6', IN_REVIEW: '#f59e0b', DELIVERED: '#10b981', ARCHIVED: '#6b7280' }[s] || '#6b7280');
    const statusLabel = (s: string) => ({ DRAFT: 'Rascunho', IN_PRODUCTION: 'Em Produção', IN_REVIEW: 'Em Revisão', DELIVERED: 'Entregue', ARCHIVED: 'Arquivado' }[s] || s);

    // Date range calculation
    const now = new Date();
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
                d.setDate(d.getDate() - d.getDay());
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
            default: return { from: null, to: null };
        }
    };

    const presetLabel = (p: FilterPreset) => ({ all: 'Todos', today: 'Hoje', week: 'Semana', month: 'Este Mês', year: 'Este Ano' }[p]);

    // Filter projects by status
    const filteredProjects = projects.filter(p => statusFilter === 'ALL' || p.status === statusFilter);

    // Filter files within a project
    const filterFiles = (files: FileItem[]) => {
        const { from, to } = getDateRange();
        return files.filter(f => {
            const pubDate = f.publishedAt ? new Date(f.publishedAt) : null;
            if (from && pubDate && pubDate < from) return false;
            if (to && pubDate && pubDate > to) return false;
            if (searchText) {
                const s = searchText.toLowerCase();
                if (!f.name.toLowerCase().includes(s) && !kindLabel(f.kind).toLowerCase().includes(s)) return false;
            }
            return true;
        });
    };

    // Group files by date for timeline
    const groupFilesByDate = (files: FileItem[]) => {
        const groups: Record<string, FileItem[]> = {};
        files.forEach(f => {
            const dateStr = f.publishedAt ? formatDate(f.publishedAt) : 'Sem data';
            if (!groups[dateStr]) groups[dateStr] = [];
            groups[dateStr].push(f);
        });
        return groups;
    };

    const Pill = ({ label, active, count, onClick }: { label: string; active: boolean; count: number; onClick: () => void }) => (
        <button onClick={onClick} style={{
            padding: '5px 14px', fontSize: '0.78rem', fontWeight: active ? 700 : 500,
            border: active ? 'none' : '1px solid var(--color-border)', borderRadius: 20, cursor: 'pointer',
            background: active ? 'var(--color-primary)' : 'transparent',
            color: active ? '#fff' : 'var(--color-text-muted)', transition: 'all 0.2s',
        }}>
            {label} <span style={{ opacity: 0.7, marginLeft: 2 }}>{count}</span>
        </button>
    );

    const allFiles = projects.flatMap(p => p.files);
    const totalNew = allFiles.filter(f => f.isNew).length;

    return (
        <div className="portal-projects">
            <style>{`
                @media (max-width: 600px) {
                    .portal-projects .stat-row { grid-template-columns: 1fr 1fr !important; gap: 8px !important; }
                    .portal-projects .filter-card { flex-wrap: wrap !important; }
                    .portal-projects .filter-card .search-wrap { flex: 1 1 100% !important; margin-top: 6px; }
                    .portal-projects .timeline-files { margin-left: 44px !important; }
                    .portal-projects .timeline-line { left: 16px !important; }
                    .portal-projects .date-circle { width: 34px !important; height: 34px !important; }
                }
            `}</style>
            <div className="page-header">
                <h1>Projetos</h1>
                <p>Veja seus projetos e baixe os arquivos</p>
            </div>

            <div className="page-content">
                {/* Stat cards */}
                <div className="stat-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
                    {[
                        { icon: <FolderKanban size={18} />, color: '#6366f1', value: String(projects.length), label: 'Projetos', sub: `${projects.filter(p => p.status === 'DELIVERED').length} entregue(s)` },
                        { icon: <FileText size={18} />, color: '#06b6d4', value: String(allFiles.length), label: 'Arquivos', sub: `${allFiles.filter(f => f.kind === 'FINAL').length} finais` },
                        { icon: <Sparkles size={18} />, color: totalNew > 0 ? '#f59e0b' : '#9ca3af', value: String(totalNew), label: 'Novos', sub: totalNew > 0 ? 'para baixar' : 'tudo baixado' },
                    ].map((c, i) => (
                        <div key={i} className="card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, borderLeft: `3px solid ${c.color}` }}>
                            <div style={{ width: 36, height: 36, borderRadius: 10, background: `${c.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: c.color, flexShrink: 0 }}>{c.icon}</div>
                            <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: c.color, lineHeight: 1.2 }}>{c.value}</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', lineHeight: 1.3 }}>{c.label}</div>
                                <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', opacity: 0.7 }}>{c.sub}</div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Status filter pills */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                    <Pill label="Todos" active={statusFilter === 'ALL'} count={projects.length} onClick={() => setStatusFilter('ALL')} />
                    <Pill label="Em Produção" active={statusFilter === 'IN_PRODUCTION'} count={projects.filter(p => p.status === 'IN_PRODUCTION').length} onClick={() => setStatusFilter('IN_PRODUCTION')} />
                    <Pill label="Em Revisão" active={statusFilter === 'IN_REVIEW'} count={projects.filter(p => p.status === 'IN_REVIEW').length} onClick={() => setStatusFilter('IN_REVIEW')} />
                    <Pill label="Entregues" active={statusFilter === 'DELIVERED'} count={projects.filter(p => p.status === 'DELIVERED').length} onClick={() => setStatusFilter('DELIVERED')} />
                </div>

                {loading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {[1, 2].map(i => <div key={i} className="card animate-pulse" style={{ height: 120 }} />)}
                    </div>
                ) : filteredProjects.length === 0 ? (
                    <div className="card" style={{ padding: 40, textAlign: 'center' }}>
                        <FolderKanban size={32} style={{ color: 'var(--color-text-muted)', margin: '0 auto 8px' }} />
                        <p className="text-muted" style={{ fontSize: '0.85rem' }}>Nenhum projeto encontrado</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {filteredProjects.map((project) => {
                            const isProjectExpanded = expandedProject === project.id;
                            const projectFilteredFiles = filterFiles(project.files);
                            const groupedFiles = groupFilesByDate(projectFilteredFiles);
                            const hasNewFiles = project.files.some(f => f.isNew);

                            return (
                                <div key={project.id} className="card" style={{ overflow: 'hidden' }}>
                                    {/* Project header - clickable */}
                                    <div
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 12,
                                            padding: '14px 18px', cursor: 'pointer',
                                            borderLeft: `4px solid ${statusColor(project.status)}`,
                                        }}
                                        onClick={() => {
                                            setExpandedProject(isProjectExpanded ? null : project.id);
                                            setExpandedFile(null);
                                        }}
                                    >
                                        {/* Icon */}
                                        <div style={{
                                            width: 42, height: 42, borderRadius: 10,
                                            background: `${statusColor(project.status)}12`,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                        }}>
                                            <FolderKanban size={20} style={{ color: statusColor(project.status) }} />
                                        </div>

                                        {/* Info */}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                                <span style={{ fontWeight: 700, fontSize: '0.92rem' }}>{project.name}</span>
                                                <span style={{ fontSize: '0.65rem', fontWeight: 600, padding: '1px 8px', borderRadius: 6, background: `${statusColor(project.status)}15`, color: statusColor(project.status) }}>{statusLabel(project.status)}</span>
                                            </div>
                                            <div style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)', marginTop: 3 }}>
                                                {project._count.files} arquivo(s)
                                            </div>
                                        </div>

                                        {/* Right side */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            {hasNewFiles && (
                                                <span style={{ fontSize: '0.65rem', fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: '#f59e0b15', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 3 }}>
                                                    <Sparkles size={11} /> Novos
                                                </span>
                                            )}
                                            {isProjectExpanded ? <ChevronUp size={18} style={{ color: '#9ca3af' }} /> : <ChevronDown size={18} style={{ color: '#9ca3af' }} />}
                                        </div>
                                    </div>

                                    {/* Expanded: File filter bar + timeline */}
                                    {isProjectExpanded && (
                                        <div style={{ borderTop: '1px solid var(--color-border)' }}>
                                            {/* Filter bar inside project — same style as admin */}
                                            <div className="filter-card" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', background: 'var(--color-bg-secondary)', flexWrap: 'wrap' }}>
                                                <Filter size={14} style={{ color: 'var(--color-text-muted)' }} />
                                                {(['all', 'today', 'week', 'month', 'year'] as FilterPreset[]).map(p => (
                                                    <button
                                                        key={p}
                                                        onClick={() => setFilterPreset(p)}
                                                        style={{
                                                            padding: '3px 10px', borderRadius: 16, fontSize: '0.72rem', fontWeight: 600,
                                                            border: filterPreset === p ? 'none' : '1px solid var(--color-border)',
                                                            background: filterPreset === p ? 'var(--color-primary)' : 'transparent',
                                                            color: filterPreset === p ? '#fff' : 'var(--color-text-muted)',
                                                            cursor: 'pointer', transition: 'all 0.15s',
                                                        }}
                                                    >
                                                        {presetLabel(p)}
                                                    </button>
                                                ))}
                                                <div style={{ flex: 1 }} />
                                                {/* Search */}
                                                <div className="search-wrap" style={{ position: 'relative', minWidth: 120, flex: '0 1 180px' }}>
                                                    <Search size={13} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', pointerEvents: 'none' }} />
                                                    <input value={searchText} onChange={(e) => setSearchText(e.target.value)}
                                                        placeholder="Buscar..."
                                                        style={{ width: '100%', padding: '4px 8px 4px 28px', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: '0.76rem', background: 'var(--color-bg)', outline: 'none', color: 'var(--color-text)' }}
                                                    />
                                                    {searchText && <button onClick={() => setSearchText('')} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: 'var(--color-text-muted)', padding: 2 }}><X size={11} /></button>}
                                                </div>
                                                <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                                                    {projectFilteredFiles.length} de {project.files.length}
                                                </span>
                                            </div>

                                            {/* Timeline */}
                                            {projectFilteredFiles.length === 0 ? (
                                                <div style={{ padding: 30, textAlign: 'center' }}>
                                                    <p className="text-muted" style={{ fontSize: '0.82rem' }}>
                                                        {project.files.length === 0 ? 'Nenhum arquivo neste projeto.' : 'Nenhum arquivo neste período.'}
                                                    </p>
                                                    {project.files.length > 0 && (
                                                        <button className="btn btn-sm btn-secondary" style={{ marginTop: 8 }} onClick={() => { setFilterPreset('all'); setSearchText(''); }}>Limpar Filtros</button>
                                                    )}
                                                </div>
                                            ) : (
                                                <div style={{ position: 'relative', padding: '16px 18px 16px 22px' }}>
                                                    {/* Timeline line */}
                                                    <div className="timeline-line" style={{
                                                        position: 'absolute', left: 20, top: 0, bottom: 0, width: 2,
                                                        background: 'linear-gradient(to bottom, var(--color-primary), var(--color-border))',
                                                        borderRadius: 1,
                                                    }} />

                                                    {Object.entries(groupedFiles).map(([dateStr, files]) => (
                                                        <div key={dateStr} style={{ position: 'relative', marginBottom: 20 }}>
                                                            {/* Date label */}
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, position: 'relative', zIndex: 1 }}>
                                                                <div className="date-circle" style={{
                                                                    width: 38, height: 38, borderRadius: '50%',
                                                                    background: 'var(--color-primary)',
                                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                    flexShrink: 0, boxShadow: '0 0 0 3px var(--color-bg)',
                                                                }}>
                                                                    <Calendar size={16} style={{ color: '#fff' }} />
                                                                </div>
                                                                <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>{dateStr}</span>
                                                                <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>({files.length} arquivo{files.length > 1 ? 's' : ''})</span>
                                                            </div>

                                                            {/* Files for this date */}
                                                            <div className="timeline-files" style={{ marginLeft: 52 }}>
                                                                {files.map((file) => {
                                                                    const isFileExpanded = expandedFile === file.id;

                                                                    return (
                                                                        <div key={file.id} className="card" style={{
                                                                            marginBottom: 8, padding: 0, overflow: 'hidden',
                                                                            borderLeft: `3px solid ${kindColor(file.kind)}`,
                                                                        }}>
                                                                            {/* File row */}
                                                                            <div
                                                                                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer' }}
                                                                                onClick={() => setExpandedFile(isFileExpanded ? null : file.id)}
                                                                            >
                                                                                {/* Icon */}
                                                                                <div style={{
                                                                                    width: 40, height: 40, borderRadius: 8,
                                                                                    background: 'var(--color-bg-secondary)',
                                                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                                                                }}>
                                                                                    {getFileIcon(file.mimeType)}
                                                                                </div>

                                                                                {/* Info */}
                                                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                                                    <div style={{ fontWeight: 600, fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                                        {file.name}
                                                                                    </div>
                                                                                    <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                                                                                        {formatSize(file.sizeBytes)}
                                                                                        <span>•</span>
                                                                                        <span style={{ padding: '0 6px', borderRadius: 8, fontSize: '0.63rem', fontWeight: 600, backgroundColor: `${kindColor(file.kind)}18`, color: kindColor(file.kind) }}>
                                                                                            {kindLabel(file.kind)}
                                                                                        </span>
                                                                                        {file.publishedAt && (
                                                                                            <>
                                                                                                <span>•</span>
                                                                                                <Clock size={10} /> {formatTime(file.publishedAt)}
                                                                                            </>
                                                                                        )}
                                                                                    </div>
                                                                                </div>

                                                                                {/* Status badge */}
                                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                                                    {file.isNew ? (
                                                                                        <span style={{ fontSize: '0.65rem', fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: '#3b82f615', color: '#3b82f6', display: 'flex', alignItems: 'center', gap: 3 }}>
                                                                                            <Sparkles size={10} /> Novo
                                                                                        </span>
                                                                                    ) : (
                                                                                        <span style={{ fontSize: '0.65rem', fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: '#9ca3af15', color: '#9ca3af', display: 'flex', alignItems: 'center', gap: 3 }}>
                                                                                            <CheckCircle size={10} /> Baixado
                                                                                        </span>
                                                                                    )}
                                                                                    {isFileExpanded ? <ChevronUp size={14} style={{ color: '#9ca3af' }} /> : <ChevronDown size={14} style={{ color: '#9ca3af' }} />}
                                                                                </div>
                                                                            </div>

                                                                            {/* Expanded: Preview + Download */}
                                                                            {isFileExpanded && (
                                                                                <div style={{ borderTop: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)' }}>
                                                                                    {/* Preview */}
                                                                                    {file.driveFileId && !file.driveFileId.startsWith('mock_') && (
                                                                                        <div style={{ background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                                                            {file.mimeType?.startsWith('video/') ? (
                                                                                                <iframe
                                                                                                    src={`https://drive.google.com/file/d/${file.driveFileId}/preview`}
                                                                                                    style={{ width: '100%', height: 360, border: 'none' }}
                                                                                                    allow="autoplay; encrypted-media"
                                                                                                    allowFullScreen
                                                                                                />
                                                                                            ) : file.mimeType?.startsWith('image/') ? (
                                                                                                <img
                                                                                                    src={`https://lh3.googleusercontent.com/d/${file.driveFileId}`}
                                                                                                    alt={file.name}
                                                                                                    style={{ maxWidth: '100%', maxHeight: 300, objectFit: 'contain' }}
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

                                                                                    {/* Actions: Download + Share */}
                                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', flexWrap: 'wrap', gap: 8 }}>
                                                                                        <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                                                            <Clock size={12} />
                                                                                            {file.publishedAt ? `Publicado em ${formatDate(file.publishedAt)} às ${formatTime(file.publishedAt)}` : 'Sem data'}
                                                                                            <span>•</span>
                                                                                            {formatSize(file.sizeBytes)}
                                                                                        </div>
                                                                                        <div style={{ display: 'flex', gap: 8 }}>
                                                                                            {(file.mimeType?.startsWith('image/') || file.mimeType?.startsWith('video/')) && (
                                                                                                <button
                                                                                                    className="btn btn-sm"
                                                                                                    disabled={sharing === file.id}
                                                                                                    onClick={(e) => { e.stopPropagation(); handleShare(file); }}
                                                                                                    style={{
                                                                                                        display: 'flex', alignItems: 'center', gap: 6, padding: '6px 16px',
                                                                                                        background: 'linear-gradient(135deg, #833AB4, #C13584, #E1306C)',
                                                                                                        color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer',
                                                                                                        fontSize: '0.8rem', fontWeight: 600,
                                                                                                    }}
                                                                                                >
                                                                                                    {sharing === file.id
                                                                                                        ? <Loader2 size={14} className="animate-spin" />
                                                                                                        : <Share2 size={14} />
                                                                                                    }
                                                                                                    Compartilhar
                                                                                                </button>
                                                                                            )}
                                                                                            <button
                                                                                                className="btn btn-primary btn-sm"
                                                                                                disabled={downloading === file.id}
                                                                                                onClick={(e) => { e.stopPropagation(); handleDownload(file.id); }}
                                                                                                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 16px' }}
                                                                                            >
                                                                                                {downloading === file.id
                                                                                                    ? <Loader2 size={14} className="animate-spin" />
                                                                                                    : <Download size={14} />
                                                                                                }
                                                                                                Baixar
                                                                                            </button>
                                                                                        </div>
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
                                    )}

                                    {isProjectExpanded && project.files.length === 0 && (
                                        <div style={{ borderTop: '1px solid var(--color-border)', padding: 24, textAlign: 'center' }}>
                                            <p className="text-muted" style={{ fontSize: '0.82rem' }}>Nenhum arquivo visível neste projeto.</p>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
