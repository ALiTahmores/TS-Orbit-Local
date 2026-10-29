import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface Props {
  title: string;
  description?: string;
  submitLabel: string;
  saving?: boolean;
  error?: string;
  /** Shown at the start of the footer, e.g. a delete action. */
  footerStart?: React.ReactNode;
  onSubmit: (event: React.FormEvent) => void;
  onClose: () => void;
  children: React.ReactNode;
}

export const sheetInput = 'w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 text-[13px] text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15';
export const sheetLabel = 'block text-xs font-bold text-slate-700 dark:text-slate-200';

/** A form that slides in from the end edge; Escape and the backdrop close it. */
export const SideSheet: React.FC<Props> = ({ title, description, submitLabel, saving, error, footerStart, onSubmit, onClose, children }) => {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex justify-end" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[1px]" onClick={onClose} />
      <form onSubmit={onSubmit} className="relative w-full sm:max-w-md h-full flex flex-col bg-white dark:bg-slate-900 shadow-2xl text-start">
        <header className="shrink-0 flex items-start justify-between gap-3 px-5 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="min-w-0">
            <h2 className="text-base font-black text-slate-900 dark:text-white">{title}</h2>
            {description && <p className="text-[11px] leading-5 text-slate-500 dark:text-slate-400 mt-0.5">{description}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="بستن" className="shrink-0 w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"><X size={16} /></button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-5">
          {error && <p role="alert" className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs font-bold">{error}</p>}
          {children}
        </div>
        <footer className="shrink-0 flex items-center justify-between gap-2 px-5 sm:px-6 py-3 border-t border-slate-200 dark:border-slate-800 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          {footerStart || <span />}
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="h-9 px-4 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">انصراف</button>
            <button type="submit" disabled={saving} className="h-9 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold disabled:opacity-50 cursor-pointer">{saving ? 'در حال ذخیره…' : submitLabel}</button>
          </div>
        </footer>
      </form>
    </div>
  );
};
