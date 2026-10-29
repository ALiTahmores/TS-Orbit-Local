import React, { useEffect, useState } from 'react';
import { Check, ChevronDown, ListChecks, Plus, Trash2 } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { checklistProgress, phaseProgress, projectChecklists, roadmapStepCount, teamRoadmap } from '../../lib/teamRoadmaps';
import { isManagerRole, isReadOnlyRole } from '../../lib/roles';
import { formatJalaliDate } from '../../lib/dates';
import type { Project } from '../../types';

const fa = (value: number) => value.toLocaleString('fa-IR');
const select = 'h-9 min-w-0 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500';

/**
 * A project's team checklists. Ticks are stored on the project, so the roadmap
 * page and the delivery boards show the same state.
 */
export const TeamChecklistPanel: React.FC<{ project: Project }> = ({ project }) => {
  const { teams, userRole, setChecklistStep, addProjectChecklist, removeProjectChecklist } = useProject();
  const lists = projectChecklists(project);
  const [activeId, setActiveId] = useState('');
  const active = lists.find(list => list.id === activeId) || lists[0];
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [openOnly, setOpenOnly] = useState(false);
  const [teamToAdd, setTeamToAdd] = useState('');
  const [busy, setBusy] = useState(false);
  const canManage = isManagerRole(userRole), canTick = !isReadOnlyRole(userRole);
  const available = teams.filter(team => roadmapStepCount(teamRoadmap(team)) > 0 && !lists.some(list => list.teamId === team.id));

  // Opening a checklist expands the first phase that still has open steps.
  useEffect(() => {
    const next = active?.phases.find(phase => !phaseProgress(phase).complete) || active?.phases[0];
    setExpanded(new Set(next ? [next.id] : []));
  }, [active?.id, project.id]);

  const toggle = (phaseId: string) => setExpanded(previous => {
    const next = new Set(previous);
    if (next.has(phaseId)) next.delete(phaseId); else next.add(phaseId);
    return next;
  });
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try { await action(); } catch { /* Request failures are reported centrally. */ } finally { setBusy(false); }
  };
  const add = () => {
    const teamId = teamToAdd || available[0]?.id;
    if (teamId) void run(async () => { await addProjectChecklist(project.id, teamId); setTeamToAdd(''); });
  };

  const addControl = canManage && available.length > 0 && (
    <div className="flex items-center gap-2 min-w-0">
      <select aria-label="تیم برای چک‌لیست جدید" value={teamToAdd || available[0].id} onChange={event => setTeamToAdd(event.target.value)} className={`${select} flex-1 sm:w-52 sm:flex-none`}>
        {available.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
      </select>
      <button type="button" disabled={busy} onClick={add} className="shrink-0 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold disabled:opacity-50 cursor-pointer">
        <Plus size={14} />افزودن چک‌لیست تیم
      </button>
    </div>
  );

  if (!active) return (
    <div className="flex flex-col items-center text-center gap-3 px-6 py-12 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      <span className="w-11 h-11 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center"><ListChecks size={20} /></span>
      <div className="space-y-1 max-w-md">
        <h3 className="text-sm font-black text-slate-900 dark:text-white">این پروژه هنوز چک‌لیست تیمی ندارد</h3>
        <p className="text-xs leading-6 text-slate-500 dark:text-slate-400">
          {canManage
            ? (available.length ? 'تیم مسئول را انتخاب کنید تا نقشهٔ راه آن تیم به‌عنوان چک‌لیست این پروژه ساخته شود.' : 'هیچ تیمی نقشهٔ راه ندارد. از صفحهٔ تیم‌ها برای تیم‌ها نقشهٔ راه تعریف کنید.')
            : 'وقتی مدیر پروژه تیم مسئول را انتخاب کند، چک‌لیست آن تیم اینجا نمایش داده می‌شود.'}
        </p>
      </div>
      {addControl}
    </div>
  );

  const progress = checklistProgress(active);
  const requiredOpen = active.phases.flatMap(phase => phase.steps).filter(step => step.required !== false && !step.completed).length;
  const remove = () => {
    if (window.confirm(`چک‌لیست «${active.teamName}» از این پروژه حذف شود؟ تیک‌های ثبت‌شده هم حذف می‌شوند.`)) void run(() => removeProjectChecklist(project.id, active.id));
  };

  return (
    <div className="space-y-4">
      {lists.length > 1 && (
        <div role="tablist" aria-label="چک‌لیست تیم‌ها" className="tab-scroller gap-2">
          {lists.map(list => {
            const selected = list.id === active.id;
            return (
              <button key={list.id} type="button" role="tab" aria-selected={selected} onClick={() => setActiveId(list.id)}
                className={`shrink-0 inline-flex items-center gap-2 h-9 px-3.5 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${selected ? 'border-blue-600 dark:border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'}`}>
                <span className="w-2 h-2 rounded-full" style={{ background: list.color || '#2563EB' }} />
                <span>{list.teamName}</span>
                <span className="text-[10px] font-semibold opacity-70">{`${fa(checklistProgress(list).percent)}٪`}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex items-center gap-3">
            <span className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-white" style={{ background: active.color || '#2563EB' }}><ListChecks size={18} /></span>
            <div className="min-w-0">
              <h3 className="text-sm font-black text-slate-900 dark:text-white truncate">{active.teamName}</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {requiredOpen ? `${fa(requiredOpen)} مرحلهٔ ضروری باقی مانده` : 'همهٔ مراحل ضروری انجام شده است'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" aria-pressed={openOnly} onClick={() => setOpenOnly(value => !value)}
              className={`h-8 px-3 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${openOnly ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
              فقط موارد باز
            </button>
            {canManage && <button type="button" disabled={busy} onClick={remove} aria-label={`حذف چک‌لیست ${active.teamName}`} title="حذف چک‌لیست از پروژه"
              className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:opacity-50 cursor-pointer"><Trash2 size={14} /></button>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div className="h-full rounded-full bg-blue-600 dark:bg-blue-500 transition-[width] duration-500" style={{ width: `${progress.percent}%` }} />
          </div>
          <span className="shrink-0 text-[11px] font-bold text-slate-600 dark:text-slate-300">{`${fa(progress.done)} از ${fa(progress.total)} · ${fa(progress.percent)}٪`}</span>
        </div>
      </div>

      <ol className="space-y-2">
        {active.phases.map((phase, index) => {
          const state = phaseProgress(phase), open = expanded.has(phase.id);
          const steps = openOnly ? phase.steps.filter(step => !step.completed) : phase.steps;
          if (openOnly && !steps.length) return null;
          return (
            <li key={phase.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
              <button type="button" aria-expanded={open} onClick={() => toggle(phase.id)} className="w-full flex items-center gap-3 p-4 text-start hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer">
                <span className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${state.complete ? 'bg-emerald-500 text-white' : state.started ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 ring-1 ring-blue-200 dark:ring-blue-800' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
                  {state.complete ? <Check size={15} strokeWidth={3} /> : fa(index + 1)}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[13px] font-bold text-slate-900 dark:text-white">{phase.title}</span>
                  {phase.description && <span className="block text-[11px] leading-5 text-slate-500 dark:text-slate-400 mt-0.5">{phase.description}</span>}
                </span>
                <span className="shrink-0 text-[11px] font-bold text-slate-500 dark:text-slate-400">{`${fa(state.done)}/${fa(state.total)}`}</span>
                <ChevronDown size={16} className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
              </button>
              {open && (
                <ul className="border-t border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                  {steps.map(step => (
                    <li key={step.id}>
                      <button type="button" role="checkbox" aria-checked={!!step.completed} disabled={!canTick}
                        onClick={() => void setChecklistStep(project.id, active.id, step.id, !step.completed).catch(() => {})}
                        className="w-full flex items-start gap-3 px-4 py-3 text-start hover:bg-slate-50/80 dark:hover:bg-slate-800/40 disabled:cursor-default disabled:hover:bg-transparent transition-colors cursor-pointer">
                        <span className={`shrink-0 mt-0.5 w-[18px] h-[18px] rounded-md border-2 flex items-center justify-center transition-colors ${step.completed ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 dark:border-slate-600'}`}>
                          {step.completed && <Check size={12} strokeWidth={3} />}
                        </span>
                        <span className="flex-1 min-w-0 space-y-1">
                          <span className={`block text-[13px] leading-6 ${step.completed ? 'text-slate-400 dark:text-slate-500 line-through' : 'text-slate-700 dark:text-slate-200'}`}>{step.title}</span>
                          {(step.required === false || step.completed) && (
                            <span className="flex flex-wrap items-center gap-1.5 text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                              {step.required === false && <span className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">اختیاری</span>}
                              {step.completed && step.completedByName && <span>{`انجام‌شده توسط ${step.completedByName}`}</span>}
                              {step.completed && step.completedAt && <span>{formatJalaliDate(step.completedAt)}</span>}
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
      {openOnly && progress.done === progress.total && (
        <p className="text-xs text-center text-emerald-600 dark:text-emerald-400 font-bold p-4">همهٔ مراحل این چک‌لیست انجام شده است.</p>
      )}

      {addControl && <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <span className="text-[11px] text-slate-500 dark:text-slate-400">تیم دیگری هم روی این پروژه کار می‌کند؟</span>
        {addControl}
      </div>}
    </div>
  );
};
