const MESES = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];
const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

export function formatDateBR(iso: string): string {
    const [y, m, d] = iso.split('-').map(Number);
    const weekday = DIAS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
    return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y} (${weekday})`;
}

export function formatMonthBR(iso: string): string {
    const [y, m] = iso.split('-').map(Number);
    const nome = MESES[m - 1];
    return `${nome.charAt(0).toUpperCase()}${nome.slice(1)} / ${y}`;
}

export function formatMoneyBR(raw: string): string {
    const n = Number(raw);
    if (Number.isNaN(n)) return raw;
    return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatTimeBR(raw: string): string {
    return raw.replace(':', 'h');
}

// referenceMonth/dueDate come back from Prisma as Date objects for @db.Date columns.
// Convert with UTC getters only -- local getters shift by the server's timezone offset.
export function dbDateToIso(date: Date): string {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}
