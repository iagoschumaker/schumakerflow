'use client';

import jsPDF from 'jspdf';
import { SFLOW_LOGO_BASE64 } from './logo-base64';

interface InvoiceItem {
    description: string;
    quantity: number;
    unitPrice: string | number;
    totalAmount: string | number;
}

interface InvoiceForPdf {
    id: string;
    dueDate: string;
    totalAmount: string | number;
    status: string;
    paidAt: string | null;
    referenceMonth: string | null;
    notes: string | null;
    client: { name: string; phone?: string | null };
    contract?: { name: string } | null;
    items?: InvoiceItem[];
}

interface PixInfo {
    pixKey: string;
    pixKeyType: string;
    pixReceiverName: string;
}

interface PdfOptions {
    qrCodeDataUrl?: string;
    pixPayload?: string;
}

const C = {
    primary: [99, 102, 241] as [number, number, number],
    dark: [20, 22, 35] as [number, number, number],
    text: [30, 30, 40] as [number, number, number],
    muted: [130, 130, 150] as [number, number, number],
    border: [210, 215, 225] as [number, number, number],
    success: [34, 197, 94] as [number, number, number],
    white: [255, 255, 255] as [number, number, number],
    bg: [245, 246, 250] as [number, number, number],
    lightPrimary: [235, 236, 255] as [number, number, number],
    lightGreen: [235, 255, 242] as [number, number, number],
};

function fmt(v: number | string): string {
    return `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}
function fmtDate(d: string): string {
    return new Date(d).toLocaleDateString('pt-BR');
}
function fmtMonth(m: string | null): string {
    if (!m) return '';
    const [y, mo] = m.split('-');
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return `${months[parseInt(mo) - 1]}/${y}`;
}

function addLogoHeader(doc: jsPDF, title: string) {
    // Clean white header with logo
    doc.setFillColor(...C.white);
    doc.rect(0, 0, 210, 38, 'F');

    // Logo
    try {
        doc.addImage(SFLOW_LOGO_BASE64, 'PNG', 15, 6, 26, 26);
    } catch {
        // Fallback text if image fails
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...C.primary);
        doc.text('S', 22, 22);
    }

    // Brand name next to logo
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.dark);
    doc.text('SFlow', 44, 17);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.muted);
    doc.text('Gestão de Mídia', 44, 24);

    // Title badge on the right
    doc.setFillColor(...C.primary);
    doc.roundedRect(150, 10, 45, 16, 4, 4, 'F');
    doc.setTextColor(...C.white);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(title, 172.5, 20, { align: 'center' });

    // Thin separator
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.3);
    doc.line(15, 36, 195, 36);

    doc.setTextColor(...C.text);
}

function addFooter(doc: jsPDF) {
    const ph = doc.internal.pageSize.getHeight();
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.3);
    doc.line(15, ph - 16, 195, ph - 16);
    doc.setFontSize(6.5);
    doc.setTextColor(...C.muted);
    doc.text('Gerado automaticamente por SFlow — schumaker.com.br', 105, ph - 10, { align: 'center' });
    doc.text(`Emissão: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 105, ph - 6, { align: 'center' });
}

// ==========================================
// COBRANÇA PDF
// ==========================================
export function generateBillingPdf(invoices: InvoiceForPdf[], pixInfo?: PixInfo | null, options?: PdfOptions) {
    const doc = new jsPDF();
    const isBatch = invoices.length > 1;
    const clientName = invoices[0]?.client.name || 'Cliente';
    const totalGeral = invoices.reduce((s, i) => s + Number(i.totalAmount), 0);

    addLogoHeader(doc, 'FATURA');

    let y = 44;

    // ── Admin/Business info ──
    if (pixInfo) {
        doc.setFillColor(...C.bg);
        doc.roundedRect(15, y, 180, 14, 3, 3, 'F');
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...C.dark);
        doc.text('Emitido por:', 20, y + 6);
        doc.setFont('helvetica', 'normal');
        doc.text(pixInfo.pixReceiverName, 50, y + 6);
        doc.setFont('helvetica', 'bold');
        doc.text('PIX:', 120, y + 6);
        doc.setFont('helvetica', 'normal');
        doc.text(`${pixInfo.pixKey} (${pixInfo.pixKeyType})`, 132, y + 6);
        y += 20;
    }

    // ── Client info ──
    doc.setFillColor(...C.lightPrimary);
    doc.roundedRect(15, y, 180, 18, 3, 3, 'F');
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.primary);
    doc.text('CLIENTE', 20, y + 7);
    doc.setTextColor(...C.dark);
    doc.setFontSize(9);
    doc.text(clientName, 50, y + 7);

    if (invoices[0]?.client.phone) {
        doc.setFontSize(7.5);
        doc.setTextColor(...C.muted);
        doc.text(`Tel: ${invoices[0].client.phone}`, 50, y + 14);
    }

    y += 24;

    // ── Invoice details ──
    for (const inv of invoices) {
        // Invoice sub-header for batch
        if (isBatch) {
            doc.setFillColor(...C.primary);
            doc.setTextColor(...C.white);
            doc.roundedRect(15, y, 180, 8, 2, 2, 'F');
            doc.setFontSize(7.5);
            doc.setFont('helvetica', 'bold');
            const label = inv.contract?.name || inv.notes || 'Fatura avulsa';
            doc.text(label, 20, y + 5.5);
            doc.text(`Venc: ${fmtDate(inv.dueDate)}`, 125, y + 5.5);
            if (inv.referenceMonth) doc.text(`Ref: ${fmtMonth(inv.referenceMonth)}`, 155, y + 5.5);
            doc.text(fmt(inv.totalAmount), 190, y + 5.5, { align: 'right' });
            doc.setTextColor(...C.text);
            y += 12;
        } else {
            // Single invoice meta
            doc.setFontSize(8);
            const meta: string[] = [];
            meta.push(`Vencimento: ${fmtDate(inv.dueDate)}`);
            if (inv.contract?.name) meta.push(`Contrato: ${inv.contract.name}`);
            if (inv.referenceMonth) meta.push(`Ref: ${fmtMonth(inv.referenceMonth)}`);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...C.muted);
            doc.text(meta.join('   •   '), 20, y);
            doc.setTextColor(...C.text);
            y += 8;
        }

        // Items table
        if (inv.items && inv.items.length > 0) {
            // Header row
            doc.setFillColor(...C.bg);
            doc.rect(15, y, 180, 7, 'F');
            doc.setFontSize(6.5);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...C.muted);
            doc.text('DESCRIÇÃO', 20, y + 5);
            doc.text('QTD', 128, y + 5, { align: 'center' });
            doc.text('UNITÁRIO', 155, y + 5, { align: 'right' });
            doc.text('TOTAL', 190, y + 5, { align: 'right' });
            doc.setTextColor(...C.text);
            y += 10;

            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            for (const item of inv.items) {
                doc.text(item.description.substring(0, 55), 20, y);
                doc.text(String(item.quantity), 128, y, { align: 'center' });
                doc.text(fmt(item.unitPrice), 155, y, { align: 'right' });
                doc.text(fmt(item.totalAmount), 190, y, { align: 'right' });

                // Light bottom border
                doc.setDrawColor(235, 235, 240);
                doc.setLineWidth(0.2);
                doc.line(20, y + 2, 190, y + 2);
                y += 7;
            }

            // Subtotal
            y += 2;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8.5);
            doc.text('Subtotal:', 155, y, { align: 'right' });
            doc.text(fmt(inv.totalAmount), 190, y, { align: 'right' });
            y += 8;
        }

        if (isBatch) y += 3;
    }

    // ── TOTAL box ──
    doc.setFillColor(...C.primary);
    doc.roundedRect(110, y, 85, 14, 4, 4, 'F');
    doc.setTextColor(...C.white);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('TOTAL:', 118, y + 10);
    doc.text(fmt(totalGeral), 190, y + 10, { align: 'right' });
    doc.setTextColor(...C.text);
    y += 22;

    // ── QR Code section ──
    if (options?.qrCodeDataUrl || pixInfo) {
        doc.setDrawColor(...C.border);
        doc.setLineWidth(0.3);
        doc.line(15, y, 195, y);
        y += 6;

        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...C.primary);
        doc.text('Pagamento PIX', 15, y + 4);
        doc.setTextColor(...C.text);
        y += 10;

        if (options?.qrCodeDataUrl) {
            // QR Code centered
            const qrSize = 50;
            const qrX = 80;
            try {
                doc.addImage(options.qrCodeDataUrl, 'PNG', qrX, y, qrSize, qrSize);
            } catch {
                doc.setFontSize(7);
                doc.setTextColor(...C.muted);
                doc.text('[QR Code não disponível]', 105, y + 25, { align: 'center' });
            }
            y += qrSize + 5;

            // Copia e Cola below QR
            if (options.pixPayload) {
                doc.setFontSize(6.5);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(...C.muted);
                doc.text('PIX Copia e Cola:', 15, y);
                y += 4;
                doc.setFillColor(...C.bg);
                doc.roundedRect(15, y, 180, 8, 2, 2, 'F');
                doc.setFontSize(5.5);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(...C.text);
                const payload = options.pixPayload.substring(0, 120);
                doc.text(payload, 20, y + 5.5);
                y += 12;
            }
        }

        // PIX data
        if (pixInfo) {
            doc.setFillColor(...C.bg);
            doc.roundedRect(15, y, 180, 16, 3, 3, 'F');
            doc.setFontSize(7.5);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...C.text);
            doc.text(`Chave: ${pixInfo.pixKey}`, 20, y + 6);
            doc.text(`Tipo: ${pixInfo.pixKeyType}`, 110, y + 6);
            doc.text(`Nome: ${pixInfo.pixReceiverName}`, 20, y + 12);
        }
    }

    // Notes
    if (!isBatch && invoices[0]?.notes) {
        y += 22;
        doc.setFontSize(7);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(...C.muted);
        doc.text(`Obs: ${invoices[0].notes}`, 20, y);
    }

    addFooter(doc);

    const fileName = isBatch
        ? `cobranca_${clientName.replace(/\s+/g, '_')}_${invoices.length}faturas.pdf`
        : `fatura_${clientName.replace(/\s+/g, '_')}_${fmtDate(invoices[0].dueDate).replace(/\//g, '-')}.pdf`;

    doc.save(fileName);
}

// ==========================================
// COMPROVANTE (Receipt)
// ==========================================
export function generateReceiptPdf(invoices: InvoiceForPdf[], pixInfo?: PixInfo | null) {
    const doc = new jsPDF();
    const clientName = invoices[0]?.client.name || 'Cliente';
    const totalGeral = invoices.reduce((s, i) => s + Number(i.totalAmount), 0);
    const isBatch = invoices.length > 1;

    addLogoHeader(doc, 'COMPROVANTE');

    let y = 44;

    // ── Admin info ──
    if (pixInfo) {
        doc.setFillColor(...C.bg);
        doc.roundedRect(15, y, 180, 14, 3, 3, 'F');
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...C.dark);
        doc.text('Recebido por:', 20, y + 6);
        doc.setFont('helvetica', 'normal');
        doc.text(pixInfo.pixReceiverName, 55, y + 6);
        y += 20;
    }

    // ── PAID badge ──
    doc.setFillColor(...C.success);
    doc.roundedRect(15, y, 42, 11, 4, 4, 'F');
    doc.setTextColor(...C.white);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('PAGO', 36, y + 8, { align: 'center' });

    // Date paid
    if (invoices[0]?.paidAt) {
        doc.setFontSize(8);
        doc.setTextColor(...C.muted);
        doc.setFont('helvetica', 'normal');
        doc.text(`em ${fmtDate(invoices[0].paidAt)}`, 62, y + 8);
    }

    doc.setTextColor(...C.text);
    y += 18;

    // ── Client + value ──
    doc.setFillColor(...C.lightGreen);
    doc.roundedRect(15, y, 180, 22, 3, 3, 'F');

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.dark);
    doc.text('CLIENTE', 20, y + 7);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(clientName, 50, y + 7);

    doc.setFont('helvetica', 'bold');
    doc.text('VALOR:', 20, y + 16);
    doc.setTextColor(...C.success);
    doc.setFontSize(13);
    doc.text(fmt(totalGeral), 50, y + 16);
    doc.setTextColor(...C.text);

    y += 28;

    // ── Invoice details ──
    for (const inv of invoices) {
        if (isBatch) {
            doc.setFillColor(...C.bg);
            doc.roundedRect(15, y, 180, 8, 2, 2, 'F');
            doc.setFontSize(7.5);
            doc.setFont('helvetica', 'bold');
            const label = inv.contract?.name || inv.notes || 'Fatura avulsa';
            doc.text(label, 20, y + 5.5);
            doc.text(`Venc: ${fmtDate(inv.dueDate)}`, 120, y + 5.5);
            doc.text(fmt(inv.totalAmount), 190, y + 5.5, { align: 'right' });
            y += 11;
        }

        if (inv.items && inv.items.length > 0) {
            doc.setFontSize(7.5);
            doc.setFont('helvetica', 'normal');
            for (const item of inv.items) {
                doc.setTextColor(...C.muted);
                doc.text(`•  ${item.description.substring(0, 50)}`, 25, y);
                doc.setTextColor(...C.text);
                doc.text(`${item.quantity}x ${fmt(item.unitPrice)} = ${fmt(item.totalAmount)}`, 190, y, { align: 'right' });
                y += 6;
            }
            y += 3;
        }
    }

    // ── Total ──
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.3);
    doc.line(15, y, 195, y);
    y += 6;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...C.dark);
    doc.text('Total pago:', 140, y, { align: 'right' });
    doc.setTextColor(...C.success);
    doc.text(fmt(totalGeral), 190, y, { align: 'right' });
    doc.setTextColor(...C.text);
    y += 14;

    // ── Confirmation ──
    doc.setFillColor(...C.lightGreen);
    doc.roundedRect(15, y, 180, 14, 3, 3, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...C.success);
    doc.text('Pagamento confirmado. Este documento serve como comprovante de quitação.', 105, y + 9, { align: 'center' });
    doc.setTextColor(...C.text);

    addFooter(doc);

    const fileName = isBatch
        ? `comprovante_${clientName.replace(/\s+/g, '_')}_${invoices.length}faturas.pdf`
        : `comprovante_${clientName.replace(/\s+/g, '_')}_${fmtDate(invoices[0].dueDate).replace(/\//g, '-')}.pdf`;

    doc.save(fileName);
}
