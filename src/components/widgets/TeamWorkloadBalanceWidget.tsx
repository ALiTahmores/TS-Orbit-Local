import { LocalImage } from '../common/LocalImage';
import React, { useMemo } from 'react';
import { Users } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { isOverdue, tasksAssignedTo } from '../../lib/taskAnalytics';

const toPersianDigits = (n: string | number): string => {
  if (n === undefined || n === null) return '';
  return n.toString().replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(d, 10)]);
};

export interface TeamWorkloadBalanceWidgetProps {
  className?: string;
  borderless?: boolean;
}

const isActive = (task: any) => !['completed', 'cancelled'].includes(String(task?.status).toLowerCase());

/** Open tasks per member, as a share of the team's open tasks. */
export const TeamWorkloadBalanceWidget: React.FC<TeamWorkloadBalanceWidgetProps> = ({
  className = '',
  borderless = false,
}) => {
  const { teamMembers, tasks, setActiveTab, setActiveSubTab, locale, getRoleLabel } = useProject();
  const isRtl = locale === 'fa';

  const memberWorkloads = useMemo(() => {
    const rows = (teamMembers || []).map((member) => {
      const active = tasksAssignedTo(tasks || [], member.id).filter(isActive);
      return { member, activeTaskCount: active.length, overdueCount: active.filter((task) => isOverdue(task)).length };
    });
    const total = rows.reduce((sum, row) => sum + row.activeTaskCount, 0);
    return rows
      .sort((a, b) => b.activeTaskCount - a.activeTaskCount)
      .slice(0, 5)
      .map((row) => ({ ...row, sharePct: total ? Math.round(row.activeTaskCount / total * 100) : 0 }));
  }, [teamMembers, tasks]);

  const containerClasses = borderless
    ? `bg-transparent border-0 p-0 shadow-none font-sans flex flex-col justify-between space-y-4 w-full ${className}`
    : `bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all font-sans flex flex-col justify-between space-y-4 ${className}`;

  return (
    <div className={containerClasses} dir={isRtl ? 'rtl' : 'ltr'}>
      {/* HEADER */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <Users className="w-5 h-5 text-blue-500 shrink-0" />
          <div>
            <h3 className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100">بار کاری اعضای تیم</h3>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold block mt-0.5">
              سهم هر عضو از وظایف باز فضای کاری
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setActiveTab('projects');
            setActiveSubTab('team');
          }}
          className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/50 px-2.5 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1 shrink-0"
        >
          <span>مدیریت تیم</span>
        </button>
      </div>

      {/* MEMBER LIST */}
      {memberWorkloads.length === 0 ? (
        <p className="text-[11px] text-slate-500 dark:text-slate-400">هنوز عضوی در این فضای کاری نیست.</p>
      ) : (
        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin">
          {memberWorkloads.map(({ member, activeTaskCount, overdueCount, sharePct }) => (
            <div
              key={member.id}
              className="p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="relative shrink-0">
                    <LocalImage
                      src={member.avatar}
                      alt={member.name}
                      className="w-7 h-7 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                    />
                    {member.status === 'online' && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-black text-slate-800 dark:text-slate-100 truncate">{member.name}</div>
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 font-bold truncate">{getRoleLabel(member.role)}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                    {activeTaskCount ? `${toPersianDigits(activeTaskCount)} وظیفهٔ باز` : 'بدون وظیفهٔ باز'}
                  </span>
                  {overdueCount > 0 && (
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-md border bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border-rose-200/60 dark:border-rose-800/60">
                      {toPersianDigits(overdueCount)} دارای تأخیر
                    </span>
                  )}
                </div>
              </div>

              {/* SHARE BAR */}
              <div className="space-y-1 pt-0.5">
                <div className="flex justify-between items-center text-[10px] text-slate-400">
                  <span>سهم از وظایف باز تیم</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300">{toPersianDigits(sharePct)}٪</span>
                </div>
                <div className="w-full bg-slate-200/80 dark:bg-slate-700/80 h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${overdueCount ? 'bg-rose-500' : 'bg-blue-500'}`}
                    style={{ width: `${sharePct}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
