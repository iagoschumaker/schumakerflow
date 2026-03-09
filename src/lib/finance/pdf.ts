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

// ── Colors ──
const P = { r: 99, g: 102, b: 241 };    // primary indigo
const D = { r: 17, g: 20, b: 39 };      // dark
const T = { r: 55, g: 55, b: 70 };      // text
const M = { r: 140, g: 145, b: 165 };   // muted
const B = { r: 225, g: 228, b: 235 };   // border
const G = { r: 34, g: 197, b: 94 };     // green
const W = { r: 255, g: 255, b: 255 };   // white

function rgb(c: { r: number; g: number; b: number }): [number, number, number] {
    return [c.r, c.g, c.b];
}

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

// ── Shared header ──
function drawHeader(doc: jsPDF, title: string, accentColor: { r: number; g: number; b: number }) {
    // Dark sidebar accent
    doc.setFillColor(accentColor.r, accentColor.g, accentColor.b);
    doc.rect(0, 0, 6, 297, 'F');

    // Logo
    try {
        doc.addImage(SFLOW_LOGO_BASE64, 'PNG', 16, 12, 18, 18);
    } catch {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...rgb(D));
        doc.text('SF', 22, 24);
    }

    // Brand
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...rgb(D));
    doc.text('SFlow', 38, 20);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...rgb(M));
    doc.text('Gestão de Mídia', 38, 26);

    // Title right-aligned
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(accentColor.r, accentColor.g, accentColor.b);
    doc.text(title, 195, 24, { align: 'right' });

    // Thin line
    doc.setDrawColor(...rgb(B));
    doc.setLineWidth(0.4);
    doc.line(16, 35, 195, 35);
}

// ── Shared footer ──
function drawFooter(doc: jsPDF) {
    const h = doc.internal.pageSize.getHeight();
    doc.setDrawColor(...rgb(B));
    doc.setLineWidth(0.3);
    doc.line(16, h - 18, 195, h - 18);
    doc.setFontSize(6);
    doc.setTextColor(...rgb(M));
    doc.text('Gerado automaticamente por SFlow — schumaker.com.br', 105, h - 12, { align: 'center' });
    doc.text(`Emissão: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 105, h - 8, { align: 'center' });
}

// ── Helper: draw a section label ──
function sectionLabel(doc: jsPDF, label: string, y: number, color: { r: number; g: number; b: number } = P) {
    doc.setFillColor(color.r, color.g, color.b);
    doc.roundedRect(16, y, 3, 10, 1.5, 1.5, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(color.r, color.g, color.b);
    doc.text(label.toUpperCase(), 24, y + 7);
    doc.setTextColor(...rgb(T));
    return y + 14;
}

// ==========================================
// FATURA / COBRANÇA
// ==========================================
export function generateBillingPdf(invoices: InvoiceForPdf[], pixInfo?: PixInfo | null, options?: PdfOptions) {
    const doc = new jsPDF();
    const isBatch = invoices.length > 1;
    const client = invoices[0]?.client;
    const total = invoices.reduce((s, i) => s + Number(i.totalAmount), 0);

    drawHeader(doc, 'FATURA', P);

    let y = 42;

    // ── Emitido por ──
    if (pixInfo) {
        y = sectionLabel(doc, 'Emitido por', y);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...rgb(T));
        doc.text(pixInfo.pixReceiverName, 24, y);
        y += 8;
    }

    // ── Cliente ──
    y = sectionLabel(doc, 'Cobrado de', y);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...rgb(D));
    doc.text(client?.name || '', 24, y);
    if (client?.phone) {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...rgb(M));
        doc.text(client.phone, 24, y + 5);
        y += 5;
    }
    y += 10;

    // ── Info row ──
    if (!isBatch) {
        const inv = invoices[0];
        const parts: string[] = [];
        parts.push(`Vencimento: ${fDate(inv.dueDate)}`);
        if (inv.contract?.name) parts.push(`Contrato: ${inv.contract.name}`);
        if (inv.referenceMonth) parts.push(`Ref: ${fMonth(inv.referenceMonth)}`);
        doc.setFillColor(245, 246, 250);
        doc.roundedRect(16, y, 179, 10, 3, 3, 'F');
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...rgb(M));
        doc.text(parts.join('     ·     '), 24, y + 7);
        y += 16;
    }

    // ── Items table ──
    for (const inv of invoices) {
        if (isBatch) {
            doc.setFillColor(P.r, P.g, P.b);
            doc.roundedRect(16, y, 179, 8, 2, 2, 'F');
            doc.setFontSize(7);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...rgb(W));
            doc.text(inv.contract?.name || inv.notes || 'Fatura avulsa', 22, y + 5.5);
            doc.text(`Venc: ${fDate(inv.dueDate)}`, 130, y + 5.5);
            doc.text(fmt(inv.totalAmount), 190, y + 5.5, { align: 'right' });
            doc.setTextColor(...rgb(T));
            y += 12;
        }

        if (inv.items && inv.items.length > 0) {
            // Table header
            doc.setFillColor(245, 246, 250);
            doc.rect(16, y, 179, 7, 'F');
            doc.setFontSize(6);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...rgb(M));
            doc.text('DESCRIÇÃO', 22, y + 5);
            doc.text('QTD', 130, y + 5, { align: 'center' });
            doc.text('UNIT.', 158, y + 5, { align: 'right' });
            doc.text('TOTAL', 190, y + 5, { align: 'right' });
            y += 10;

            // Rows
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...rgb(T));
            for (const item of inv.items) {
                doc.text(item.description.substring(0, 55), 22, y);
                doc.text(String(item.quantity), 130, y, { align: 'center' });
                doc.text(fmt(item.unitPrice), 158, y, { align: 'right' });
                doc.setFont('helvetica', 'bold');
                doc.text(fmt(item.totalAmount), 190, y, { align: 'right' });
                doc.setFont('helvetica', 'normal');

                doc.setDrawColor(240, 240, 245);
                doc.setLineWidth(0.15);
                doc.line(22, y + 2.5, 190, y + 2.5);
                y += 7;
            }
            y += 3;
        }
    }

    // ── Total ──
    doc.setDrawColor(...rgb(B));
    doc.setLineWidth(0.3);
    doc.line(120, y, 195, y);
    y += 7;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...rgb(M));
    doc.text('Total a pagar', 150, y, { align: 'right' });
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(P.r, P.g, P.b);
    doc.text(fmt(total), 190, y, { align: 'right' });
    doc.setTextColor(...rgb(T));
    y += 14;

    // ── QR Code ──
    if (options?.qrCodeDataUrl) {
        y = sectionLabel(doc, 'Pagamento PIX', y);
        try {
            doc.addImage(options.qrCodeDataUrl, 'PNG', 16, y, 44, 44);
        } catch {
            /* skip */
        }

        // PIX info next to QR
        const qrInfoX = 66;
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...rgb(M));
        doc.text('Escaneie o QR Code ou use o código', qrInfoX, y + 6);
        doc.text('Copia e Cola abaixo:', qrInfoX, y + 11);

        if (pixInfo) {
            doc.setFontSize(8);
            doc.setTextColor(...rgb(T));
            doc.setFont('helvetica', 'bold');
            doc.text('Chave:', qrInfoX, y + 20);
            doc.setFont('helvetica', 'normal');
            doc.text(pixInfo.pixKey, qrInfoX + 18, y + 20);
            doc.setFont('helvetica', 'bold');
            doc.text('Tipo:', qrInfoX, y + 26);
            doc.setFont('helvetica', 'normal');
            doc.text(pixInfo.pixKeyType, qrInfoX + 14, y + 26);
            doc.setFont('helvetica', 'bold');
            doc.text('Nome:', qrInfoX, y + 32);
            doc.setFont('helvetica', 'normal');
            doc.text(pixInfo.pixReceiverName, qrInfoX + 17, y + 32);
        }

        y += 48;

        // Copia e Cola
        if (options.pixPayload) {
            doc.setFillColor(245, 246, 250);
            doc.roundedRect(16, y, 179, 10, 2, 2, 'F');
            doc.setFontSize(5);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...rgb(M));
            doc.text(options.pixPayload.substring(0, 140), 20, y + 6);
            y += 14;
        }
    } else if (pixInfo) {
        // PIX info without QR
        y = sectionLabel(doc, 'Pagamento PIX', y);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...rgb(T));
        doc.text(`Chave: ${pixInfo.pixKey}  ·  Tipo: ${pixInfo.pixKeyType}  ·  Nome: ${pixInfo.pixReceiverName}`, 24, y);
        y += 10;
    }

    // Notes
    if (!isBatch && invoices[0]?.notes) {
        doc.setFontSize(7);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(...rgb(M));
        doc.text(`Obs: ${invoices[0].notes}`, 24, y + 4);
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

    drawHeader(doc, 'RECIBO', G);

    let y = 42;

    // ── Recebido por ──
    if (pixInfo) {
        y = sectionLabel(doc, 'Recebido por', y, G);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...rgb(T));
        doc.text(pixInfo.pixReceiverName, 24, y);
        y += 10;
    }

    // ── PAGO badge ──
    doc.setFillColor(G.r, G.g, G.b);
    doc.roundedRect(16, y, 35, 11, 4, 4, 'F');
    doc.setTextColor(...rgb(W));
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('PAGO', 33.5, y + 8, { align: 'center' });

    if (invoices[0]?.paidAt) {
        doc.setFontSize(8);
        doc.setTextColor(...rgb(M));
        doc.setFont('helvetica', 'normal');
        doc.text(`em ${fDate(invoices[0].paidAt)}`, 56, y + 8);
    }
    doc.setTextColor(...rgb(T));
    y += 18;

    // ── Cliente + Valor ──
    y = sectionLabel(doc, 'Pagador', y, G);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...rgb(D));
    doc.text(client?.name || '', 24, y);
    y += 8;

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...rgb(M));
    doc.text('Valor pago:', 24, y);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(G.r, G.g, G.b);
    doc.text(fmt(total), 60, y);
    doc.setTextColor(...rgb(T));
    y += 12;

    // ── Details ──
    for (const inv of invoices) {
        if (isBatch) {
            doc.setFillColor(245, 246, 250);
            doc.roundedRect(16, y, 179, 8, 2, 2, 'F');
            doc.setFontSize(7.5);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...rgb(T));
            doc.text(inv.contract?.name || inv.notes || 'Fatura avulsa', 22, y + 5.5);
            doc.text(fmt(inv.totalAmount), 190, y + 5.5, { align: 'right' });
            y += 11;
        }

        if (inv.items && inv.items.length > 0) {
            doc.setFontSize(7.5);
            doc.setFont('helvetica', 'normal');
            for (const item of inv.items) {
                doc.setTextColor(...rgb(M));
                doc.text(`·  ${item.description.substring(0, 50)}`, 28, y);
                doc.setTextColor(...rgb(T));
                doc.text(fmt(item.totalAmount), 190, y, { align: 'right' });
                y += 6;
            }
            y += 2;
        }
    }

    // ── Total line ──
    doc.setDrawColor(...rgb(B));
    doc.setLineWidth(0.3);
    doc.line(120, y, 195, y);
    y += 6;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...rgb(D));
    doc.text('Total:', 150, y, { align: 'right' });
    doc.setTextColor(G.r, G.g, G.b);
    doc.text(fmt(total), 190, y, { align: 'right' });
    y += 16;

    // ── Confirmation ──
    doc.setFillColor(235, 255, 242);
    doc.roundedRect(16, y, 179, 14, 3, 3, 'F');
    doc.setFillColor(G.r, G.g, G.b);
    doc.roundedRect(16, y, 3, 14, 1.5, 1.5, 'F');
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(G.r, G.g, G.b);
    doc.text('Pagamento confirmado. Este documento serve como comprovante de quitação.', 26, y + 9);

    drawFooter(doc);

    const name = client?.name?.replace(/\s+/g, '_') || 'recibo';
    doc.save(isBatch ? `comprovante_${name}_${invoices.length}faturas.pdf` : `comprovante_${name}_${fDate(invoices[0].dueDate).replace(/\//g, '-')}.pdf`);
}
