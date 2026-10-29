import React from 'react';
import { FolderKanban } from 'lucide-react';
import { useProject } from '../../../context/ProjectContext';
import { checklistProgress, projectChecklists } from '../../../lib/teamRoadmaps';
import { TeamChecklistPanel } from '../../projects/TeamChecklistPanel';

const fa = (value: number) => value.toLocaleString('fa-IR');

/**
 * The selected project's team roadmaps. Each team's roadmap is copied to the
 * project as a checklist, so a tick here is the same tick on the project's
 * delivery boards.
 */
export const ProjectRoadmapPlan: React.FC = () => {
  const { projects, selectedProject, setSelectedProject } = useProject();
  const project = projects.find(row => row.id === selectedProject?.id) || projects[0] || null;
  const totals = projectChecklists(project).map(checklistProgress).reduce((sum, row) => ({ done: sum.done + row.done, total: sum.total + row.total }), { done: 0, total: 0 });

  return (
    <div className="w-full text-start space-y-5">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1 max-w-2xl">
          <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">نقشهٔ راه پروژه</h2>
          <p className="text-xs leading-6 text-slate-500 dark:text-slate-400">
            مراحل هر تیم از شروع تا تحویل پروژه. تیک‌های این صفحه همان چک‌لیست بخش «چک‌لیست، محتوا و کنترل کیفیت» پروژه است و برای همهٔ اعضای تیم به‌روز می‌شود.
          </p>
        </div>
        {projects.length > 0 && (
          <div className="flex items-end gap-3 w-full md:w-auto">
            {totals.total > 0 && (
              <div className="hidden sm:block shrink-0 text-end">
                <span className="block text-[10px] font-semibold text-slate-400 dark:text-slate-500">کل مراحل پروژه</span>
                <span className="text-xs font-black text-slate-800 dark:text-slate-100">{`${fa(totals.done)} از ${fa(totals.total)}`}</span>
              </div>
            )}
            <label className="flex-1 md:w-64 md:flex-none space-y-1 text-[11px] font-bold text-slate-500 dark:text-slate-400">
              <span>پروژه</span>
              <select aria-label="انتخاب پروژه" value={project?.id || ''} onChange={event => { const next = projects.find(row => row.id === event.target.value); if (next) setSelectedProject(next); }}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500">
                {projects.map(row => <option key={row.id} value={row.id}>{row.title}</option>)}
              </select>
            </label>
          </div>
        )}
      </div>

      {project
        ? <TeamChecklistPanel project={project} />
        : (
          <div className="flex flex-col items-center text-center gap-3 px-6 py-12 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
            <span className="w-11 h-11 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center"><FolderKanban size={20} /></span>
            <p className="text-xs text-slate-500 dark:text-slate-400">هنوز پروژه‌ای ثبت نشده است. با ساختن پروژه و انتخاب تیم مسئول، نقشهٔ راه آن تیم اینجا نمایش داده می‌شود.</p>
          </div>
        )}
    </div>
  );
};
