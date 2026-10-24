import React, { useState, useMemo } from 'react';
import { 
  Activity, 
  CheckCircle2, 
  MessageSquare, 
  Settings, 
  Filter, 
  Clock, 
  User, 
  Calendar, 
  Zap,
  Sparkles,
  Layers,
  ArrowRight
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { useAuth } from '../../hooks/useAuth';
import { ActivityLog } from '../../types';

const toPersianDigits = (n: string | number | undefined | null): string => {
  if (n === undefined || n === null) return '۰';
  return n.toString().replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(d, 10)] || '۰');
};

export const PersonalActivitiesView: React.FC = () => {
  const projectContext = useProject();
  const { currentUser } = useAuth();
  
  const activityLogs = projectContext?.activityLogs || [];
  const locale = projectContext?.locale || 'fa';
  const isRtl = locale === 'fa';
  const getRoleLabel = projectContext.getRoleLabel;

  const [selectedFilter, setSelectedFilter] = useState<'all' | 'task' | 'comment' | 'system'>('all');

  // Safely extract and filter activities for current user
  const myActivities = useMemo(() => {
    const safeLogs = Array.isArray(activityLogs) ? activityLogs : [];
    if(!currentUser?.id)return [];
    return safeLogs.filter(log=>log&&(log.userId||log.actorId)===currentUser.id).map(log=>({...log,category:log.category || (/comment|message|chat/i.test(log.action)?'comment':/task/i.test(log.action)?'task':'system')}));

  }, [activityLogs, currentUser]);

  const activityDays=useMemo(()=>{
    const dayKey=(date:Date)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
    const counts=new Map<string,number>();
    for(const log of myActivities){const date=new Date(log.timestamp);if(Number.isFinite(date.getTime())){const key=dayKey(date);counts.set(key,(counts.get(key)||0)+1);}}
    return Array.from({length:36},(_,index)=>{const date=new Date(Date.now()-(35-index)*86400000),key=dayKey(date);return{key,date,count:counts.get(key)||0};});
  },[myActivities]);

  // Filtered by selected category
  const filteredActivities = useMemo(() => {
    const safeActivities = myActivities || [];
    if (selectedFilter === 'all') return safeActivities;
    return safeActivities.filter((act) => act && act.category === selectedFilter);
  }, [myActivities, selectedFilter]);

  // Statistics calculation safely
  const categoryCounts = useMemo(() => {
    const safeActivities = myActivities || [];
    return {
      all: safeActivities.length,
      task: safeActivities.filter((a) => a && a.category === 'task').length,
      comment: safeActivities.filter((a) => a && a.category === 'comment').length,
      system: safeActivities.filter((a) => a && a.category === 'system').length,
    };
  }, [myActivities]);

  // Category Icon Resolver
  const getCategoryIcon = (category?: string) => {
    switch (category) {
      case 'task':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'comment':
        return <MessageSquare className="w-4 h-4 text-blue-500" />;
      case 'system':
        return <Settings className="w-4 h-4 text-amber-500" />;
      default:
        return <Zap className="w-4 h-4 text-indigo-500" />;
    }
  };

  const getCategoryBadgeClass = (category?: string) => {
    switch (category) {
      case 'task':
        return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
      case 'comment':
        return 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border-blue-200 dark:border-blue-800';
      case 'system':
        return 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-800';
      default:
        return 'bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    }
  };

  return (
    <div className="space-y-6 font-sans text-slate-800 dark:text-slate-100" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 dark:text-slate-100">
                {isRtl ? 'تاریخچه و فعاليت‌های من' : 'My Activity Feed'}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-0.5">
                {isRtl 
                  ? 'مرور زمان‌بندی‌شده کلیه اقدامات، کامنت‌ها و تغییرات پروژه توسط شما' 
                  : 'Track your personal action history, task updates, and system contributions'}
              </p>
            </div>
          </div>
        </div>

        {/* LOGGED IN USER MINI BADGE */}
        <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/60 dark:border-slate-700/60 self-start sm:self-auto">
          <div className="w-8 h-8 rounded-full bg-emerald-500 text-white font-black text-xs flex items-center justify-center shadow-sm">
            {currentUser?.avatar || (currentUser?.name ? currentUser.name.charAt(0) : 'ع')}
          </div>
          <div className="text-xs">
            <div className="font-bold text-slate-900 dark:text-slate-100">{currentUser?.name || 'کاربر سیستم'}</div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400">{getRoleLabel(currentUser?.role)}</div>
          </div>
        </div>
      </div>

      {/* HEATMAP / CONTRIBUTION GRID */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
        <div className="flex justify-between items-center text-xs font-black text-slate-800 dark:text-slate-100">
          <span className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-500" />
            {isRtl ? 'نمودار فعالیت‌های اخیر من' : 'Recent Activity Heatmap'}
          </span>
          <span className="text-emerald-600 dark:text-emerald-400 font-mono text-[11px] bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
            {toPersianDigits(myActivities.length)} {isRtl ? 'فعالیت ثبتی اخیر' : 'total logs'}
          </span>
        </div>

        <div className="grid grid-cols-12 gap-1.5 pt-2">
          {activityDays.map(({key,date,count}) => {
            const intensity=count===0?0:count<3?1:count<6?2:count<10?3:4;
            return (
              <div
                key={key}
                className={`h-6 rounded-md transition-all cursor-pointer hover:scale-105 ${
                  intensity === 0 ? 'bg-slate-100 dark:bg-slate-800' :
                  intensity === 1 ? 'bg-emerald-200 dark:bg-emerald-950' :
                  intensity === 2 ? 'bg-emerald-300 dark:bg-emerald-800' :
                  intensity === 3 ? 'bg-emerald-500 dark:bg-emerald-600' :
                  'bg-emerald-600 dark:bg-emerald-400 shadow-sm'
                }`}
                title={`${date.toLocaleDateString(isRtl?'fa-IR':'en-US',{timeZone:'Asia/Tehran'})}: ${toPersianDigits(count)} اقدام`}
              />
            );
          })}
        </div>
      </div>

      {/* FILTER TAGS BAR */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-black text-slate-700 dark:text-slate-300">
            {isRtl ? 'فیلتر دسته‌بندی:' : 'Filter category:'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'all', label: isRtl ? 'همه فعالیت‌ها' : 'All Activities', count: categoryCounts.all, icon: Layers },
            { id: 'task', label: isRtl ? 'اقدامات تسک' : 'Tasks', count: categoryCounts.task, icon: CheckCircle2 },
            { id: 'comment', label: isRtl ? 'کامنت‌ها' : 'Comments', count: categoryCounts.comment, icon: MessageSquare },
            { id: 'system', label: isRtl ? 'سیستمی' : 'System', count: categoryCounts.system, icon: Settings },
          ].map((tag) => {
            const Icon = tag.icon;
            const isActive = selectedFilter === tag.id;
            return (
              <button
                key={tag.id}
                onClick={() => setSelectedFilter(tag.id as any)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tag.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  isActive ? 'bg-emerald-700 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                }`}>
                  {toPersianDigits(tag.count)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* TIMELINE LIST */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-500" />
            <span>{isRtl ? 'تایم‌لاین زنده اکشن‌های شخصی' : 'Live Personal Activity Stream'}</span>
          </h3>
          <span className="text-xs text-slate-400 font-mono">
            {toPersianDigits(filteredActivities.length)} {isRtl ? 'مورد' : 'items'}
          </span>
        </div>

        {filteredActivities.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">
              <Activity className="w-6 h-6" />
            </div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
              {isRtl ? 'هیچ فعالیتی در این دسته‌بندی ثبت نشده است.' : 'No activity logs found for this filter.'}
            </p>
          </div>
        ) : (
          <div className="relative space-y-6 before:absolute before:right-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800 pr-8">
            {filteredActivities.map((act) => (
              <div key={act.id} className="relative space-y-1.5 group">
                {/* TIMELINE NODE DOT */}
                <div className="absolute -right-8 top-1.5 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-4 ring-white dark:ring-slate-900 shadow-sm group-hover:scale-125 transition-all flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-white" />
                </div>

                {/* LOG HEADER */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[10px] font-black ${getCategoryBadgeClass(act.category)}`}>
                      {getCategoryIcon(act.category)}
                      <span>{act.action || 'اقدام انجام شد'}</span>
                    </span>
                  </div>

                  <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>{act.timestamp ? new Date(act.timestamp).toLocaleString(isRtl?'fa-IR':'en-US',{timeZone:'Asia/Tehran'}) : 'زمان ثبت نشده'}</span>
                  </span>
                </div>

                {/* TARGET REFERENCE */}
                {act.target && (
                  <p className="text-xs text-slate-700 dark:text-slate-300 font-bold bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/80 flex items-center gap-2">
                    <ArrowRight className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>{act.target}</span>
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
