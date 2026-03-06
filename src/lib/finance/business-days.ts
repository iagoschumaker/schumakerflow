/**
 * Business Day Calculator
 * Calculate the Nth business day of a given month.
 * Business days = Monday to Friday.
 * Supports optional holiday calendar for future expansion.
 */

interface Holiday {
    date: Date;
    name: string;
}

/**
 * Get the Nth business day of a given month/year.
 * @param year - Full year (e.g. 2026)
 * @param month - 1-indexed month (1=January, 12=December)
 * @param n - Which business day (default 5)
 * @param holidays - Optional list of holidays to exclude
 * @returns The date of the Nth business day
 */
export function getNthBusinessDay(
    year: number,
    month: number,
    n: number = 5,
    holidays?: Holiday[]
): Date {
    const holidaySet = new Set(
        (holidays || []).map((h) => formatDateKey(h.date))
    );

    let businessDayCount = 0;
    let day = 1;

    // Get the last day of the month
    const lastDay = new Date(year, month, 0).getDate();

    while (day <= lastDay) {
        const date = new Date(year, month - 1, day);
        const dayOfWeek = date.getDay();

        // Monday (1) to Friday (5)
        const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
        const isHoliday = holidaySet.has(formatDateKey(date));

        if (isWeekday && !isHoliday) {
            businessDayCount++;
            if (businessDayCount === n) {
                return date;
            }
        }

        day++;
    }

    // If the month doesn't have N business days, return last business day
    // (edge case, shouldn't happen with n=5)
    return new Date(year, month - 1, lastDay);
}

/**
 * Format date as YYYY-MM-DD for comparison.
 */
function formatDateKey(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/**
 * Check if a date is a business day.
 */
export function isBusinessDay(date: Date, holidays?: Holiday[]): boolean {
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) return false;

    if (holidays) {
        const key = formatDateKey(date);
        return !holidays.some((h) => formatDateKey(h.date) === key);
    }

    return true;
}

/**
 * Get the due date for a monthly invoice.
 * Due on the 5th business day of the given month.
 */
export function getMonthlyDueDate(year: number, month: number): Date {
    return getNthBusinessDay(year, month, 5);
}

/**
 * Format date as DD/MM/YYYY HH:MM for display.
 */
export function formatDateBR(date: Date): string {
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${d}/${m}/${y} ${h}:${min}`;
}

/**
 * Format date as YYYY-MM for reference month.
 */
export function formatReferenceMonth(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
}
