import React, { useEffect } from 'react';
import { 
  Folder, 
  Database, 
  Search, 
  LayoutGrid, 
  ListFilter, 
  Plus 
} from 'lucide-react';
import { toPersianDigits } from './utils';

interface OverviewTopBarProps {
  totalFileCount: number;
  usedGB: string;
  maxGB?: number;
  storagePercentage: number;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  layoutMode: 'grid' | 'list';
  onLayoutModeChange: (mode: 'grid' | 'list') => void;
  onCreateFileClick: () => void;
  activeProjectTitle?: string;
}

export const OverviewTopBar: React.FC<OverviewTopBarProps> = ({
  totalFileCount,
  usedGB,
  maxGB = 100,
  storagePercentage,
  searchQuery,
  onSearchChange,
  layoutMode,
  onLayoutModeChange,
  onCreateFileClick,
  activeProjectTitle = 'پروژه فعال'
}) => {
  // Listen for Cmd+F / Ctrl+F keyboard shortcut to focus search input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        const input = document.getElementById('overview-search-input');
        if (input) {
          e.preventDefault();
          input.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between p-3.5 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-2xs gap-4 transition-all">
      
      {/* Right Side (RTL): Resource Allocation & Storage Bar */}
      <div className="flex-1 max-w-lg bg-slate-50/80 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60 space-y-1.5 shadow-2xs">
        <div className="flex justify-between items-center text-xs font-bold text-slate-600 dark:text-slate-300">
          <span className="flex items-center gap-1.5">
            <Database size={14} className="text-blue-500 animate-pulse" />
            <span>تخصیص منابع / حافظه ابری پروژه:</span>
          </span>
          <span className="font-mono text-blue-600 dark:text-blue-400 font-extrabold">
            {toPersianDigits(usedGB)}GB / {toPersianDigits(maxGB)}GB
          </span>
        </div>
        <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden p-0.5">
          <div 
            className="h-full bg-blue-600 rounded-full transition-all duration-700 ease-out" 
            style={{ width: `${storagePercentage}%` }}
          />
        </div>
      </div>

      {/* Far Left Actions: Total Count Pill, View Switcher & Action Trigger */}
      <div className="flex items-center gap-2.5 shrink-0 justify-between sm:justify-end">
        {/* Total File Count Badge */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-100/60 dark:border-blue-900/40 text-xs font-black shadow-2xs">
          <Folder size={14} className="text-blue-600 dark:text-blue-400" />
          <span>مجموع: {toPersianDigits(totalFileCount)} فایل</span>
        </div>

        {/* View Switcher */}
        <div className="flex items-center bg-slate-100/80 dark:bg-slate-800/80 p-1 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
          <button
            type="button"
            onClick={() => onLayoutModeChange('grid')}
            className={`p-1.5 rounded-lg transition-all cursor-pointer ${
              layoutMode === 'grid' 
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-2xs font-bold' 
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
            title="نمایش شبکه‌ای"
          >
            <LayoutGrid size={15} />
          </button>
          <button
            type="button"
            onClick={() => onLayoutModeChange('list')}
            className={`p-1.5 rounded-lg transition-all cursor-pointer ${
              layoutMode === 'list' 
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-2xs font-bold' 
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
            title="نمایش لیستی"
          >
            <ListFilter size={15} />
          </button>
        </div>

        {/* Primary Quick Create Button */}
        <button
          type="button"
          onClick={onCreateFileClick}
          className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-black px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-blue-500/20 transition-all cursor-pointer whitespace-nowrap"
        >
          <Plus size={15} />
          <span>ایجاد فایل</span>
        </button>
      </div>

    </div>
  );
};
