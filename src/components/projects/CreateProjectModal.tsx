import { englishDigits, persianDateParts, jalaliToISO } from '../../lib/domain';
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, FolderPlus, Sparkles, ChevronDown, Check, Lock, Unlock,
  Globe, Building2, User2, Calendar, Shield, Users, FileText, Plus, Edit3
} from 'lucide-react';
import { useProjectContext } from '../../context/ProjectContext';
import { cn } from '../../lib/utils';
import { Project } from '../../types';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectToEdit?: Project | null;
}

const PERSIAN_MONTHS = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
];

const YEARS = ['۱۴۰۵', '۱۴۰۶', '۱۴۰۷', '۱۴۰۸', '۱۴۰۹'];

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

const DAYS_LIST = Array.from({ length: 31 }, (_, i) => toPersianDigits(String(i + 1).padStart(2, '0')));

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({ 
  isOpen, 
  onClose,
  projectToEdit
}) => {
  const { currentUser, teamMembers, teams, addProject, updateProject, activeWorkspaceId, locale } = useProjectContext();
  const isRtl = locale !== 'en';

  // Basic Form States
  const [title, setTitle] = useState('');
  const [website, setWebsite] = useState('');
  const [clientName, setClientName] = useState('');
  const [description, setDescription] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 1. Team Lead Selection State
  const defaultLeadName = useMemo(() => {
    return currentUser?.name 
      ? `${currentUser.name} (${currentUser.role || 'OWNER'})` 
      : 'علی طهمورث (OWNER)';
  }, [currentUser?.name, currentUser?.role]);

  const [selectedLead, setSelectedLead] = useState(defaultLeadName);
  const [isLeadDropdownOpen, setIsLeadDropdownOpen] = useState(false);
  const [customLeadInput, setCustomLeadInput] = useState('');
  const [isCustomLeadMode, setIsCustomLeadMode] = useState(false);

  // 2. Budget & Confidential State - Initial empty string
  const [rawBudget, setRawBudget] = useState('');
  const [isConfidential, setIsConfidential] = useState(false);

  // 3. Jalali Date Picker State
  const [selectedYear, setSelectedYear] = useState('۱۴۰۵');
  const [selectedMonth, setSelectedMonth] = useState('تیر');
  const [selectedDay, setSelectedDay] = useState('۱۵');
  const [dateStep, setDateStep] = useState<'year' | 'month' | 'day'>('year');
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  // Date Picker Trigger Handler
  const handleOpenDatePicker = () => {
    setDateStep('year'); // Always start from Step 1 (Year)
    setIsDatePickerOpen((prev) => !prev);
  };

  // Step Selection Handlers with Auto-Progression
  const handleSelectYear = (year: string) => {
    setDateChanged(true); setSelectedYear(year);
    setDateStep('month'); // Advance to Month
  };

  const handleSelectMonth = (month: string) => {
    setDateChanged(true); setSelectedMonth(month);
    setDateStep('day'); // Advance to Day
  };

  const handleSelectDay = (day: string) => {
    setDateChanged(true); setSelectedDay(day);
  };

  // 4. Access Control Selection
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [dateChanged,setDateChanged] = useState(false);

  const leadRef = useRef<HTMLDivElement>(null);
  const dateRef = useRef<HTMLDivElement>(null);

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

  const formattedDueDate = `${selectedDay} ${selectedMonth} ${selectedYear}`;

  // Reset or Populate form on open/edit
  useEffect(() => {
    if (isOpen) {
      setSubmitError(''); setDateChanged(false);
      const existing=projectToEdit?.deadline || projectToEdit?.dueDate;
      const date=existing && /^\d{4}-\d{2}-\d{2}$/.test(existing) ? new Date(existing+'T12:00:00Z') : new Date();
      const parts=persianDateParts(date);
      setSelectedYear(toPersianDigits(parts.year)); setSelectedMonth(PERSIAN_MONTHS[parts.month-1]); setSelectedDay(toPersianDigits(String(parts.day).padStart(2,'0')));
      if (projectToEdit) {
        setTitle(projectToEdit.title || projectToEdit.name || '');
        setWebsite(projectToEdit.websiteUrl || '');
        setClientName(projectToEdit.clientName || '');
        if (projectToEdit.teamLead) {
          setSelectedLead(projectToEdit.teamLead);
        }
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
        setRawBudget('');
        setIsConfidential(false);
        setSelectedTeams([]);
        setDescription('');
      }
      setIsCustomLeadMode(false);
      setCustomLeadInput('');
      setIsDatePickerOpen(false);
      setIsLeadDropdownOpen(false);
    }
  }, [isOpen, projectToEdit?.id]);

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (leadRef.current && !leadRef.current.contains(e.target as Node)) {
        setIsLeadDropdownOpen(false);
      }
      if (dateRef.current && !dateRef.current.contains(e.target as Node)) {
        setIsDatePickerOpen(false);
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
    const chosenLead = teamMembers.find(member => selectedLead === `${member.name} (${member.role || 'LEAD'})`);
    const leadId = selectedLead === defaultLeadName ? currentUser.id : (chosenLead ? ((chosenLead as any).userId || chosenLead.id) : '');

    const savedDate = projectToEdit && !dateChanged ? (projectToEdit.deadline || projectToEdit.dueDate || '') : jalaliToISO(Number(englishDigits(selectedYear)),PERSIAN_MONTHS.indexOf(selectedMonth)+1,Number(englishDigits(selectedDay)));
    const formattedBudgetStr = rawBudget ? `${formatCurrency(rawBudget)} تومان` : '';
    const effectiveUserId = currentUser?.id || 'usr_master_alitahmores';
    const effectiveUserName = currentUser?.name || 'علی طهمورث';
    const effectiveUserAvatar = currentUser?.avatar || "/avatars/avatar-5.svg";
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
        dueDate: savedDate,
        deadline: savedDate,
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
        clientPortalEnabled: true,
        isPortalActive: true,
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
        className={`relative z-10 w-full max-w-xl max-h-[92vh] flex flex-col bg-white dark:bg-[#0d121f] rounded-[28px] border border-slate-200/90 dark:border-slate-800 shadow-[0_25px_70px_-15px_rgba(0,0,0,0.18)] animate-in fade-in zoom-in-95 duration-150 overflow-hidden ${isRtl ? 'text-right' : 'text-left'}`}
      >
        
        {/* Modal Header: In RTL layout, Right Edge has Blue Folder Icon + Title & Subtitle, Left Edge has Circular Close Button */}
        <div className="flex items-center justify-between p-5 px-6 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-white dark:bg-[#0d121f] flex-row">
          {/* Right Edge (First in RTL flow): Folder Icon + Title & Subtitle */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/20 shrink-0">
              {projectToEdit ? <Edit3 className="w-5 h-5"/> : <FolderPlus className="w-5 h-5"/>}
            </div>
            <div className={isRtl ? 'text-right' : 'text-left'}>
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
                <span>راهبر ارشد / تیم لید پروژه (Team Lead) <span className="text-red-500">*</span></span>
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
                <div className="absolute top-12 left-0 sm:right-0 sm:left-auto z-50 w-full min-w-[240px] p-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl space-y-1 animate-in fade-in zoom-in-95">
                  <div
                    onClick={() => {
                      setSelectedLead(`${currentUser?.name || 'علی طهمورث'} (${currentUser?.role || 'OWNER'})`);
                      setIsLeadDropdownOpen(false);
                    }}
                    className={cn(
                      "flex items-center justify-between p-2.5 rounded-xl cursor-pointer font-bold transition-colors",
                      selectedLead.includes(currentUser?.name || 'علی طهمورث')
                        ? "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400"
                        : "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                    )}
                  >
                    <span>{currentUser?.name || 'علی طهمورث'} ({currentUser?.role || 'OWNER'})</span>
                    {selectedLead.includes(currentUser?.name || 'علی طهمورث') && <Check className="w-4 h-4 text-blue-600"/>}
                  </div>

                  {candidateLeads
                    .filter(m => m.name !== (currentUser?.name || 'علی طهمورث'))
                    .map(m => {
                      const itemLabel = `${m.name} (${m.role || 'LEAD'})`;
                      const isSelected = selectedLead === itemLabel;
                      return (
                        <div
                          key={m.id}
                          onClick={() => {
                            setSelectedLead(itemLabel);
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
            
            {/* Right Column (in RTL): Jalali Date Picker */}
            <div className="relative" ref={dateRef}>
              <label className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300 mb-1">
                <Calendar className="w-3.5 h-3.5 text-blue-500"/>
                <span>ددلاین تحویل (تحویل پروژه)</span>
              </label>
              <div 
                onClick={handleOpenDatePicker}
                className={cn(
                  "flex items-center justify-between h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border cursor-pointer transition-all",
                  isDatePickerOpen 
                    ? "border-blue-500 ring-2 ring-blue-500/10 bg-white dark:bg-slate-800" 
                    : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                )}
              >
                {/* Chosen date on the right (in RTL) */}
                <span className="font-bold text-slate-800 dark:text-slate-100 font-mono">{formattedDueDate}</span>
                
                {/* Blue pill button on the left (in RTL) */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenDatePicker();
                  }}
                  className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-bold text-[10px] flex items-center gap-1 hover:bg-blue-100 dark:hover:bg-blue-900/60 cursor-pointer transition-colors"
                >
                  <span>تغییر تاریخ</span>
                  <ChevronDown className={cn("w-3 h-3 transition-transform", isDatePickerOpen && "rotate-180")}/>
                </button>
              </div>

              {/* 3-Step Jalali Popover */}
              {isDatePickerOpen && (
                <div className="absolute top-full mt-2 right-0 w-full min-w-[320px] max-w-[340px] z-50 p-3.5 bg-white dark:bg-[#0d121f] rounded-[22px] border border-slate-200/90 dark:border-slate-800 shadow-[0_20px_50px_-10px_rgba(0,0,0,0.18)] animate-in fade-in zoom-in-95 duration-150">
                  {/* Preset Shortcuts Row (Top Header) */}
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] font-semibold text-slate-400">میانبرهای زمانبندی:</span>
                    <div className="flex items-center gap-1">
                      <button 
                        type="button" 
                        onClick={() => { setSelectedMonth('مرداد'); setDateStep('day'); }} 
                        className="px-2.5 py-1 rounded-lg bg-blue-50/80 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/60 font-bold text-[10px] transition-colors cursor-pointer"
                      >
                        ۱ ماه آینده
                      </button>
                      <button 
                        type="button" 
                        onClick={() => { setSelectedMonth('مهر'); setDateStep('day'); }} 
                        className="px-2.5 py-1 rounded-lg bg-blue-50/80 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/60 font-bold text-[10px] transition-colors cursor-pointer"
                      >
                        ۳ ماه آینده
                      </button>
                      <button 
                        type="button" 
                        onClick={() => { setSelectedMonth('دی'); setDateStep('day'); }} 
                        className="px-2.5 py-1 rounded-lg bg-blue-50/80 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/60 font-bold text-[10px] transition-colors cursor-pointer"
                      >
                        ۶ ماه آینده
                      </button>
                    </div>
                  </div>

                  {/* 3-Step Capsule Navigator Bar */}
                  <div className="bg-slate-100/80 dark:bg-slate-800/80 rounded-xl p-1 grid grid-cols-3 gap-1 my-2.5 text-center">
                    <button 
                      type="button" 
                      onClick={() => setDateStep('year')} 
                      className={cn(
                        "py-1 text-[10px] transition-all cursor-pointer rounded-lg", 
                        dateStep === 'year' 
                          ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 font-bold shadow-sm" 
                          : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-medium"
                      )}
                    >
                      ۱. سال ({selectedYear})
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setDateStep('month')} 
                      className={cn(
                        "py-1 text-[10px] transition-all cursor-pointer rounded-lg", 
                        dateStep === 'month' 
                          ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 font-bold shadow-sm" 
                          : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-medium"
                      )}
                    >
                      ۲. ماه ({selectedMonth})
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setDateStep('day')} 
                      className={cn(
                        "py-1 text-[10px] transition-all cursor-pointer rounded-lg", 
                        dateStep === 'day' 
                          ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 font-bold shadow-sm" 
                          : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 font-medium"
                      )}
                    >
                      ۳. روز ({selectedDay})
                    </button>
                  </div>

                  {/* Step 1: Years (Screenshot 214339) */}
                  {dateStep === 'year' && (
                    <div className="grid grid-cols-3 gap-2 py-1">
                      {YEARS.map(y => (
                        <button
                          key={y}
                          type="button"
                          onClick={() => handleSelectYear(y)}
                          className={cn(
                            "h-9 rounded-xl font-bold text-xs flex items-center justify-center transition-all cursor-pointer", 
                            selectedYear === y 
                              ? "bg-blue-600 text-white shadow-sm" 
                              : "bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                          )}
                        >
                          {y}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Step 2: Months (Screenshot 214348) */}
                  {dateStep === 'month' && (
                    <div className="grid grid-cols-3 gap-1.5 py-1">
                      {PERSIAN_MONTHS.map(m => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => handleSelectMonth(m)}
                          className={cn(
                            "h-8 rounded-xl font-bold text-[11px] flex items-center justify-center transition-all cursor-pointer", 
                            selectedMonth === m 
                              ? "bg-blue-600 text-white shadow-sm" 
                              : "bg-slate-50/70 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                          )}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Step 3: Days (Screenshot 214355) */}
                  {dateStep === 'day' && (
                    <div className="grid grid-cols-7 gap-1 py-1">
                      {DAYS_LIST.map(d => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => handleSelectDay(d)}
                          className={cn(
                            "h-7 rounded-lg font-bold text-[10px] flex items-center justify-center transition-all cursor-pointer", 
                            selectedDay === d 
                              ? "bg-blue-600 text-white shadow-sm" 
                              : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                          )}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Popover Footer */}
                  <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                      تاریخ انتخابی: {formattedDueDate}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsDatePickerOpen(false)}
                      className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] shadow-sm transition-all active:scale-95 cursor-pointer"
                    >
                      تایید
                    </button>
                  </div>
                </div>
              )}
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
              <span>سطوح دسترسی و تخصیص پروژه (Zero-Trust Access Control)</span>
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
                  <span>{currentUser?.name || 'علی طهمورث'}</span>
                </span>
                <Check className="w-4 h-4 text-blue-600"/>
              </div>
            </div>

            {/* Subsection 2: Assigned Teams (6 Chips in 2 Rows x 3 Cols) */}
            <div>
              <div className="flex items-center gap-1 text-[11px] text-slate-400 mb-1.5 font-semibold">
                <Shield className="w-3.5 h-3.5 text-slate-400"/>
                <span>تیم‌های تخصیص‌یافته به پروژه</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {teams.map(team => {
                  const isSelected = selectedTeams.includes(team.id);
                  return (
                    <button
                      key={team.id}
                      type="button"
                      onClick={() => {
                        setSelectedTeams(prev => 
                          isSelected ? prev.filter(t => t !== team.id) : [...prev, team.id]
                        );
                      }}
                      className={cn(
                        "p-2 rounded-xl text-[10px] font-bold border transition-all flex items-center justify-center gap-1 text-center cursor-pointer",
                        isSelected
                          ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 shadow-sm"
                          : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600"
                      )}
                    >
                      {isSelected && <Check className="w-3 h-3 text-emerald-600 shrink-0"/>}
                      <span>{team.name}</span>
                    </button>
                  );
                })}
              </div>
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
