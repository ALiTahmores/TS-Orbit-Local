// One label per task status and priority. Stored values vary by origin (server
// canonical lowercase, older UI enums, Persian text), so each alias maps to a key.
type Locale = 'fa' | 'en';

export type PriorityKey = 'critical' | 'high' | 'medium' | 'low';
export type StatusKey = 'pending' | 'inprogress' | 'review' | 'completed' | 'blocked' | 'cancelled';

const PRIORITY_ALIASES: Record<string, PriorityKey> = {
  critical: 'critical', urgent: 'critical', 'فوری': 'critical',
  high: 'high', 'بالا': 'high', 'زیاد': 'high',
  medium: 'medium', normal: 'medium', 'متوسط': 'medium', 'عادی': 'medium',
  low: 'low', 'کم': 'low', 'پایین': 'low',
};
const STATUS_ALIASES: Record<string, StatusKey> = {
  pending: 'pending', todo: 'pending', 'to-do': 'pending', backlog: 'pending',
  inprogress: 'inprogress', in_progress: 'inprogress', 'in progress': 'inprogress', 'on progress': 'inprogress',
  review: 'review', under_review: 'review', 'in review': 'review', qa: 'review',
  completed: 'completed', done: 'completed',
  blocked: 'blocked',
  cancelled: 'cancelled', canceled: 'cancelled',
};

export const PRIORITY_LABELS: Record<PriorityKey, Record<Locale, string>> = {
  critical: { fa: 'فوری', en: 'Urgent' },
  high: { fa: 'بالا', en: 'High' },
  medium: { fa: 'متوسط', en: 'Medium' },
  low: { fa: 'پایین', en: 'Low' },
};
export const STATUS_LABELS: Record<StatusKey, Record<Locale, string>> = {
  pending: { fa: 'در انتظار', en: 'To do' },
  inprogress: { fa: 'در حال انجام', en: 'In progress' },
  review: { fa: 'در حال بررسی', en: 'In review' },
  completed: { fa: 'تکمیل‌شده', en: 'Completed' },
  blocked: { fa: 'مسدود', en: 'Blocked' },
  cancelled: { fa: 'لغوشده', en: 'Cancelled' },
};

export const priorityKey = (value: unknown): PriorityKey => PRIORITY_ALIASES[String(value ?? '').trim().toLowerCase()] || 'medium';
export const statusKey = (value: unknown): StatusKey => STATUS_ALIASES[String(value ?? '').trim().toLowerCase()] || 'pending';
export const priorityLabel = (value: unknown, locale: Locale = 'fa') => PRIORITY_LABELS[priorityKey(value)][locale];
export const statusLabel = (value: unknown, locale: Locale = 'fa') => STATUS_LABELS[statusKey(value)][locale];
