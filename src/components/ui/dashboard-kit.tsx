import React from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { cn } from '../../lib/utils';
import { isEnglish } from '../../lib/locale';
import { formatJalaliDate } from '../../lib/dates';

/*
 * Building blocks shared by the workspace pages: page headers, figure tiles,
 * panels, segmented filters, progress rings and people. They follow the app's
 * tokens (accent #155DFC, slate neutrals, 16px card radius) so every page reads
 * as one product.
 */

/** A count in the interface language's digits. */
export const num = (value: number | string | null | undefined, digits = 0) => {
  if (value === null || value === undefined || value === '') return '—';
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) return String(value);
  return number.toLocaleString(isEnglish() ? 'en-US' : 'fa-IR', { maximumFractionDigits: digits });
};
export const percent = (value: number | null | undefined) => (value === null || value === undefined ? '—' : isEnglish() ? `${num(value)}%` : `${num(value)}٪`);

/** "۵ دقیقه پیش" / "5 min ago" for a recent instant. */
export function timeAgo(value?: string): string {
  const time = value ? new Date(value).getTime() : NaN;
  if (!Number.isFinite(time)) return '';
  const minutes = Math.max(0, Math.round((Date.now() - time) / 60000));
  if (minutes < 1) return isEnglish() ? 'just now' : 'همین حالا';
  if (minutes < 60) return isEnglish() ? `${minutes} min ago` : `${num(minutes)} دقیقه پیش`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return isEnglish() ? `${hours} h ago` : `${num(hours)} ساعت پیش`;
  const days = Math.round(hours / 24);
  return days < 7 ? (isEnglish() ? `${days} d ago` : `${num(days)} روز پیش`) : formatJalaliDate(value);
}

export const PageHeader: React.FC<{ eyebrow?: React.ReactNode; title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; className?: string }> = ({ eyebrow, title, description, actions, className }) => (
  <header className={cn('flex flex-col lg:flex-row lg:items-end justify-between gap-4', className)}>
    <div className="min-w-0 space-y-1.5">
      {eyebrow && <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">{eyebrow}</p>}
      <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tight">{title}</h1>
      {description && <p className="text-xs md:text-[13px] leading-6 text-slate-500 dark:text-slate-400 max-w-3xl">{description}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
  </header>
);

export const Panel: React.FC<{ title?: React.ReactNode; description?: React.ReactNode; icon?: React.ElementType; action?: React.ReactNode; className?: string; bodyClassName?: string; children?: React.ReactNode; id?: string }> = ({ title, description, icon: Icon, action, className, bodyClassName, children, id }) => (
  <section id={id} className={cn('rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#0d121f] flex flex-col min-w-0', className)}>
    {(title || action) && (
      <div className="flex items-start justify-between gap-3 px-5 pt-5">
        <div className="flex items-start gap-2.5 min-w-0">
          {Icon && <span className="mt-0.5 shrink-0 text-slate-400 dark:text-slate-500"><Icon size={17} /></span>}
          <div className="min-w-0">
            {title && <h2 className="text-sm font-black text-slate-900 dark:text-white">{title}</h2>}
            {description && <p className="mt-0.5 text-[11px] leading-5 text-slate-500 dark:text-slate-400">{description}</p>}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    )}
    <div className={cn('p-5 flex-1 min-h-0', bodyClassName)}>{children}</div>
  </section>
);

type Tone = 'blue' | 'slate' | 'violet' | 'emerald' | 'amber' | 'rose';
const tones: Record<Tone, string> = {
  blue: 'bg-[#E8F1FF] dark:bg-blue-500/10',
  slate: 'bg-slate-100/80 dark:bg-slate-800/50',
  violet: 'bg-[#EEF0FF] dark:bg-indigo-500/10',
  emerald: 'bg-[#E6F7F0] dark:bg-emerald-500/10',
  amber: 'bg-[#FFF4E2] dark:bg-amber-500/10',
  rose: 'bg-[#FDECEE] dark:bg-rose-500/10',
};

/** A headline figure with its change since the previous period. */
export const StatTile: React.FC<{
  label: string; value: React.ReactNode; tone?: Tone; hint?: React.ReactNode; icon?: React.ElementType;
  delta?: { current: number; previous: number; goodWhenUp?: boolean } | null; onClick?: () => void; active?: boolean;
}> = ({ label, value, tone = 'slate', hint, icon: Icon, delta, onClick, active }) => {
  const change = delta && (delta.previous ? Math.round((delta.current - delta.previous) / delta.previous * 100) : delta.current ? 100 : 0);
  const up = !!delta && delta.current > delta.previous, flat = !delta || delta.current === delta.previous;
  const good = flat ? null : (delta?.goodWhenUp ?? true) === up;
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} onClick={onClick} aria-pressed={onClick && active !== undefined ? active : undefined}
      className={cn('text-start rounded-2xl p-5 flex flex-col gap-3 min-w-0 transition-shadow', tones[tone], onClick && 'cursor-pointer hover:ring-2 hover:ring-slate-900/5 dark:hover:ring-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500', active && 'ring-2 ring-blue-500/60')}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{label}</span>
        {Icon && <Icon size={16} className="shrink-0 text-slate-500 dark:text-slate-400" />}
      </div>
      <div className="flex items-end justify-between gap-2">
        <span className="text-2xl md:text-[28px] leading-none font-black text-slate-900 dark:text-white tabular-nums">{value}</span>
        {delta && (
          <span className={cn('inline-flex items-center gap-0.5 text-[11px] font-bold tabular-nums', good === null ? 'text-slate-500' : good ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
            {flat ? <Minus size={13} /> : up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
            {flat ? percent(0) : `${up ? '+' : '−'}${percent(Math.abs(change || 0))}`}
          </span>
        )}
      </div>
      {hint && <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-5">{hint}</p>}
    </Tag>
  );
};

/** One choice among a few, as a compact pill bar. */
export function Segmented<T extends string>({ options, value, onChange, label, className }: { options: { value: T; label: React.ReactNode; count?: number }[]; value: T; onChange: (value: T) => void; label: string; className?: string }) {
  return (
    <div role="tablist" aria-label={label} className={cn('inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/70 max-w-full overflow-x-auto scrollbar-none', className)}>
      {options.map(option => {
        const selected = option.value === value;
        return (
          <button key={option.value} type="button" role="tab" aria-selected={selected} onClick={() => onChange(option.value)}
            className={cn('shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
              selected ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200')}>
            {option.label}
            {option.count !== undefined && <span className={cn('min-w-5 h-5 px-1 rounded-md text-[10px] leading-5 text-center tabular-nums', selected ? 'bg-slate-100 dark:bg-slate-800' : 'bg-slate-200/70 dark:bg-slate-700/70')}>{num(option.count)}</span>}
          </button>
        );
      })}
    </div>
  );
}

export const ProgressRing: React.FC<{ value: number; size?: number; stroke?: number; className?: string; label?: string }> = ({ value, size = 44, stroke = 5, className, label }) => {
  const radius = (size - stroke) / 2, circumference = 2 * Math.PI * radius, clamped = Math.max(0, Math.min(100, value || 0));
  const color = clamped >= 100 ? '#10B981' : clamped >= 60 ? '#155DFC' : clamped >= 30 ? '#F5A623' : '#EF4444';
  return (
    <span className={cn('relative inline-flex items-center justify-center shrink-0', className)} style={{ width: size, height: size }} role="img" aria-label={label || percent(clamped)}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} className="stroke-slate-200 dark:stroke-slate-800" />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} stroke={color} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - clamped / 100)} />
      </svg>
      <span className="absolute text-[10px] font-black text-slate-700 dark:text-slate-200 tabular-nums">{num(clamped)}</span>
    </span>
  );
};

export const ProgressBar: React.FC<{ value: number; className?: string; tone?: 'blue' | 'emerald' | 'amber' | 'rose' }> = ({ value, className, tone = 'blue' }) => (
  <div className={cn('h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden', className)}>
    <div className={cn('h-full rounded-full', { blue: 'bg-blue-600', emerald: 'bg-emerald-500', amber: 'bg-amber-500', rose: 'bg-rose-500' }[tone])} style={{ width: `${Math.max(0, Math.min(100, value || 0))}%` }} />
  </div>
);

export type Health = 'on_track' | 'at_risk' | 'off_track' | 'done';
const healthStyles: Record<Health, { label: { fa: string; en: string }; className: string; dot: string }> = {
  on_track: { label: { fa: 'روی برنامه', en: 'On track' }, className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300', dot: 'bg-emerald-500' },
  at_risk: { label: { fa: 'در معرض خطر', en: 'At risk' }, className: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300', dot: 'bg-amber-500' },
  off_track: { label: { fa: 'خارج از برنامه', en: 'Off track' }, className: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300', dot: 'bg-rose-500' },
  done: { label: { fa: 'تکمیل‌شده', en: 'Done' }, className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300', dot: 'bg-slate-400' },
};
export const HealthBadge: React.FC<{ health: Health }> = ({ health }) => {
  const style = healthStyles[health] || healthStyles.on_track;
  return <span className={cn('inline-flex items-center gap-1.5 h-6 px-2 rounded-md text-[10px] font-bold whitespace-nowrap', style.className)}><span className={cn('w-1.5 h-1.5 rounded-full', style.dot)} />{isEnglish() ? style.label.en : style.label.fa}</span>;
};

const avatarColors = ['bg-blue-100 text-blue-700', 'bg-emerald-100 text-emerald-700', 'bg-amber-100 text-amber-800', 'bg-rose-100 text-rose-700', 'bg-indigo-100 text-indigo-700', 'bg-cyan-100 text-cyan-800', 'bg-slate-200 text-slate-700'];
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() || '؟';
const colorOf = (seed: string) => avatarColors[[...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0) % avatarColors.length];

export const Avatar: React.FC<{ name: string; size?: number; online?: boolean; className?: string }> = ({ name, size = 32, online, className }) => (
  <span className={cn('relative inline-flex shrink-0', className)} style={{ width: size, height: size }}>
    <span className={cn('w-full h-full rounded-full inline-flex items-center justify-center font-black ring-2 ring-white dark:ring-[#0d121f]', colorOf(name))} style={{ fontSize: Math.max(9, size * 0.36) }} aria-hidden="true">{initials(name)}</span>
    {online !== undefined && <span className={cn('absolute -bottom-0.5 -end-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-[#0d121f]', online ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600')} />}
  </span>
);

export const AvatarStack: React.FC<{ people: { id: string; name: string }[]; max?: number; size?: number }> = ({ people, max = 4, size = 26 }) => {
  if (!people.length) return <span className="text-[11px] text-slate-400">—</span>;
  const shown = people.slice(0, max), rest = people.length - shown.length;
  return (
    <span className="inline-flex items-center -space-x-2 rtl:space-x-reverse" title={people.map(person => person.name).join('، ')}>
      {shown.map(person => <Avatar key={person.id} name={person.name} size={size} />)}
      {rest > 0 && <span className="inline-flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300 ring-2 ring-white dark:ring-[#0d121f]" style={{ width: size, height: size }}>+{num(rest)}</span>}
    </span>
  );
};

export const EmptyHint: React.FC<{ icon?: React.ElementType; title: string; text?: string; action?: React.ReactNode; className?: string }> = ({ icon: Icon, title, text, action, className }) => (
  <div className={cn('py-10 px-4 flex flex-col items-center justify-center text-center gap-2', className)}>
    {Icon && <span className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 inline-flex items-center justify-center mb-1"><Icon size={20} /></span>}
    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{title}</p>
    {text && <p className="text-xs leading-6 text-slate-500 dark:text-slate-400 max-w-sm">{text}</p>}
    {action && <div className="mt-2">{action}</div>}
  </div>
);

export const PrimaryButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { icon?: React.ElementType }> = ({ icon: Icon, className, children, ...props }) => (
  <button type="button" {...props} className={cn('inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl bg-[#155DFC] hover:bg-[#0E50D6] text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2', className)}>
    {Icon && <Icon size={16} />}{children}
  </button>
);
export const SecondaryButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { icon?: React.ElementType }> = ({ icon: Icon, className, children, ...props }) => (
  <button type="button" {...props} className={cn('inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500', className)}>
    {Icon && <Icon size={16} />}{children}
  </button>
);
