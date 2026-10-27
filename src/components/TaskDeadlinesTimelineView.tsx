import React, { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import { Task } from '../types';
import { CustomSelect } from './common/CustomSelect';
import { TaskDetailModal } from './tasks/TaskDetailModal';
import { dueDate, isOverdue } from '../lib/taskAnalytics';
import {
  jalaliWeekdaysShort, formatJalaliDate, jalaliMonthGrid, jalaliMonthLabel, jalaliMonthOf,
  localISODate, persianNumber, shiftJalaliMonth, type JalaliMonth,
} from '../lib/dates';

const MAX_PER_DAY = 3;

const chipClass = (task: Task, today: string) => {
  if (task.status === 'completed') return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 line-through decoration-emerald-400/60';
  if (task.status === 'cancelled') return 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500 line-through';
  if (isOverdue(task, today)) return 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300';
  if (task.status === 'blocked') return 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300';
  return 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300';
};

const dotClass = (task: Task, today: string) => {
  if (task.status === 'completed') return 'bg-emerald-400';
  if (task.status === 'cancelled') return 'bg-slate-300 dark:bg-slate-600';
  if (isOverdue(task, today)) return 'bg-rose-400';
  if (task.status === 'blocked') return 'bg-amber-400';
  return 'bg-blue-400';
};

/** Tasks placed on their due dates in a Persian-calendar month. */
export const TaskDeadlinesTimelineView: React.FC = () => {
  const { projects, tasks } = useProject();
  const today = localISODate();
  const [month, setMonth] = useState<JalaliMonth>(() => jalaliMonthOf(today));
  const [projectId, setProjectId] = useState('all');
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [expandedDay, setExpandedDay] = useState('');
  // Phones show one day's tasks under the month; it starts on today.
  const [selectedDay, setSelectedDay] = useState(today);

  const visibleTasks = useMemo(() => (tasks || []).filter(task => projectId === 'all' || task.projectId === projectId), [tasks, projectId]);
  const byDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of visibleTasks) {
      const due = dueDate(task);
      if (due) map.set(due, [...(map.get(due) || []), task]);
    }
    return map;
  }, [visibleTasks]);
  const grid = useMemo(() => jalaliMonthGrid(month), [month]);
  const undated = visibleTasks.filter(task => !dueDate(task) && task.status !== 'completed' && task.status !== 'cancelled').length;
  const monthTotal = grid.days.reduce((sum, day) => sum + (byDay.get(day.iso)?.length || 0), 0);
  const projectTitle = (id: string) => projects.find(project => project.id === id)?.title || '';

  return (
    <div className="space-y-4 font-sans">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <CalendarDays size={18} className="text-blue-600" />
          <div>
            <h2 className="text-sm font-black text-slate-900 dark:text-white">تقویم سررسید وظایف</h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {`${persianNumber(monthTotal)} وظیفه در این ماه`}{undated ? ` • ${persianNumber(undated)} وظیفهٔ باز بدون سررسید` : ''}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-full sm:w-52">
            <CustomSelect
              options={[{ value: 'all', label: 'همهٔ پروژه‌ها' }, ...projects.map(project => ({ value: project.id, label: project.title }))]}
              value={projectId}
              onChange={setProjectId}
            />
          </div>
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
            <button type="button" onClick={() => setMonth(current => shiftJalaliMonth(current, -1))} aria-label="ماه قبل" className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 cursor-pointer"><ChevronRight size={16} /></button>
            <span className="text-xs font-black text-slate-800 dark:text-slate-100 min-w-28 text-center">{jalaliMonthLabel(month)}</span>
            <button type="button" onClick={() => setMonth(current => shiftJalaliMonth(current, 1))} aria-label="ماه بعد" className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 cursor-pointer"><ChevronLeft size={16} /></button>
          </div>
          <button type="button" onClick={() => setMonth(jalaliMonthOf(today))} className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">امروز</button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 overflow-x-auto">
        <div className="sm:min-w-[680px]">
          <div className="grid grid-cols-7 gap-1.5 mb-1.5">
            {jalaliWeekdaysShort().map((day, index) => (
              <span key={day} className={`text-center text-[11px] font-bold py-1 ${index === 6 ? 'text-rose-500' : 'text-slate-400'}`}>{day}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: grid.leading }, (_, index) => <div key={`blank-${index}`} className="min-h-12 sm:min-h-24 rounded-xl bg-slate-50/50 dark:bg-slate-800/20" />)}
            {grid.days.map(({ iso, day }) => {
              const dayTasks = byDay.get(iso) || [];
              const expanded = expandedDay === iso;
              const shown = expanded ? dayTasks : dayTasks.slice(0, MAX_PER_DAY);
              const isToday = iso === today;
              return (
                <div key={iso} className={`relative min-h-12 sm:min-h-24 rounded-xl border p-1.5 space-y-1 ${isToday ? 'border-blue-400 bg-blue-50/40 dark:bg-blue-950/20' : 'border-slate-100 dark:border-slate-800'} ${selectedDay === iso ? 'max-sm:ring-2 max-sm:ring-blue-500' : ''}`}>
                  <button type="button" onClick={() => setSelectedDay(iso)} aria-label={formatJalaliDate(iso)} aria-pressed={selectedDay === iso} className="sm:hidden absolute inset-0 rounded-xl cursor-pointer" />
                  {dayTasks.length > 0 && (
                    <div className="sm:hidden flex flex-wrap gap-0.5 pt-0.5" aria-hidden="true">
                      {dayTasks.slice(0, 4).map(task => <span key={task.id} className={`w-1.5 h-1.5 rounded-full ${dotClass(task, today)}`} />)}
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className={`text-[11px] font-black ${isToday ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'}`} title={formatJalaliDate(iso)}>{persianNumber(day)}</span>
                    {isToday && <span className="hidden sm:inline text-[9px] font-bold text-blue-600 dark:text-blue-400">امروز</span>}
                  </div>
                  {shown.map(task => (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => setDetailTask(task)}
                      title={[task.title, projectTitle(task.projectId)].filter(Boolean).join(' — ')}
                      className={`hidden sm:block w-full text-start truncate px-1.5 py-1 rounded-md text-[10px] font-bold cursor-pointer hover:brightness-95 ${chipClass(task, today)}`}
                    >
                      {task.title}
                    </button>
                  ))}
                  {dayTasks.length > MAX_PER_DAY && (
                    <button type="button" onClick={() => setExpandedDay(expanded ? '' : iso)} className="hidden sm:inline text-[10px] font-bold text-slate-500 hover:text-blue-600 cursor-pointer">
                      {expanded ? 'نمایش کمتر' : `+${persianNumber(dayTasks.length - MAX_PER_DAY)} مورد دیگر`}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Phones: the selected day's tasks */}
      <section className="sm:hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-2" aria-live="polite">
        <h3 className="text-xs font-black text-slate-800 dark:text-slate-100">{formatJalaliDate(selectedDay)}</h3>
        {(byDay.get(selectedDay) || []).length === 0 ? (
          <p className="text-[11px] text-slate-500 dark:text-slate-400">وظیفه‌ای در این روز سررسید ندارد.</p>
        ) : (byDay.get(selectedDay) || []).map(task => (
          <button key={task.id} type="button" onClick={() => setDetailTask(task)} className={`block w-full text-start px-3 py-2.5 rounded-xl text-xs font-bold cursor-pointer ${chipClass(task, today)}`}>
            <span className="block truncate">{task.title}</span>
            {projectTitle(task.projectId) && <span className="block text-[10px] font-medium opacity-75 truncate mt-0.5">{projectTitle(task.projectId)}</span>}
          </button>
        ))}
      </section>

      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
        {[['bg-blue-400', 'در حال انجام'], ['bg-rose-400', 'دارای تأخیر'], ['bg-amber-400', 'متوقف'], ['bg-emerald-400', 'تکمیل‌شده']].map(([dot, label]) => (
          <span key={label} className="inline-flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${dot}`} />{label}</span>
        ))}
      </div>

      <TaskDetailModal task={detailTask} isOpen={!!detailTask} onClose={() => setDetailTask(null)} />
    </div>
  );
};

export default TaskDeadlinesTimelineView;
