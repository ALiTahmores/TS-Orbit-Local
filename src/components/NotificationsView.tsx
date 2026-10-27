import { formatJalaliDateTime } from '../lib/dates';
import React, { useState, useMemo } from 'react';
import { useProject } from '../context/ProjectContext';
import { 
  Bell, 
  BellOff, 
  CheckCheck, 
  CheckCircle2, 
  PlusCircle, 
  Trash2, 
  AlertTriangle, 
  FileText, 
  FolderGit, 
  ShieldCheck, 
  Info, 
  Check 
} from 'lucide-react';
import { Tooltip } from './common/Tooltip';
import { AppNotification } from '../types';

export const NotificationsView: React.FC = () => {
  const { 
    notifications, 
    markNotificationAsRead, 
    markAllNotificationsAsRead, 
    clearNotifications, collaborationError, locale 
  } = useProject();

  const isRtl = locale === 'fa';
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [error,setError]=useState(''),[busy,setBusy]=useState(false);
  const act=async(action:()=>Promise<void>)=>{setBusy(true);setError('');try{await action();}catch(error){setError(error instanceof Error?error.message:'عملیات انجام نشد.');}finally{setBusy(false);}};

  const unreadCount = useMemo(() => {
    return notifications.filter(n => !n.read).length;
  }, [notifications]);

  const filteredNotifications = useMemo(() => {
    if (filter === 'unread') {
      return notifications.filter(n => !n.read);
    }
    return notifications;
  }, [notifications, filter]);

  const getNotificationIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'task_assigned':
        return <PlusCircle size={18} className="text-blue-600 dark:text-blue-400" />;
      case 'task_completed':
        return <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400" />;
      case 'deadline_warning':
        return <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400" />;
      case 'approval_needed':
        return <ShieldCheck size={18} className="text-indigo-600 dark:text-indigo-400" />;
      case 'file_uploaded':
        return <FileText size={18} className="text-cyan-600 dark:text-cyan-400" />;
      case 'project_updated':
        return <FolderGit size={18} className="text-purple-600 dark:text-purple-400" />;
      default:
        return <Bell size={18} className="text-slate-600 dark:text-slate-400" />;
    }
  };

  const getNotificationBadgeClass = (type: AppNotification['type']) => {
    switch (type) {
      case 'task_assigned':
        return 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border-blue-200/60 dark:border-blue-900/40';
      case 'task_completed':
        return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200/60 dark:border-emerald-900/40';
      case 'deadline_warning':
        return 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200/60 dark:border-amber-900/40';
      case 'approval_needed':
        return 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border-indigo-200/60 dark:border-indigo-900/40';
      case 'file_uploaded':
        return 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300 border-cyan-200/60 dark:border-cyan-900/40';
      case 'project_updated':
        return 'bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border-purple-200/60 dark:border-purple-900/40';
      default:
        return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    }
  };

  const getNotificationLabel = (type: AppNotification['type']) => {
    switch (type) {
      case 'task_assigned': return isRtl ? 'وظیفه جدید' : 'Task Assigned';
      case 'task_completed': return isRtl ? 'تکمیل وظیفه' : 'Task Completed';
      case 'deadline_warning': return isRtl ? 'هشدار ددلاین' : 'Deadline Warning';
      case 'approval_needed': return isRtl ? 'نیازمند تایید' : 'Approval Needed';
      case 'file_uploaded': return isRtl ? 'آپلود فایل' : 'File Uploaded';
      case 'project_updated': return isRtl ? 'تغییر وضعیت پروژه' : 'Project Updated';
      default: return isRtl ? 'اعلان عمومی' : 'General Alert';
    }
  };

  return (
    <div className="w-full space-y-6 pb-12 font-vazirmatn text-right" style={{ direction: isRtl ? 'rtl' : 'ltr' }}>
      
      {(error||collaborationError)&&<p role="alert" className="text-sm text-rose-600">{error||collaborationError}</p>}
      <button className="text-xs underline" disabled={busy||!notifications.length} onClick={()=>void act(clearNotifications)}>پاک کردن اعلان‌های من</button>
      {/* HEADER SECTION */}
      <div className="bg-white dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 md:p-6 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-2xl shrink-0">
            <Bell size={22} className="stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                {isRtl ? 'اعلان‌های سیستم' : 'System Notifications'}
              </h1>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 bg-rose-500 text-white font-extrabold text-[11px] rounded-full font-mono animate-pulse">
                  {unreadCount} {isRtl ? 'خوانده‌نشده' : 'unread'}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              {isRtl ? 'مدیریت و پیگیری آنلاین رویدادها، هشدارها و تغییرات سامانه' : 'Manage and track online system events, alerts and updates'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void act(markAllNotificationsAsRead)}
          disabled={busy || unreadCount === 0}
          className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-extrabold rounded-2xl text-xs transition-all flex items-center gap-2 shadow-sm cursor-pointer shrink-0"
        >
          <CheckCheck size={16} />
          <span>{isRtl ? 'علامت‌گذاری همه به عنوان خوانده شده' : 'Mark all as read'}</span>
        </button>
      </div>

      {/* FILTER TABS */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-200/60 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              filter === 'all'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <span>{isRtl ? 'همه اعلان‌ها' : 'All Notifications'}</span>
            <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono ${
              filter === 'all' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
            }`}>
              {notifications.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setFilter('unread')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              filter === 'unread'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <span>{isRtl ? 'خوانده نشده' : 'Unread'}</span>
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono bg-rose-500 text-white">
                {unreadCount}
              </span>
            )}
          </button>
        </div>

        <div className="text-[11px] font-bold text-slate-400 dark:text-slate-500 hidden sm:block">
          {isRtl ? `نمایش ${filteredNotifications.length} مورد` : `Showing ${filteredNotifications.length} items`}
        </div>
      </div>

      {/* NOTIFICATIONS LIST */}
      {filteredNotifications.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-12 text-center space-y-4 shadow-sm">
          <div className="w-16 h-16 rounded-3xl bg-blue-50 dark:bg-blue-950/40 text-blue-500 flex items-center justify-center mx-auto shadow-inner">
            <BellOff size={32} />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-black text-slate-800 dark:text-slate-100">
              {isRtl ? 'هیچ اعلانی برای نمایش وجود ندارد' : 'No notifications to display'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed font-medium">
              {filter === 'unread'
                ? (isRtl ? 'تمام اعلان‌های سیستم خوانده شده‌اند.' : 'All system notifications have been read.')
                : (isRtl ? 'تمام رویدادها و پیام‌های سیستم به صورت اتوماتیک در این بخش نمایش داده می‌شوند.' : 'All system events and updates will automatically appear here.')
              }
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredNotifications.map((notification) => (
            <div
              key={notification.id}
              onClick={() => {
                if (!notification.read) {
                  void act(()=>markNotificationAsRead(notification.id));
                }
              }}
              className={`p-4 rounded-2xl border transition-all duration-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 group cursor-pointer ${
                notification.read
                  ? 'bg-white dark:bg-slate-900/60 border-slate-200/70 dark:border-slate-800/80 opacity-85 hover:opacity-100'
                  : 'bg-blue-50/50 dark:bg-blue-950/25 border-blue-200 dark:border-blue-900/60 shadow-xs hover:border-blue-400'
              }`}
            >
              <div className="flex items-start gap-3.5 min-w-0 flex-1">
                <div className={`p-2.5 rounded-xl shrink-0 mt-0.5 ${
                  notification.read ? 'bg-slate-100 dark:bg-slate-800 text-slate-500' : 'bg-blue-100/80 dark:bg-blue-900/50'
                }`}>
                  {getNotificationIcon(notification.type)}
                </div>

                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {!notification.read && (
                      <span className="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400 shrink-0" />
                    )}
                    <h4 className={`text-xs sm:text-sm font-extrabold ${
                      notification.read ? 'text-slate-700 dark:text-slate-200' : 'text-slate-900 dark:text-white'
                    }`}>
                      {notification.title}
                    </h4>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${getNotificationBadgeClass(notification.type)}`}>
                      {getNotificationLabel(notification.type)}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
                    {notification.description}
                  </p>

                  <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono pt-0.5">
                    {formatJalaliDateTime(notification.timestamp) || notification.timestamp}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                {!notification.read ? (
                  <Tooltip content={isRtl ? "علامت‌گذاری به عنوان خوانده شده" : "Mark as read"}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void act(()=>markNotificationAsRead(notification.id));
                      }}
                      className="p-2 bg-blue-100 hover:bg-blue-600 hover:text-white dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-xl transition-all cursor-pointer text-xs font-extrabold flex items-center gap-1"
                    >
                      <Check size={14} />
                      <span className="text-[10px]">{isRtl ? 'خواندن' : 'Read'}</span>
                    </button>
                  </Tooltip>
                ) : (
                  <span className="text-[10px] text-slate-400 dark:text-slate-600 font-bold px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800">
                    {isRtl ? 'خوانده شده' : 'Read'}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
};

export default NotificationsView;
