import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Layers, Plus } from 'lucide-react';
import { useProject } from '../../../context/ProjectContext';
import { checklistProgress, phaseProgress, projectChecklists, roadmapStepCount, teamRoadmap, type ChecklistPhase, type TeamChecklist } from '../../../lib/teamRoadmaps';
import { isManagerRole, isReadOnlyRole } from '../../../lib/roles';
import { formatJalaliDate } from '../../../lib/dates';
import { AgentPlan, type AgentPlanTask } from '../../ui/agent-plan';
import { TeamAvatar } from '../../team/TeamAvatar';

const fa = (value: number) => value.toLocaleString('fa-IR');

/** Roadmap phases as plan rows: a phase is done when every step is ticked. */
const planTasks = (phases: ChecklistPhase[]): AgentPlanTask[] => phases.map((phase, index) => {
  const state = phaseProgress(phase);
  return {
    id: phase.id, phaseNumber: `فاز ${fa(index + 1)}`, title: phase.title, description: phase.description || '',
    status: state.complete ? 'completed' : state.started ? 'in_progress' : 'pending',
    subtasks: phase.steps.map(step => ({
      id: step.id, title: step.title, required: step.required !== false, status: step.completed ? 'completed' : 'pending',
      description: step.completed && step.completedByName ? [`انجام‌شده توسط ${step.completedByName}`, formatJalaliDate(step.completedAt)].filter(Boolean).join(' · ') : undefined,
    })),
  };
});

interface RoadmapEntry { id: string; name: string; color?: string; team?: any; checklist?: TeamChecklist }

/**
 * Every team's roadmap for the selected project. Once a roadmap is activated for
 * the project it becomes the project's checklist, so a tick here is the same
 * tick on the project's checklist page.
 */
export const ProjectRoadmapPlan: React.FC = () => {
  const { projects, selectedProject, setSelectedProject, teams, userRole, setChecklistStep, addProjectChecklist } = useProject();
  const project = projects.find(row => row.id === selectedProject?.id) || projects[0] || null;
  const lists = projectChecklists(project);
  const canManage = isManagerRole(userRole), canTick = !isReadOnlyRole(userRole);
  const [teamId, setTeamId] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => setTeamId(''), [project?.id]);

  // Teams with a roadmap, plus checklists whose team was since removed or emptied.
  const entries: RoadmapEntry[] = [
    ...teams.filter((team: any) => roadmapStepCount(teamRoadmap(team)) > 0)
      .map((team: any) => ({ id: team.id, name: team.name, color: team.color, team, checklist: lists.find(list => list.teamId === team.id) })),
    ...lists.filter(list => !teams.some((team: any) => team.id === list.teamId && roadmapStepCount(teamRoadmap(team)) > 0))
      .map(list => ({ id: list.teamId, name: list.teamName, color: list.color, checklist: list })),
  ];
  const preferred = lists[0]?.teamId || project?.assignedTeamIds?.find(id => entries.some(entry => entry.id === id));
  const current = entries.find(entry => entry.id === teamId) || entries.find(entry => entry.id === preferred) || entries[0];

  if (!current) return (
    <div className="w-full text-start bg-white dark:bg-[#0d121f] rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-sm p-10 text-center space-y-2">
      <h2 className="text-sm font-black text-slate-900 dark:text-white">هنوز تیمی با نقشهٔ راه تعریف نشده است</h2>
      <p className="text-xs text-slate-500 dark:text-slate-400">از صفحهٔ «دسته‌بندی و لیست تیم‌ها» برای تیم‌ها نقشهٔ راه تعریف کنید.</p>
    </div>
  );

  const checklist = current.checklist;
  const phases: ChecklistPhase[] = checklist ? checklist.phases
    : teamRoadmap(current.team).phases.map(phase => ({ ...phase, steps: phase.steps.map(step => ({ ...step, completed: false })) }));
  const progress = checklistProgress({ phases });
  const activate = async () => {
    if (!project || !current.team) return;
    setBusy(true);
    try { await addProjectChecklist(project.id, current.team.id); } catch { /* Request failures are reported centrally. */ } finally { setBusy(false); }
  };

  return (
    <div className="w-full text-start font-vazirmatn">
      <div className="bg-white dark:bg-[#0d121f] rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-sm p-5 sm:p-7 space-y-6 overflow-hidden">

        {/* Team roadmaps and the project they are shown for */}
        <div className="p-2 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/80 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div role="tablist" aria-label="نقشهٔ راه تیم‌ها" className="tab-scroller items-center gap-1.5 min-w-0">
            {entries.map(entry => {
              const active = entry.id === current.id;
              const done = entry.checklist && checklistProgress(entry.checklist);
              return (
                <button key={entry.id} type="button" role="tab" aria-selected={active} onClick={() => setTeamId(entry.id)}
                  className={`shrink-0 inline-flex items-center gap-2 h-9 px-3 rounded-xl text-xs whitespace-nowrap transition-colors cursor-pointer ${active ? 'bg-blue-600 text-white font-bold shadow-sm' : 'text-slate-600 dark:text-slate-400 font-semibold hover:bg-white dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'}`}>
                  <TeamAvatar team={entry.team || { name: entry.name, color: entry.color }} className="w-5 h-5 rounded-md text-[9px]" iconSize={11} />
                  <span>{entry.name}</span>
                  {done && <span className={`px-1.5 rounded-full text-[10px] font-bold ${active ? 'bg-white/20 text-white' : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'}`}>{`${fa(done.percent)}٪`}</span>}
                </button>
              );
            })}
          </div>
          {projects.length > 0 && (
            <select aria-label="انتخاب پروژه" value={project?.id || ''} onChange={event => { const next = projects.find(row => row.id === event.target.value); if (next) setSelectedProject(next); }}
              className="shrink-0 h-9 w-full lg:w-56 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer">
              {projects.map(row => <option key={row.id} value={row.id}>{row.title}</option>)}
            </select>
          )}
        </div>

        {/* Roadmap title, progress and project */}
        <div className="space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start gap-2 min-w-0">
              <span className="shrink-0 p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800"><Layers size={18} /></span>
              <div className="min-w-0 space-y-1">
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex flex-wrap items-center gap-2">
                  {`نقشهٔ راه ${current.name}`}
                  {checklist
                    ? <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200/70 dark:border-emerald-800/60">چک‌لیست فعال</span>
                    : <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200/70 dark:border-amber-800/60">الگو</span>}
                </h2>
                <p className="text-xs leading-6 text-slate-500 dark:text-slate-400">
                  {checklist
                    ? 'تیک‌های این صفحه همان چک‌لیست پروژه در بخش «چک‌لیست، محتوا و کنترل کیفیت» است و برای همهٔ اعضای تیم به‌روز می‌شود.'
                    : canManage
                      ? 'این نقشهٔ راه هنوز برای این پروژه فعال نشده است. با فعال‌سازی، چک‌لیست آن در بخش پروژه‌ها ساخته می‌شود و تیک‌ها در هر دو جا یکی است.'
                      : 'این نقشهٔ راه هنوز برای این پروژه فعال نشده است؛ مدیر پروژه می‌تواند آن را فعال کند.'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/80 shrink-0 self-start lg:self-auto">
              <div className="text-end">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-medium">پیشرفت چک‌لیست</span>
                <span className="text-xs font-black text-slate-800 dark:text-slate-100">{`${fa(progress.percent)}٪`}</span>
              </div>
              <div className="w-24 sm:w-32 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: `${progress.percent}%` }} transition={{ duration: 0.5, ease: 'easeOut' }} className="h-full bg-blue-600 dark:bg-blue-500 rounded-full" />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className={`w-2 h-2 rounded-full ${checklist ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300 dark:bg-slate-600'}`} />
              <span className="text-slate-500 dark:text-slate-400 font-medium">پروژه فعال:</span>
              <span className="font-bold text-slate-800 dark:text-slate-100 truncate">{project ? project.title : 'هیچ پروژه‌ای ثبت نشده است'}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-slate-500 dark:text-slate-400 text-[11px]">
              <span className="inline-flex items-center gap-1 bg-slate-50 dark:bg-slate-900/50 px-2.5 py-1 rounded-lg border border-slate-100 dark:border-slate-800/80">
                <span>مجموع فازها:</span>
                <strong className="text-slate-800 dark:text-slate-200 font-bold">{fa(phases.length)}</strong>
              </span>
              <span className="inline-flex items-center gap-1 bg-slate-50 dark:bg-slate-900/50 px-2.5 py-1 rounded-lg border border-slate-100 dark:border-slate-800/80">
                <span>مراحل انجام‌شده:</span>
                <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{`${fa(progress.done)} / ${fa(progress.total)}`}</strong>
              </span>
              {!checklist && canManage && project && current.team && (
                <button type="button" disabled={busy} onClick={() => void activate()} className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold disabled:opacity-50 cursor-pointer">
                  <Plus size={14} />فعال‌سازی برای این پروژه
                </button>
              )}
            </div>
          </div>

          <div className="border-t border-slate-100 dark:border-slate-800 pt-1" />
        </div>

        {/* Phases and their steps */}
        <div className="pt-1">
          <AgentPlan
            key={`${project?.id || 'none'}:${current.id}:${checklist?.id || 'template'}`}
            tasks={planTasks(phases)}
            readOnly={!checklist || !project || !canTick}
            onSubtaskToggle={(_phaseId, stepId, completed) => { if (checklist && project) void setChecklistStep(project.id, checklist.id, stepId, completed).catch(() => {}); }}
            overallProgress={progress.percent}
            embedded
            hideHeader
          />
        </div>
      </div>
    </div>
  );
};
