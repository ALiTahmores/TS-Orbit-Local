import { formatJalaliDate } from '../../lib/dates';
import { assignedIds } from '../../lib/domain';
import { LocalImage } from '../common/LocalImage';
import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  Plus, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  Paperclip, 
  MessageSquare, 
  MoreHorizontal, 
  ChevronRight,
  ChevronLeft,
  TrendingUp, 
  Download, 
  CheckSquare, 
  GripVertical, 
  FileText,
  Layers,
  LayoutGrid,
  Table,
  SlidersHorizontal,
  Flame,
  ArrowUpRight,
  Maximize2
} from 'lucide-react';
import { useProjectContext } from '../../context/ProjectContext';
import { Task, SubTask } from '../../types';
import { cn } from '../../lib/utils';
import { priorityKey, priorityLabel, statusLabel } from '../../lib/taskLabels';
import { CreateTaskModal } from '../tasks/CreateTaskModal';
import { TaskDetailModal } from '../tasks/TaskDetailModal';
import { TaskFullDetailView } from '../tasks/TaskFullDetailView';

export const MyTasksView: React.FC = () => {
  const { 
    tasks, 
    currentUser, 
    language, 
    locale, 
    updateTaskStatus,
    projects
  } = useProjectContext();

  const [activeTab, setActiveTab] = useState<'kanban' | 'timeline' | 'spreadsheet'>('kanban');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPriority, setFilterPriority] = useState<string>('ALL');

  // Modals & Navigation States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createDefaultStatus, setCreateDefaultStatus] = useState<string>('TODO');
  const [selectedTaskForQuickView, setSelectedTaskForQuickView] = useState<Task | null>(null);
  const [fullDetailTask, setFullDetailTask] = useState<Task | null>(null);

  const isRtl = (language === 'fa' || locale !== 'en');

  // 1. Strict personal scoping
  const myTasks = useMemo(() => {
    if(!currentUser?.id) return [];
    return tasks.filter(task=>assignedIds(task).includes(currentUser.id) || task.creatorId===currentUser.id);
  },[tasks,currentUser]);
  const timelineDays = useMemo(() => {
    const dates=[...new Set(myTasks.map(task=>task.deadlineCanonical || task.dueDateCanonical || task.deadline || task.dueDate).filter(Boolean))].sort().slice(0,8);
    return dates.map(date=>({day:String(date),jalali:/^\d{4}-\d{2}-\d{2}$/.test(String(date))?new Date(date+'T12:00:00Z').toLocaleDateString('fa-IR'):'',hasTasks:true,label:myTasks.filter(task=>(task.deadlineCanonical || task.dueDateCanonical || task.deadline || task.dueDate)===date).map(task=>task.title).join('، '),color:'bg-blue-600 text-white'}));
  },[myTasks]);

  // Every persisted task status remains reachable in the personal board.
  const columns = [
    { 
      id: 'PENDING', 
      aliases: ['PENDING', 'pending', 'TODO', 'todo', 'To-do'], 
      title: statusLabel('pending', isRtl ? 'fa' : 'en'),
      color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' 
    },
    { 
      id: 'IN_PROGRESS', 
      aliases: ['IN_PROGRESS', 'inprogress', 'in_progress', 'On Progress', 'In Progress'], 
      title: statusLabel('inprogress', isRtl ? 'fa' : 'en'),
      color: 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400' 
    },
    { 
      id: 'UNDER_REVIEW', 
      aliases: ['UNDER_REVIEW', 'review', 'under_review', 'In Review'], 
      title: statusLabel('review', isRtl ? 'fa' : 'en'),
      color: 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400' 
    },
    { 
      id: 'COMPLETED', 
      aliases: ['COMPLETED', 'completed', 'done', 'Done', 'Completed'], 
      title: statusLabel('completed', isRtl ? 'fa' : 'en'),
      color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400' 
    },
    { id: 'BLOCKED', aliases: ['blocked', 'BLOCKED'], title: isRtl ? 'مسدود' : 'Blocked', color: 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400' },
    { id: 'CANCELLED', aliases: ['cancelled', 'CANCELLED'], title: isRtl ? 'لغوشده' : 'Cancelled', color: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400' }
  ];

  // Filtered tasks by search & priority
  const displayTasks = useMemo(() => {
    return myTasks.filter(t => {
      const matchesDate = !selectedDate || (t.deadlineCanonical || t.dueDateCanonical || t.deadline || t.dueDate)===selectedDate;
      const matchesSearch = !searchQuery.trim() || 
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesPriority = filterPriority === 'ALL' || 
        String(t.priority).toLowerCase() === ({Urgent:'critical',High:'high',Medium:'medium',Low:'low'}[filterPriority] || filterPriority.toLowerCase());

      return matchesDate && matchesSearch && matchesPriority;
    });
  }, [myTasks, searchQuery, filterPriority,selectedDate]);

  if (fullDetailTask) {
    return (
      <TaskFullDetailView 
        task={fullDetailTask} 
        onBack={() => setFullDetailTask(null)} 
      />
    );
  }

  const openCreateModal = (statusKey: string = 'TODO') => {
    setCreateDefaultStatus(statusKey);
    setIsCreateModalOpen(true);
  };

  return (
    <div className={`w-full space-y-6 pb-16 font-sans ${isRtl ? 'dir-rtl' : 'dir-ltr'}`} dir={isRtl ? 'rtl' : 'ltr'}>
      
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-slate-100">
            {isRtl ? 'تسک‌های من' : 'My Tasks'}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {isRtl ? 'تقویم زمانبندی و بورد مدیریت کلیه وظایف محوله' : 'Interactive Date-Driven Timeline & Kanban Matrix'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Search Input */}
          <div className="relative min-w-[220px] sm:min-w-[260px]">
            <Search className="w-4 h-4 text-slate-400 absolute start-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isRtl ? "جستجو در تسک‌ها..." : "Search tasks..."}
              className="w-full h-10 ps-9 pe-4 text-xs rounded-2xl bg-white dark:bg-[#0d121f] border border-slate-200/90 dark:border-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500 shadow-xs"
            />
          </div>

          {/* New Task Trigger Button */}
          <button
            type="button"
            onClick={() => openCreateModal('TODO')}
            className="h-10 px-5 rounded-2xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>{isRtl ? 'تسک جدید' : 'New Task'}</span>
          </button>
        </div>
      </div>

      {/* 1. Task Calendar Timeline Strip (Faithful to 127e1d8b9bc.jpg) */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-[#0d121f] border border-slate-200/90 dark:border-slate-800 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">
              {isRtl ? 'تقویم و گانت وظایف' : 'Task Calendar'}
            </h3>
            {selectedDate && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
                {selectedDate}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              type="button"
              onClick={() => setSelectedDate('')}
              className="text-[11px] text-slate-400 hover:text-blue-600 transition-colors cursor-pointer"
            >
              {isRtl ? 'نمایش همه' : 'Show All'}
            </button>
            <button type="button" className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer">
              <MoreHorizontal className="w-4 h-4"/>
            </button>
          </div>
        </div>

        {/* Dynamic Timeline Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 border-t border-slate-100 dark:border-slate-800/80 pt-4">
          {timelineDays.map((item, idx) => {
            const isSelected = selectedDate === item.day;
            return (
              <div 
                key={idx}
                onClick={() => setSelectedDate(isSelected ? '' : item.day)}
                className={cn(
                  "p-3 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between min-h-[110px] group",
                  isSelected 
                    ? "border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 shadow-xs ring-2 ring-blue-500/20" 
                    : "border-slate-100 dark:border-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-700"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{item.day}</span>
                  <span className="text-[10px] text-slate-400 font-mono">{item.jalali}</span>
                </div>

                {item.hasTasks ? (
                  <div className={cn(
                    "p-2 rounded-xl text-[10px] font-bold leading-tight line-clamp-2 mt-2 transition-transform group-hover:scale-102 shadow-2xs",
                    item.color || "bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900"
                  )}>
                    {item.label}
                  </div>
                ) : (
                  <div className="h-7 w-full rounded-xl bg-slate-100/60 dark:bg-slate-800/30 flex items-center justify-center text-[10px] text-slate-300 dark:text-slate-600 mt-2">
                    -
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. View Switcher & All Tasks Section Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            {isRtl ? 'تمام وظایف' : 'All Tasks'}
          </h2>
          <span className="px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-400">
            {displayTasks.length} {isRtl ? 'تسک' : 'tasks'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Priority Quick Filter */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl text-xs">
            {['ALL', 'Urgent', 'High', 'Medium', 'Low'].map(p => (
              <button
                type="button"
                key={p}
                onClick={() => setFilterPriority(p)}
                className={cn(
                  "px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer",
                  filterPriority === p 
                    ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-2xs" 
                    : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
                )}
              >
                {p === 'ALL' ? (isRtl ? 'همه' : 'All') : priorityLabel(p, isRtl ? 'fa' : 'en')}
              </button>
            ))}
          </div>

          {/* View Mode Switcher: Spreadsheet ▦ | Timeline 📉 | Kanban ▤ */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl border border-slate-200/80 dark:border-slate-700/80 text-xs">
            <button 
              type="button"
              onClick={() => setActiveTab('spreadsheet')}
              className={cn(
                "px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer",
                activeTab === 'spreadsheet' 
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs" 
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
              )}
            >
              <Table className="w-3.5 h-3.5" />
              <span>{isRtl ? 'صفحه گسترده' : 'Spreadsheet'}</span>
            </button>

            <button 
              type="button"
              onClick={() => setActiveTab('timeline')}
              className={cn(
                "px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer",
                activeTab === 'timeline' 
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs" 
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
              )}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>{isRtl ? 'تایملاین' : 'Timeline'}</span>
            </button>

            <button 
              type="button"
              onClick={() => setActiveTab('kanban')}
              className={cn(
                "px-3.5 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer",
                activeTab === 'kanban' 
                  ? "bg-blue-600 text-white shadow-xs" 
                  : "text-slate-500 hover:text-slate-800 dark:text-slate-400"
              )}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>{isRtl ? 'برد کانبان' : 'Kanban'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. KANBAN MATRIX VIEW (4 COLUMNS) */}
      {activeTab === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
          {columns.map((col) => {
            const colTasks = displayTasks.filter(t => {
              const statusStr = String(t.status || '').toLowerCase();
              return col.aliases.some(a => a.toLowerCase() === statusStr);
            });

            return (
              <div 
                key={col.id} 
                className="p-4 rounded-3xl bg-slate-50/80 dark:bg-[#0d121f] border border-slate-200/80 dark:border-slate-800/80 min-h-[500px] flex flex-col shadow-2xs"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{col.title}</span>
                    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", col.color)}>
                      {colTasks.length}
                    </span>
                  </div>
                  <button 
                    type="button"
                    onClick={() => openCreateModal(col.id)} 
                    className="w-6 h-6 rounded-lg bg-white dark:bg-slate-800 hover:bg-blue-50 text-slate-400 hover:text-blue-600 flex items-center justify-center transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5"/>
                  </button>
                </div>

                {/* Tasks Cards List */}
                <div className="space-y-3 flex-1">
                  {colTasks.length === 0 ? (
                    <div className="py-12 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
                      {isRtl ? 'تسکی در این بخش وجود ندارد' : 'No tasks in this stage'}
                    </div>
                  ) : (
                    colTasks.map((task) => {
                      const taskProgress = task.progress ?? (col.id === 'COMPLETED' ? 100 : 0);
                      const assigneesList = task.assignees || [];

                      return (
                        <div
                          key={task.id}
                          onClick={() => setSelectedTaskForQuickView(task)}
                          onDoubleClick={() => setFullDetailTask(task)}
                          className="p-4 rounded-2xl bg-white dark:bg-[#131b2e] border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:shadow-md hover:border-blue-400 dark:hover:border-blue-600 transition-all cursor-pointer group relative"
                        >
                          {/* Card Header: Title + Options / Expand */}
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-blue-500 transition-colors leading-snug">
                              {task.title}
                            </h4>
                            <button 
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setFullDetailTask(task);
                              }}
                              className="text-slate-300 hover:text-blue-600 p-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer shrink-0"
                              title={isRtl ? "نمای تمام صفحه" : "Full View"}
                            >
                              <Maximize2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Due Date Badge with Calendar Icon */}
                          <div className="flex items-center gap-1 mb-2.5">
                            <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                              <Calendar className="w-2.5 h-2.5" />
                              <span>{formatJalaliDate((task as any).deadlineCanonical || (task as any).dueDateCanonical || task.dueDate || task.deadline) || '—'}</span>
                            </span>
                            {task.priority && (
                              <span className={cn(
                                "text-[9px] font-black px-1.5 py-0.5 rounded-md",
                                priorityKey(task.priority) === 'critical' ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400' : 'bg-slate-100 text-slate-500'
                              )}>
                                {priorityLabel(task.priority, isRtl ? 'fa' : 'en')}
                              </span>
                            )}
                          </div>

                          {/* Subtitle / Phase */}
                          <p className="text-[11px] text-slate-400 dark:text-slate-400 mb-3 line-clamp-1">
                            {task.description || (isRtl ? 'بدون توضیح' : 'No description')}
                          </p>

                          {/* Progress Bar with Dynamic % */}
                          <div className="space-y-1 mb-3">
                            <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold">
                              <span>{isRtl ? 'پیشرفت' : 'Progress'}: {taskProgress}%</span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                              <div 
                                className="h-full bg-emerald-500 rounded-full transition-all duration-300" 
                                style={{ width: `${taskProgress}%` }} 
                              />
                            </div>
                          </div>

                          {/* Card Footer: Metadata Counters + Assignees */}
                          <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 dark:border-slate-800/80 text-[11px] text-slate-400">
                            <div className="flex items-center gap-2.5">
                              <span className="flex items-center gap-1 text-[10px] font-medium">
                                <MessageSquare className="w-3 h-3 text-slate-400" />
                                <span>{task.commentsCount ?? task.comments?.length ?? 0}</span>
                              </span>
                              <span className="flex items-center gap-1 text-[10px] font-medium">
                                <Paperclip className="w-3 h-3 text-slate-400" />
                                <span>{task.attachments?.length ?? 0}</span>
                              </span>
                            </div>

                            <div className="flex items-center -space-x-1.5 space-x-reverse">
                              {assigneesList.slice(0, 3).map((a, idx) => (
                                <LocalImage 
                                  key={idx}
                                  src={a.avatar} 
                                  alt={a.name} 
                                  title={a.name}
                                  className="w-5 h-5 rounded-full border-2 border-white dark:border-slate-900 object-cover" 
                                />
                              ))}
                            </div>
                          </div>

                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. SPREADSHEET TABLE VIEW */}
      {activeTab === 'spreadsheet' && (
        <div className="rounded-3xl bg-white dark:bg-[#0d121f] border border-slate-200/90 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left rtl:text-right">
              <thead className="bg-slate-50 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-4 px-5">{isRtl ? 'عنوان تسک' : 'Task Title'}</th>
                  <th className="p-4">{isRtl ? 'وضعیت' : 'Status'}</th>
                  <th className="p-4">{isRtl ? 'سررسید' : 'Due Date'}</th>
                  <th className="p-4">{isRtl ? 'اولویت' : 'Priority'}</th>
                  <th className="p-4">{isRtl ? 'پیشرفت' : 'Progress'}</th>
                  <th className="p-4">{isRtl ? 'مسئول' : 'Assignee'}</th>
                  <th className="p-4 text-center">{isRtl ? 'عملیات' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {displayTasks.map(task => (
                  <tr 
                    key={task.id}
                    onClick={() => setSelectedTaskForQuickView(task)}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-900/50 transition-colors cursor-pointer"
                  >
                    <td className="p-4 px-5 font-bold text-slate-800 dark:text-slate-100">
                      {task.title}
                    </td>
                    <td className="p-4">
                      <span className="px-2.5 py-1 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 font-bold text-[11px]">
                        {statusLabel(task.status, isRtl ? 'fa' : 'en')}
                      </span>
                    </td>
                    <td className="p-4 font-mono text-slate-500">
                      {formatJalaliDate((task as any).deadlineCanonical || (task as any).dueDateCanonical || task.dueDate || task.deadline) || '—'}
                    </td>
                    <td className="p-4 font-bold text-rose-500">
                      {priorityLabel(task.priority, isRtl ? 'fa' : 'en')}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${task.progress ?? 0}%` }} />
                        </div>
                        <span className="text-[10px] font-bold text-slate-400">{task.progress ?? 0}%</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1.5">
                        {task.assignees?.[0] && <LocalImage src={task.assignees[0].avatar || '/avatars/avatar-7.svg'} className="w-5 h-5 rounded-full object-cover" alt="" />}
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{task.assignees?.map(member=>member.name).join('، ') || task.assignedTo || (isRtl ? 'بدون مسئول' : 'Unassigned')}</span>
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFullDetailTask(task);
                        }}
                        className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-blue-600 hover:text-white text-slate-600 dark:text-slate-300 text-[11px] font-bold transition-all"
                      >
                        {isRtl ? 'مدیریت' : 'Manage'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. TIMELINE GANTT VIEW */}
      {activeTab === 'timeline' && (
        <div className="p-6 rounded-3xl bg-white dark:bg-[#0d121f] border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-4">
          <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200">
            {isRtl ? 'نمای زمانی و وابستگی وظایف' : 'Chronological Timeline'}
          </h3>
          <div className="space-y-3">
            {displayTasks.map(t => (
              <div 
                key={t.id}
                onClick={() => setSelectedTaskForQuickView(t)}
                className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-4 cursor-pointer hover:border-blue-400 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 flex items-center justify-center font-bold">
                    <CheckSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">{t.title}</h4>
                    <span className="text-[10px] text-slate-400 font-mono">{formatJalaliDate((t as any).deadlineCanonical || (t as any).dueDateCanonical || t.dueDate || t.deadline) || (isRtl ? 'بدون سررسید' : 'No due date')}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span className="px-2.5 py-1 rounded-xl bg-slate-200 dark:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    {statusLabel(t.status, isRtl ? 'fa' : 'en')}
                  </span>
                  <button 
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFullDetailTask(t);
                    }}
                    className="text-xs text-blue-600 font-bold hover:underline"
                  >
                    {isRtl ? 'مشاهده کامل' : 'Details'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modals & Dialogs */}
      <CreateTaskModal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)}
        defaultStatus={createDefaultStatus}
      />
      
      <TaskDetailModal 
        isOpen={!!selectedTaskForQuickView} 
        task={selectedTaskForQuickView}
        onClose={() => setSelectedTaskForQuickView(null)}
        onOpenFull={() => {
          setFullDetailTask(selectedTaskForQuickView);
          setSelectedTaskForQuickView(null);
        }}
      />
    </div>
  );
};

export default MyTasksView;

