import React from 'react';
import { Bookmark, Bug, CheckSquare, Zap } from 'lucide-react';
import { cn } from '../../lib/utils';

/** Issue types, Jira-style: each has a small coloured mark so it reads at a glance, plus its name. */
export type TaskType = 'story' | 'task' | 'bug' | 'epic';
export const TASK_TYPES: Array<{ value: TaskType; label: string; icon: React.ElementType; tone: string }> = [
  { value: 'story', label: 'استوری', icon: Bookmark, tone: 'bg-emerald-600' },
  { value: 'task', label: 'وظیفه', icon: CheckSquare, tone: 'bg-blue-600' },
  { value: 'bug', label: 'باگ', icon: Bug, tone: 'bg-rose-600' },
  { value: 'epic', label: 'اپیک', icon: Zap, tone: 'bg-violet-600' },
];
export const typeMeta = (type?: string | null) => TASK_TYPES.find(item => item.value === type) || TASK_TYPES[1];

/** `decorative` when a visible type name sits beside it, so it is not read twice. */
export const TaskTypeIcon: React.FC<{ type?: string | null; size?: number; className?: string; decorative?: boolean }> = ({ type, size = 18, className, decorative }) => {
  const meta = typeMeta(type);
  const Icon = meta.icon;
  return (
    <span title={decorative ? undefined : meta.label} aria-hidden={decorative || undefined} className={cn('inline-flex items-center justify-center rounded-[5px] text-white shrink-0', meta.tone, className)} style={{ width: size, height: size }}>
      <Icon size={Math.round(size * 0.62)} strokeWidth={2.5} aria-hidden="true" />{!decorative && <span className="sr-only">{meta.label}</span>}
    </span>
  );
};

/** Epic colours: a soft lozenge for labels and a solid tone for timeline bars. */
export const EPIC_COLORS: Record<string, { label: string; lozenge: string; solid: string; track: string; swatch: string }> = {
  violet: { label: 'بنفش', lozenge: 'bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-200', solid: 'bg-violet-600 dark:bg-violet-500', track: 'bg-violet-200 dark:bg-violet-500/30', swatch: 'bg-violet-500' },
  blue: { label: 'آبی', lozenge: 'bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-200', solid: 'bg-blue-600 dark:bg-blue-500', track: 'bg-blue-200 dark:bg-blue-500/30', swatch: 'bg-blue-500' },
  teal: { label: 'فیروزه‌ای', lozenge: 'bg-teal-100 text-teal-800 dark:bg-teal-500/15 dark:text-teal-200', solid: 'bg-teal-600 dark:bg-teal-500', track: 'bg-teal-200 dark:bg-teal-500/30', swatch: 'bg-teal-500' },
  green: { label: 'سبز', lozenge: 'bg-green-100 text-green-800 dark:bg-green-500/15 dark:text-green-200', solid: 'bg-green-600 dark:bg-green-500', track: 'bg-green-200 dark:bg-green-500/30', swatch: 'bg-green-500' },
  amber: { label: 'کهربایی', lozenge: 'bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200', solid: 'bg-amber-500', track: 'bg-amber-200 dark:bg-amber-500/30', swatch: 'bg-amber-500' },
  orange: { label: 'نارنجی', lozenge: 'bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-200', solid: 'bg-orange-600 dark:bg-orange-500', track: 'bg-orange-200 dark:bg-orange-500/30', swatch: 'bg-orange-500' },
  rose: { label: 'سرخ', lozenge: 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-200', solid: 'bg-rose-600 dark:bg-rose-500', track: 'bg-rose-200 dark:bg-rose-500/30', swatch: 'bg-rose-500' },
  slate: { label: 'خاکستری', lozenge: 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200', solid: 'bg-slate-600 dark:bg-slate-500', track: 'bg-slate-200 dark:bg-slate-700', swatch: 'bg-slate-500' },
};
export const epicTone = (color?: string | null) => EPIC_COLORS[color || 'violet'] || EPIC_COLORS.violet;

export const EpicLozenge: React.FC<{ title: string; color?: string | null; className?: string; onClick?: () => void }> = ({ title, color, className, onClick }) => {
  const Tag = onClick ? 'button' : 'span';
  return (
    <Tag type={onClick ? 'button' : undefined} onClick={onClick} title={`اپیک: ${title}`}
      className={cn('inline-flex items-center h-5 max-w-40 px-1.5 rounded text-[10px] font-bold truncate shrink-0', epicTone(color).lozenge, onClick && 'cursor-pointer hover:opacity-80', className)}>
      <span className="truncate">{title}</span>
    </Tag>
  );
};

/**
 * Type and epic for a task form. Epics of the task's project are offered; an epic
 * itself has no epic, so the epic picker hides for it.
 */
export const TypeAndEpicFields: React.FC<{
  type: TaskType; onType: (type: TaskType) => void; epicId: string; onEpic: (id: string) => void;
  epics: Array<{ id: string; title: string; key?: string }>; selectClassName?: string; labelClassName?: string; allowEpic?: boolean; className?: string;
}> = ({ type, onType, epicId, onEpic, epics, selectClassName, labelClassName, allowEpic = true, className }) => (
  <div className={cn('grid grid-cols-1 sm:grid-cols-2 gap-3.5', className)}>
    <div>
      <span className={cn('block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1.5', labelClassName)} id="task-type-label">نوع کار</span>
      <div role="radiogroup" aria-labelledby="task-type-label" className="flex flex-wrap items-center gap-1.5">
        {TASK_TYPES.filter(item => allowEpic || item.value !== 'epic').map(item => (
          <button key={item.value} type="button" role="radio" aria-checked={type === item.value} onClick={() => onType(item.value)}
            className={cn('h-9 px-2.5 rounded-xl border text-[11px] font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors',
              type === item.value ? 'border-blue-500 bg-blue-50 text-blue-800 dark:bg-blue-500/10 dark:text-blue-200 ring-2 ring-blue-500/20' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800')}>
            <TaskTypeIcon type={item.value} size={16} decorative />{item.label}
          </button>
        ))}
      </div>
    </div>
    {type !== 'epic' && (
      <label className="block">
        <span className={cn('block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1.5', labelClassName)}>اپیک</span>
        <select value={epicId} onChange={event => onEpic(event.target.value)} disabled={!epics.length}
          className={cn('w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 disabled:opacity-60', selectClassName)}>
          <option value="">{epics.length ? 'بدون اپیک' : 'این پروژه اپیکی ندارد'}</option>
          {epics.map(epic => <option key={epic.id} value={epic.id}>{epic.key ? `${epic.key} · ` : ''}{epic.title}</option>)}
        </select>
      </label>
    )}
  </div>
);
