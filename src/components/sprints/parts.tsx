import React from 'react';
import { Flag } from 'lucide-react';
import { formatJalaliDayMonth } from '../../lib/dates';
import { cn } from '../../lib/utils';
import { STATUS_GROUP, STATUS_LABEL, type Sprint } from '../../hooks/useSprints';

/** Pieces shared by the backlog, the sprint board and the reports. */
export const sprintDates = (sprint: Sprint) => sprint.startDate && sprint.endDate ? `${formatJalaliDayMonth(sprint.startDate)} تا ${formatJalaliDayMonth(sprint.endDate)}` : '';

export const statusTone: Record<string, string> = {
  todo: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  progress: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300',
  done: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
};

export const StatusPill: React.FC<{ status: string }> = ({ status }) => (
  <span className={cn('h-6 px-2 rounded-md text-[10px] font-bold inline-flex items-center whitespace-nowrap', status === 'blocked' ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300' : statusTone[STATUS_GROUP[status] || 'todo'])}>{STATUS_LABEL[status] || status}</span>
);

/** `decorative` when the priority's name is shown beside the flag, so it is not read twice. */
export const PriorityFlag: React.FC<{ priority: string; decorative?: boolean }> = ({ priority, decorative }) => {
  const value = String(priority).toLowerCase();
  if (!['high', 'urgent', 'critical'].includes(value)) return null;
  const label = value === 'high' ? 'اولویت بالا' : 'فوری';
  return <span title={decorative ? undefined : label} aria-hidden={decorative || undefined} className="text-rose-500 shrink-0"><Flag size={14} aria-hidden="true" />{!decorative && <span className="sr-only">{label}</span>}</span>;
};
