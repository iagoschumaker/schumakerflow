import type { BriefingTemplateFieldType } from '@prisma/client';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MONEY_RE = /^-?\d+(\.\d{1,2})?$/;

/** Checks a raw answer value against its field type. Empty values (null/undefined/'') are always valid -- required-ness is checked separately on submit. */
export function isValidFieldValue(type: BriefingTemplateFieldType, raw: unknown): boolean {
    if (raw === null || raw === undefined || raw === '') return true;

    switch (type) {
        case 'text':
        case 'textarea':
        case 'phone':
            return typeof raw === 'string';
        case 'date':
            return typeof raw === 'string' && DATE_RE.test(raw);
        case 'month':
            return typeof raw === 'string' && MONTH_RE.test(raw);
        case 'time':
            return typeof raw === 'string' && TIME_RE.test(raw);
        case 'money':
            return typeof raw === 'string' && MONEY_RE.test(raw);
        case 'number':
            return typeof raw === 'number' || (typeof raw === 'string' && raw.trim() !== '' && !Number.isNaN(Number(raw)));
        case 'select':
            return typeof raw === 'string';
        case 'multi_select':
        case 'client_list':
            return Array.isArray(raw) && raw.every((v) => typeof v === 'string');
        case 'boolean':
            return typeof raw === 'boolean' || raw === 'true' || raw === 'false';
        case 'email':
            return typeof raw === 'string' && EMAIL_RE.test(raw);
        case 'url':
            try {
                if (typeof raw !== 'string') return false;
                new URL(raw);
                return true;
            } catch {
                return false;
            }
        default:
            return true;
    }
}

export function hasValue(value: unknown): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === 'object' && value !== null && 'raw' in value) {
        const raw = (value as { raw: unknown }).raw;
        if (Array.isArray(raw)) return raw.length > 0;
        return raw !== null && raw !== undefined && raw !== '';
    }
    return true;
}
