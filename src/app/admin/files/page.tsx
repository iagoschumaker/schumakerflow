'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { X, FileText, Loader2, Upload, Film, Image, FileSpreadsheet, File, CheckCircle2, RefreshCw } from 'lucide-react';
import SearchableSelect from '@/components/SearchableSelect';

interface Project { id: string; name: string; client: { name: string } }

interface UploadItem {
    file: File;
    status: 'pending' | 'uploading' | 'done' | 'error';
    progress: number;
    speed: number;
    loaded: number;
    errorMsg?: string;
}

export default function FilesPage() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploadForm, setUploadForm] = useState({ projectId: '', kind: 'FINAL', isVisible: false });
    const [uploadFiles, setUploadFiles] = useState<UploadItem[]>([]);
    const [uploading, setUploading] = useState(false);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);
    const [syncing, setSyncing] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleSync = async () => {
        setSyncing(true);
        try {
            const res = await fetch('/api/admin/files/sync', { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                alert(`${data.data?.message || 'Sincronização concluída!'}`);
                window.location.reload();
            } else {
                alert(data.error || 'Erro na sincronização');
            }
        } catch {
            alert('Falha na conexão');
        }
        setSyncing(false);
    };

    useEffect(() => {
        fetch('/api/admin/projects').then(r => r.json()).then(d => {
            setProjects(d.data || []);
            setLoading(false);
        });
    }, []);

    const handleFilesSelected = (selectedFiles: FileList | null) => {
        if (!selectedFiles) return;
        const items: UploadItem[] = Array.from(selectedFiles).map((f) => ({
            file: f, status: 'pending' as const, progress: 0, speed: 0, loaded: 0,
        }));
        setUploadFiles((prev) => [...prev, ...items]);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        handleFilesSelected(e.dataTransfer.files);
    };

    const uploadSingleFile = useCallback((index: number, projectId: string, kind: string, isVisible: boolean): Promise<void> => {
        return new Promise((resolve) => {
            setUploadFiles((prev) => {
                const item = prev[index];
                if (!item || item.status !== 'pending') { resolve(); return prev; }
                return prev.map((it, idx) => idx === index ? { ...it, status: 'uploading', progress: 0, speed: 0, loaded: 0 } : it);
            });

            // Need to get the file from state asynchronously
            setTimeout(() => {
                const formData = new FormData();
                const fileItem = uploadFiles[index];
                if (!fileItem) { resolve(); return; }

                formData.append('file', fileItem.file);
                formData.append('projectId', projectId);
                formData.append('kind', kind);
                formData.append('isVisible', String(isVisible));

                const xhr = new XMLHttpRequest();
                let lastLoaded = 0;
                let lastTime = Date.now();

                xhr.upload.addEventListener('progress', (e) => {
                    if (e.lengthComputable) {
                        const now = Date.now();
                        const elapsed = (now - lastTime) / 1000;
                        const deltaBytes = e.loaded - lastLoaded;
                        const speed = elapsed > 0.1 ? deltaBytes / elapsed : 0;
                        lastLoaded = e.loaded;
                        lastTime = now;
                        const progress = Math.round((e.loaded / e.total) * 100);
                        setUploadFiles((prev) => prev.map((it, idx) =>
                            idx === index ? { ...it, progress, speed, loaded: e.loaded } : it
                        ));
                    }
                });

                xhr.addEventListener('load', () => {
                    setUploadFiles((prev) => prev.map((it, idx) =>
                        idx === index ? { ...it, status: xhr.status < 300 ? 'done' : 'error', progress: xhr.status < 300 ? 100 : 0, speed: 0, errorMsg: xhr.status >= 300 ? `Erro ${xhr.status}` : undefined } : it
                    ));
                    resolve();
                });

                xhr.addEventListener('error', () => {
                    setUploadFiles((prev) => prev.map((it, idx) =>
                        idx === index ? { ...it, status: 'error', progress: 0, errorMsg: 'Falha na conexão' } : it
                    ));
                    resolve();
                });

                xhr.open('POST', '/api/admin/files');
                xhr.send(formData);
            }, 50);
        });
    }, [uploadFiles]);

    const handleUploadAll = async () => {
        if (!uploadForm.projectId || uploadFiles.length === 0) return;
        setUploading(true);
        setSuccessMsg(null);

        for (let i = 0; i < uploadFiles.length; i++) {
            if (uploadFiles[i].status === 'pending') {
                await uploadSingleFile(i, uploadForm.projectId, uploadForm.kind, uploadForm.isVisible);
            }
        }

        setUploading(false);
        const doneCount = uploadFiles.filter(f => f.status === 'done').length;
        setSuccessMsg(`${doneCount} arquivo(s) enviado(s) com sucesso!`);
    };

    const removeUploadFile = (idx: number) => {
        setUploadFiles((prev) => prev.filter((_, i) => i !== idx));
    };

    const clearDone = () => {
        setUploadFiles([]);
        setSuccessMsg(null);
    };

    const formatSize = (bytes: number) => {
        if (!bytes) return '—';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
        return (bytes / 1073741824).toFixed(2) + ' GB';
    };

    const formatSpeed = (bytesPerSec: number) => {
        if (bytesPerSec < 1024) return bytesPerSec.toFixed(0) + ' B/s';
        if (bytesPerSec < 1048576) return (bytesPerSec / 1024).toFixed(1) + ' KB/s';
        return (bytesPerSec / 1048576).toFixed(1) + ' MB/s';
    };

    const getFileIcon = (mimeType: string, name: string) => {
        if (mimeType.startsWith('video/')) return <Film size={18} style={{ color: '#8b5cf6' }} />;
        if (mimeType.startsWith('image/')) return <Image size={18} style={{ color: '#06b6d4' }} />;
        if (mimeType.includes('spreadsheet') || name.endsWith('.xlsx')) return <FileSpreadsheet size={18} style={{ color: '#10b981' }} />;
        if (mimeType.includes('pdf') || mimeType.includes('document')) return <FileText size={18} style={{ color: '#ef4444' }} />;
        return <File size={18} style={{ color: '#6b7280' }} />;
    };

    const totalSize = uploadFiles.reduce((sum, it) => sum + it.file.size, 0);
    const totalLoaded = uploadFiles.reduce((sum, it) => {
        if (it.status === 'done') return sum + it.file.size;
        return sum + it.loaded;
    }, 0);
    const overallProgress = totalSize > 0 ? Math.round((totalLoaded / totalSize) * 100) : 0;
    const activeUpload = uploadFiles.find(it => it.status === 'uploading');

    if (loading) return <div className="page-content"><div className="card animate-pulse" style={{ height: 300 }} /></div>;

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1>Upload de Arquivos</h1>
                    <p>Envie arquivos para os projetos</p>
                </div>
                <button className="btn btn-secondary" onClick={handleSync} disabled={syncing} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} />
                    {syncing ? 'Sincronizando...' : 'Sincronizar Drive'}
                </button>
            </div>

            <div className="page-content">
                <div className="card" style={{ padding: 'var(--space-6)' }}>
                    {/* Project + Kind selectors */}
                    <div className="grid-2" style={{ marginBottom: 'var(--space-4)' }}>
                        <div className="form-group">
                            <label className="form-label">Projeto *</label>
                            <SearchableSelect
                                options={projects.map(p => ({ value: p.id, label: p.name, sublabel: p.client?.name || '' }))}
                                value={uploadForm.projectId}
                                onChange={(v) => setUploadForm({ ...uploadForm, projectId: v })}
                                placeholder="Buscar projeto..."
                                disabled={uploading}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Tipo</label>
                            <select className="form-input" value={uploadForm.kind} onChange={(e) => setUploadForm({ ...uploadForm, kind: e.target.value })} disabled={uploading}>
                                <option value="FINAL">Final</option>
                                <option value="PREVIEW">Preview</option>
                                <option value="RAW">Bruto</option>
                                <option value="OTHER">Outro</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.85rem' }}>
                            <input type="checkbox" checked={uploadForm.isVisible} onChange={(e) => setUploadForm({ ...uploadForm, isVisible: e.target.checked })} disabled={uploading} />
                            Tornar visível para o cliente imediatamente
                        </label>
                    </div>

                    {/* Drop Zone */}
                    {!uploading && (
                        <div
                            onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = 'var(--color-primary)'; }}
                            onDragLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; }}
                            onDrop={(e) => { handleDrop(e); e.currentTarget.style.borderColor = 'var(--color-border)'; }}
                            onClick={() => fileInputRef.current?.click()}
                            style={{
                                border: '2px dashed var(--color-border)',
                                borderRadius: 'var(--radius-lg)',
                                padding: 'var(--space-8)',
                                textAlign: 'center',
                                cursor: 'pointer',
                                background: 'var(--color-bg-secondary)',
                                transition: 'all 0.2s ease',
                            }}
                        >
                            <Upload size={40} style={{ margin: '0 auto', color: 'var(--color-primary)', marginBottom: 12, opacity: 0.7 }} />
                            <p style={{ fontWeight: 600, fontSize: '1.05rem', marginBottom: 4 }}>Arraste arquivos aqui ou clique para selecionar</p>
                            <p className="text-sm text-muted">Todos os tipos de arquivo — sem limite de quantidade</p>
                            <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={(e) => { handleFilesSelected(e.target.files); e.target.value = ''; }} />
                        </div>
                    )}

                    {/* Overall progress bar */}
                    {uploading && (
                        <div style={{ padding: 'var(--space-4)', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-lg)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                <span style={{ fontWeight: 600 }}>Enviando... {overallProgress}%</span>
                                <span className="text-sm text-muted">
                                    {formatSize(totalLoaded)} / {formatSize(totalSize)}
                                    {activeUpload && activeUpload.speed > 0 ? ` • ${formatSpeed(activeUpload.speed)}` : ''}
                                </span>
                            </div>
                            <div style={{ width: '100%', height: 10, background: 'var(--color-border)', borderRadius: 5, overflow: 'hidden' }}>
                                <div style={{
                                    width: `${overallProgress}%`, height: '100%',
                                    background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                                    borderRadius: 5, transition: 'width 0.3s ease',
                                }} />
                            </div>
                        </div>
                    )}

                    {/* Success message */}
                    {successMsg && (
                        <div style={{
                            marginTop: 'var(--space-4)', padding: 'var(--space-3) var(--space-4)',
                            borderRadius: 'var(--radius-md)', background: '#ecfdf5', color: '#059669',
                            fontWeight: 500, fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <CheckCircle2 size={18} /> {successMsg}
                            </span>
                            <button className="btn btn-sm btn-secondary" onClick={clearDone} style={{ padding: '4px 12px' }}>Novo Upload</button>
                        </div>
                    )}

                    {/* File list */}
                    {uploadFiles.length > 0 && (
                        <div style={{ marginTop: 'var(--space-4)', maxHeight: 400, overflowY: 'auto' }}>
                            {uploadFiles.map((item, idx) => (
                                <div key={idx} style={{ padding: 'var(--space-3)', borderBottom: '1px solid var(--color-border)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                                        {getFileIcon(item.file.type, item.file.name)}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: '0.85rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.file.name}</div>
                                            <div className="text-xs text-muted">
                                                {formatSize(item.file.size)}
                                                {item.status === 'uploading' && item.speed > 0 && ` • ${formatSpeed(item.speed)}`}
                                                {item.status === 'uploading' && ` • ${item.progress}%`}
                                            </div>
                                        </div>
                                        {item.status === 'pending' && (
                                            <button onClick={() => removeUploadFile(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: 'var(--color-text-muted)' }}>
                                                <X size={16} />
                                            </button>
                                        )}
                                        {item.status === 'uploading' && <Loader2 size={16} className="animate-spin" style={{ color: 'var(--color-primary)', flexShrink: 0 }} />}
                                        {item.status === 'done' && <CheckCircle2 size={16} style={{ color: 'var(--color-success)', flexShrink: 0 }} />}
                                        {item.status === 'error' && <span className="badge badge-danger" style={{ fontSize: '0.65rem' }}>{item.errorMsg || 'Erro'}</span>}
                                    </div>
                                    {item.status === 'uploading' && (
                                        <div style={{ marginTop: 6, width: '100%', height: 4, background: 'var(--color-border)', borderRadius: 2, overflow: 'hidden' }}>
                                            <div style={{ width: `${item.progress}%`, height: '100%', background: '#6366f1', borderRadius: 2, transition: 'width 0.2s' }} />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Upload button */}
                    {uploadFiles.length > 0 && !uploading && uploadFiles.some(f => f.status === 'pending') && (
                        <div style={{ marginTop: 'var(--space-4)', display: 'flex', justifyContent: 'flex-end' }}>
                            <button className="btn btn-primary" onClick={handleUploadAll} disabled={!uploadForm.projectId}>
                                <Upload size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
                                Enviar {uploadFiles.filter(f => f.status === 'pending').length} arquivo(s)
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
