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

// ── Colors (all black/gray based) ──
const D = [17, 20, 39] as const;      // dark
const T = [40, 42, 55] as const;      // text
const M = [130, 135, 155] as const;   // muted
const B = [215, 218, 228] as const;   // border
const BG = [245, 246, 250] as const;  // bg
const W = [255, 255, 255] as const;   // white
const GR = [34, 197, 94] as const;    // green (receipt only)

function fmt(v: number | string): string {
    return `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}
function fDate(d: string): string {
    return new Date(d).toLocaleDateString('pt-BR');
}
function fMonth(m: string | null): string {
    if (!m) return '';
    const [y, mo] = m.split('-');
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return `${months[parseInt(mo) - 1]}/${y}`;
}

// ── Header ──
function drawHeader(doc: jsPDF, title: string) {
    // Black left accent bar
    doc.setFillColor(...D);
    doc.rect(0, 0, 5, 297, 'F');

    // Logo
    try {
        doc.addImage(SFLOW_LOGO_BASE64, 'PNG', 14, 10, 16, 16);
    } catch { /* skip */ }

    // Brand
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...D);
    doc.text('SFlow', 34, 18);
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...M);
    doc.text('Gestão de Mídia', 34, 23);

    // Title - small, right-aligned, uppercase
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...D);
    doc.text(title, 195, 20, { align: 'right' });

    // Separator
    doc.setDrawColor(...B);
    doc.setLineWidth(0.3);
    doc.line(14, 32, 195, 32);
}

// ── Footer ──
function drawFooter(doc: jsPDF) {
    const h = doc.internal.pageSize.getHeight();
    doc.setDrawColor(...B);
    doc.setLineWidth(0.2);
    doc.line(14, h - 16, 195, h - 16);
    doc.setFontSize(6);
    doc.setTextColor(...M);
    doc.text('Gerado automaticamente por SFlow — schumaker.com.br', 105, h - 10, { align: 'center' });
    doc.text(`Emissão: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 105, h - 6, { align: 'center' });
}

// ── Section label with bar ──
function label(doc: jsPDF, text: string, y: number, color: readonly [number, number, number] = D) {
    doc.setFillColor(...color);
    doc.roundedRect(14, y, 2.5, 9, 1, 1, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...color);
    doc.text(text.toUpperCase(), 21, y + 6.5);
    doc.setTextColor(...T);
    return y + 12;
}

// ==========================================
// FATURA
// ==========================================
export function generateBillingPdf(invoices: InvoiceForPdf[], pixInfo?: PixInfo | null, options?: PdfOptions) {
    const doc = new jsPDF();
    const isBatch = invoices.length > 1;
    const client = invoices[0]?.client;
    const total = invoices.reduce((s, i) => s + Number(i.totalAmount), 0);

    drawHeader(doc, 'FATURA');
    let y = 38;

    // ── Emitido por ──
    if (pixInfo) {
        y = label(doc, 'Emitido por', y);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(pixInfo.pixReceiverName, 21, y);
        y += 10;
    }

    // ── Cobrado de ──
    y = label(doc, 'Cobrado de', y);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...D);
    doc.text(client?.name || '', 21, y);
    if (client?.phone) {
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...M);
        doc.text(client.phone, 21, y + 5);
        y += 5;
    }
    y += 10;

    // ── Vencimento row ──
    if (!isBatch) {
        const inv = invoices[0];
        doc.setFillColor(...BG);
        doc.roundedRect(14, y, 179, 14, 3, 3, 'F');

        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...D);
        doc.text('Vencimento', 20, y + 6);
        doc.setFontSize(10);
        doc.text(fDate(inv.dueDate), 20, y + 12);

        if (inv.contract?.name) {
            doc.setFontSize(8);
            doc.setTextColor(...D);
            doc.text('Contrato', 85, y + 6);
            doc.setFontSize(10);
            doc.text(inv.contract.name, 85, y + 12);
        }

        if (inv.referenceMonth) {
            doc.setFontSize(8);
            doc.setTextColor(...D);
            doc.text('Referência', 150, y + 6);
            doc.setFontSize(10);
            doc.text(fMonth(inv.referenceMonth), 150, y + 12);
        }

        y += 20;
    }

    // ── Items ──
    for (const inv of invoices) {
        if (isBatch) {
            doc.setFillColor(...D);
            doc.roundedRect(14, y, 181, 8, 2, 2, 'F');
            doc.setFontSize(7);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...W);
            doc.text(inv.contract?.name || inv.notes || 'Fatura avulsa', 20, y + 5.5);
            doc.text(`Venc: ${fDate(inv.dueDate)}`, 130, y + 5.5);
            doc.text(fmt(inv.totalAmount), 190, y + 5.5, { align: 'right' });
            doc.setTextColor(...T);
            y += 12;
        }

        if (inv.items && inv.items.length > 0) {
            // Header
            doc.setFillColor(...BG);
            doc.rect(14, y, 181, 7, 'F');
            doc.setFontSize(6);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...M);
            doc.text('DESCRIÇÃO', 20, y + 5);
            doc.text('QTD', 130, y + 5, { align: 'center' });
            doc.text('UNITÁRIO', 160, y + 5, { align: 'right' });
            doc.text('TOTAL', 190, y + 5, { align: 'right' });
            y += 10;

            // Rows
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...T);
            for (const item of inv.items) {
                doc.text(item.description.substring(0, 55), 20, y);
                doc.text(String(item.quantity), 130, y, { align: 'center' });
                doc.text(fmt(item.unitPrice), 160, y, { align: 'right' });
                doc.setFont('helvetica', 'bold');
                doc.text(fmt(item.totalAmount), 190, y, { align: 'right' });
                doc.setFont('helvetica', 'normal');
                doc.setDrawColor(238, 238, 244);
                doc.setLineWidth(0.15);
                doc.line(20, y + 2.5, 190, y + 2.5);
                y += 7;
            }
            y += 3;
        }
    }

    // ── Total ──
    doc.setDrawColor(...D);
    doc.setLineWidth(0.5);
    doc.line(125, y, 195, y);
    y += 7;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...M);
    doc.text('Total a pagar', 147, y, { align: 'right' });
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...D);
    doc.text(fmt(total), 190, y, { align: 'right' });
    y += 14;

    // ── QR Code + PIX ──
    if (options?.qrCodeDataUrl || pixInfo) {
        y = label(doc, 'Pagamento PIX', y);

        if (options?.qrCodeDataUrl) {
            // QR code on the left
            const qrSize = 42;
            try {
                doc.addImage(options.qrCodeDataUrl, 'PNG', 14, y, qrSize, qrSize);
            } catch { /* skip */ }

            // PIX info on the right of QR
            const rx = 62;
            doc.setFontSize(7);
            doc.setTextColor(...M);
            doc.text('Escaneie o QR Code ou copie o código abaixo', rx, y + 5);

            if (pixInfo) {
                doc.setFontSize(8);
                doc.setTextColor(...T);
                let ry = y + 14;
                doc.setFont('helvetica', 'bold');
                doc.text('Chave:', rx, ry);
                doc.setFont('helvetica', 'normal');
                doc.text(pixInfo.pixKey, rx + 17, ry);
                ry += 6;
                doc.setFont('helvetica', 'bold');
                doc.text('Tipo:', rx, ry);
                doc.setFont('helvetica', 'normal');
                doc.text(pixInfo.pixKeyType, rx + 13, ry);
                ry += 6;
                doc.setFont('helvetica', 'bold');
                doc.text('Nome:', rx, ry);
                doc.setFont('helvetica', 'normal');
                doc.text(pixInfo.pixReceiverName, rx + 16, ry);
            }

            y += qrSize + 4;

            // Copia e Cola
            if (options.pixPayload) {
                doc.setFillColor(...BG);
                doc.roundedRect(14, y, 181, 10, 2, 2, 'F');
                doc.setFontSize(4.5);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(...M);
                doc.text(options.pixPayload.substring(0, 160), 18, y + 6);
                y += 14;
            }
        } else if (pixInfo) {
            // Just PIX text info (no QR)
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...T);
            doc.text(`Chave: ${pixInfo.pixKey}  ·  Tipo: ${pixInfo.pixKeyType}  ·  Nome: ${pixInfo.pixReceiverName}`, 21, y);
            y += 8;
        }
    }

    // Notes
    if (!isBatch && invoices[0]?.notes) {
        doc.setFontSize(7);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(...M);
        doc.text(`Obs: ${invoices[0].notes}`, 21, y + 4);
    }

    drawFooter(doc);

    const name = client?.name?.replace(/\s+/g, '_') || 'fatura';
    doc.save(isBatch ? `cobranca_${name}_${invoices.length}faturas.pdf` : `fatura_${name}_${fDate(invoices[0].dueDate).replace(/\//g, '-')}.pdf`);
}

// ==========================================
// COMPROVANTE
// ==========================================
export function generateReceiptPdf(invoices: InvoiceForPdf[], pixInfo?: PixInfo | null) {
    const doc = new jsPDF();
    const client = invoices[0]?.client;
    const total = invoices.reduce((s, i) => s + Number(i.totalAmount), 0);
    const isBatch = invoices.length > 1;

    drawHeader(doc, 'COMPROVANTE');
    let y = 38;

    // ── Recebido por ──
    if (pixInfo) {
        y = label(doc, 'Recebido por', y);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...T);
        doc.text(pixInfo.pixReceiverName, 21, y);
        y += 10;
    }

    // ── PAGO badge ──
    doc.setFillColor(...GR);
    doc.roundedRect(14, y, 30, 10, 3, 3, 'F');
    doc.setTextColor(...W);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('PAGO', 29, y + 7, { align: 'center' });

    if (invoices[0]?.paidAt) {
        doc.setFontSize(8);
        doc.setTextColor(...M);
        doc.setFont('helvetica', 'normal');
        doc.text(`em ${fDate(invoices[0].paidAt)}`, 48, y + 7);
    }
    doc.setTextColor(...T);
    y += 16;

    // ── Pagador ──
    y = label(doc, 'Pagador', y);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...D);
    doc.text(client?.name || '', 21, y);
    y += 8;

    // ── Valor ──
    doc.setFillColor(...BG);
    doc.roundedRect(14, y, 179, 16, 3, 3, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...M);
    doc.text('Valor pago', 20, y + 6);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...GR);
    doc.text(fmt(total), 20, y + 14);
    doc.setTextColor(...T);
    y += 22;

    // ── Details ──
    for (const inv of invoices) {
        if (isBatch) {
            doc.setFillColor(...BG);
            doc.roundedRect(14, y, 181, 8, 2, 2, 'F');
            doc.setFontSize(7.5);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...T);
            doc.text(inv.contract?.name || inv.notes || 'Fatura avulsa', 20, y + 5.5);
            doc.text(fmt(inv.totalAmount), 190, y + 5.5, { align: 'right' });
            y += 11;
        }

        if (inv.items && inv.items.length > 0) {
            doc.setFontSize(7.5);
            doc.setFont('helvetica', 'normal');
            for (const item of inv.items) {
                doc.setTextColor(...M);
                doc.text(`·  ${item.description.substring(0, 50)}`, 24, y);
                doc.setTextColor(...T);
                doc.text(fmt(item.totalAmount), 190, y, { align: 'right' });
                y += 6;
            }
            y += 2;
        }
    }

    // ── Total ──
    doc.setDrawColor(...D);
    doc.setLineWidth(0.5);
    doc.line(125, y, 195, y);
    y += 6;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...D);
    doc.text('Total:', 150, y, { align: 'right' });
    doc.setTextColor(...GR);
    doc.text(fmt(total), 190, y, { align: 'right' });
    y += 16;

    // ── Confirmation ──
    doc.setFillColor(235, 255, 242);
    doc.roundedRect(14, y, 181, 12, 3, 3, 'F');
    doc.setFillColor(...GR);
    doc.roundedRect(14, y, 2.5, 12, 1, 1, 'F');
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(GR[0], GR[1], GR[2]);
    doc.text('Pagamento confirmado. Este documento serve como comprovante de quitação.', 24, y + 8);

    drawFooter(doc);

    const name = client?.name?.replace(/\s+/g, '_') || 'recibo';
    doc.save(isBatch ? `comprovante_${name}_${invoices.length}faturas.pdf` : `comprovante_${name}_${fDate(invoices[0].dueDate).replace(/\//g, '-')}.pdf`);
}

// ==========================================
// Helper: generate billing PDF with auto QR
// ==========================================
export async function generateBillingPdfWithQr(invoices: InvoiceForPdf[], pixInfo?: PixInfo | null) {
    if (!pixInfo) {
        generateBillingPdf(invoices, pixInfo);
        return;
    }

    const total = invoices.reduce((s, i) => s + Number(i.totalAmount), 0);
    const clientName = invoices[0]?.client?.name || 'Cliente';

    try {
        const res = await fetch('/api/admin/finance/pix-qr', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: total, clientName, invoiceId: invoices[0]?.id }),
        });
        if (res.ok) {
            const d = await res.json();
            generateBillingPdf(invoices, pixInfo, {
                qrCodeDataUrl: d.data.qrDataUrl,
                pixPayload: d.data.payload,
            });
            return;
        }
    } catch { /* fallback without QR */ }

    // Fallback: generate without QR
    generateBillingPdf(invoices, pixInfo);
}
