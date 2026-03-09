'use client';

import jsPDF from 'jspdf';

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

const COLORS = {
    primary: [99, 102, 241] as [number, number, number],
    dark: [15, 20, 35] as [number, number, number],
    text: [30, 30, 40] as [number, number, number],
    muted: [120, 120, 140] as [number, number, number],
    border: [220, 220, 230] as [number, number, number],
    success: [34, 197, 94] as [number, number, number],
    white: [255, 255, 255] as [number, number, number],
    bg: [248, 249, 250] as [number, number, number],
};

function formatCurrency(v: number | string): string {
    return `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

function formatDate(d: string): string {
    return new Date(d).toLocaleDateString('pt-BR');
}

function formatMonth(m: string | null): string {
    if (!m) return '';
    const [y, mo] = m.split('-');
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return `${months[parseInt(mo) - 1]} ${y}`;
}

function statusLabel(s: string): string {
    return { PENDING: 'Pendente', PAID: 'Pago', OVERDUE: 'Atrasado', CANCELLED: 'Cancelado' }[s] || s;
}

function addHeader(doc: jsPDF, title: string) {
    // Header bar
    doc.setFillColor(...COLORS.primary);
    doc.rect(0, 0, 210, 28, 'F');

    doc.setTextColor(...COLORS.white);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('SFlow', 15, 14);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Gestão de Mídia', 15, 20);

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(title, 195, 16, { align: 'right' });

    doc.setTextColor(...COLORS.text);
}

function addFooter(doc: jsPDF) {
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.muted);
    doc.text('Gerado automaticamente por SFlow — sflow.com', 105, pageHeight - 8, { align: 'center' });
    doc.text(`Data de emissão: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`, 105, pageHeight - 4, { align: 'center' });
}

// ==========================================
// COBRANÇA (single or batch invoices)
// ==========================================
export function generateBillingPdf(invoices: InvoiceForPdf[], pixInfo?: PixInfo | null) {
    const doc = new jsPDF();
    const isBatch = invoices.length > 1;
    const clientName = invoices[0]?.client.name || 'Cliente';
    const totalGeral = invoices.reduce((s, i) => s + Number(i.totalAmount), 0);

    addHeader(doc, isBatch ? 'COBRANÇA' : 'FATURA');

    let y = 38;

    // Client info box
    doc.setFillColor(...COLORS.bg);
    doc.roundedRect(15, y, 180, 22, 3, 3, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.text);
    doc.text('Cliente:', 20, y + 8);
    doc.setFont('helvetica', 'normal');
    doc.text(clientName, 45, y + 8);

    if (invoices[0]?.client.phone) {
        doc.setFont('helvetica', 'bold');
        doc.text('Telefone:', 120, y + 8);
        doc.setFont('helvetica', 'normal');
        doc.text(invoices[0].client.phone, 148, y + 8);
    }

    const refInfo = isBatch ? `${invoices.length} faturas` : invoices[0]?.referenceMonth ? formatMonth(invoices[0].referenceMonth) : '';
    if (refInfo) {
        doc.setFont('helvetica', 'bold');
        doc.text('Referência:', 20, y + 16);
        doc.setFont('helvetica', 'normal');
        doc.text(refInfo, 50, y + 16);
    }

    y += 30;

    // Invoice table
    for (const inv of invoices) {
        // Invoice header
        if (isBatch) {
            doc.setFillColor(...COLORS.primary);
            doc.setTextColor(...COLORS.white);
            doc.roundedRect(15, y, 180, 9, 2, 2, 'F');
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            const label = inv.contract?.name || inv.notes || 'Fatura avulsa';
            doc.text(label, 20, y + 6);
            doc.text(`Venc: ${formatDate(inv.dueDate)}`, 130, y + 6);
            doc.text(formatCurrency(inv.totalAmount), 190, y + 6, { align: 'right' });
            doc.setTextColor(...COLORS.text);
            y += 13;
        } else {
            // Single invoice info
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.text('Vencimento:', 20, y);
            doc.setFont('helvetica', 'normal');
            doc.text(formatDate(inv.dueDate), 52, y);

            if (inv.contract?.name) {
                doc.setFont('helvetica', 'bold');
                doc.text('Contrato:', 100, y);
                doc.setFont('helvetica', 'normal');
                doc.text(inv.contract.name, 128, y);
            }

            if (inv.referenceMonth) {
                doc.setFont('helvetica', 'bold');
                doc.text('Ref:', 20, y + 6);
                doc.setFont('helvetica', 'normal');
                doc.text(formatMonth(inv.referenceMonth), 35, y + 6);
            }

            y += 12;
        }

        // Items table header
        if (inv.items && inv.items.length > 0) {
            doc.setFillColor(240, 240, 245);
            doc.rect(15, y, 180, 7, 'F');
            doc.setFontSize(7);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...COLORS.muted);
            doc.text('DESCRIÇÃO', 20, y + 5);
            doc.text('QTD', 130, y + 5, { align: 'center' });
            doc.text('UNIT.', 155, y + 5, { align: 'right' });
            doc.text('TOTAL', 190, y + 5, { align: 'right' });
            doc.setTextColor(...COLORS.text);
            y += 10;

            // Items
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            for (const item of inv.items) {
                doc.text(item.description.substring(0, 60), 20, y);
                doc.text(String(item.quantity), 130, y, { align: 'center' });
                doc.text(formatCurrency(item.unitPrice), 155, y, { align: 'right' });
                doc.text(formatCurrency(item.totalAmount), 190, y, { align: 'right' });
                y += 6;
            }

            // Subtotal line
            doc.setDrawColor(...COLORS.border);
            doc.line(15, y, 195, y);
            y += 5;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.text('Subtotal:', 145, y, { align: 'right' });
            doc.text(formatCurrency(inv.totalAmount), 190, y, { align: 'right' });
            y += 8;
        }

        if (isBatch) y += 2;
    }

    // Grand total for batch
    if (isBatch) {
        doc.setFillColor(...COLORS.primary);
        doc.setTextColor(...COLORS.white);
        doc.roundedRect(100, y, 95, 12, 3, 3, 'F');
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('TOTAL:', 110, y + 8);
        doc.text(formatCurrency(totalGeral), 190, y + 8, { align: 'right' });
        doc.setTextColor(...COLORS.text);
        y += 20;
    } else {
        // Single total box
        doc.setFillColor(...COLORS.primary);
        doc.setTextColor(...COLORS.white);
        doc.roundedRect(100, y, 95, 14, 3, 3, 'F');
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('TOTAL:', 110, y + 10);
        doc.text(formatCurrency(totalGeral), 190, y + 10, { align: 'right' });
        doc.setTextColor(...COLORS.text);
        y += 22;
    }

    // PIX info
    if (pixInfo) {
        doc.setFillColor(240, 245, 255);
        const boxH = 28;
        doc.roundedRect(15, y, 180, boxH, 3, 3, 'F');
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...COLORS.primary);
        doc.text('Dados para Pagamento PIX', 20, y + 8);
        doc.setTextColor(...COLORS.text);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(`Chave: ${pixInfo.pixKey}`, 20, y + 15);
        doc.text(`Tipo: ${pixInfo.pixKeyType}`, 120, y + 15);
        doc.text(`Nome: ${pixInfo.pixReceiverName}`, 20, y + 22);
        y += boxH + 6;
    }

    // Notes
    if (!isBatch && invoices[0]?.notes) {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(...COLORS.muted);
        doc.text(`Obs: ${invoices[0].notes}`, 20, y);
    }

    addFooter(doc);

    const fileName = isBatch
        ? `cobranca_${clientName.replace(/\s+/g, '_')}_${invoices.length}faturas.pdf`
        : `fatura_${clientName.replace(/\s+/g, '_')}_${formatDate(invoices[0].dueDate).replace(/\//g, '-')}.pdf`;

    doc.save(fileName);
}

// ==========================================
// COMPROVANTE DE PAGAMENTO (receipt)
// ==========================================
export function generateReceiptPdf(invoices: InvoiceForPdf[], pixInfo?: PixInfo | null) {
    const doc = new jsPDF();
    const clientName = invoices[0]?.client.name || 'Cliente';
    const totalGeral = invoices.reduce((s, i) => s + Number(i.totalAmount), 0);
    const isBatch = invoices.length > 1;

    addHeader(doc, 'COMPROVANTE');

    let y = 38;

    // Status badge
    doc.setFillColor(...COLORS.success);
    doc.roundedRect(15, y, 50, 10, 3, 3, 'F');
    doc.setTextColor(...COLORS.white);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('PAGO', 40, y + 7, { align: 'center' });
    doc.setTextColor(...COLORS.text);
    y += 16;

    // Client & Value box
    doc.setFillColor(...COLORS.bg);
    doc.roundedRect(15, y, 180, 28, 3, 3, 'F');
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Cliente:', 20, y + 8);
    doc.setFont('helvetica', 'normal');
    doc.text(clientName, 45, y + 8);

    doc.setFont('helvetica', 'bold');
    doc.text('Valor Total:', 20, y + 16);
    doc.setTextColor(...COLORS.success);
    doc.setFontSize(12);
    doc.text(formatCurrency(totalGeral), 55, y + 16);
    doc.setTextColor(...COLORS.text);

    if (invoices[0]?.paidAt) {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('Data Pagamento:', 120, y + 16);
        doc.setFont('helvetica', 'normal');
        doc.text(formatDate(invoices[0].paidAt), 165, y + 16);
    }

    const refInfo = isBatch ? `${invoices.length} faturas` : invoices[0]?.referenceMonth ? formatMonth(invoices[0].referenceMonth) : '';
    if (refInfo) {
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text('Referência:', 20, y + 24);
        doc.setFont('helvetica', 'normal');
        doc.text(refInfo, 50, y + 24);
    }

    y += 36;

    // Invoice details
    for (const inv of invoices) {
        if (isBatch) {
            doc.setFillColor(240, 240, 245);
            doc.roundedRect(15, y, 180, 8, 2, 2, 'F');
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            const label = inv.contract?.name || inv.notes || 'Fatura avulsa';
            doc.text(label, 20, y + 5.5);
            doc.text(`Venc: ${formatDate(inv.dueDate)}`, 120, y + 5.5);
            doc.text(formatCurrency(inv.totalAmount), 190, y + 5.5, { align: 'right' });
            y += 11;
        }

        if (inv.items && inv.items.length > 0) {
            doc.setFontSize(7.5);
            doc.setFont('helvetica', 'normal');
            for (const item of inv.items) {
                doc.setTextColor(...COLORS.muted);
                doc.text(`• ${item.description.substring(0, 55)}`, 25, y);
                doc.text(`${item.quantity}x ${formatCurrency(item.unitPrice)} = ${formatCurrency(item.totalAmount)}`, 190, y, { align: 'right' });
                doc.setTextColor(...COLORS.text);
                y += 5;
            }
            y += 3;
        }
    }

    // Total line
    doc.setDrawColor(...COLORS.border);
    doc.line(15, y, 195, y);
    y += 6;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Total pago:', 130, y, { align: 'right' });
    doc.setTextColor(...COLORS.success);
    doc.text(formatCurrency(totalGeral), 190, y, { align: 'right' });
    doc.setTextColor(...COLORS.text);
    y += 12;

    // Confirmation message
    doc.setFillColor(240, 255, 244);
    doc.roundedRect(15, y, 180, 16, 3, 3, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.success);
    doc.text('✓ Pagamento confirmado. Este documento serve como comprovante de quitação.', 105, y + 10, { align: 'center' });
    doc.setTextColor(...COLORS.text);

    addFooter(doc);

    const fileName = isBatch
        ? `comprovante_${clientName.replace(/\s+/g, '_')}_${invoices.length}faturas.pdf`
        : `comprovante_${clientName.replace(/\s+/g, '_')}_${formatDate(invoices[0].dueDate).replace(/\//g, '-')}.pdf`;

    doc.save(fileName);
}
