// Task metrics derived only from stored task data: status history timestamps,
// canonical due dates and assignments. Nothing here is estimated or seeded.
import { assignedIds } from './domain';
import { calendarDay } from './formValues';
import { jalaliMonthName, persianNumber } from './dates';
import { isEnglish } from './locale';

export type SeriesPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly';
export interface SeriesPoint { name: string; Completed: number; OnTime: number | null }

const DAY = 24 * 60 * 60 * 1000;
const isoDate = calendarDay;

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
const deadlineInstant = (task: any): Date | undefined => {
  const value = task?.deadlineCanonical || task?.dueDateCanonical || task?.deadline || task?.dueDate;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(value)) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};
export const isOverdue = (task: any, today = todayISO(), now = new Date()) => {
  if (!isOpen(task)) return false;
  const instant = deadlineInstant(task);
  return instant ? instant.getTime() < now.getTime() : !!dueDate(task) && dueDate(task)! < today;
};
export const isDueToday = (task: any, today = todayISO()) => isOpen(task) && dueDate(task) === today;

/** Completed on or before its due date; undefined when the task had no due date. */
export function deliveredOnTime(task: any): boolean | undefined {
  const done = completedAt(task), due = dueDate(task);
  if (!done || !due) return undefined;
  const instant = deadlineInstant(task);
  if (instant) return done.getTime() <= instant.getTime();
  return todayISO(done) <= due;
}

export const tasksAssignedTo = (tasks: any[], userId: string) =>
  userId ? tasks.filter(task => task && (assignedIds(task).includes(userId) || task.assigneeId === userId)) : [];

/** Net recorded hours, including durable corrections; calendar days follow the viewer's zone. */
export function weeklyTimeTotals(tasks: any[], now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (today.getDay() + 1) % 7);
  const calendarNumber = (date: Date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY;
  const days = Array.from({ length: 7 }, () => 0);
  for (const task of tasks || []) for (const entry of task?.timeEntries || []) {
    const at = new Date(entry?.createdAt || entry?.date || '');
    const hours = Number(entry?.hours);
    if (Number.isNaN(at.getTime()) || !Number.isFinite(hours)) continue;
    const index = calendarNumber(at) - calendarNumber(start);
    if (index >= 0 && index < 7) days[index] += hours;
  }
  const total = days.reduce((sum, hours) => sum + hours, 0);
  const elapsed = Math.min(7, calendarNumber(today) - calendarNumber(start) + 1);
  return { days, total, average: total / elapsed, max: Math.max(...days.map(Math.abs), 0), start, todayIndex: elapsed - 1 };
}

const persianYearMonth = new Intl.DateTimeFormat('en-US-u-ca-persian', { year: 'numeric', month: 'numeric' });
const jalaliParts = (date: Date) => {
  const parts = Object.fromEntries(persianYearMonth.formatToParts(date).filter(p => p.type === 'year' || p.type === 'month').map(p => [p.type, Number(p.value)]));
  return { year: parts.year as number, month: parts.month as number };
};
const SEASONS = { fa: ['بهار', 'تابستان', 'پاییز', 'زمستان'], en: ['Spring', 'Summer', 'Autumn', 'Winter'] };

/** Completed-task counts and on-time rate per bucket, oldest bucket first. */
export function completionSeries(tasks: any[], period: SeriesPeriod, now = new Date()): SeriesPoint[] {
  type Bucket = { name: string; match: (date: Date) => boolean };
  const buckets: Bucket[] = [];
  const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const today = startOfDay(now);
  if (period === 'daily') {
    for (let i = 6; i >= 0; i--) {
      const day = new Date(today.getTime() - i * DAY);
      buckets.push({ name: day.toLocaleDateString(isEnglish() ? 'en-US' : 'fa-IR', { weekday: 'short' }), match: date => startOfDay(date).getTime() === day.getTime() });
    }
  } else if (period === 'weekly') {
    for (let i = 3; i >= 0; i--) {
      const end = new Date(today.getTime() + DAY - i * 7 * DAY), start = new Date(end.getTime() - 7 * DAY);
      buckets.push({ name: i === 0 ? (isEnglish() ? 'This week' : 'این هفته') : isEnglish() ? `${i} week${i > 1 ? 's' : ''} ago` : `${persianNumber(i)} هفته پیش`, match: date => date >= start && date < end });
    }
  } else {
    const span = period === 'monthly' ? 1 : 3, count = period === 'monthly' ? 6 : 4;
    const current = jalaliParts(now);
    // Months are counted in the Persian calendar; a quarter is one season.
    const index = (parts: { year: number; month: number }) => parts.year * 12 + parts.month - 1;
    const currentIndex = index(current), currentStart = currentIndex - (span === 3 ? (current.month - 1) % 3 : 0);
    for (let i = count - 1; i >= 0; i--) {
      const first = currentStart - i * span, year = Math.floor(first / 12), month = first % 12 + 1;
      const name = span === 1 ? jalaliMonthName(month) : `${SEASONS[isEnglish() ? 'en' : 'fa'][Math.floor((month - 1) / 3)]} ${persianNumber(year)}`;
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
  const rows = [isEnglish() ? ['Period', 'Completed tasks', 'On-time delivery (%)'] : ['بازه', 'وظایف تکمیل‌شده', 'درصد تحویل به‌موقع'], ...points.map(p => [p.name, String(p.Completed), p.OnTime === null ? '' : String(p.OnTime)])];
  return '﻿' + rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\r\n');
}

export function downloadCsv(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const link = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
