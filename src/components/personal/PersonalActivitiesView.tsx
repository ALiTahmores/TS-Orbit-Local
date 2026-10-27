import React, { useState, useMemo } from 'react';
import { Activity, CheckCircle2, MessageSquare, Settings, Clock, Layers, FolderKanban } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { useAuth } from '../../hooks/useAuth';
import { LocalImage } from '../common/LocalImage';
import { ActivityHeatmap } from '../common/ActivityHeatmap';
import { activityCategory, activityLabel, type ActivityCategory } from '../../lib/activityLabels';
import { formatJalaliDateTime, persianNumber } from '../../lib/dates';

type Filter = 'all' | ActivityCategory;

const CATEGORY_STYLE: Record<ActivityCategory, { icon: React.ElementType; badge: string }> = {
  task: { icon: CheckCircle2, badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' },
  project: { icon: FolderKanban, badge: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800' },
  comment: { icon: MessageSquare, badge: 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border-blue-200 dark:border-blue-800' },
  system: { icon: Settings, badge: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-800' },
};

export const PersonalActivitiesView: React.FC = () => {
  const { activityLogs = [], getRoleLabel, projects = [], tasks = [], departments = [], teams = [] } = useProject();
  const { currentUser } = useAuth();
  const [selectedFilter, setSelectedFilter] = useState<Filter>('all');

  // Entity names for log rows recorded before the server stored a name.
  const names = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of [...projects, ...tasks, ...departments, ...teams] as any[]) if (row?.id) map.set(row.id, row.title || row.name || '');
    return map;
  }, [projects, tasks, departments, teams]);

  const myActivities = useMemo(() => {
    if (!currentUser?.id || !Array.isArray(activityLogs)) return [];
    return activityLogs
      .filter((log: any) => log && (log.userId || log.actorId) === currentUser.id)
      .map((log: any) => ({ ...log, category: activityCategory(log.action), targetLabel: log.targetName || names.get(log.targetId || log.target) || '' }));
  }, [activityLogs, currentUser, names]);

  const activityDates = useMemo(() => myActivities.map((log: any) => new Date(log.timestamp)), [myActivities]);
  const filteredActivities = selectedFilter === 'all' ? myActivities : myActivities.filter((act: any) => act.category === selectedFilter);
  const count = (filter: Filter) => filter === 'all' ? myActivities.length : myActivities.filter((act: any) => act.category === filter).length;

  const filters: { id: Filter; label: string; icon: React.ElementType }[] = [
    { id: 'all', label: 'همهٔ فعالیت‌ها', icon: Layers },
    { id: 'task', label: 'وظایف', icon: CheckCircle2 },
    { id: 'project', label: 'پروژه‌ها', icon: FolderKanban },
    { id: 'comment', label: 'نظرها و بازخوردها', icon: MessageSquare },
    { id: 'system', label: 'سازمان و تنظیمات', icon: Settings },
  ];

  return (
    <div className="space-y-6 font-sans text-slate-800 dark:text-slate-100">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400"><Activity className="w-6 h-6" /></div>
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-slate-100">فعالیت‌های من</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-0.5">کارهایی که در این فضای کاری انجام داده‌اید، به ترتیب زمان</p>
          </div>
        </div>
        <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/60 dark:border-slate-700/60 self-start sm:self-auto">
          <LocalImage src={currentUser?.avatar} alt={currentUser?.name || ''} className="w-8 h-8 rounded-full object-cover" />
          <div className="text-xs">
            <div className="font-bold text-slate-900 dark:text-slate-100">{currentUser?.name}</div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400">{getRoleLabel(currentUser?.role)}</div>
          </div>
        </div>
      </div>

      <ActivityHeatmap dates={activityDates} weeks={5} title="روزهای فعالیت من" subtitle="پنج هفتهٔ اخیر، هر خانه یک روز" describe={value => `${persianNumber(value)} فعالیت`} />

      <div className="flex flex-wrap items-center gap-2 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm" role="tablist" aria-label="دسته‌بندی فعالیت‌ها">
        {filters.map(tag => {
          const active = selectedFilter === tag.id;
          return (
            <button key={tag.id} type="button" role="tab" aria-selected={active} onClick={() => setSelectedFilter(tag.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${active ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>
              <tag.icon className="w-3.5 h-3.5" />
              <span>{tag.label}</span>
              <span className={`text-[10px] px-1.5 rounded-full ${active ? 'bg-blue-700 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>{persianNumber(count(tag.id))}</span>
            </button>
          );
        })}
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-500" />
            <span>تاریخچهٔ فعالیت</span>
          </h3>
          <span className="text-xs text-slate-400">{`${persianNumber(filteredActivities.length)} مورد`}</span>
        </div>

        {filteredActivities.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 mx-auto flex items-center justify-center"><Activity className="w-6 h-6" /></div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">در این دسته فعالیتی ثبت نشده است.</p>
          </div>
        ) : (
          <ol className="relative space-y-3 ps-6 before:absolute before:start-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
            {filteredActivities.map((act: any) => {
              const style = CATEGORY_STYLE[act.category as ActivityCategory];
              return (
                <li key={act.id} className="relative">
                  <span className="absolute -start-[1.3rem] top-3 w-3 h-3 rounded-full bg-blue-500 ring-4 ring-white dark:ring-slate-900" aria-hidden="true" />
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 px-4 py-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[10px] font-black shrink-0 ${style.badge}`}>
                        <style.icon className="w-3.5 h-3.5" />
                        <span>{activityLabel(act.action)}</span>
                      </span>
                      {act.targetLabel && <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate" data-no-translate>{act.targetLabel}</span>}
                    </div>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1 shrink-0">
                      <Clock className="w-3 h-3" />
                      <span>{formatJalaliDateTime(act.timestamp) || 'زمان ثبت نشده'}</span>
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
};
