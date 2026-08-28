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

// Two different rules for two different kinds of value in this module:
//
// - Pure dates (@db.Date columns, and DATE-type answers): NEVER convert.
//   "2026-09-05" means the 5th everywhere in the world -- parse the string
//   manually, as formatDateBR/dbDateToIso already do above.
//
// - Instants (submittedAt, createdAt, lastOpenedAt, event timestamps):
//   stored correctly in UTC, but MUST convert to the app's display timezone
//   when shown -- a raw UTC hour is not what a human reading it expects.
//   The previous version of this function used getUTC* getters, which was
//   right for the pure-date rule but wrong here: it left instants in UTC
//   instead of converting them, which is the actual bug this fixes.
const TZ = process.env.APP_TIMEZONE || 'America/Sao_Paulo';

function weekdayShort(long: string): string {
    // Intl gives "quinta-feira" for pt-BR; segunda..sexta drop the
    // "-feira" suffix in casual use, sábado/domingo don't have one to drop.
    return long.replace('-feira', '');
}

export function formatDateTimeBR(input: Date | string): string {
    const date = typeof input === 'string' ? new Date(input) : input;
    const parts = new Intl.DateTimeFormat('pt-BR', {
        timeZone: TZ,
        day: '2-digit', month: '2-digit', year: 'numeric', weekday: 'long',
        hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(date);
    const get = (type: string) => parts.find((p) => p.type === type)?.value || '';
    return `${get('day')}/${get('month')}/${get('year')} (${weekdayShort(get('weekday'))}) às ${get('hour')}h${get('minute')}`;
}

// referenceMonth/dueDate come back from Prisma as Date objects for @db.Date columns.
// Convert with UTC getters only -- local getters shift by the server's timezone offset.
export function dbDateToIso(date: Date): string {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}
