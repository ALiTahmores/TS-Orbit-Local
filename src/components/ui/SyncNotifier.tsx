import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, RefreshCw, X, AlertCircle, Info, ArrowLeft, ArrowRight, Sparkles, Database } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';

export const SyncNotifier: React.FC = () => {
  const {
    projects,
    tasks,
    activeToast,
    setActiveToast,
    hasPendingSync,
    setHasPendingSync,
    performSilentSync,
    setActiveView,
    setActiveTab,
    setActiveSubTab,
    locale
  } = useProject();

  const isRtl = locale !== 'en';
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSyncClick = () => {
    setIsSyncing(true);
    try {
      if (typeof window !== 'undefined') {
        const currentSnapshot = {
          projectCount: (projects || []).length,
          taskCount: (tasks || []).length,
          triggeredAt: Date.now()
        };
        sessionStorage.setItem('orbit_sync_flash', JSON.stringify(currentSnapshot));
        window.location.reload();
      }
    } catch (err) {
      console.error('Failed to trigger hard sync reload:', err);
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    }
  };

  const handleActionClick = (targetView?: string, targetSubView?: string) => {
    if (!targetView) {
      setActiveToast?.(null);
      return;
    }

    if (setActiveView) {
      setActiveView(targetView);
    }

    // Map common targetView aliases to physical tabs & subtabs
    if (targetView === 'projects' || targetView === 'all_projects') {
      setActiveTab?.('projects');
      setActiveSubTab?.(targetSubView || 'overview');
    } else if (targetView === 'tasks' || targetView === 'technical_tasks' || targetView === 'my_tasks') {
      if (targetView === 'my_tasks') {
        setActiveTab?.('personal_tasks');
        setActiveSubTab?.('my_tasks');
      } else {
        setActiveTab?.('tasks');
        setActiveSubTab?.(targetSubView || 'kanban_board');
      }
    } else if (targetView === 'dashboard') {
      setActiveTab?.('dashboard');
      setActiveSubTab?.('overview');
    } else if (targetView === 'my_projects') {
      setActiveTab?.('personal_tasks');
      setActiveSubTab?.('my_projects');
    } else {
      setActiveTab?.(targetView);
      if (targetSubView) setActiveSubTab?.(targetSubView);
    }

    if (setActiveToast) {
      setActiveToast(null);
    }
  };

  return (
    <>
      {/* 1. TOP INTERACTIVE ACTIONABLE TOAST WITH DIRECT ROUTING (5s Duration) */}
      <AnimatePresence>
        {activeToast && (
          <motion.div
            key="actionable-toast"
            initial={{ opacity: 0, y: -24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={{ type: 'spring', damping: 24, stiffness: 340 }}
            className={`fixed top-5 z-[99999] max-w-lg w-full px-4 pointer-events-none select-none ${
              isRtl ? 'left-4 sm:left-6' : 'right-4 sm:right-6'
            }`}
            style={{ direction: isRtl ? 'rtl' : 'ltr' }}
          >
            <div
              className={`pointer-events-auto flex items-center justify-between gap-3.5 px-4 py-3 rounded-2xl backdrop-blur-2xl border shadow-[0_16px_40px_rgba(0,0,0,0.22)] transition-all ${
                activeToast.type === 'error'
                  ? 'bg-rose-950/90 dark:bg-rose-950/95 border-rose-500/40 text-rose-50 shadow-rose-950/40'
                  : activeToast.type === 'info'
                  ? 'bg-slate-900/90 dark:bg-[#11162B]/95 border-slate-700/60 dark:border-blue-500/30 text-slate-100 shadow-slate-950/50'
                  : 'bg-emerald-950/90 dark:bg-emerald-950/95 border-emerald-500/40 text-emerald-50 shadow-emerald-950/40'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {/* Icon Container */}
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-inner ${
                    activeToast.type === 'error'
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      : activeToast.type === 'info'
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                      : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  }`}
                >
                  {activeToast.type === 'error' ? (
                    <AlertCircle className="w-5 h-5 text-rose-400" />
                  ) : activeToast.type === 'info' ? (
                    <Database className="w-5 h-5 text-blue-400" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  )}
                </div>

                {/* Text Content */}
                <div className="min-w-0 flex-1">
                  <h4 className="text-[12.5px] font-black tracking-tight leading-snug text-white">
                    {activeToast.title}
                  </h4>
                  {activeToast.description && (
                    <p className="text-[11.5px] font-medium mt-0.5 opacity-90 line-clamp-2 leading-relaxed">
                      {activeToast.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Action Button & Dismiss */}
              <div className="flex items-center gap-2 shrink-0">
                {activeToast.actionText && activeToast.targetView && (
                  <button
                    type="button"
                    onClick={() => handleActionClick(activeToast.targetView, activeToast.targetSubView)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer whitespace-nowrap ${
                      activeToast.type === 'error'
                        ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30'
                        : activeToast.type === 'info'
                        ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                    }`}
                  >
                    <span>{activeToast.actionText}</span>
                    {isRtl ? <ArrowLeft className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setActiveToast?.(null)}
                  className="text-white/60 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer shrink-0"
                  title={isRtl ? 'بستن' : 'Close'}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 2. SLEEK MINIMAL FLOATING SMART REFRESH PILL (Bottom Corner) */}
      <AnimatePresence>
        {hasPendingSync && (
          <motion.div
            key="sync-pill"
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.9 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className={`fixed bottom-6 z-[99990] max-w-sm w-auto pointer-events-none select-none ${
              isRtl ? 'left-4 sm:left-6' : 'right-4 sm:right-6'
            }`}
            style={{ direction: isRtl ? 'rtl' : 'ltr' }}
          >
            <div className="pointer-events-auto flex items-center gap-3 px-3.5 py-2.5 rounded-2xl bg-slate-900/95 dark:bg-[#121526]/95 text-white backdrop-blur-2xl border border-slate-700/80 dark:border-blue-500/30 shadow-[0_16px_48px_rgba(0,0,0,0.45)]">
              {/* Message */}
              <div className="text-xs font-bold text-slate-200 dark:text-slate-100 whitespace-nowrap pl-1">
                {isRtl ? 'داده‌های جدید در دسترس است' : 'New data available'}
              </div>

              {/* Single Clean Sync Action Button */}
              <button
                type="button"
                onClick={handleSyncClick}
                disabled={isSyncing}
                className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-black flex items-center gap-1.5 transition-all shadow-md shadow-blue-600/30 active:scale-95 cursor-pointer disabled:opacity-60 whitespace-nowrap"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isRtl ? 'همگامسازی' : 'Sync'}</span>
              </button>

              {/* Dismiss */}
              <button
                type="button"
                onClick={() => setHasPendingSync?.(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer shrink-0"
                title={isRtl ? 'بستن' : 'Dismiss'}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default SyncNotifier;
