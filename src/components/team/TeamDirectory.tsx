import React, { useState } from 'react';
import { FolderKanban, ListChecks, Pencil, Plus, Search, Users } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { roadmapStepCount, teamRoadmap } from '../../lib/teamRoadmaps';
import { isManagerRole } from '../../lib/roles';
import { TeamEditor } from './TeamEditor';
import { TeamAvatar } from './TeamAvatar';

const fa = (value: number) => value.toLocaleString('fa-IR');

/** Every team in the workspace with its roadmap; managers create and edit teams here. */
export const TeamDirectory: React.FC = () => {
  const { teams, teamMembers, projects, userRole } = useProject();
  const canManage = isManagerRole(userRole);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<{ team?: any } | null>(null);
  const memberName = (id: string) => teamMembers.find(person => ((person as any).userId || person.id) === id)?.name || '';
  const visible = teams.filter((team: any) => `${team.name} ${team.description || ''}`.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <section className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div className="space-y-1 max-w-2xl">
          <h2 className="text-base font-black text-slate-900 dark:text-white">{`تیم‌ها (${fa(teams.length)})`}</h2>
          <p className="text-xs leading-6 text-slate-500 dark:text-slate-400">هر تیم نقشهٔ راه خودش را دارد. وقتی تیمی برای پروژه انتخاب شود، چک‌لیست آن به‌طور خودکار برای پروژه ساخته می‌شود.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-56 sm:flex-none">
            <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="جست‌وجوی تیم" aria-label="جست‌وجوی تیم"
              className="w-full h-9 ps-9 pe-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-blue-500" />
          </div>
          {canManage && (
            <button type="button" onClick={() => setEditing({})} className="shrink-0 inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer">
              <Plus size={14} />تیم جدید
            </button>
          )}
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="flex flex-col items-center text-center gap-2 px-6 py-12 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <Users size={28} className="text-slate-300 dark:text-slate-600" />
          <p className="text-xs text-slate-500 dark:text-slate-400">{teams.length ? 'تیمی با این نام پیدا نشد.' : 'هنوز تیمی تعریف نشده است.'}</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {visible.map((team: any) => {
            const roadmap = teamRoadmap(team), steps = roadmapStepCount(roadmap);
            const memberIds: string[] = [...new Set<string>([...(team.memberIds || []), ...(team.leaderId ? [team.leaderId] : [])])];
            const projectCount = projects.filter(project => project.assignedTeamIds?.includes(team.id)).length;
            return (
              <article key={team.id} className="flex flex-col gap-3 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
                <div className="flex items-start gap-3">
                  <TeamAvatar team={team} />
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <h3 className="text-[13px] font-black text-slate-900 dark:text-white truncate">{team.name}</h3>
                      {team.customFields?.templateKey && <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-500 dark:text-slate-400">پیش‌فرض</span>}
                    </div>
                    <p className="text-[11px] leading-5 text-slate-500 dark:text-slate-400 line-clamp-2">{team.description || 'بدون توضیح'}</p>
                  </div>
                </div>
                <dl className="grid grid-cols-3 gap-2 text-center">
                  {[[Users, memberIds.length, 'عضو'], [ListChecks, steps, 'مرحله'], [FolderKanban, projectCount, 'پروژه']].map(([Icon, count, text]: any) => (
                    <div key={text} className="rounded-xl bg-slate-50 dark:bg-slate-800/50 py-2">
                      <dt className="sr-only">{text}</dt>
                      <dd className="text-sm font-black text-slate-800 dark:text-slate-100">{fa(count)}</dd>
                      <dd className="flex items-center justify-center gap-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400"><Icon size={11} />{text}</dd>
                    </div>
                  ))}
                </dl>
                <div className="flex items-center justify-between gap-2 pt-3 mt-auto border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center -space-x-1.5 rtl:space-x-reverse min-w-0">
                    {memberIds.slice(0, 4).map(id => (
                      <span key={id} title={memberName(id)} className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 border-2 border-white dark:border-slate-900 flex items-center justify-center text-[10px] font-black text-slate-600 dark:text-slate-200">{(memberName(id) || '?')[0]}</span>
                    ))}
                    {memberIds.length === 0 && <span className="text-[11px] text-slate-400">بدون عضو</span>}
                    {memberIds.length > 4 && <span className="ps-2.5 text-[10px] font-bold text-slate-400">{`+${fa(memberIds.length - 4)}`}</span>}
                  </div>
                  <button type="button" onClick={() => setEditing({ team })} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer">
                    {canManage ? <><Pencil size={13} />ویرایش</> : <><ListChecks size={13} />نقشهٔ راه</>}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {editing && <TeamEditor team={editing.team} readOnly={!canManage} onClose={() => setEditing(null)} />}
    </section>
  );
};
