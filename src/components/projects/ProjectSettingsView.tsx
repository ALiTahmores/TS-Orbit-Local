import { ClientPortalView } from './ClientPortalView';
import { projectStatusUI } from '../../lib/domain';
import React, { useState, useMemo, useEffect } from 'react';
import { Project, StatusLog, ClientFeedback } from '../../types';
import { useProject } from '../../context/ProjectContext';
import { CustomSelect, CustomSelectOption } from '../common/CustomSelect';
import { JalaliDateInput } from '../common/JalaliDateInput';
import { formatJalaliDate, formatJalaliDateTime } from '../../lib/dates';
import { calendarDay, deadlineEditPatch } from '../../lib/formValues';
import { PublicClientPortal } from '../PublicClientPortal';
import { 
  ArrowRight, 
  Save, 
  CheckCircle2, 
  Building2, 
  User, 
  Users,
  Calendar, 
  Clock, 
  DollarSign, 
  Lock, 
  Globe, 
  Copy, 
  Check, 
  RefreshCw, 
  Shield, 
  FileText, 
  AlertTriangle,
  Sliders,
  CheckCircle,
  Eye,
  History,
  BarChart3,
  ListTodo,
  ExternalLink,
  ArrowLeft,
  Sparkles,
  MessageSquare,
  Activity,
  Layers,
  Trash2
} from 'lucide-react';

const toPersianDigits = (n: string | number): string => {
  if (n === null || n === undefined) return '';
  const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(n).replace(/[0-9]/g, (x) => farsiDigits[parseInt(x, 10)]);
};


interface ProjectSettingsViewProps {
  project: Project;
  onBack: () => void;
  initialTab?: 'all' | 'general' | 'stats' | 'audit' | 'portal';
}

export const ProjectSettingsView: React.FC<ProjectSettingsViewProps> = ({
  project,
  onBack,
  initialTab = 'all'
}) => {
  const { 
    updateProject, 
    teamMembers,
    teams, 
    tasks, 
    toggleClientPortal, 
    regenerateClientToken, 
    updateFeedbackStatus, 
    deleteFeedback,
    getRoleLabel
  } = useProject();

  const teamOptions: CustomSelectOption[] = useMemo(() => {
    if (teamMembers && teamMembers.length > 0) {
      return teamMembers.map(m => ({ value: m.id || m.name, label: `${m.name} — ${getRoleLabel(m.role)}` }));
    }
    return [];
  }, [teamMembers, getRoleLabel]);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'all' | 'general' | 'stats' | 'audit' | 'portal'>(initialTab);

  // Feedback Management State
  const [feedbackFilter, setFeedbackFilter] = useState<'all' | 'pending' | 'resolved'>('all');
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

  // Calculate initial team lead ID
  const initialLeadId = useMemo(() => {
    if (project.teamLeadId) return project.teamLeadId;
    if (project.teamLead) {
      const match = teamMembers?.find(m => m.name === project.teamLead || `${m.name} (${m.role})` === project.teamLead || `${m.name} — ${getRoleLabel(m.role)}` === project.teamLead);
      if (match) return match.id;
      return ''; 
    }
    return teamMembers && teamMembers[0] ? teamMembers[0].id : '';
  }, [project.teamLeadId, project.teamLead, teamMembers]);

  // Local Form State
  const [title, setTitle] = useState(project.title || '');
  const [websiteUrl, setWebsiteUrl] = useState(project.websiteUrl || '');
  const [description, setDescription] = useState(project.description || '');
  const [clientName, setClientName] = useState(project.clientName || '');
  const [teamLead, setTeamLead] = useState(initialLeadId);
  const [assignedMemberIds, setAssignedMemberIds] = useState<string[]>(
    project.assignedMemberIds || (project.teamLeadId ? [project.teamLeadId] : [])
  );
  const [assignedTeamIds, setAssignedTeamIds] = useState<string[]>(
    project.assignedTeamIds || []
  );
  const [status, setStatus] = useState<string>(({ACTIVE:'active',IN_PROGRESS:'in_progress',DRAFT:'pending',COMPLETED:'completed',CANCELLED:'canceled',ARCHIVED:'archived'}[project.status] || project.status || 'active'));
  const [startDate, setStartDate] = useState(project.startDate || '');
  const [deadline, setDeadline] = useState(calendarDay((project as any).deadlineCanonical || project.deadline) || '');
  const [deadlineChanged, setDeadlineChanged] = useState(false);
  useEffect(() => {
    setDeadline(calendarDay((project as any).deadlineCanonical || project.deadline) || '');
    setDeadlineChanged(false);
  }, [project.id]);
  const [budget, setBudget] = useState(project.budget || '');
  const [isBudgetConfidential, setIsBudgetConfidential] = useState<boolean>(
    project.isBudgetConfidential !== undefined ? project.isBudgetConfidential : true
  );
  // UI Feedback State
  const [isSaving, setIsSaving] = useState(false);
  const [saveError,setSaveError] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Task & Progress Stats
  const projectTasks = useMemo(() => {
    return tasks ? tasks.filter(t => t.projectId === project.id) : [];
  }, [tasks, project.id]);

  const totalTasksCount = projectTasks.length > 0 ? projectTasks.length : (project.totalTasks || 0);
  const completedTasksCount = projectTasks.length > 0 
    ? projectTasks.filter(t => t.status === 'completed').length 
    : (project.completedTasks || 0);
  const pendingTasksCount = Math.max(0, totalTasksCount - completedTasksCount);
  const progressPct = totalTasksCount > 0 
    ? Math.min(100, Math.round((completedTasksCount / totalTasksCount) * 100)) 
    : (project.progress || 0);

  // Feedback calculations
  const allFeedbacks: ClientFeedback[] = project.clientFeedbacks || [];
  const pendingFeedbacks = useMemo(() => allFeedbacks.filter(f => f.status === 'pending'), [allFeedbacks]);
  const resolvedFeedbacks = useMemo(() => allFeedbacks.filter(f => f.status === 'resolved'), [allFeedbacks]);

  const filteredFeedbacks = useMemo(() => {
    return allFeedbacks.filter(fb => {
      if (feedbackFilter === 'all') return true;
      if (feedbackFilter === 'pending') return fb.status === 'pending';
      if (feedbackFilter === 'resolved') return fb.status === 'resolved';
      return true;
    });
  }, [allFeedbacks, feedbackFilter]);

  const toggleMemberAssignment = (mId: string) => {
    setAssignedMemberIds(prev => 
      prev.includes(mId) ? prev.filter(id => id !== mId) : [...prev, mId]
    );
  };

  const toggleTeamAssignment = (tId: string) => {
    setAssignedTeamIds(prev => 
      prev.includes(tId) ? prev.filter(id => id !== tId) : [...prev, tId]
    );
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);setSavedSuccess(false);setSaveError('');
    try {
      const matchedMember = teamMembers?.find(m => m.id === teamLead || m.name === teamLead);
      const teamLeadName = matchedMember ? `${matchedMember.name} — ${getRoleLabel(matchedMember.role)}` : teamLead;
      const teamLeadId = matchedMember ? matchedMember.id : teamLead;

      const finalMembers = Array.from(new Set([
        ...assignedMemberIds,
        teamLeadId,
      ].filter(Boolean)));

      await updateProject(project.id, {
        title,
        websiteUrl,
        description,
        clientName,
        teamLead: teamLeadName,
        teamLeadId,
        assignedMemberIds: finalMembers,
        assignedTeamIds,
        status: status as any,
        startDate,
        ...deadlineEditPatch(deadline, deadlineChanged),
        budget,
        isBudgetConfidential,

      });

      setSavedSuccess(true);
      setDeadlineChanged(false);
      setTimeout(() => {
        setSavedSuccess(false);
      }, 3000);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'ذخیره انجام نشد.');
    } finally {
      setIsSaving(false);
    }
  };

  // Helper Status Transition Badges
  const renderStatusBadge = (st: string) => {
    switch (projectStatusUI(st)) {
      case 'connected_to_wordpress':
      case 'active':
      case 'in_progress':
        return (
          <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5 whitespace-nowrap w-fit">
            <CheckCircle2 size={13} />
            <span>فعال</span>
          </span>
        );
      case 'suspended':
      case 'on_hold':
      case 'pending':
        return (
          <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1.5 whitespace-nowrap w-fit">
            <AlertTriangle size={13} />
            <span>در انتظار / تعلیق</span>
          </span>
        );
      case 'canceled':
      case 'terminated':
        return (
          <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center gap-1.5 whitespace-nowrap w-fit">
            <AlertTriangle size={13} />
            <span>لغو شده</span>
          </span>
        );
      case 'archived':
      case 'completed':
        return (
          <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20 flex items-center gap-1.5 whitespace-nowrap w-fit">
            <CheckCircle size={13} />
            <span>تکمیل شده / آرشیو</span>
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20 whitespace-nowrap w-fit">
            {st}
          </span>
        );
    }
  };

  const statusHistory = project.statusHistory || [];

  return (
    <div className="space-y-6 dir-rtl text-right font-sans pb-12" dir="rtl" style={{ fontFeatureSettings: '"ss01" 1' }}>
      
      {saveError && <p role="alert" className="p-3 text-red-600">{saveError}</p>}
      {/* HEADER ACTION BAR */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-2xl transition-all cursor-pointer shrink-0"
            title="← بازگشت به مدیریت پروژه‌ها"
          >
            <ArrowRight size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <Sliders size={18} className="text-blue-600 dark:text-blue-400 shrink-0" />
              <h1 className="text-base sm:text-lg font-black text-slate-800 dark:text-slate-100">
                تنظیمات پروژه: <span className="text-blue-600 dark:text-blue-400">{title || project.title}</span>
              </h1>
              {clientName && (
                <span className="px-2.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs rounded-lg border border-slate-200 dark:border-slate-700">
                  کارفرما: {clientName}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
              ویرایش کامل مشخصات عمومی، بررسی آمار پیشرفت و سوابق علت تغییرات وضعیت
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-2xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5"
          >
            <span>← بازگشت به مدیریت پروژه‌ها</span>
          </button>

          <button
            type="button"
            onClick={() => handleSave()}
            disabled={isSaving}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-black shadow-md shadow-blue-600/20 transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
          >
            <Save size={15} />
            <span>{isSaving ? 'در حال ذخیره...' : 'ذخیره تغییرات'}</span>
          </button>
        </div>
      </div>

      {/* SUCCESS NOTIFICATION TOAST */}
      {savedSuccess && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-200 rounded-2xl p-4 flex items-center gap-3 animate-in fade-in zoom-in-95 duration-200">
          <CheckCircle2 size={20} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="text-xs font-bold">تغییرات پروژه با موفقیت در دیتابیس سیستم ثبت شد.</span>
        </div>
      )}

      {/* QUICK NAVIGATION TABS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-2xl text-xs font-bold">
        <button
          type="button"
          onClick={() => setActiveTab('all')}
          className={`px-3 py-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 text-center ${
            activeTab === 'all' 
              ? 'bg-blue-600 text-white shadow-md font-extrabold' 
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Layers size={14} className="shrink-0" />
          <span className="truncate">نمایش یکپارچه</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('general')}
          className={`px-3 py-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 text-center ${
            activeTab === 'general' 
              ? 'bg-blue-600 text-white shadow-md font-extrabold' 
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <FileText size={14} className="shrink-0" />
          <span className="truncate">اطلاعات پایه</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('stats')}
          className={`px-3 py-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 text-center ${
            activeTab === 'stats' 
              ? 'bg-blue-600 text-white shadow-md font-extrabold' 
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <BarChart3 size={14} className="shrink-0" />
          <span className="truncate">آمار پیشرفت</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('audit')}
          className={`px-3 py-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 text-center ${
            activeTab === 'audit' 
              ? 'bg-blue-600 text-white shadow-md font-extrabold' 
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <History size={14} className="shrink-0" />
          <span className="truncate">تاریخچه تغییرات ({toPersianDigits(statusHistory.length)})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('portal')}
          className={`px-3 py-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 text-center col-span-2 sm:col-span-1 ${
            activeTab === 'portal' 
              ? 'bg-blue-600 text-white shadow-md font-extrabold' 
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Globe size={14} className="shrink-0" />
          <span className="truncate">پورتال کارفرما</span>
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-6">

        {/* SECTION 1: اطلاعات پایه و ویرایش */}
        {(activeTab === 'all' || activeTab === 'general') && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-2xs space-y-5">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-blue-600 dark:text-blue-400" />
                <h2 className="text-sm font-black text-slate-800 dark:text-slate-100">
                  ۱. اطلاعات پایه و ویرایش (General Information)
                </h2>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">مشخصات عمومی، آدرس سایت، کارفرما و بودجه</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              
              {/* Title */}
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <span>عنوان پروژه / نام‌تجاری</span>
                  <span className="text-rose-500 font-black">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all"
                  placeholder="عنوان پروژه را وارد کنید..."
                />
              </div>

              {/* Website URL */}
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Globe size={14} className="text-blue-500" />
                  <span>آدرس وبسایت / دامنه پروژه</span>
                </label>
                <input
                  type="url"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  dir="ltr"
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-800 dark:text-slate-100 font-mono text-left focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all placeholder:text-slate-400"
                  placeholder="https://example.com"
                />
              </div>

              {/* Client Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Building2 size={14} className="text-slate-400" />
                  <span>نام کارفرما / آژانس طرف قرارداد</span>
                </label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all"
                  placeholder="نام شرکت یا کارفرما..."
                />
              </div>

              {/* Team Lead */}
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <User size={14} className="text-slate-400" />
                  <span>مدیر / راهبر ارشد پروژه</span>
                </label>
                <CustomSelect
                  options={teamOptions}
                  value={teamLead}
                  onChange={(val) => setTeamLead(val)}
                  placeholder="انتخاب راهبر پروژه..."
                />
              </div>

              {/* ACCESS CONTROL & ASSIGNMENTS SECTION */}
              <div className="md:col-span-2 p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80 rounded-2xl space-y-3">
                <div className="flex items-center gap-2 text-xs font-black text-slate-800 dark:text-slate-100 border-b border-slate-200 dark:border-slate-700/80 pb-2">
                  <Shield size={16} className="text-blue-500" />
                  <span>سطوح دسترسی و تخصیص پروژه</span>
                </div>

                {/* ASSIGNED MEMBERS */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Users size={13} className="text-slate-400" />
                    <span>اعضای تخصیص‌یافته به پروژه (دسترس‌پذیر برای اعضا)</span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-36 overflow-y-auto p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                    {(teamMembers || []).map(m => {
                      const mId = m.id || m.name;
                      const isAssigned = assignedMemberIds.includes(mId);
                      return (
                        <button
                          type="button"
                          key={mId}
                          onClick={() => toggleMemberAssignment(mId)}
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all flex items-center justify-between gap-1 cursor-pointer ${
                            isAssigned
                              ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-700 dark:text-blue-300'
                              : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/80'
                          }`}
                        >
                          <span className="truncate">{m.name}</span>
                          {isAssigned && <Check size={12} className="text-blue-600 dark:text-blue-400 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* ASSIGNED TEAMS */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Shield size={13} className="text-slate-400" />
                    <span>تیم‌های تخصیص‌یافته به پروژه</span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-32 overflow-y-auto p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
                    {teams.map(team => {
                      const isAssigned = assignedTeamIds.includes(team.id);
                      return (
                        <button
                          type="button"
                          key={team.id}
                          onClick={() => toggleTeamAssignment(team.id)}
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all flex items-center justify-between gap-1 cursor-pointer ${
                            isAssigned
                              ? 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-500 text-emerald-700 dark:text-emerald-300'
                              : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/80'
                          }`}
                        >
                          <span className="truncate">{team.name}</span>
                          {isAssigned && <Check size={12} className="text-emerald-600 dark:text-emerald-400 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Deadline */}
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Clock size={14} className="text-slate-400" />
                  <span>سررسید پروژه</span>
                </label>
                <JalaliDateInput value={deadline} onChange={value => { setDeadline(value); setDeadlineChanged(true); }} ariaLabel="سررسید پروژه" placeholder="بدون سررسید" className="[&>button]:h-11 [&>button]:rounded-2xl" />
              </div>

              {/* Budget */}
              <div className="space-y-1.5">
                <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <DollarSign size={14} className="text-slate-400" />
                  <span>مبلغ بودجه قرارداد</span>
                </label>
                <input
                  type="text"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all"
                  placeholder="مثلاً: ۱۵۰,۰۰۰,۰۰۰ تومان"
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300">
                  توضیحات و شرح خلاصه پروژه
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all resize-none"
                  placeholder="توضیحات و اهداف کلی پروژه..."
                />
              </div>
            </div>

            {/* Confidential Budget Toggle */}
            <div className="pt-2">
              <div className="p-4 bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700 rounded-2xl flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${isBudgetConfidential ? 'bg-amber-500/10 text-amber-600' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
                    {isBudgetConfidential ? <Lock size={18} /> : <Eye size={18} />}
                  </div>
                  <div>
                    <h3 className="text-xs font-extrabold text-slate-800 dark:text-slate-100">
                      بودجه محرمانه پروژه (Confidential Budget)
                    </h3>
                    <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                      در صورت فعال بودن، مبلغ قرارداد فقط به مدیران ارشد نمایش داده می‌شود.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsBudgetConfidential(!isBudgetConfidential)}
                  className={`w-12 h-6 rounded-full transition-colors relative p-0.5 shrink-0 cursor-pointer ${
                    isBudgetConfidential ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'
                  }`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full transition-transform shadow-xs ${
                    isBudgetConfidential ? 'translate-x-0' : '-translate-x-6'
                  }`} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* SECTION 2: آمار پیشرفت و وضعیت اجرایی */}
        {(activeTab === 'all' || activeTab === 'stats') && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-2xs space-y-5">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 size={18} className="text-emerald-600 dark:text-emerald-400" />
                <h2 className="text-sm font-black text-slate-800 dark:text-slate-100">
                  ۲. آمار پیشرفت و وضعیت اجرایی (Progress & Task Stats)
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400 font-medium">وضعیت فعلی:</span>
                {renderStatusBadge(status)}
              </div>
            </div>

            {/* PROGRESS WIDGET & METRICS GRID */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              
              {/* PROGRESS BAR WIDGET */}
              <div className="md:col-span-4 bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl p-4 space-y-2">
                <div className="flex justify-between items-center text-xs font-black">
                  <span className="text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <Activity size={15} className="text-blue-600" />
                    <span>میزان پیشرفت کلی پروژه</span>
                  </span>
                  <span className="font-mono text-blue-600 dark:text-blue-400 text-sm">
                    {toPersianDigits(progressPct)}٪
                  </span>
                </div>
                
                <div className="w-full h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden p-0.5">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-600 to-indigo-500 rounded-full transition-all duration-500 shadow-sm"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>

                <div className="flex justify-between items-center text-[11px] text-slate-400 font-medium pt-1">
                  <span>شروع: {formatJalaliDate(startDate) || '—'}</span>
                  <span>{toPersianDigits(completedTasksCount)} از {toPersianDigits(totalTasksCount)} وظیفه تکمیل شده</span>
                  <span>سررسید: {formatJalaliDate(deadline) || '—'}</span>
                </div>
              </div>

              {/* METRIC CARD 1: TOTAL TASKS */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 rounded-2xl flex items-center gap-3">
                <div className="p-3 bg-blue-500/10 text-blue-600 rounded-xl shrink-0">
                  <ListTodo size={20} />
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 font-bold block">کل وظایف تعریف‌شده</span>
                  <span className="text-base font-black text-slate-800 dark:text-slate-100 font-mono">
                    {toPersianDigits(totalTasksCount)} تسک
                  </span>
                </div>
              </div>

              {/* METRIC CARD 2: COMPLETED TASKS */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 rounded-2xl flex items-center gap-3">
                <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-xl shrink-0">
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 font-bold block">وظایف تکمیل‌شده</span>
                  <span className="text-base font-black text-emerald-600 dark:text-emerald-400 font-mono">
                    {toPersianDigits(completedTasksCount)} تسک
                  </span>
                </div>
              </div>

              {/* METRIC CARD 3: PENDING TASKS */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 rounded-2xl flex items-center gap-3">
                <div className="p-3 bg-amber-500/10 text-amber-600 rounded-xl shrink-0">
                  <Clock size={20} />
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 font-bold block">وظایف در جریان</span>
                  <span className="text-base font-black text-amber-600 dark:text-amber-400 font-mono">
                    {toPersianDigits(pendingTasksCount)} تسک
                  </span>
                </div>
              </div>

              {/* METRIC CARD 4: DAYS REMAINING */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 rounded-2xl flex items-center gap-3">
                <div className="p-3 bg-purple-500/10 text-purple-600 rounded-xl shrink-0">
                  <Calendar size={20} />
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 font-bold block">مهلت تحویل پروژه</span>
                  <span className="text-xs font-black text-slate-800 dark:text-slate-100">
                    {formatJalaliDate(deadline) || 'تعیین نشده'}
                  </span>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* SECTION 3: تاریخچه و علت تغییرات وضعیت (STATUS AUDIT TRAIL) */}
        {(activeTab === 'all' || activeTab === 'audit') && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-6 shadow-2xs space-y-5">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History size={18} className="text-blue-600 dark:text-blue-400" />
                <h2 className="text-sm font-black text-slate-800 dark:text-slate-100">
                  ۳. تاریخچه و علت تغییرات وضعیت (Status Audit Trail)
                </h2>
              </div>
              <span className="text-[11px] text-slate-400 font-medium">
                تعداد سوابق ثبت شده: <strong className="font-mono text-blue-600">{toPersianDigits(statusHistory.length)}</strong> مورد
              </span>
            </div>

            {statusHistory.length > 0 ? (
              <div className="space-y-4 pt-2">
                {statusHistory.slice().reverse().map((log: StatusLog, idx: number) => (
                  <div key={idx} className="relative pr-6 border-r-2 border-blue-500/30 dark:border-blue-500/20 pb-4 last:pb-0">
                    <div className="absolute -right-[9px] top-1 w-4 h-4 rounded-full bg-blue-600 border-2 border-white dark:border-slate-900 shadow-xs" />
                    
                    <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl p-4 space-y-3">
                      
                      {/* Top Header Row */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/60 dark:border-slate-700/60 pb-2.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-black text-slate-700 dark:text-slate-200">تغییر وضعیت:</span>
                          {renderStatusBadge(log.previousStatus)}
                          <ArrowLeft size={14} className="text-slate-400 shrink-0" />
                          {renderStatusBadge(log.newStatus)}
                        </div>

                        <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 font-bold flex items-center gap-1">
                          <Clock size={12} className="text-blue-500" />
                          <span>{formatJalaliDateTime(log.timestamp)}</span>
                          {log.username && <span className="mr-2 text-slate-400" dir="ltr">@{log.username}</span>}
                        </div>
                      </div>

                      {/* Reason Quote Box */}
                      <div>
                        <span className="text-[11px] font-black text-slate-500 dark:text-slate-400 block mb-1.5 flex items-center gap-1">
                          <MessageSquare size={12} className="text-blue-500" />
                          <span>علت ثبت‌شده توسط راهبر:</span>
                        </span>
                        <div className="bg-white dark:bg-slate-800 p-3 rounded-xl text-slate-700 dark:text-slate-200 text-xs font-medium leading-relaxed border-r-4 border-blue-600 shadow-2xs">
                          {log.reason || 'بدون توضیحات ثبت شده.'}
                        </div>
                      </div>

                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* ZERO-STATE FALLBACK FOR AUDIT TRAIL */
              <div className="bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-8 text-center space-y-2">
                <History size={32} className="mx-auto text-slate-400 stroke-[1.5]" />
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  هنوز هیچ تغییر وضعیتی برای این پروژه ثبت نشده است.
                </p>
                <p className="text-[11px] text-slate-400 font-medium max-w-sm mx-auto">
                  با هر بار تغییر وضعیت پروژه از جدول مدیریت، علت وارد شده به همراه زمان دقیق در این بخش آرشیو خواهد شد.
                </p>
              </div>
            )}
          </div>
        )}

        {/* SECTION 4: پورتال کارفرما و مرکز بازخوردهای دریافتی */}
        {/* BOTTOM SAVE ACTIONS */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onBack}
            className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-2xl text-xs font-extrabold transition-all cursor-pointer"
          >
            ← انصراف و بازگشت
          </button>

          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-black shadow-md shadow-blue-600/20 transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
          >
            <Save size={15} />
            <span>{isSaving ? 'در حال ذخیره...' : 'ذخیره تمام تغییرات'}</span>
          </button>
        </div>

      </form>
      {(activeTab==='all'||activeTab==='portal')&&<ClientPortalView projectOverride={project}/>}

    </div>
  );
};

export default ProjectSettingsView;

