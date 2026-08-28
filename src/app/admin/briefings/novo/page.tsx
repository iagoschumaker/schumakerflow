'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, Check, ArrowRight } from 'lucide-react';
import { useToast } from '@/components/Toast';
import SearchableSelect from '@/components/SearchableSelect';
import { formatDateBR, formatMonthBR } from '@/lib/briefings/dates';

interface Client { id: string; name: string; isActive: boolean }
interface Template { id: string; name: string; isActive: boolean }

function nextMonthIso(): string {
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth() + 1; // next month, 0-indexed +1 = current month number; +1 more for "next"
    const next = new Date(Date.UTC(y, m, 1));
    return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}`;
}

function defaultDueDate(referenceMonthIso: string): string {
    const [y, m] = referenceMonthIso.split('-').map(Number);
    const prev = new Date(Date.UTC(y, m - 2, 23)); // month before reference, day 23
    return `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, '0')}-${String(prev.getUTCDate()).padStart(2, '0')}`;
}

export default function NewBriefingPage() {
    const router = useRouter();
    const { showToast } = useToast();

    const [clients, setClients] = useState<Client[]>([]);
    const [templates, setTemplates] = useState<Template[]>([]);
    const [clientId, setClientId] = useState('');
    const [templateId, setTemplateId] = useState('');
    const [referenceMonth, setReferenceMonth] = useState(nextMonthIso());
    const [dueDate, setDueDate] = useState(defaultDueDate(nextMonthIso()));
    const [dueDateTouched, setDueDateTouched] = useState(false);
    const [saving, setSaving] = useState(false);

    const [result, setResult] = useState<{ cycleId: string; token: string; clientName: string } | null>(null);
    const [copiedLink, setCopiedLink] = useState(false);
    const [copiedText, setCopiedText] = useState(false);

    useEffect(() => {
        Promise.all([
            fetch('/api/admin/clients').then((r) => r.json()),
            fetch('/api/admin/briefings/templates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'list', isActive: true }),
            }).then((r) => r.json()),
        ]).then(([clientsData, templatesData]) => {
            setClients((clientsData.data || []).filter((c: Client) => c.isActive));
            setTemplates(templatesData.data || []);
        });
    }, []);

    useEffect(() => {
        if (!dueDateTouched) setDueDate(defaultDueDate(referenceMonth));
    }, [referenceMonth, dueDateTouched]);

    const clientOptions = useMemo(() => clients.map((c) => ({ value: c.id, label: c.name })), [clients]);

    const link = useMemo(() => {
        if (!result) return '';
        return `${window.location.origin}/b/${result.token}`;
    }, [result]);

    const whatsappText = useMemo(() => {
        if (!result) return '';
        const mesLabel = formatMonthBR(`${referenceMonth}-01`);
        return `Oi! Segue o link do briefing de ${mesLabel} para eu montar o planejamento:\n\n${link}\n\nSão poucos campos, leva uns 5 minutos. O formulário salva sozinho, dá pra fechar e voltar depois pelo mesmo link.\n\nPrazo: ${dueDate ? formatDateBR(dueDate) : 'a combinar'}`;
    }, [result, link, referenceMonth, dueDate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!clientId || !templateId || !referenceMonth) {
            showToast('Preencha cliente, modelo e mês', 'warning');
            return;
        }
        setSaving(true);
        try {
            const res = await fetch('/api/admin/briefings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'create', clientId, templateId, referenceMonth, dueDate: dueDate || undefined }),
            });
            const data = await res.json();
            if (!res.ok) {
                showToast(data.error || 'Erro ao criar briefing', 'error');
                return;
            }
            const clientName = clients.find((c) => c.id === clientId)?.name || '';
            setResult({ cycleId: data.data.cycle.id, token: data.data.token, clientName });
        } finally {
            setSaving(false);
        }
    };

    const copy = async (text: string, which: 'link' | 'text') => {
        await navigator.clipboard.writeText(text);
        if (which === 'link') { setCopiedLink(true); setTimeout(() => setCopiedLink(false), 2000); }
        else { setCopiedText(true); setTimeout(() => setCopiedText(false), 2000); }
    };

    if (result) {
        const [y, m] = referenceMonth.split('-').map(Number);
        const mesLabel = formatMonthBR(`${y}-${String(m).padStart(2, '0')}-01`);
        return (
            <div>
                <div className="page-header">
                    <h1>Briefing criado</h1>
                    <p>{result.clientName} — {mesLabel}</p>
                </div>
                <div className="page-content">
                    <div className="card">
                        <p className="text-sm text-muted" style={{ marginBottom: 'var(--space-5)' }}>Você pode ver este link de novo a qualquer momento no detalhe do ciclo, em &quot;Mostrar link&quot;.</p>

                        <div className="form-group">
                            <label className="form-label">Link do briefing</label>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <input className="form-input" readOnly value={link} onFocus={(e) => e.target.select()} />
                                <button type="button" className="btn btn-secondary" onClick={() => copy(link, 'link')} style={{ flexShrink: 0 }}>
                                    {copiedLink ? <Check size={16} /> : <Copy size={16} />}
                                </button>
                            </div>
                        </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Texto pronto para WhatsApp</label>
                            <textarea className="form-textarea" readOnly value={whatsappText} rows={9} style={{ minHeight: 190, resize: 'vertical' }} />
                            <button type="button" className="btn btn-secondary mt-2" onClick={() => copy(whatsappText, 'text')}>
                                {copiedText ? <Check size={16} /> : <Copy size={16} />} Copiar texto
                            </button>
                        </div>
                    </div>

                    <button className="btn btn-primary" style={{ marginTop: 'var(--space-4)' }} onClick={() => router.push(`/admin/briefings/${result.cycleId}`)}>
                        Ver detalhe do ciclo <ArrowRight size={16} />
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div>
            <div className="page-header">
                <h1>Novo briefing</h1>
                <p>Escolha o cliente, o modelo e o mês</p>
            </div>
            <div className="page-content">
                <form onSubmit={handleSubmit}>
                    <div className="card">
                        <div className="form-group">
                            <label className="form-label">Cliente *</label>
                            <SearchableSelect options={clientOptions} value={clientId} onChange={setClientId} placeholder="Buscar cliente..." />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Modelo *</label>
                            <select className="form-input" value={templateId} onChange={(e) => setTemplateId(e.target.value)} required>
                                <option value="">Selecione</option>
                                {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Mês de referência *</label>
                            <input type="month" className="form-input" value={referenceMonth} onChange={(e) => setReferenceMonth(e.target.value)} required />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Prazo</label>
                            <input type="date" className="form-input" value={dueDate} onChange={(e) => { setDueDate(e.target.value); setDueDateTouched(true); }} />
                        </div>
                    </div>
                    <button type="submit" className="btn btn-primary" style={{ marginTop: 'var(--space-4)' }} disabled={saving}>
                        {saving ? 'Criando...' : 'Criar briefing e gerar link'}
                    </button>
                </form>
            </div>
        </div>
    );
}
