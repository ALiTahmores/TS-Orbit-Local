import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import {
  jalaliWeekdaysShort, formatJalaliDate, jalaliMonthGrid, jalaliMonthLabel, jalaliMonthOf,
  localISODate, persianNumber, shiftJalaliMonth, type JalaliMonth,
} from '../../lib/dates';

interface JalaliDateInputProps {
  /** ISO date (YYYY-MM-DD) or ''. */
  value: string;
  onChange: (iso: string) => void;
  id?: string;
  ariaLabel?: string;
  placeholder?: string;
  disabled?: boolean;
  clearable?: boolean;
  /** Earliest selectable ISO date. */
  min?: string;
  className?: string;
}

/** A date field that shows and picks days in the Persian calendar while storing ISO dates. */
export const JalaliDateInput: React.FC<JalaliDateInputProps> = ({
  value, onChange, id, ariaLabel, placeholder = 'انتخاب تاریخ', disabled = false, clearable = true, min, className = '',
}) => {
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '';
  const today = localISODate();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState<JalaliMonth>(() => jalaliMonthOf(valid || today));
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (open) setMonth(jalaliMonthOf(valid || today)); }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopPropagation(); setOpen(false); } };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape, true);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', escape, true); };
  }, [open]);

  const grid = useMemo(() => jalaliMonthGrid(month), [month]);
  const pick = (iso: string) => { onChange(iso); setOpen(false); };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(current => !current)}
        className="w-full h-10 flex items-center gap-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs font-bold text-slate-800 dark:text-slate-100 hover:border-blue-400 focus-visible:ring-2 focus-visible:ring-blue-500/30 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer transition-colors"
      >
        <Calendar size={14} className="text-slate-400 shrink-0" />
        <span className={`flex-1 text-start truncate ${valid ? '' : 'text-slate-400 font-medium'}`}>{valid ? formatJalaliDate(valid) : placeholder}</span>
        {clearable && valid && !disabled && (
          <span
            role="button"
            tabIndex={0}
            aria-label="پاک کردن تاریخ"
            onClick={event => { event.stopPropagation(); onChange(''); }}
            onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); onChange(''); } }}
            className="p-0.5 rounded-md text-slate-400 hover:text-rose-500 hover:bg-slate-200/70 dark:hover:bg-slate-700"
          >
            <X size={13} />
          </span>
        )}
      </button>

      {open && (
        <div role="dialog" aria-label="انتخاب تاریخ" className="absolute z-50 mt-1.5 start-0 w-72 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={() => setMonth(current => shiftJalaliMonth(current, -1))} aria-label="ماه قبل" className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
              <ChevronRight size={16} />
            </button>
            <span className="text-sm font-black text-slate-800 dark:text-slate-100">{jalaliMonthLabel(month)}</span>
            <button type="button" onClick={() => setMonth(current => shiftJalaliMonth(current, 1))} aria-label="ماه بعد" className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
              <ChevronLeft size={16} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 mb-1">
            {jalaliWeekdaysShort().map(day => <span key={day}>{day}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: grid.leading }, (_, index) => <span key={`blank-${index}`} />)}
            {grid.days.map(({ iso, day }) => {
              const selected = iso === valid, isToday = iso === today, blocked = !!min && iso < min;
              return (
                <button
                  key={iso}
                  type="button"
                  disabled={blocked}
                  onClick={() => pick(iso)}
                  aria-pressed={selected}
                  aria-label={formatJalaliDate(iso)}
                  className={`h-8 rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                    selected ? 'bg-blue-600 text-white' : isToday ? 'border border-blue-400 text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {persianNumber(day)}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button type="button" disabled={!!min && today < min} onClick={() => pick(today)} className="text-xs font-bold text-blue-600 dark:text-blue-400 px-2 py-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/40 disabled:opacity-40 cursor-pointer">امروز</button>
            {clearable && <button type="button" onClick={() => pick('')} className="text-xs font-bold text-slate-500 px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">بدون تاریخ</button>}
          </div>
        </div>
      )}
    </div>
  );
};
