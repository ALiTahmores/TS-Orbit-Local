import { formatJalaliDate } from '../lib/dates';
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useProject } from '../context/ProjectContext';
import { Task, TaskStatus, TaskPriority, DepartmentKey } from '../types';
import { CustomSelect, CustomSelectOption } from './common/CustomSelect';

const deptFilterOptions: CustomSelectOption[] = [
  { value: 'all', label: 'همه دپارتمان‌ها' },
  { value: 'ui_ux', label: 'طراحی UI/UX' },
  { value: 'wp_dev', label: 'توسعه وردپرس' },
  { value: 'content', label: 'تولید محتوا' },
  { value: 'seo', label: 'سئو و بهینه‌سازی' },
  { value: 'qa', label: 'QA و تست' },
];

const priorityFilterOptions: CustomSelectOption[] = [
  { value: 'all', label: 'همه اولویت‌ها' },
  { value: 'critical', label: 'فوری' },
  { value: 'high', label: 'بالا' },
  { value: 'medium', label: 'متوسط' },
  { value: 'low', label: 'پایین' },
];

const deptFormOptions: CustomSelectOption[] = [
  { value: 'ui_ux', label: 'طراحی UI/UX' },
  { value: 'wp_dev', label: 'توسعه وردپرس' },
  { value: 'content', label: 'تولید محتوا' },
  { value: 'seo', label: 'سئو و بهینه‌سازی' },
  { value: 'qa', label: 'QA و تست' },
  { value: 'client_approval', label: 'تایید کارفرما' },
];

const priorityFormOptions: CustomSelectOption[] = [
  { value: 'low', label: 'پایین' },
  { value: 'medium', label: 'متوسط' },
  { value: 'high', label: 'بالا' },
  { value: 'critical', label: 'فوری' },
];

const statusFormOptions: CustomSelectOption[] = [
  { value: 'pending', label: 'در انتظار' },
  { value: 'inprogress', label: 'در حال انجام' },
  { value: 'review', label: 'در حال بررسی' },
  { value: 'completed', label: 'تکمیل‌شده' },
  { value: 'blocked', label: 'مسدود' },
  { value: 'cancelled', label: 'لغوشده' },
];
import { motion, AnimatePresence } from 'motion/react';
import { TeamTaskMatrixView } from './TeamTaskMatrixView';
import { TaskDeadlinesTimelineView } from './TaskDeadlinesTimelineView';
import { CreateTaskModal } from './tasks/CreateTaskModal';
import { 
  Plus, 
  Search, 
  Trash2, 
  Edit3, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Folder, 
  User, 
  Tag, 
  X,
  Briefcase,
  Layers,
  ChevronLeft,
  Trello,
  LayoutGrid
} from 'lucide-react';

export const TasksGlobalView: React.FC = () => {
  const { 
    tasks, 
    updateTaskStatus, 
    updateTask, 
    deleteTask, 
    teamMembers, 
    projects, 
    createTask, 
    selectedProject,
    activeSubTab,
    setActiveSubTab,
    getRoleLabel
  } = useProject();
  
  // Search and Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [projectFilter, setProjectFilter] = useState<string>('all');

  // Unified Create Task Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedStatusForNewTask, setSelectedStatusForNewTask] = useState<string>('pending');

  // Modal control states
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Drag and drop state for visual highlights
  const [draggingOverCol, setDraggingOverCol] = useState<TaskStatus | null>(null);

  // Form Fields states
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formProjectId, setFormProjectId] = useState('');
  const [formDept, setFormDept] = useState<DepartmentKey>('wp_dev');
  const [formAssignee, setFormAssignee] = useState('');
  const [formPriority, setFormPriority] = useState<TaskPriority>('medium');
  const [formStatus, setFormStatus] = useState<TaskStatus>('pending');
  const [formStartDate, setFormStartDate] = useState('');
  const [formDeadline, setFormDeadline] = useState('');
  const [formTagsString, setFormTagsString] = useState('');

  // 5 standard status columns
  const columns: { id: TaskStatus; title: string; subtitle: string; colorClass: string; badgeClass: string }[] = [
    { 
      id: 'pending', 
      title: 'در انتظار', 
      subtitle: 'PENDING', 
      colorClass: 'border-amber-400/40 bg-amber-500/5', 
      badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400' 
    },
    { 
      id: 'inprogress', 
      title: 'در حال انجام', 
      subtitle: 'IN PROGRESS', 
      colorClass: 'border-blue-400/40 bg-blue-500/5', 
      badgeClass: 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400' 
    },
    { 
      id: 'review', 
      title: 'در حال بررسی', 
      subtitle: 'UNDER REVIEW', 
      colorClass: 'border-sky-400/40 bg-sky-500/5', 
      badgeClass: 'bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-400' 
    },
    { 
      id: 'completed', 
      title: 'تکمیل‌شده', 
      subtitle: 'COMPLETED', 
      colorClass: 'border-emerald-400/40 bg-emerald-500/5', 
      badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400' 
    },
    { 
      id: 'blocked', 
      title: 'مسدود', 
      subtitle: 'BLOCKED', 
      colorClass: 'border-rose-400/40 bg-rose-500/5', 
      badgeClass: 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400' 
    },
    {
      id: 'cancelled', title: 'لغوشده', subtitle: 'CANCELLED',
      colorClass: 'border-slate-400/40 bg-slate-500/5',
      badgeClass: 'bg-slate-100 text-slate-600 dark:bg-slate-950/40 dark:text-slate-400'
    }
  ];

  // Map database department keys to elegant Persian names
  const getDeptLabel = (d: string) => {
    switch (d) {
      case 'ui_ux': return 'طراحی UI/UX';
      case 'wp_dev': return 'توسعه وردپرس';
      case 'content': return 'تولید محتوا';
      case 'seo': return 'سئو و بهینه‌سازی';
      case 'qa': return 'QA و تست';
      case 'client_approval': return 'تایید کارفرما';
      default: return d;
    }
  };

  const getPriorityLabel = (p: TaskPriority) => {
    switch(p) {
      case 'critical': return 'فوری';
      case 'high': return 'بالا';
      case 'medium': return 'متوسط';
      case 'low': return 'پایین';
    }
  };

  const getPriorityBadgeStyles = (p: TaskPriority) => {
    switch(p) {
      case 'critical': 
        return 'text-rose-700 bg-rose-50 dark:bg-rose-950/30 dark:text-rose-400 border border-rose-200/50 dark:border-rose-900/40';
      case 'high': 
        return 'text-amber-700 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-200/50 dark:border-amber-900/40';
      case 'medium': 
        return 'text-blue-700 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-400 border border-blue-200/50 dark:border-blue-900/40';
      case 'low': 
        return 'text-zinc-600 bg-zinc-50 dark:bg-zinc-900/40 dark:text-zinc-400 border border-zinc-200/50 dark:border-zinc-800/60';
    }
  };

  // Filter Tasks
  const filteredTasks = tasks.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (t.assignedTo || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDept = deptFilter === 'all' || t.department === deptFilter;
    const matchesPriority = priorityFilter === 'all' || t.priority === priorityFilter;
    
    let matchesProject = true;
    if (projectFilter !== 'all') {
      matchesProject = t.projectId === projectFilter;
    }

    return matchesSearch && matchesDept && matchesPriority && matchesProject;
  });

  // Init Form for creating
  const openCreateModal = (preselectedStatus?: TaskStatus) => {
    setModalMode('create');
    setSelectedTask(null);
    setFormTitle('');
    setFormDesc('');
    
    // Default to first project if available
    if (selectedProject && selectedProject.id !== 'no_project') {
      setFormProjectId(selectedProject.id);
    } else if (projects && projects.length > 0) {
      setFormProjectId(projects[0].id);
    } else {
      setFormProjectId('no_project');
    }

    setFormDept('wp_dev');
    
    if (teamMembers && teamMembers.length > 0) {
      setFormAssignee((teamMembers[0] as any).userId || teamMembers[0].id);
    } else {
      setFormAssignee('');
    }

    setFormPriority('medium');
    setFormStatus(preselectedStatus || 'pending');
    setFormStartDate('');
    setFormDeadline('');
    setFormTagsString('');
    setShowModal(true);
  };

  // Init Form for editing/viewing details
  const openEditModal = (task: Task) => {
    setModalMode('edit');
    setSelectedTask(task);
    setFormTitle(task.title);
    setFormDesc(task.description);
    setFormProjectId(task.projectId || 'no_project');
    setFormDept(task.department);
    setFormAssignee(task.assignedMemberIds?.[0] || task.assigneeId || '');
    setFormPriority(task.priority);
    setFormStatus(task.status);
    setFormStartDate(task.startDate || '');
    setFormDeadline(task.deadline || '');
    setFormTagsString(task.tags ? task.tags.join(', ') : '');
    setShowModal(true);
  };

  // Submit Form
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    const tagsArray = formTagsString
      ? formTagsString.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)
      : [];

    if (modalMode === 'create') {
      await createTask({
        title: formTitle,
        description: formDesc,
        status: formStatus,
        priority: formPriority,
        department: formDept,
        assignedMemberIds: formAssignee ? [formAssignee] : [],
        startDate: formStartDate,
        deadline: formDeadline,
        projectId: formProjectId,
        tags: tagsArray,
        attachments: [],
        dependencies: []
      });
    } else if (modalMode === 'edit' && selectedTask) {
      await updateTask(selectedTask.id, {
        title: formTitle,
        description: formDesc,
        status: formStatus,
        priority: formPriority,
        department: formDept,
        assignedMemberIds: formAssignee ? [formAssignee] : [],
        startDate: formStartDate,
        deadline: formDeadline,
        projectId: formProjectId,
        tags: tagsArray
      });
    }

    setShowModal(false);
  };

  // Drag and Drop implementation
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    if (draggingOverCol !== status) {
      setDraggingOverCol(status);
    }
  };

  const handleDragLeave = () => {
    setDraggingOverCol(null);
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: TaskStatus) => {
    e.preventDefault();
    setDraggingOverCol(null);
    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId) {
      await updateTaskStatus(taskId, targetStatus);
    }
  };

  return (
    <div id="tasks_kanban_module" className="w-full space-y-6 text-start font-sans">
      
      {/* SINGLE FLOATING TOP-TAB NAVIGATION BAR WITH ACTION BUTTON */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-1">
        <div className="flex items-center gap-2 overflow-x-auto select-none">
          <button
            type="button"
            onClick={() => setActiveSubTab('kanban_board')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
              activeSubTab === 'kanban_board' || !activeSubTab || activeSubTab === 'tasks'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60 border border-slate-200/80 dark:border-slate-700/80'
            }`}
          >
            <Trello size={16} />
            <span>برد کانبان وظایف</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('team_matrix')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
              activeSubTab === 'team_matrix' || activeSubTab === 'list_view'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60 border border-slate-200/80 dark:border-slate-700/80'
            }`}
          >
            <LayoutGrid size={16} />
            <span>دسته‌بندی و لیست تیم‌ها</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('timeline')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-medium flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
              activeSubTab === 'timeline' || activeSubTab === 'calendar'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60 border border-slate-200/80 dark:border-slate-700/80'
            }`}
          >
            <Calendar size={16} />
            <span>تقویم و گانت سررسیدها</span>
          </button>
        </div>

        {/* Primary Action Button */}
        <button
          id="btn_create_task_top"
          type="button"
          onClick={() => {
            setSelectedStatusForNewTask('pending');
            setIsCreateModalOpen(true);
          }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-md shadow-blue-500/20 cursor-pointer transition-all hover:-translate-y-0.5 active:translate-y-0 shrink-0"
        >
          <Plus size={16} />
          <span>ثبت وظیفه جدید</span>
        </button>
      </div>

      {/* RENDER SUBVIEWS BASED ON ACTIVE SUBTAB */}
      {(activeSubTab === 'team_matrix' || activeSubTab === 'list_view') ? (
        <TeamTaskMatrixView />
      ) : (activeSubTab === 'timeline' || activeSubTab === 'calendar') ? (
        <TaskDeadlinesTimelineView />
      ) : (
        <>
          {/* FILTERS AND CONTROLS */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-xs flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4">
        
        {/* Search input with modern styling */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute start-3.5 top-3 text-slate-400 dark:text-zinc-500" size={15} />
          <input 
            type="text" 
            placeholder="جستجو در عنوان، توضیحات یا مسئول وظیفه..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 dark:bg-[#0d0d0f] border border-slate-200 dark:border-zinc-800 text-xs text-slate-800 dark:text-zinc-100 ps-10 pe-3.5 py-2.5 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-sans text-start"
          />
        </div>

        {/* Compact filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Project filter */}
          <div className="flex items-center gap-1.5 w-44">
            <span className="text-[10px] text-slate-400 dark:text-zinc-500 shrink-0">پروژه:</span>
            <CustomSelect 
              options={[
                { value: 'all', label: 'همه پروژه‌ها' },
                ...(projects ? projects.map(p => ({ value: p.id, label: p.title })) : [])
              ]}
              value={projectFilter}
              onChange={(val) => setProjectFilter(val)}
            />
          </div>

          {/* Department Filter */}
          <div className="flex items-center gap-1.5 w-44">
            <span className="text-[10px] text-slate-400 dark:text-zinc-500 shrink-0">دپارتمان:</span>
            <CustomSelect 
              options={deptFilterOptions}
              value={deptFilter}
              onChange={(val) => setDeptFilter(val)}
            />
          </div>

          {/* Priority filter */}
          <div className="flex items-center gap-1.5 w-40">
            <span className="text-[10px] text-slate-400 dark:text-zinc-500 shrink-0">اولویت:</span>
            <CustomSelect 
              options={priorityFilterOptions}
              value={priorityFilter}
              onChange={(val) => setPriorityFilter(val)}
            />
          </div>
        </div>

      </div>

      {/* KANBAN BOARD WRAPPER */}
      <div className="overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-zinc-800">
        <div className="grid grid-flow-col auto-cols-[minmax(15rem,1fr)] gap-4 pb-2">
          
          {columns.map(col => {
            const colTasks = filteredTasks.filter(t => t.status === col.id);
            const isDraggingOver = draggingOverCol === col.id;

            return (
              <div 
                key={col.id}
                onDragOver={(e) => handleDragOver(e, col.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, col.id)}
                className={`min-w-0 flex flex-col rounded-2xl border p-3.5 transition-all duration-200 ${col.colorClass} ${
                  isDraggingOver 
                    ? 'border-blue-500 bg-blue-500/10 dark:border-blue-500/30 ring-2 ring-blue-500/10' 
                    : 'border-slate-200/60 dark:border-slate-700/60 bg-slate-100/70 dark:bg-slate-800/50 shadow-xs'
                }`}
              >
                
                {/* Column Header Design */}
                <div className="flex items-center justify-between border-b border-slate-200/50 dark:border-slate-700/60 pb-3 mb-4">
                  <h3 className="font-extrabold text-[13px] text-slate-800 dark:text-slate-100">
                    {col.title}
                  </h3>

                  {/* Task counter */}
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${col.badgeClass}`}>
                    {colTasks.length.toLocaleString('fa-IR')} وظیفه
                  </span>
                </div>

                {/* Column Scrollable Content Area */}
                <div className="flex-1 overflow-y-auto space-y-3 min-h-[460px] max-h-[calc(100vh-320px)] ps-0.5 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
                  <AnimatePresence initial={false}>
                    {colTasks.length === 0 ? (
                      col.id === 'pending' ? (
                        // Clean Empty State Dropzone ONLY for First Column ("در انتظار")
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0 }}
                          className="flex flex-col items-center justify-center py-12 px-4 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl bg-white/70 dark:bg-slate-900/40 text-center space-y-3 mt-2"
                        >
                          <p className="text-[11px] text-slate-400 dark:text-slate-400 font-medium">
                            هیچ وظیفه‌ای در این وضعیت وجود ندارد
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedStatusForNewTask('pending');
                              setIsCreateModalOpen(true);
                            }}
                            className="px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer border border-slate-200 dark:border-slate-700"
                          >
                            <Plus size={13} />
                            <span>ثبت وظیفه</span>
                          </button>
                        </motion.div>
                      ) : (
                        // Clean empty state for subsequent columns (NO creation placeholder)
                        <div className="w-full py-16 flex flex-col items-center justify-center text-center opacity-40">
                          <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">وظیفه‌ای در این ستون نیست</span>
                        </div>
                      )
                    ) : (
                      // Solid White Task Cards List
                      colTasks.map(task => {
                        const projectTitle = projects.find(p => p.id === task.projectId)?.title || 'بدون پروژه';

                        return (
                          <motion.div
                            key={task.id}
                            layoutId={task.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, task.id)}
                            onClick={() => openEditModal(task)}
                            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-500/50 p-4 rounded-xl shadow-xs hover:shadow-md cursor-grab active:cursor-grabbing transition-all duration-200 space-y-3 group text-start"
                          >
                            {/* Card Top Badges Row */}
                            <div className="flex justify-between items-center gap-2">
                              {/* Department */}
                              <span className="text-[9px] font-bold bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 px-2 py-0.5 rounded font-mono">
                                {(task.department || 'عمومی').toUpperCase()}
                              </span>

                              {/* Priority badge */}
                              <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full ${getPriorityBadgeStyles(task.priority)}`}>
                                {getPriorityLabel(task.priority)}
                              </span>
                            </div>

                            {/* Task Title and Description */}
                            <div className="space-y-1">
                              <h4 className="text-[12px] font-bold text-slate-800 dark:text-zinc-100 line-clamp-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                {task.title}
                              </h4>
                              {task.description && (
                                <p className="text-[10px] text-slate-400 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                                  {task.description}
                                </p>
                              )}
                            </div>

                            {/* Project Reference Badge */}
                            <div className="flex items-center gap-1.5 text-[9px] text-slate-400 dark:text-zinc-500 bg-slate-50 dark:bg-[#0d0d0f]/50 p-1.5 rounded-lg border border-slate-100 dark:border-zinc-800/40">
                              <Folder size={11} className="text-slate-400" />
                              <span className="truncate">{projectTitle}</span>
                            </div>

                            {/* Tags list if available */}
                            {task.tags && task.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 pt-1">
                                {task.tags.map((t, i) => (
                                  <span key={i} className="text-[8.5px] bg-blue-50/50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded border border-blue-100/30 dark:border-blue-900/20">
                                    #{t}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* Card Footer: Assignee & Deadline */}
                            <div className="flex justify-between items-center border-t border-slate-100 dark:border-zinc-800/60 pt-2.5 mt-1.5">
                              {/* Assignee info */}
                              <div className="flex items-center gap-1.5">
                                <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-[9px] font-bold text-slate-600 dark:text-zinc-300 border border-slate-200/50 dark:border-zinc-700/50">
                                  {task.assignedTo ? task.assignedTo.charAt(0) : <User size={9} />}
                                </div>
                                <span className="text-[10px] font-semibold text-slate-600 dark:text-zinc-300">
                                  {task.assignedTo || 'بدون مسئول'}
                                </span>
                              </div>

                              {/* Deadline */}
                              <div className="flex items-center gap-1 text-[10px] text-rose-600 dark:text-rose-400 font-mono font-bold">
                                <Clock size={11} />
                                <span>{formatJalaliDate((task as any).deadlineCanonical || task.deadline) || task.deadline}</span>
                              </div>
                            </div>

                            {/* Step-by-Step Progress & Quick Actions Bar */}
                            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-zinc-800/60 mt-1">
                              {col.id !== 'completed' ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const nextStatusMap: Record<string, TaskStatus> = {
                                      pending: 'inprogress',
                                      inprogress: 'review',
                                      review: 'completed',
                                      completed: 'completed',
                                      blocked: 'inprogress'
                                    };
                                    updateTaskStatus(task.id, nextStatusMap[task.status] || 'completed');
                                  }}
                                  className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 hover:underline cursor-pointer flex items-center gap-1"
                                >
                                  <span>انتقال به مرحله بعد ←</span>
                                </button>
                              ) : (
                                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                  <CheckCircle2 size={12} />
                                  <span>تکمیل شده</span>
                                </span>
                              )}

                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openEditModal(task);
                                  }}
                                  className="p-1 text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 rounded hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all cursor-pointer"
                                  title="ویرایش وظیفه"
                                >
                                  <Edit3 size={12} />
                                </button>
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    if (confirm('آیا از حذف این وظیفه مطمئن هستید؟')) {
                                      await deleteTask(task.id);
                                    }
                                  }}
                                  className="p-1 text-rose-500 hover:text-rose-700 rounded hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all cursor-pointer"
                                  title="حذف وظیفه"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>

                          </motion.div>
                        );
                      })
                    )}
                  </AnimatePresence>
                </div>

              </div>
            );
          })}

        </div>
      </div>

      {/* EDIT TASK MODAL — AnimatePresence lives inside the portal: it drops
          non-element children, so wrapping the portal itself rendered nothing. */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {showModal && (
          <div key="task-edit-modal" className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
            <div 
              onClick={() => setShowModal(false)}
              className="fixed inset-0 z-0 bg-black/[0.05] dark:bg-black/[0.3] backdrop-blur-[0.5px] transition-opacity duration-200 animate-in fade-in cursor-pointer"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: 'spring', duration: 0.3 }}
              className="relative z-10 bg-white dark:bg-zinc-900 border border-slate-200/90 dark:border-zinc-800 w-full max-w-lg rounded-[28px] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.12),0_10px_25px_-10px_rgba(0,0,0,0.05)] dark:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.5)] p-6 md:p-8 space-y-6 cursor-default"
            >
              
              {/* Header */}
              <div className="flex justify-between items-center border-b border-slate-100 dark:border-zinc-800 pb-4">
                <div>
                  <h3 className="font-extrabold text-base text-slate-800 dark:text-zinc-100">
                    {modalMode === 'create' ? 'ثبت وظیفه جدید پروژه' : 'ویرایش و جزئیات وظیفه'}
                  </h3>
                  <p className="text-[11px] text-slate-400 dark:text-zinc-400 mt-1">
                    {modalMode === 'create' 
                      ? 'یک وظیفه یا مرحله اجرایی جدید به پروژه فعال اضافه کنید.' 
                      : 'مشخصات، وضعیت پیشرفت و تخصیص این وظیفه را ویرایش فرمایید.'}
                  </p>
                </div>
                <button 
                  onClick={() => setShowModal(false)}
                  className="text-slate-400 hover:text-slate-600 dark:text-zinc-400 dark:hover:text-zinc-200 bg-slate-100 dark:bg-zinc-800 p-2 rounded-xl transition-all cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleFormSubmit} className="space-y-4">
                
                {/* Title */}
                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-zinc-300 block mb-1">عنوان وظیفه *</label>
                  <input 
                    type="text"
                    required
                    placeholder="مثال: طراحی صفحه نخست پورتال"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 text-xs px-3 py-3 rounded-xl text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500 transition-all font-sans text-start"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-zinc-300 block mb-1">توضیحات و جزئیات</label>
                  <textarea 
                    rows={3}
                    placeholder="جزئیات این وظیفه یا فایل‌های راهنما را وارد کنید..."
                    value={formDesc}
                    onChange={(e) => setFormDesc(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 text-xs px-3 py-2.5 rounded-xl text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/15 focus:border-blue-500 transition-all font-sans text-start"
                  />
                </div>

                {/* Project & Department Row */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-zinc-300 block mb-1">پروژه مربوطه</label>
                    <CustomSelect
                      options={
                        projects && projects.length > 0 
                          ? projects.map(p => ({ value: p.id, label: p.title }))
                          : [{ value: 'no_project', label: 'بدون پروژه فعال' }]
                      }
                      value={formProjectId}
                      onChange={(val) => setFormProjectId(val)}
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-zinc-300 block mb-1">دپارتمان</label>
                    <CustomSelect
                      options={deptFormOptions}
                      value={formDept}
                      onChange={(val) => setFormDept(val as any)}
                    />
                  </div>
                </div>

                {/* Assignee & Priority Row */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-zinc-300 block mb-1">مسئول اجرا</label>
                    <CustomSelect
                      options={
                        teamMembers && teamMembers.length > 0
                          ? teamMembers.map(m => ({ value: (m as any).userId || m.id, label: `${m.name} — ${getRoleLabel(m.role)}` }))
                          : []
                      }
                      value={formAssignee}
                      onChange={(val) => setFormAssignee(val)}
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-zinc-300 block mb-1">اولویت</label>
                    <CustomSelect
                      options={priorityFormOptions}
                      value={formPriority}
                      onChange={(val) => setFormPriority(val as any)}
                    />
                  </div>
                </div>

                {/* Status & Start Date Row */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-zinc-300 block mb-1">وضعیت وظیفه</label>
                    <CustomSelect
                      options={statusFormOptions}
                      value={formStatus}
                      onChange={(val) => setFormStatus(val as any)}
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-zinc-300 block mb-1">تاریخ شروع</label>
                    <input 
                      type={/^\d{4}-\d{2}-\d{2}$/.test(formStartDate) || !formStartDate ? 'date' : 'text'}
                      value={formStartDate}
                      onChange={(e) => setFormStartDate(e.target.value)}
                      placeholder="۱۴۰۵/۰۳/۰۱"
                      className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 text-xs px-3 py-3 rounded-xl text-slate-800 dark:text-zinc-100 focus:outline-none focus:border-blue-500 font-mono text-center"
                    />
                  </div>
                </div>

                {/* Deadline & Tags Row */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-zinc-300 block mb-1">تاریخ پایان/مهلت</label>
                    <input 
                      type={/^\d{4}-\d{2}-\d{2}$/.test(formDeadline) || !formDeadline ? 'date' : 'text'}
                      value={formDeadline}
                      onChange={(e) => setFormDeadline(e.target.value)}
                      placeholder="۱۴۰۵/۰۳/۱۵"
                      className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 text-xs px-3 py-3 rounded-xl text-slate-800 dark:text-zinc-100 focus:outline-none focus:border-blue-500 font-mono text-center"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-zinc-300 block mb-1">برچسب‌ها (با ویرگول جدا کنید)</label>
                    <input 
                      type="text"
                      value={formTagsString}
                      onChange={(e) => setFormTagsString(e.target.value)}
                      placeholder="مثال: فرانت, بازخورد, هدر"
                      className="w-full bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-850 text-xs px-3 py-3 rounded-xl text-slate-800 dark:text-zinc-100 focus:outline-none focus:border-blue-500 text-start font-sans"
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-150 dark:border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-300 text-xs font-semibold rounded-xl transition-all cursor-pointer"
                  >
                    انصراف
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-500/20 transition-all cursor-pointer"
                  >
                    {modalMode === 'create' ? 'ثبت و ذخیره وظیفه' : 'بروزرسانی وظیفه'}
                  </button>
                </div>

              </form>

            </motion.div>
          </div>
          )}
        </AnimatePresence>,
        document.body
      )}
      </>
      )}

      {/* CREATE TASK MODAL: available from every sub-view (board, matrix, calendar) */}
      <CreateTaskModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        defaultStatus={selectedStatusForNewTask}
      />
    </div>
  );
};
