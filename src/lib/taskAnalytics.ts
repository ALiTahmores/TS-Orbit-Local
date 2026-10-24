// Task metrics derived only from stored task data: status history timestamps,
// canonical due dates and assignments. Nothing here is estimated or seeded.
import { assignedIds } from './domain';

export type SeriesPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly';
export interface SeriesPoint { name: string; Completed: number; OnTime: number | null }

const DAY = 24 * 60 * 60 * 1000;
const isoDate = (value: unknown) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : undefined;

/** When the task last entered "completed" (status history), else its last update while completed. */
export function completedAt(task: any): Date | undefined {
  if (String(task?.status).toLowerCase() !== 'completed') return undefined;
  const entry = [...(task.statusHistory || [])].reverse().find((item: any) => String(item?.newStatus).toLowerCase() === 'completed');
  const stamp = entry?.timestamp || task.updatedAt;
  const date = stamp ? new Date(stamp) : undefined;
  return date && !Number.isNaN(date.getTime()) ? date : undefined;
}

/** Due date as YYYY-MM-DD, from the canonical fields the server writes. */
export function dueDate(task: any): string | undefined {
  return isoDate(task?.deadlineCanonical) || isoDate(task?.dueDateCanonical) || isoDate(task?.deadline) || isoDate(task?.dueDate);
}

export const todayISO = (now = new Date()) => new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const isOpen = (task: any) => !['completed', 'cancelled'].includes(String(task?.status).toLowerCase());
export const isOverdue = (task: any, today = todayISO()) => isOpen(task) && !!dueDate(task) && dueDate(task)! < today;
export const isDueToday = (task: any, today = todayISO()) => isOpen(task) && dueDate(task) === today;

/** Completed on or before its due date; undefined when the task had no due date. */
export function deliveredOnTime(task: any): boolean | undefined {
  const done = completedAt(task), due = dueDate(task);
  if (!done || !due) return undefined;
  return todayISO(done) <= due;
}

export const tasksAssignedTo = (tasks: any[], userId: string) =>
  userId ? tasks.filter(task => task && (assignedIds(task).includes(userId) || task.assigneeId === userId)) : [];

const MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
const persianYearMonth = new Intl.DateTimeFormat('en-US-u-ca-persian', { year: 'numeric', month: 'numeric' });
const persianWeekday = new Intl.DateTimeFormat('fa-IR', { weekday: 'short' });
const jalaliParts = (date: Date) => {
  const parts = Object.fromEntries(persianYearMonth.formatToParts(date).filter(p => p.type === 'year' || p.type === 'month').map(p => [p.type, Number(p.value)]));
  return { year: parts.year as number, month: parts.month as number };
};
const SEASONS = ['بهار', 'تابستان', 'پاییز', 'زمستان'];
const faDigits = (value: number | string) => String(value).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);

/** Completed-task counts and on-time rate per bucket, oldest bucket first. */
export function completionSeries(tasks: any[], period: SeriesPeriod, now = new Date()): SeriesPoint[] {
  type Bucket = { name: string; match: (date: Date) => boolean };
  const buckets: Bucket[] = [];
  const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const today = startOfDay(now);
  if (period === 'daily') {
    for (let i = 6; i >= 0; i--) {
      const day = new Date(today.getTime() - i * DAY);
      buckets.push({ name: persianWeekday.format(day), match: date => startOfDay(date).getTime() === day.getTime() });
    }
  } else if (period === 'weekly') {
    for (let i = 3; i >= 0; i--) {
      const end = new Date(today.getTime() + DAY - i * 7 * DAY), start = new Date(end.getTime() - 7 * DAY);
      buckets.push({ name: i === 0 ? 'این هفته' : `${faDigits(i)} هفته پیش`, match: date => date >= start && date < end });
    }
  } else {
    const span = period === 'monthly' ? 1 : 3, count = period === 'monthly' ? 6 : 4;
    const current = jalaliParts(now);
    // Months are counted in the Persian calendar; a quarter is one season.
    const index = (parts: { year: number; month: number }) => parts.year * 12 + parts.month - 1;
    const currentIndex = index(current), currentStart = currentIndex - (span === 3 ? (current.month - 1) % 3 : 0);
    for (let i = count - 1; i >= 0; i--) {
      const first = currentStart - i * span, year = Math.floor(first / 12), month = first % 12 + 1;
      const name = span === 1 ? MONTHS[month - 1] : `${SEASONS[Math.floor((month - 1) / 3)]} ${faDigits(year)}`;
      buckets.push({ name, match: date => { const at = index(jalaliParts(date)); return at >= first && at < first + span; } });
    }
  }
  return buckets.map(bucket => {
    const done = tasks.filter(task => { const at = completedAt(task); return !!at && bucket.match(at); });
    const judged = done.map(deliveredOnTime).filter((value): value is boolean => value !== undefined);
    return { name: bucket.name, Completed: done.length, OnTime: judged.length ? Math.round(judged.filter(Boolean).length / judged.length * 100) : null };
  });
}

export function seriesToCsv(points: SeriesPoint[]): string {
  const rows = [['بازه', 'تسک‌های تکمیل‌شده', 'درصد تحویل به‌موقع'], ...points.map(p => [p.name, String(p.Completed), p.OnTime === null ? '' : String(p.OnTime)])];
  return '﻿' + rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\r\n');
}

export function downloadCsv(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const link = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
