// One place for showing dates: the Persian calendar with Persian digits, from ISO values.
import { jalaliToISO, persianDateParts } from './domain';

export const JALALI_MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
export const JALALI_WEEKDAYS_SHORT = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

const faDigits = (value: number | string) => String(value).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);

/** A date-only value ("2026-10-24") is a calendar day; anything longer is an instant. */
const toDate = (value?: string | number | Date | null) => {
  if (value === undefined || value === null || value === '') return undefined;
  const date = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

/** "۲ آبان ۱۴۰۵", or '' when the value is not a date. */
export function formatJalaliDate(value?: string | number | Date | null): string {
  const date = toDate(value);
  return date ? date.toLocaleDateString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
}

/** "۲ آبان ۱۴۰۵، ۱۴:۳۰", or '' when the value is not a date. */
export function formatJalaliDateTime(value?: string | number | Date | null): string {
  const date = toDate(value);
  if (!date) return '';
  return `${formatJalaliDate(date)}، ${date.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
}

/** Today in the local time zone as YYYY-MM-DD. */
export const localISODate = (date = new Date()) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

export interface JalaliMonth { year: number; month: number }

export const jalaliMonthOf = (iso: string): JalaliMonth => {
  const parts = persianDateParts(new Date(`${iso}T00:00:00Z`));
  return { year: parts.year, month: parts.month };
};

export const shiftJalaliMonth = ({ year, month }: JalaliMonth, delta: number): JalaliMonth => {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
};

/** Days of a Persian month as ISO dates, plus how many blank cells precede day 1 in a Saturday-first week. */
export function jalaliMonthGrid({ year, month }: JalaliMonth): { leading: number; days: { iso: string; day: number }[] } {
  const first = jalaliToISO(year, month, 1);
  const start = new Date(`${first}T00:00:00Z`);
  let length = month <= 6 ? 31 : month <= 11 ? 30 : 29;
  if (month === 12) { try { jalaliToISO(year, 12, 30); length = 30; } catch { /* 29-day Esfand */ } }
  const days = Array.from({ length }, (_, index) => {
    const day = new Date(start.getTime() + index * 86400000);
    return { iso: day.toISOString().slice(0, 10), day: index + 1 };
  });
  return { leading: (start.getUTCDay() + 1) % 7, days };
}

export const jalaliMonthLabel = ({ year, month }: JalaliMonth) => `${JALALI_MONTHS[month - 1]} ${faDigits(year)}`;
export const persianNumber = faDigits;
