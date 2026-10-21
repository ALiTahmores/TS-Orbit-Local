import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCw, X, Sparkles, CheckCircle2 } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { PendingUpdateInfo } from '../../hooks/useSmartRefresh';

interface SmartRefreshNotifierProps {
  hasPendingUpdate: boolean;
  pendingUpdate: PendingUpdateInfo | null;
  isRefreshing: boolean;
  onRefresh: () => void;
  onDismiss: () => void;
}

export const SmartRefreshNotifier: React.FC<SmartRefreshNotifierProps> = ({
  hasPendingUpdate,
  pendingUpdate,
  isRefreshing,
  onRefresh,
  onDismiss
}) => {
  const { locale, theme } = useProject();
  const isRtl = locale !== 'en';

  if (!hasPendingUpdate) return null;

  const title = pendingUpdate?.title
    ? (isRtl ? pendingUpdate.title.fa : pendingUpdate.title.en)
    : (isRtl ? 'بروزرسانی جدید در دسترس است' : 'New updates available');

  const description = pendingUpdate?.description
    ? (isRtl ? pendingUpdate.description.fa : pendingUpdate.description.en)
    : (isRtl ? 'جهت مشاهده تغییرات اخیر، روی دکمه بروزرسانی کلیک کنید.' : 'Click refresh to view recent changes without losing your place.');

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className={`fixed z-40 ${isRtl ? 'left-5 bottom-5' : 'right-5 bottom-5'} max-w-sm w-full pointer-events-auto select-none`}
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        <div className="p-3.5 rounded-2xl bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl border border-blue-200/70 dark:border-blue-900/50 shadow-[0_10px_30px_rgba(0,0,0,0.12),0_1px_3px_rgba(0,0,0,0.05)] text-slate-800 dark:text-neutral-100 flex items-start gap-3 transition-all">
          
          {/* Glowing pulse icon */}
          <div className="relative shrink-0 mt-0.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200/60 dark:border-blue-800/60 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
            </span>
          </div>

          {/* Content info */}
          <div className="flex-1 min-w-0 pr-1">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                {title}
              </h4>
              <button
                type="button"
                onClick={onDismiss}
                className="text-slate-400 hover:text-slate-600 dark:text-neutral-500 dark:hover:text-neutral-300 p-0.5 rounded-lg transition-colors cursor-pointer"
                title={isRtl ? 'بستن' : 'Dismiss'}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-neutral-400 line-clamp-2 mt-0.5 font-normal leading-relaxed">
              {description}
            </p>

            {/* Action Buttons */}
            <div className="mt-2.5 flex items-center gap-2">
              <button
                type="button"
                onClick={onRefresh}
                disabled={isRefreshing}
                className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm shadow-blue-500/20 active:scale-[0.98] cursor-pointer disabled:opacity-70"
              >
                <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>
                  {isRefreshing
                    ? (isRtl ? 'در حال بروزرسانی...' : 'Refreshing...')
                    : (isRtl ? 'بروزرسانی اطلاعات' : 'Refresh Now')}
                </span>
              </button>

              <button
                type="button"
                onClick={onDismiss}
                className="px-2.5 py-1.5 rounded-xl text-slate-600 dark:text-neutral-300 hover:bg-slate-100 dark:hover:bg-neutral-800 text-xs font-medium transition-colors cursor-pointer"
              >
                {isRtl ? 'بعداً' : 'Later'}
              </button>
            </div>
          </div>

        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default SmartRefreshNotifier;
