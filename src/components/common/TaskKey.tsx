import React from 'react';
import { cn } from '../../lib/utils';

/** A task's short key ("TS-12"), the handle used in commits, chat and search. */
export const TaskKey: React.FC<{ value?: string; className?: string }> = ({ value, className }) => value ? (
  <span dir="ltr" translate="no" title={value}
    className={cn('inline-flex items-center h-5 px-1.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400 shrink-0 align-middle', className)}>{value}</span>
) : null;
