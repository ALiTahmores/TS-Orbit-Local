import { LocalImage } from '../common/LocalImage';
import React from 'react';
import { Users, UserCheck, Activity, BarChart2 } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';

const toPersianDigits = (n: string | number): string => {
  if (n === undefined || n === null) return '';
  return n.toString().replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(d, 10)]);
};

export interface TeamWorkloadBalanceWidgetProps {
  className?: string;
  borderless?: boolean;
}

export const TeamWorkloadBalanceWidget: React.FC<TeamWorkloadBalanceWidgetProps> = ({
  className = '',
  borderless = false,
}) => {
  const { teamMembers, tasks, setActiveTab, setActiveSubTab, locale } = useProject();
  const isRtl = locale === 'fa';

  // Calculate workload for members
  const memberWorkloads = (teamMembers || []).slice(0, 5).map((member) => {
    // Count active tasks (pending, inprogress, review, blocked) assigned to this member
    const activeTasks = (tasks || []).filter(
      (t) => t && t.assignedTo === member.name && t.status !== 'completed' && t.status !== 'cancelled'
    );
    const activeTaskCount = activeTasks.length || member.taskCount || 1;

    // Calculate workload percentage (assuming 5 tasks = 100% capacity)
    const capacityPct = Math.min(Math.round((activeTaskCount / 5) * 100), 100);

    let badgeText = 'ظرفیت متعادل';
    let badgeClass = 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border-blue-200/60 dark:border-blue-800/60';
    let barClass = 'bg-blue-500';

    if (capacityPct <= 45) {
      badgeText = 'ظرفیت آزاد';
      badgeClass = 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-800/60';
      barClass = 'bg-emerald-500';
    } else if (capacityPct >= 85) {
      badgeText = 'فشار کاری';
      badgeClass = 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border-rose-200/60 dark:border-rose-800/60';
      barClass = 'bg-rose-500';
    }

    return {
      id: member.id,
      name: member.name,
      role: member.role,
      avatar: member.avatar,
      activeTaskCount,
      capacityPct,
      badgeText,
      badgeClass,
      barClass,
      isOnline: member.status === 'online',
    };
  });

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
            <h3 className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100">
              ماتریس ظرفیت و بار کاری اعضای تیم
            </h3>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold block mt-0.5">
              پایش آنلاین درصد اشتغال و ظرفیت پرسنل فنی
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
      <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin">
        {memberWorkloads.map((item) => (
          <div
            key={item.id}
            className="p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 space-y-2"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="relative shrink-0">
                  <LocalImage
                    src={item.avatar}
                    alt={item.name}
                    className="w-7 h-7 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                  />
                  {item.isOnline && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-black text-slate-800 dark:text-slate-100 truncate">
                    {item.name}
                  </div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 font-bold truncate">
                    {item.role}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 font-mono">
                  {toPersianDigits(item.activeTaskCount)} تسک فعال
                </span>
                <span
                  className={`text-[9px] font-bold px-2 py-0.5 rounded-md border ${item.badgeClass}`}
                >
                  {item.badgeText}
                </span>
              </div>
            </div>

            {/* CAPACITY BAR */}
            <div className="space-y-1 pt-0.5">
              <div className="flex justify-between items-center text-[10px] font-mono text-slate-400">
                <span>تراکم ظرفیت:</span>
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  {toPersianDigits(item.capacityPct)}٪
                </span>
              </div>
              <div className="w-full bg-slate-200/80 dark:bg-slate-700/80 h-1.5 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${item.barClass}`}
                  style={{ width: `${item.capacityPct}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
