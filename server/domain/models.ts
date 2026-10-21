import { DomainError } from './repository.ts';
export function invalid(message: string): never { throw new DomainError(422, 'INVALID_INPUT', message); }
export function text(value: any, label = 'متن', required = false, max = 10000): string {
    if (typeof value !== 'string' || value.length > max || (required && !value.trim()))
        invalid(`${label} معتبر لازم است.`);
    return value.trim();
}
export function numeric(value: any, label = 'عدد', max = 1000000): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > max)
        invalid(`${label} معتبر لازم است.`);
    return value;
}
export function strings(value: any, label = 'فهرست', max = 200): string[] {
    if (!Array.isArray(value) || value.length > max || value.some(item => typeof item !== 'string' || !item.trim() || item.length > 300))
        invalid(`${label} معتبر لازم است.`);
    return [...new Set(value.map(item => item.trim()))];
}
export function boolean(value: any): boolean { if (typeof value !== 'boolean')
    invalid('مقدار بولی معتبر لازم است.'); return value; }
export function dto(value: any, allowed: string[]): any {
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !allowed.includes(key)))
        invalid('فیلد ورودی مجاز نیست.');
    return value;
}
const taskAliases: Record<string, string> = { todo: 'pending', pending: 'pending', in_progress: 'inprogress', inprogress: 'inprogress', under_review: 'review', review: 'review', completed: 'completed', blocked: 'blocked', cancelled: 'cancelled', canceled: 'cancelled' };
export function taskStatus(value: any): string { const mapped = taskAliases[String(value).toLowerCase()]; if (!mapped)
    invalid('وضعیت وظیفه معتبر نیست.'); return mapped; }
export function projectStatus(value: any): string {
    const mapped: Record<string, string> = { draft: 'DRAFT', pending: 'DRAFT', review: 'DRAFT', active: 'ACTIVE', in_progress: 'IN_PROGRESS', inprogress: 'IN_PROGRESS', connected_to_wordpress: 'CONNECTED_TO_WORDPRESS', completed: 'COMPLETED', delayed: 'delayed', on_hold: 'delayed', suspended: 'delayed', blocked: 'delayed', archived: 'ARCHIVED', cancelled: 'CANCELLED', canceled: 'CANCELLED', terminated: 'CANCELLED' };
    const status = mapped[String(value).toLowerCase()];
    if (!status)
        invalid('وضعیت پروژه معتبر نیست.');
    return status;
}
export function priority(value: any): string { const mapped: Record<string, string> = { low: 'low', medium: 'medium', high: 'high', urgent: 'critical', critical: 'critical' }; const result = mapped[String(value).toLowerCase()]; if (!result)
    invalid('اولویت معتبر نیست.'); return result; }
// Strict Persian-calendar dates are inverted using the platform's ICU calendar.
// Ambiguous text remains raw; a date-only value never becomes a guessed instant.
const persianCalendar = new Intl.DateTimeFormat('en-u-ca-persian', { timeZone: 'UTC', year: 'numeric', month: 'numeric', day: 'numeric' });
function persianDate(year: number, month: number, day: number): string {
    if (month < 1 || month > 12 || day < 1 || day > 31)
        invalid('تاریخ شمسی نامعتبر است.');
    const compare = (stamp: number) => { const parts = Object.fromEntries(persianCalendar.formatToParts(new Date(stamp)).map(part => [part.type, part.value])); return Number(parts.year) * 10000 + Number(parts.month) * 100 + Number(parts.day); };
    const target = year * 10000 + month * 100 + day;
    let low = Math.floor(Date.UTC(year + 621, 0, 1) / 86400000), high = Math.floor(Date.UTC(year + 622, 11, 31) / 86400000);
    while (low <= high) {
        const middle = Math.floor((low + high) / 2), value = compare(middle * 86400000);
        if (value === target)
            return new Date(middle * 86400000).toISOString().slice(0, 10);
        if (value < target)
            low = middle + 1;
        else
            high = middle - 1;
    }
    invalid('تاریخ شمسی نامعتبر است.');
}
export function dateFields(value: any, key: string): any {
    const raw = text(value, key, false, 100);
    let canonical: string | null = null;
    const digits = raw.replace(/[۰-۹]/g, c => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/[٠-٩]/g, c => String('٠١٢٣٤٥٦٧٨٩'.indexOf(c)));
    const jalali = /^(1[3-6]\d{2})[/-](\d{1,2})[/-](\d{1,2})$/.exec(digits);
    if (jalali)
        canonical = persianDate(Number(jalali[1]), Number(jalali[2]), Number(jalali[3]));
    else if (/^(19|20|21|22)\d{2}-\d{2}-\d{2}$/.test(digits)) {
        const stamp = new Date(digits + 'T00:00:00.000Z');
        if (Number.isFinite(stamp.getTime()) && stamp.toISOString().slice(0, 10) === digits)
            canonical = digits;
        else
            invalid('تاریخ میلادی نامعتبر است.');
    }
    else if (/^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/.test(digits)) {
        const prefix = digits.slice(0, 10);
        const day = new Date(prefix + 'T00:00:00Z');
        if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== prefix)
            invalid('تاریخ نامعتبر است.');
        const stamp = new Date(digits);
        if (!Number.isFinite(stamp.getTime()))
            invalid('تاریخ نامعتبر است.');
        canonical = stamp.toISOString();
    }
    return { [key]: raw, [`${key}Canonical`]: canonical };
}
