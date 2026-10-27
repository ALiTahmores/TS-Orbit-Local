import { formatJalaliDate } from '../lib/dates';
import React, { useState } from 'react';
import { useProject } from '../context/ProjectContext';
import { Task, TaskStatus, TaskPriority } from '../types';
import { 
  ArrowUpDown, 
  Plus, 
  Search, 
  MoreVertical, 
  CheckCircle2, 
  Square, 
  Calendar, 
  Folder, 
  Trash2, 
  Code2,
  Palette,
  Compass,
  ShieldCheck,
  Users
} from 'lucide-react';
import { CustomSelect } from './common/CustomSelect';

export interface TeamGroupDef {
  id: string;
  name: string;
  deptKey: string;
  leader: string;
  members: string[];
  memberIds: string[];
  bannerClass: string;
  badgeClass: string;
  icon: any;
}


export const TeamTaskMatrixView: React.FC = () => {
  const { tasks, updateTaskStatus, createTask, deleteTask, projects, teams, departments, teamMembers, t, locale, userRole, setActiveTab, setActiveSubTab } = useProject();
  // Teams are defined in the organization builder, which owners and admins can open.
  const canDefineTeams = ['OWNER', 'ADMIN'].includes(String(userRole || '').toUpperCase());
  const TEAMS_GROUPS:TeamGroupDef[] = teams.map((team:any) => {
    const dept=departments.find((department:any)=>department.id===team.departmentId);
    const memberIds=[...new Set<string>([...(team.memberIds || []),...(team.leaderId?[team.leaderId]:[])])];
    return {id:team.id,name:team.name,deptKey:team.departmentId || '',leader:teamMembers.find(member=>member.id===team.leaderId)?.name || '',memberIds,
      members:memberIds.map(id=>teamMembers.find(member=>((member as any).userId||member.id)===id)?.name || id),
      bannerClass:'bg-blue-50 dark:bg-slate-900 border border-blue-200 dark:border-slate-800',badgeClass:'bg-blue-100 text-blue-700',icon:Users};
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Quick Add Task Modal State
  const [selectedTeamForAdd, setSelectedTeamForAdd] = useState<TeamGroupDef | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState<TaskPriority>('medium');
  const [newAssignee, setNewAssignee] = useState('');

  // Active dropdown action row id
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const isRtl = locale === 'fa';

  const formatDigits = (num: number | string) => {
    if (!isRtl) return String(num);
    return String(num).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(d)]);
  };

  const getStatusBadge = (status: TaskStatus) => {
    switch (status) {
      case 'inprogress':
        return {
          label: t('status_inprogress'),
          dotColor: 'bg-emerald-500',
          className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50'
        };
      case 'review':
        return {
          label: t('status_review'),
          dotColor: 'bg-amber-500',
          className: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-800/50'
        };
      case 'pending':
        return {
          label: t('status_pending'),
          dotColor: 'bg-blue-500',
          className: 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border-blue-200 dark:border-blue-800/50'
        };
      case 'completed':
        return {
          label: t('status_completed'),
          dotColor: 'bg-emerald-600',
          className: 'bg-emerald-200 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800/60'
        };
      case 'blocked':
        return {
          label: t('status_blocked'),
          dotColor: 'bg-rose-500',
          className: 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border-rose-200 dark:border-rose-800/50'
        };
      default:
        return {
          label: status,
          dotColor: 'bg-slate-400',
          className: 'bg-slate-100 text-slate-700 dark:bg-[#131b2e] dark:text-slate-300 border-slate-200 dark:border-slate-800'
        };
    }
  };

  const handleCreateTaskForTeam = async (event:React.FormEvent) => {
    event.preventDefault(); if(!newTitle.trim() || !selectedTeamForAdd || !projects.length) return;
    await createTask({title:newTitle.trim(),description:'',status:'pending',priority:newPriority,
      teamId:selectedTeamForAdd.id,departmentId:selectedTeamForAdd.deptKey,
      assignedMemberIds:newAssignee?[newAssignee]:[],projectId:projects[0].id,tags:[]});
    setNewTitle(''); setSelectedTeamForAdd(null);
  };

  return (
    <div className={`w-full space-y-6 ${isRtl ? 'font-vazirmatn text-start' : 'font-sans text-left'}`} dir={isRtl ? 'rtl' : 'ltr'}>
      
      {/* SUB-HEADER BANNER & GLOBAL CONTROLS */}
      <div className="bg-white dark:bg-[#0d121f] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
        {/* Global Search and Status Filter */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search size={14} className={`absolute ${isRtl ? 'start-3' : 'end-3'} top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('search_tasks_placeholder')}
              className={`w-full ${isRtl ? 'ps-9 pe-3' : 'pe-9 ps-3'} py-2.5 bg-slate-50 dark:bg-[#131b2e] border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 dark:focus:border-blue-500 transition-colors`}
            />
          </div>

          <div className="w-full sm:w-48">
            <CustomSelect
              options={[
                { value: 'all', label: t('all_statuses') },
                { value: 'inprogress', label: t('status_inprogress') },
                { value: 'review', label: t('status_review') },
                { value: 'pending', label: t('status_pending') },
                { value: 'completed', label: t('status_completed') },
                { value: 'blocked', label: t('status_blocked') },
              ]}
              value={statusFilter}
              onChange={(val) => setStatusFilter(val)}
            />
          </div>
        </div>
      </div>

      {/* TEAM GROUPED TABLES */}
      <div className="space-y-6">
        {TEAMS_GROUPS.length === 0 ? (
          <div className="bg-white dark:bg-[#0d121f] border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center space-y-3 shadow-xs">
            <Users size={40} className="text-slate-300 dark:text-slate-600 mx-auto" />
            <h3 className="text-sm font-extrabold text-slate-700 dark:text-slate-200">{t('no_teams_registered')}</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500">{t('no_teams_desc')}</p>
            {canDefineTeams && (
              <button
                type="button"
                onClick={() => { setActiveTab('org_builder'); setActiveSubTab('org_builder_main'); }}
                className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2 text-xs font-bold text-white shadow-sm transition-colors cursor-pointer"
              >
                <Plus size={14} />
                <span>تعریف تیم جدید</span>
              </button>
            )}
          </div>
        ) : (
          TEAMS_GROUPS.map((team) => {
            const TeamIcon = team.icon;

            // Filter tasks assigned to team members or matching team deptKey
            const teamTasks = tasks.filter((tItem) => {
              const isTeamTask = tItem.teamId===team.id || (tItem.assignedMemberIds || tItem.assignees?.map(member=>member.id) || (tItem.assigneeId?[tItem.assigneeId]:[])).some(id=>team.memberIds.includes(id));
              const matchesSearch = tItem.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                    (tItem.assignedTo || '').toLowerCase().includes(searchQuery.toLowerCase());
              const matchesStatus = statusFilter === 'all' || tItem.status === statusFilter;

              return isTeamTask && matchesSearch && matchesStatus;
            });

            return (
              <div key={team.id} className="space-y-2.5">
                
                {/* GROUP HEADER ACCENT BAR */}
                <div className={`flex items-center justify-between px-4 py-3 rounded-xl shadow-xs font-semibold ${team.bannerClass}`}>
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-lg bg-white/70 dark:bg-[#131b2e] shadow-2xs">
                      <TeamIcon size={17} className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 dark:text-slate-100">
                      {t(team.name)}
                    </h3>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border ${team.badgeClass}`}>
                      {formatDigits(teamTasks.length)} {t('tasks_count_suffix')}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTeamForAdd(team);
                      setNewAssignee(team.memberIds[0] || '');
                    }}
                    className="px-3 py-1.5 bg-white/80 dark:bg-[#131b2e] hover:bg-white dark:hover:bg-[#17223b] border border-slate-200/80 dark:border-slate-700/80 rounded-lg text-slate-700 dark:text-slate-200 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold shadow-2xs"
                    title={t('add_task_team')}
                  >
                    <Plus size={14} className="text-blue-600 dark:text-blue-400" />
                    <span>{t('add_task_team')}</span>
                  </button>
                </div>

                {/* TEAM TASK TABLE STRUCTURE */}
                <div className="bg-white dark:bg-[#0d121f] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                  <div className="overflow-x-auto">
                    <table className={`w-full ${isRtl ? 'text-start' : 'text-left'} border-collapse min-w-[760px]`}>
                      <thead>
                        <tr className="text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-50/80 dark:bg-[#131b2e] border-b border-slate-200/80 dark:border-slate-800 select-none">
                          <th className="p-3 w-10 text-center">
                            <Square size={14} className="text-slate-300 dark:text-slate-600 inline-block" />
                          </th>
                          <th className="p-3 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span>{t('col_task_title')}</span>
                              <ArrowUpDown size={12} className="text-slate-400 dark:text-slate-500" />
                            </div>
                          </th>
                          <th className="p-3 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span>{t('col_status_priority')}</span>
                              <ArrowUpDown size={12} className="text-slate-400 dark:text-slate-500" />
                            </div>
                          </th>
                          <th className="p-3 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span>{t('col_project_name')}</span>
                              <ArrowUpDown size={12} className="text-slate-400 dark:text-slate-500" />
                            </div>
                          </th>
                          <th className="p-3 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span>{t('col_due_date')}</span>
                              <ArrowUpDown size={12} className="text-slate-400 dark:text-slate-500" />
                            </div>
                          </th>
                          <th className="p-3 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span>{t('col_assigned_to')}</span>
                              <ArrowUpDown size={12} className="text-slate-400 dark:text-slate-500" />
                            </div>
                          </th>
                          <th className="p-3 w-12 text-center whitespace-nowrap">
                            <span>{t('col_actions')}</span>
                          </th>
                        </tr>
                      </thead>

                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-xs font-medium">
                        {teamTasks.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="p-7 text-center text-slate-400 dark:text-slate-500 text-xs">
                              {t('no_tasks_for_team')}
                            </td>
                          </tr>
                        ) : (
                          teamTasks.map((task) => {
                            const relatedProject = projects.find((p) => p.id === task.projectId);
                            const statusInfo = getStatusBadge(task.status);
                            
                            const assignedList = [
                              task.assignedTo,
                              ...team.members.filter((m) => m !== task.assignedTo)
                            ].slice(0, 4);

                            const isDone = task.status === 'completed' || task.status === 'done';

                            return (
                              <tr
                                key={task.id}
                                className="bg-white dark:bg-[#0d121f] border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50/90 dark:hover:bg-[#17223b] transition-colors py-3 text-sm"
                              >
                                {/* Checkbox */}
                                <td className="p-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() => updateTaskStatus(task.id, isDone ? 'pending' : 'completed')}
                                    className="text-slate-300 dark:text-slate-600 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                                  >
                                    {isDone ? (
                                      <CheckCircle2 size={16} className="text-emerald-500" />
                                    ) : (
                                      <Square size={16} />
                                    )}
                                  </button>
                                </td>

                                {/* Task Title */}
                                <td className="p-3">
                                  <div className="space-y-0.5">
                                    <h4 className={`font-extrabold text-xs ${isDone ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-100'}`}>
                                      {t(task.title)}
                                    </h4>
                                    {task.description && (
                                      <p className="text-[10px] text-slate-400 dark:text-slate-500 line-clamp-1">
                                        {t(task.description)}
                                      </p>
                                    )}
                                  </div>
                                </td>

                                {/* Status / Priority Pill */}
                                <td className="p-3 whitespace-nowrap">
                                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black border ${statusInfo.className}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotColor}`} />
                                    <span>{statusInfo.label}</span>
                                  </span>
                                </td>

                                {/* Project Name */}
                                <td className="p-3 whitespace-nowrap">
                                  <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-extrabold text-xs">
                                    <Folder size={13} className="text-blue-500 shrink-0" />
                                    <span>{relatedProject ? t(relatedProject.title) : (isRtl ? 'فروشگاه آنلاین وابینو' : 'Vabino E-Commerce')}</span>
                                  </div>
                                </td>

                                {/* Due Date Range */}
                                <td className="p-3 whitespace-nowrap font-mono text-[11px] font-bold text-slate-600 dark:text-slate-300">
                                  <div className="flex items-center gap-1.5">
                                    <Calendar size={13} className="text-slate-400 dark:text-slate-500 shrink-0" />
                                    <span>
                                      {[formatJalaliDate(task.startDate), formatJalaliDate((task as any).deadlineCanonical || task.deadline)].filter(Boolean).join(' تا ') || (isRtl ? 'بدون تاریخ' : 'No dates')}
                                    </span>
                                  </div>
                                </td>

                                {/* Assigned Members Overlapping Avatars */}
                                <td className="p-3 whitespace-nowrap">
                                  <div className={`flex items-center ${isRtl ? '-space-x-2 space-x-reverse' : '-space-x-2'}`}>
                                    {assignedList.map((member, idx) => (
                                      <div
                                        key={idx}
                                        className="w-6 h-6 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white border-2 border-white dark:border-[#0d121f] flex items-center justify-center text-[9px] font-extrabold shadow-2xs"
                                        title={t(member)}
                                      >
                                        {member.substring(0, 1)}
                                      </div>
                                    ))}
                                    {team.members.length > 3 && (
                                      <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-[#131b2e] text-slate-700 dark:text-slate-200 border-2 border-white dark:border-[#0d121f] flex items-center justify-center text-[9px] font-black">
                                        +{team.members.length - 2}
                                      </div>
                                    )}
                                  </div>
                                </td>

                                {/* Actions Dropdown */}
                                <td className="p-3 text-center whitespace-nowrap relative">
                                  <button
                                    type="button"
                                    onClick={() => setActiveMenuId(activeMenuId === task.id ? null : task.id)}
                                    className="p-1 hover:bg-slate-100 dark:hover:bg-[#131b2e] rounded-lg text-slate-400 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                                  >
                                    <MoreVertical size={15} />
                                  </button>

                                  {activeMenuId === task.id && (
                                    <div className={`absolute ${isRtl ? 'end-4' : 'start-4'} top-10 w-40 bg-white dark:bg-[#131b2e] border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-20 py-1 ${isRtl ? 'text-start' : 'text-left'} text-xs font-bold`}>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          updateTaskStatus(task.id, 'completed');
                                          setActiveMenuId(null);
                                        }}
                                        className="w-full px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-[#17223b] text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 cursor-pointer"
                                      >
                                        <CheckCircle2 size={13} />
                                        <span>{t('mark_as_completed')}</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          deleteTask(task.id);
                                          setActiveMenuId(null);
                                        }}
                                        className="w-full px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-[#17223b] text-rose-500 dark:text-rose-400 flex items-center gap-1.5 cursor-pointer"
                                      >
                                        <Trash2 size={13} />
                                        <span>{t('delete_task')}</span>
                                      </button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            );
          })
        )}
      </div>

      {/* QUICK ADD TASK MODAL */}
      {selectedTeamForAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto" dir={isRtl ? 'rtl' : 'ltr'}>
          <div 
            onClick={() => setSelectedTeamForAdd(null)}
            className="fixed inset-0 z-0 bg-black/40 dark:bg-black/70 backdrop-blur-[1px] transition-opacity duration-200 animate-in fade-in cursor-pointer"
          />
          <div className="relative z-10 bg-white dark:bg-[#0d121f] border border-slate-200/90 dark:border-slate-800 rounded-[28px] max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm">
              {t('add_task_team')} - {t(selectedTeamForAdd.name)}
            </h3>

            <form onSubmit={handleCreateTaskForTeam} className="space-y-4 text-xs font-bold">
              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1">
                  {t('task_title')}
                </label>
                <input
                  type="text"
                  required
                  placeholder={t('search_tasks_placeholder')}
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 dark:bg-[#131b2e] border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-blue-500 text-slate-800 dark:text-slate-100 transition-colors"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1">
                  {t('assigned_lead')}
                </label>
                <CustomSelect
                  options={selectedTeamForAdd.memberIds.map((id,index) => ({ value:id, label:selectedTeamForAdd.members[index] }))}
                  value={newAssignee}
                  onChange={(val) => setNewAssignee(val)}
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1">
                  {t('priority')}
                </label>
                <CustomSelect
                  options={[
                    { value: 'low', label: t('priority_low') },
                    { value: 'medium', label: t('priority_medium') },
                    { value: 'high', label: t('priority_high') },
                    { value: 'critical', label: t('priority_critical') },
                  ]}
                  value={newPriority}
                  onChange={(val) => setNewPriority(val as TaskPriority)}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedTeamForAdd(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-[#131b2e] transition-colors cursor-pointer"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 text-white font-black hover:bg-blue-700 shadow-md shadow-blue-500/20 cursor-pointer transition-all"
                >
                  {t('submit_task')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
