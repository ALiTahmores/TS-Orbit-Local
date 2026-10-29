import { JalaliDateInput } from '../common/JalaliDateInput';
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, FolderPlus, Sparkles, ChevronDown, Check, Lock, Unlock,
  Globe, Building2, User2, Calendar, Shield, Users, FileText, Plus, Edit3, ListChecks
} from 'lucide-react';
import { useProjectContext } from '../../context/ProjectContext';
import { cn } from '../../lib/utils';
import { roadmapStepCount, teamRoadmap } from '../../lib/teamRoadmaps';
import { TeamAvatar } from '../team/TeamAvatar';
import { Project } from '../../types';
import { calendarDay, deadlineEditPatch, projectLeadSelection } from '../../lib/formValues';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectToEdit?: Project | null;
}

// Helper to convert Persian/Arabic digits to English standard digits
const toEnglishDigits = (str: string): string => {
  return str
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632));
};

// Helper to convert English digits to Persian digits
const toPersianDigits = (n: string | number): string => {
  if (n === null || n === undefined) return '';
  const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(n).replace(/[0-9]/g, (x) => farsiDigits[parseInt(x, 10)]);
};


export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({ 
  isOpen, 
  onClose,
  projectToEdit
}) => {
  const { currentUser, teamMembers, teams, addProject, updateProject, activeWorkspaceId, locale, getRoleLabel } = useProjectContext();
  const isRtl = locale !== 'en';
  // Display and selection both use this exact text for a lead option.
  const leadLabel = (name: string, role?: string) => `${name} — ${getRoleLabel(role || 'MEMBER')}`;
  const currentUserName = currentUser?.name || '';

  // Basic Form States
  const [title, setTitle] = useState('');
  const [website, setWebsite] = useState('');
  const [clientName, setClientName] = useState('');
  const [description, setDescription] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 1. Team Lead Selection State
  const defaultLeadName = useMemo(() => currentUserName ? leadLabel(currentUserName, currentUser?.role) : '', [currentUserName, currentUser?.role, locale]);

  const [selectedLead, setSelectedLead] = useState(defaultLeadName);
  const [selectedLeadId, setSelectedLeadId] = useState(currentUser?.id || '');
  const [isLeadDropdownOpen, setIsLeadDropdownOpen] = useState(false);
  const [customLeadInput, setCustomLeadInput] = useState('');
  const [isCustomLeadMode, setIsCustomLeadMode] = useState(false);

  // 2. Budget & Confidential State - Initial empty string
  const [rawBudget, setRawBudget] = useState('');
  const [isConfidential, setIsConfidential] = useState(false);

  // 3. Deadline (ISO date, or '' for none)
  const [deadline, setDeadline] = useState('');
  const [deadlineChanged, setDeadlineChanged] = useState(false);

  // 4. Access Control Selection
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);

  const leadRef = useRef<HTMLDivElement>(null);

  // Format numbers to Persian Comma Separated (e.g. ۸۵,۰۰۰,۰۰۰)
  const formatCurrency = (val: string) => {
    if (!val) return '';
    const cleanDigits = toEnglishDigits(val).replace(/[^0-9]/g, '');
    if (!cleanDigits) return '';
    return Number(cleanDigits).toLocaleString('fa-IR');
  };

  const handleBudgetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const cleanDigits = toEnglishDigits(rawVal).replace(/[^0-9]/g, '');
    setRawBudget(cleanDigits);
  };

  // Reset or Populate form on open/edit
  useEffect(() => {
    if (isOpen) {
      setSubmitError('');
      const existing=(projectToEdit as any)?.deadlineCanonical || projectToEdit?.deadline || projectToEdit?.dueDate || '';
      setDeadline(calendarDay(existing) || '');
      setDeadlineChanged(false);
      if (projectToEdit) {
        setTitle(projectToEdit.title || projectToEdit.name || '');
        setWebsite(projectToEdit.websiteUrl || '');
        setClientName(projectToEdit.clientName || '');
        const lead = projectLeadSelection(projectToEdit, teamMembers, leadLabel);
        setSelectedLead(lead.label);
        setSelectedLeadId(lead.id);
        const numericBudget = toEnglishDigits(projectToEdit.budget || '').replace(/[^0-9]/g, '');
        setRawBudget(numericBudget);
        setIsConfidential(!!(projectToEdit.isBudgetConfidential || projectToEdit.isConfidential));
        setSelectedTeams(projectToEdit.assignedTeamIds || []);
        setDescription(projectToEdit.description || '');
      } else {
        setTitle('');
        setWebsite('');
        setClientName('');
        setSelectedLead(defaultLeadName);
        setSelectedLeadId(currentUser?.id || '');
        setRawBudget('');
        setIsConfidential(false);
        setSelectedTeams([]);
        setDescription('');
      }
      setIsCustomLeadMode(false);
      setCustomLeadInput('');
      setIsLeadDropdownOpen(false);
    }
  }, [isOpen, projectToEdit?.id]);

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (leadRef.current && !leadRef.current.contains(e.target as Node)) {
        setIsLeadDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isOpen || typeof document === 'undefined') return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || isSubmitting) return;
    setSubmitError('');
    setIsSubmitting(true);
    try {
    if (!currentUser?.id || !activeWorkspaceId) throw new Error('برای ذخیرهٔ پروژه، وارد فضای کاری معتبر شوید.');
    // Labels describe disciplines; only real team IDs are membership links.
    const assignedTeamIds = teams.filter(team => selectedTeams.includes(team.id) || selectedTeams.includes(team.name)).map(team => team.id);
    const leadId = selectedLeadId;

    const savedDate = deadline;
    const formattedBudgetStr = rawBudget ? `${formatCurrency(rawBudget)} تومان` : '';
    const effectiveUserId = currentUser?.id || '';
    const effectiveUserName = currentUser?.name || '';
    const effectiveUserAvatar = currentUser?.avatar || '';
    const effectiveUserRole = currentUser?.role || 'OWNER';

    if (projectToEdit && updateProject) {
      await updateProject(projectToEdit.id, {
        name: title.trim(),
        title: title.trim(),
        websiteUrl: website.trim(),
        clientName: clientName.trim(),
        teamLead: selectedLead,
        teamLeadId: leadId,
        budget: formattedBudgetStr,
        ...deadlineEditPatch(savedDate, deadlineChanged),
        isConfidential,
        isBudgetConfidential: isConfidential,
        selectedTeams,
        assignedTeamIds,
        department: '',
        description: description.trim()
      });
    } else {
      const newProjectId = `prj_${Date.now()}`;
      const newProject: Project = {
        id: newProjectId,
        workspaceId: activeWorkspaceId || 'ws_master_default',
        name: title.trim(),
        title: title.trim(),
        websiteUrl: website.trim(),
        clientName: clientName.trim(),
        teamLead: selectedLead,
        leadId,
        teamLeadId: leadId,
        creatorId: effectiveUserId,
        createdById: effectiveUserId,
        budget: formattedBudgetStr,
        isConfidential,
        isBudgetConfidential: isConfidential,
        dueDate: savedDate,
        deadline: savedDate,
        startDate: new Date().toISOString().slice(0,10),
        priority: 'medium',
        status: 'ACTIVE',
        progress: 0,
        totalTasks: 0,
        completedTasks: 0,
        selectedTeams,
        assignedTeamIds,
        department: '',
        category: '',
        description: description.trim(),
        createdAt: new Date().toISOString(),
        assignedMemberIds: [effectiveUserId],
        assignedMembers: [
          {
            id: effectiveUserId,
            name: effectiveUserName,
            avatar: effectiveUserAvatar,
            role: effectiveUserRole
          }
        ],
        clientPortalEnabled: false,
        isPortalActive: false,
        portalToken: `prj_token_${newProjectId}`,
        clientPortalToken: `prj_token_${newProjectId}`
      };

      if (addProject) {
        await addProject(newProject);
      }
    }

    onClose();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'پروژه ذخیره نشد؛ دوباره تلاش کنید.');
    } finally { setIsSubmitting(false); }
  };

  // Candidate leads list
  const candidateLeads = teamMembers && teamMembers.length > 0 
    ? teamMembers.filter(m => m.role === 'OWNER' || m.role === 'ADMIN' || m.role === 'PROJECT_MANAGER' || m.role === 'MEMBER')
    : currentUser?.id ? [{id:currentUser.id,name:currentUser.name,role:currentUser.workspaceRole || 'MEMBER'}] : [];

  return createPortal(
    <div className={`fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-6 overflow-y-auto font-sans ${isRtl ? 'dir-rtl' : 'dir-ltr'}`} dir={isRtl ? 'rtl' : 'ltr'}>
      {/* 1. Translucent Backdrop */}
      <div 
        onClick={onClose}
        className="fixed inset-0 z-0 bg-black/[0.08] dark:bg-black/[0.35] backdrop-blur-[1.5px] transition-opacity animate-in fade-in cursor-pointer"
      />

      {/* 2. Elevated Modal Container */}
      <div 
        onClick={(e) => e.stopPropagation()}
        className={`relative z-10 w-full max-w-xl max-h-[92vh] flex flex-col bg-white dark:bg-[#0d121f] rounded-[28px] border border-slate-200/90 dark:border-slate-800 shadow-[0_25px_70px_-15px_rgba(0,0,0,0.18)] animate-in fade-in zoom-in-95 duration-150 overflow-hidden ${isRtl ? 'text-start' : 'text-left'}`}
      >
        
        {/* Modal Header: In RTL layout, Right Edge has Blue Folder Icon + Title & Subtitle, Left Edge has Circular Close Button */}
        <div className="flex items-center justify-between p-5 px-6 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-white dark:bg-[#0d121f] flex-row">
          {/* Right Edge (First in RTL flow): Folder Icon + Title & Subtitle */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/20 shrink-0">
              {projectToEdit ? <Edit3 className="w-5 h-5"/> : <FolderPlus className="w-5 h-5"/>}
            </div>
            <div className={isRtl ? 'text-start' : 'text-left'}>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                {projectToEdit ? (isRtl ? 'ویرایش مشخصات پروژه' : 'Edit Project') : (isRtl ? 'ثبت پروژه جدید' : 'ثبت پروژه جدید')}
              </h3>
              <p className="text-[11px] text-slate-400">
                {isRtl ? 'تکمیل مشخصات پایه، تیم لید مسئول و زمانبندی تحویل قرارداد' : 'Complete basic specs, team lead, and delivery schedule'}
              </p>
            </div>
          </div>

          {/* Left Edge (End in RTL flow): Circular Close Button */}
          <button 
            type="button" 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center justify-center transition-colors cursor-pointer shrink-0"
            aria-label="بستن پنجره"
          >
            <X className="w-4 h-4"/>
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form id="create-project-form" onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
          
          {/* Field 1: Project Title */}
          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
              عنوان پروژه / نام تجاری <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: طراحی وبسایت فروشگاهی وابینو"
              className="w-full h-10 px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500 transition-colors font-medium"
            />
          </div>

          {/* Field 2: Website Address */}
          <div>
            <label className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300 mb-1">
              <Globe className="w-3.5 h-3.5 text-blue-500"/>
              <span>آدرس وبسایت / دامنه پروژه (اختیاری)</span>
            </label>
            <input
              type="text"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://example.com"
              className="w-full h-10 px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500 text-left font-mono text-xs transition-colors"
              dir="ltr"
            />
          </div>

          {/* Row 3: Client & Team Lead (2 Columns Grid) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Right Column (in RTL): Client / Organization Name */}
            <div>
              <label className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300 mb-1">
                <Building2 className="w-3.5 h-3.5 text-slate-400"/>
                <span>نام کارفرما / آژانس طرف قرارداد <span className="text-red-500">*</span></span>
              </label>
              <input
                type="text"
                required
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="مثال: آژانس توسعه دیجیتال پارس"
                className="w-full h-10 px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500 font-medium transition-colors"
              />
            </div>

            {/* Left Column (in RTL): Team Lead with Custom Dropdown Popover */}
            <div className="relative" ref={leadRef}>
              <label className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300 mb-1">
                <User2 className="w-3.5 h-3.5 text-blue-500"/>
                <span>راهبر ارشد / تیم لید پروژه <span className="text-red-500">*</span></span>
              </label>

              {isCustomLeadMode ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    autoFocus
                    value={customLeadInput}
                    onChange={(e) => setCustomLeadInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && customLeadInput.trim()) {
                        e.preventDefault();
                        setSelectedLead(customLeadInput.trim());
                        setSelectedLeadId('');
                        setIsCustomLeadMode(false);
                      }
                    }}
                    placeholder="نام و عنوان لید دلخواه..."
                    className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-blue-500 text-slate-800 dark:text-slate-100 font-bold focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (customLeadInput.trim()) {
                        setSelectedLead(customLeadInput.trim());
                        setSelectedLeadId('');
                      }
                      setIsCustomLeadMode(false);
                    }}
                    className="h-10 px-3 rounded-xl bg-blue-600 text-white font-bold text-xs shrink-0 cursor-pointer"
                  >
                    تایید
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsLeadDropdownOpen(!isLeadDropdownOpen)}
                  className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 flex items-center justify-between cursor-pointer hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
                >
                  <span className="font-semibold truncate">{selectedLead}</span>
                  <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform", isLeadDropdownOpen && "rotate-180")}/>
                </button>
              )}

              {/* Popover Dropdown Card */}
              {isLeadDropdownOpen && (
                <div className="absolute top-12 end-0 sm:start-0 sm:end-auto z-50 w-full min-w-[240px] p-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl space-y-1 animate-in fade-in zoom-in-95">
                  <div
                    onClick={() => {
                      setSelectedLead(defaultLeadName);
                      setSelectedLeadId(currentUser?.id || '');
                      setIsLeadDropdownOpen(false);
                    }}
                    className={cn(
                      "flex items-center justify-between p-2.5 rounded-xl cursor-pointer font-bold transition-colors",
                      selectedLead === defaultLeadName
                        ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                    )}
                  >
                    <span>{defaultLeadName}</span>
                    {selectedLead === defaultLeadName && <Check className="w-4 h-4 text-blue-600"/>}
                  </div>

                  {candidateLeads
                    .filter(m => m.name !== currentUserName)
                    .map(m => {
                      const itemLabel = leadLabel(m.name, m.role);
                      const isSelected = selectedLead === itemLabel;
                      return (
                        <div
                          key={m.id}
                          onClick={() => {
                            setSelectedLead(itemLabel);
                            setSelectedLeadId((m as any).userId || m.id);
                            setIsLeadDropdownOpen(false);
                          }}
                          className={cn(
                            "flex items-center justify-between p-2.5 rounded-xl cursor-pointer font-bold transition-colors",
                            isSelected
                              ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400"
                              : "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                          )}
                        >
                          <span>{itemLabel}</span>
                          {isSelected && <Check className="w-4 h-4 text-blue-600"/>}
                        </div>
                      );
                    })}

                  <div
                    onClick={() => {
                      setIsCustomLeadMode(true);
                      setIsLeadDropdownOpen(false);
                    }}
                    className="flex items-center gap-1.5 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 cursor-pointer font-medium border-t border-slate-100 dark:border-slate-800 mt-1 pt-2"
                  >
                    <Plus className="w-3.5 h-3.5"/>
                    <span>+ سایر (وارد کردن نام دلخواه)</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Row 4: Due Date & Budget (2 Columns Grid) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
            
            {/* Right Column (in RTL): deadline */}
            <div>
              <label htmlFor="project-deadline" className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300 mb-1">
                <Calendar className="w-3.5 h-3.5 text-blue-500"/>
                <span>سررسید تحویل پروژه</span>
              </label>
              <JalaliDateInput id="project-deadline" value={deadline} onChange={value => { setDeadline(value); setDeadlineChanged(true); }} placeholder="بدون سررسید" />
            </div>

            {/* Left Column (in RTL): Budget with Comma Separator & Dynamic Lock Icon */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">بودجه مصوب</label>
                <label className="flex items-center gap-1.5 cursor-pointer text-[10px] text-slate-500 dark:text-slate-400 select-none">
                  <span>محرمانه (فقط مدیران)</span>
                  <input
                    type="checkbox"
                    checked={isConfidential}
                    onChange={(e) => setIsConfidential(e.target.checked)}
                    className="accent-blue-600 rounded cursor-pointer"
                  />
                </label>
              </div>
              <div className={cn(
                "relative flex items-center h-10 px-3 rounded-xl border transition-all",
                isConfidential
                  ? "border-amber-400 dark:border-amber-500 bg-amber-50/20 dark:bg-amber-950/20 shadow-sm"
                  : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60"
              )}>
                {/* Dynamic Lock Icon: Open lock (Unlock) in gray when unchecked, Closed lock (Lock) in golden amber when checked */}
                {isConfidential ? (
                  <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0 transition-colors" />
                ) : (
                  <Unlock className="w-3.5 h-3.5 text-slate-400 shrink-0 transition-colors" />
                )}

                <input
                  type="text"
                  value={formatCurrency(rawBudget)}
                  onChange={handleBudgetChange}
                  placeholder="مثال: ۸۵,۰۰۰,۰۰۰"
                  className="w-full bg-transparent text-center font-bold text-slate-800 dark:text-slate-100 focus:outline-none px-2"
                />
                
                <span className="text-[11px] text-slate-400 shrink-0 font-medium">تومان</span>
              </div>
            </div>

          </div>

          {/* Section: Zero-Trust Access Control (سطوح دسترسی و تخصیص پروژه) */}
          <div className="p-4 rounded-2xl bg-slate-50/50 dark:bg-slate-800/30 border border-slate-200/80 dark:border-slate-800 space-y-3">
            <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200 font-bold">
              <Shield className="w-4 h-4 text-blue-600"/>
              <span>سطوح دسترسی و تخصیص پروژه</span>
            </div>

            {/* Subsection 1: Assigned Members */}
            <div>
              <div className="flex items-center gap-1 text-[11px] text-slate-400 mb-1.5 font-semibold">
                <Users className="w-3.5 h-3.5 text-slate-400"/>
                <span>اعضای تخصیص‌یافته به پروژه (دسترس‌پذیر برای اعضا)</span>
              </div>
              <div className="flex items-center justify-between p-2.5 px-3.5 rounded-xl bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-800 shadow-sm">
                <span className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>{currentUser?.name || ''}</span>
                </span>
                <Check className="w-4 h-4 text-blue-600"/>
              </div>
            </div>

            {/* Subsection 2: Responsible teams; each one's roadmap becomes a project checklist. */}
            <div className="space-y-2">
              <div>
                <div className="flex items-center gap-1 text-[11px] text-slate-700 dark:text-slate-300 font-bold">
                  <ListChecks className="w-3.5 h-3.5 text-blue-600"/>
                  <span>این پروژه برای کدام تیم است؟</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5 leading-5">نقشهٔ راه هر تیم انتخاب‌شده به‌طور خودکار به‌عنوان چک‌لیست پروژه ساخته می‌شود.</p>
              </div>
              {teams.length === 0
                ? <p className="text-[11px] text-slate-500 dark:text-slate-400 p-3 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">هنوز تیمی تعریف نشده است؛ از بخش «دسته‌بندی و لیست تیم‌ها» تیم بسازید.</p>
                : <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {teams.map(team => {
                  const isSelected = selectedTeams.includes(team.id);
                  const steps = roadmapStepCount(teamRoadmap(team));
                  return (
                    <button
                      key={team.id}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => {
                        setSelectedTeams(prev =>
                          isSelected ? prev.filter(t => t !== team.id) : [...prev, team.id]
                        );
                      }}
                      className={cn(
                        "p-2.5 rounded-xl border transition-all flex items-center gap-2.5 text-start cursor-pointer",
                        isSelected
                          ? "border-blue-600 bg-blue-50/60 dark:bg-blue-950/40 shadow-sm"
                          : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600"
                      )}
                    >
                      {isSelected
                        ? <span className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-white bg-blue-600"><Check className="w-3.5 h-3.5" strokeWidth={3}/></span>
                        : <TeamAvatar team={team} className="w-7 h-7 rounded-lg text-[11px]" iconSize={14} />}
                      <span className="min-w-0 flex-1">
                        <span className={cn("block text-[11px] font-bold truncate", isSelected ? "text-blue-700 dark:text-blue-300" : "text-slate-700 dark:text-slate-200")}>{team.name}</span>
                        <span className="block text-[10px] text-slate-400">{steps ? `چک‌لیست ${steps.toLocaleString('fa-IR')} مرحله‌ای` : 'بدون نقشهٔ راه'}</span>
                      </span>
                    </button>
                  );
                })}
              </div>}
            </div>
          </div>

          {/* Section: Description & Key Objectives */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                <FileText className="w-3.5 h-3.5 text-slate-400"/>
                <span>توضیحات و اهداف کلیدی پروژه</span>
              </label>
              <span className="text-[10px] text-slate-400 font-mono">
                {description.length} / ۵۰۰ کاراکتر
              </span>
            </div>
            <textarea
              rows={2}
              maxLength={500}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="توضیحات خلاصه در خصوص دامنه پروژه، نیازمندی‌ها و اهداف کلیدی کارفرما..."
              className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 resize-none focus:outline-none focus:border-blue-500 transition-colors font-medium text-xs"
            />
          </div>
        </form>

        {/* Modal Submit Footer */}
        <div className="p-4 px-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
          {submitError && <p role="alert" className="mb-3 text-red-600 dark:text-red-400 text-xs">{submitError}</p>}
          <button
            type="submit"
            form="create-project-form"
            disabled={isSubmitting}
            className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98"
          >
            <Sparkles className="w-4 h-4"/>
            <span>
              {projectToEdit 
                ? (isRtl ? 'ذخیره تغییرات پروژه' : 'Save Changes') 
                : (isRtl ? '+ ثبت نهایی و افزودن به لیست' : '+ Create & Add to List')}
            </span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default CreateProjectModal;
