import {uploadAsset,type ManagedAsset} from '../../lib/assets';
import { LocalImage } from '../common/LocalImage';
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  Calendar, 
  Clock, 
  User, 
  Tag, 
  CheckSquare, 
  Paperclip, 
  AlertCircle, 
  ChevronDown, 
  Plus, 
  Trash2, 
  MessageSquare, 
  Send,
  Sparkles,
  Layers,
  Flame,
  CheckCircle2,
  HelpCircle
} from 'lucide-react';
import { useProjectContext } from '../../context/ProjectContext';
import { Task, SubTask, TaskPriority, TaskStatus } from '../../types';
import { cn } from '../../lib/utils';

export interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultStatus?: string;
  defaultProjectId?: string;
}

export const CreateTaskModal: React.FC<CreateTaskModalProps> = props=>{
  const {currentUser,activeWorkspaceId}=useProjectContext();
  return <CreateTaskModalView key={JSON.stringify([currentUser?.id,activeWorkspaceId])} {...props}/>;
};
const CreateTaskModalView: React.FC<CreateTaskModalProps> = ({
  isOpen,
  onClose,
  defaultStatus,
  defaultProjectId
}) => {
  const { 
    currentUser, 
    projects, 
    teamMembers, 
    createTask, 
    activeWorkspaceId, 
    language,
    locale 
  } = useProjectContext();

  const isRtl = (language === 'fa' || locale !== 'en');

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState(defaultProjectId || projects[0]?.id || '');
  const [status, setStatus] = useState<'TODO' | 'IN_PROGRESS' | 'UNDER_REVIEW' | 'COMPLETED' | 'BLOCKED' | 'CANCELLED'>(() => {
    if (defaultStatus === 'IN_PROGRESS' || defaultStatus === 'inprogress') return 'IN_PROGRESS';
    if (defaultStatus === 'UNDER_REVIEW' || defaultStatus === 'review') return 'UNDER_REVIEW';
    if (defaultStatus === 'COMPLETED' || defaultStatus === 'completed') return 'COMPLETED';
    if (defaultStatus === 'BLOCKED' || defaultStatus === 'blocked') return 'BLOCKED';
    if (defaultStatus === 'CANCELLED' || defaultStatus === 'cancelled') return 'CANCELLED';
    return 'TODO';
  });
  useEffect(() => {
    if (!isOpen) return;
    const key = String(defaultStatus || '').toLowerCase();
    setStatus(key === 'inprogress' || key === 'in_progress' ? 'IN_PROGRESS' : key === 'review' || key === 'under_review' ? 'UNDER_REVIEW' : key === 'completed' ? 'COMPLETED' : key === 'blocked' ? 'BLOCKED' : key === 'cancelled' ? 'CANCELLED' : 'TODO');
  }, [isOpen, defaultStatus]);
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<'Urgent' | 'High' | 'Medium' | 'Low'>('Urgent');
  
  // Selected Assignees (Chips with remove)
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>(currentUser?.id ? [currentUser.id] : []);
  const [isAssigneePickerOpen, setIsAssigneePickerOpen] = useState(false);

  // Tags
  const availableTags = ['Dashboard', 'Frontend', 'UI/UX', 'Mobile App', 'API', 'Branding', 'QA'];
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);
  const [customTagInput, setCustomTagInput] = useState('');

  // Subtask / Sections
  const [sections, setSections] = useState<{ id: string; title: string; note?: string; completed: boolean }[]>([]);
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [isAddingSection, setIsAddingSection] = useState(false);

  // Live Comment in modal
  const [commentText, setCommentText] = useState('');
  const [commentsList, setCommentsList] = useState<{ id: string; author: string; avatar: string; text: string; time: string }[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draftAssets,setDraftAssets]=useState<ManagedAsset[]>([]);
  const [uploading,setUploading]=useState(false);
  const attachmentScope=useRef(0);
  useEffect(()=>{attachmentScope.current++;setDraftAssets([]);setUploading(false);setIsSubmitting(false);return()=>{attachmentScope.current++;};},[isOpen,projectId]);
  const [submitError, setSubmitError] = useState('');
  useEffect(() => { if(isOpen) { setProjectId(defaultProjectId || projects[0]?.id || ''); setTitle(''); setDescription(''); setDueDate(''); setSections([]); setDraftAssets([]); setCommentsList([]); setSelectedTags([]); setSelectedAssigneeIds(currentUser?.id ? [currentUser.id] : []); setSubmitError(''); } },[isOpen,defaultProjectId]);

  if (!isOpen || typeof document === 'undefined') return null;

  const handleAddAssignee = (memberId: string) => {
    if (!selectedAssigneeIds.includes(memberId)) {
      setSelectedAssigneeIds(prev => [...prev, memberId]);
    }
    setIsAssigneePickerOpen(false);
  };

  const handleRemoveAssignee = (memberId: string) => {
    setSelectedAssigneeIds(prev => prev.filter(id => id !== memberId));
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleAddCustomTag = () => {
    if (customTagInput.trim() && !selectedTags.includes(customTagInput.trim())) {
      setSelectedTags(prev => [...prev, customTagInput.trim()]);
      setCustomTagInput('');
    }
  };

  const handleAddSection = () => {
    if (!newSectionTitle.trim()) return;
    setSections(prev => [
      ...prev,
      { id: `sec_${Date.now()}`, title: newSectionTitle.trim(), completed: false }
    ]);
    setNewSectionTitle('');
    setIsAddingSection(false);
  };

  const handleRemoveSection = (id: string) => {
    setSections(prev => prev.filter(s => s.id !== id));
  };

  const handleAddComment = () => {
    if (!commentText.trim()) return;
    setCommentsList(prev => [
      ...prev,
      {
        id: `cm_${Date.now()}`,
        author: currentUser?.name || 'Ali Tahmores',
        avatar: currentUser?.avatar || '/avatars/avatar-7.svg',
        text: commentText.trim(),
        time: 'Just now'
      }
    ]);
    setCommentText('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()||uploading||isSubmitting) return;
    const generation=attachmentScope.current;

    setIsSubmitting(true);
    setSubmitError('');
    const newTaskObj: Omit<Task,'id'> = {
      projectId, title:title.trim(), description:description.trim(),
      assignedMemberIds:selectedAssigneeIds, status:status==='IN_PROGRESS'?'inprogress':status==='UNDER_REVIEW'?'review':status==='COMPLETED'?'completed':status==='BLOCKED'?'blocked':status==='CANCELLED'?'cancelled':'pending',
      priority:priority==='Urgent'?'critical':priority==='High'?'high':priority==='Low'?'low':'medium',
      ...(dueDate ? {dueDate,deadline:dueDate} : {}), tags:selectedTags,
      subtasks:sections.map(section=>({id:section.id,title:section.title,note:section.note,completed:section.completed})),
      attachments:draftAssets.map(file=>file.id),
      initialComments:[...commentsList.map(comment=>comment.text),...(commentText.trim()?[commentText.trim()]:[])]
    };
    try {
      if (createTask) {
        await createTask(newTaskObj);
      }
      if(generation===attachmentScope.current)onClose();
    } catch (err) {
      if(generation===attachmentScope.current)setSubmitError(err instanceof Error ? err.message : 'ذخیره انجام نشد.');
    } finally {
      if(generation===attachmentScope.current)setIsSubmitting(false);
    }
  };

  const selectedMembers = teamMembers.filter(m => selectedAssigneeIds.includes((m as any).userId || m.id));

  return createPortal(
    <div className={`fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-5 overflow-y-auto font-sans ${isRtl ? 'dir-rtl' : 'dir-ltr'}`} dir={isRtl ? 'rtl' : 'ltr'}>
      {submitError && <div role="alert" className="fixed top-6 z-[100001] bg-red-50 text-red-700 p-4 rounded-xl">{submitError}</div>}
      {/* Translucent Backdrop */}
      <div 
        onClick={onClose}
        className="fixed inset-0 z-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in cursor-pointer"
      />

      {/* Modal Dialog Card (Faithful to 47ae26cf758c666ddd1c3.jpg) */}
      <div 
        onClick={(e) => e.stopPropagation()}
        className={`relative z-10 w-full max-w-xl max-h-[92vh] flex flex-col bg-white dark:bg-[#0d121f] rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-2xl animate-in fade-in zoom-in-95 duration-150 overflow-hidden ${isRtl ? 'text-right' : 'text-left'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 px-6 border-b border-slate-100 dark:border-slate-800/80 shrink-0 bg-white dark:bg-[#0d121f]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/60 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <CheckSquare className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                {isRtl ? 'ثبت وظیفه جدید (Create Task)' : 'Create Task'}
              </h2>
              <p className="text-[11px] text-slate-400">
                {isRtl ? 'تنظیمات و جزئیات تسک پروژه' : 'Configure task properties, assignees & milestones'}
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4"/>
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
          
          {/* Task Title */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1.5">
              {isRtl ? 'عنوان تسک *' : 'Task Title *'}
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={isRtl ? "مثال: ABC Dashboard یا طراحی وایرفریم" : "e.g. ABC Dashboard"}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/80 text-slate-800 dark:text-slate-100 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          {/* Status Selector Pills */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1.5">
              {isRtl ? 'وضعیت (Status)' : 'Status'}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'TODO', label: 'To-do', bg: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-700' },
                { id: 'IN_PROGRESS', label: 'On Progress', bg: 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 border-blue-300 dark:border-blue-800' },
                { id: 'UNDER_REVIEW', label: 'In Review', bg: 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 border-amber-300 dark:border-amber-800' },
                { id: 'COMPLETED', label: 'Completed', bg: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800' },
                { id: 'BLOCKED', label: isRtl ? 'مسدود' : 'Blocked', bg: 'bg-rose-50 text-rose-600 border-rose-300 dark:bg-rose-950/60' },
                { id: 'CANCELLED', label: isRtl ? 'لغوشده' : 'Cancelled', bg: 'bg-slate-100 text-slate-500 border-slate-300 dark:bg-slate-800' },
              ].map(st => (
                <button
                  type="button"
                  key={st.id}
                  onClick={() => setStatus(st.id as any)}
                  className={cn(
                    "py-2 px-2.5 rounded-xl border text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                    status === st.id 
                      ? `${st.bg} ring-2 ring-blue-500/40 shadow-xs` 
                      : "border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  )}
                >
                  <span className={cn("w-1.5 h-1.5 rounded-full", status === st.id ? "bg-current" : "bg-slate-300")}/>
                  <span>{st.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Row: Due Date & Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Due Date */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                {isRtl ? 'سررسید (Due Date)' : 'Due Date'}
              </label>
              <div className="relative">
                <Calendar className="w-3.5 h-3.5 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  placeholder="Feb 02, 2027"
                  className="w-full ps-9 pe-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/80 text-slate-800 dark:text-slate-100 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Priority Pill */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                {isRtl ? 'اولویت (Priority)' : 'Priority'}
              </label>
              <div className="flex items-center gap-1.5">
                {[
                  { id: 'Urgent', label: 'Urgent', color: 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/50 dark:text-rose-400 dark:border-rose-800' },
                  { id: 'High', label: 'High', color: 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800' },
                  { id: 'Medium', label: 'Medium', color: 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800' },
                  { id: 'Low', label: 'Low', color: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700' }
                ].map(pr => (
                  <button
                    type="button"
                    key={pr.id}
                    onClick={() => setPriority(pr.id as any)}
                    className={cn(
                      "flex-1 py-2 px-1 rounded-xl border text-[10px] font-bold transition-all cursor-pointer text-center",
                      priority === pr.id 
                        ? `${pr.color} ring-2 ring-blue-500/30 shadow-xs font-black` 
                        : "border-slate-200 dark:border-slate-800 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                    )}
                  >
                    {pr.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Assignees Bar with Removable Chips (e.g. Kiara Laras ✕, Joe Tesla ✕, Tania ✕) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                {isRtl ? 'مسئولین تسک (Assignees)' : 'Assignees'}
              </label>
              <span className="text-[10px] text-slate-400">
                {selectedMembers.length} {isRtl ? 'نفر انتخاب شده' : 'selected'}
              </span>
            </div>
            
            <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 min-h-[44px]">
              {selectedMembers.map(member => (
                <span 
                  key={member.id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-medium shadow-2xs"
                >
                  <LocalImage src={member.avatar} alt={member.name} className="w-4 h-4 rounded-full object-cover" />
                  <span className="text-[11px] font-bold">{member.name}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveAssignee((member as any).userId || member.id)}
                    className="text-slate-400 hover:text-rose-500 p-0.5 transition-colors cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}

              {/* Add Assignee Trigger */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsAssigneePickerOpen(!isAssigneePickerOpen)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-blue-600 dark:text-blue-400 text-xs font-bold transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isRtl ? 'افزودن عضو' : '+ Add'}</span>
                </button>

                {/* Dropdown Popover */}
                {isAssigneePickerOpen && (
                  <div className="absolute top-full start-0 mt-1.5 w-56 p-2 rounded-2xl bg-white dark:bg-[#131b2e] border border-slate-200 dark:border-slate-800 shadow-xl z-50 space-y-1">
                    <div className="text-[10px] font-bold text-slate-400 px-2 py-1">
                      {isRtl ? 'انتخاب از اعضای تیم' : 'Select Team Member'}
                    </div>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {teamMembers.map(m => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => handleAddAssignee((m as any).userId || m.id)}
                          className={cn(
                            "w-full flex items-center gap-2 p-1.5 px-2 rounded-xl text-left transition-all cursor-pointer",
                            selectedAssigneeIds.includes((m as any).userId || m.id) 
                              ? "bg-blue-50 dark:bg-blue-950/60 text-blue-600" 
                              : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                          )}
                        >
                          <LocalImage src={m.avatar} alt={m.name} className="w-5 h-5 rounded-full object-cover" />
                          <span className="text-xs font-semibold flex-1 truncate">{m.name}</span>
                          {selectedAssigneeIds.includes((m as any).userId || m.id) && <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tags Selector */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1.5">
              {isRtl ? 'برچسب‌ها (Tags)' : 'Tags'}
            </label>
            <div className="flex flex-wrap items-center gap-1.5">
              {availableTags.map(tag => (
                <button
                  type="button"
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={cn(
                    "px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer border",
                    selectedTags.includes(tag)
                      ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 border-transparent shadow-xs"
                      : "bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-400"
                  )}
                >
                  #{tag}
                </button>
              ))}

              {/* Custom Tag Input */}
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={customTagInput}
                  onChange={(e) => setCustomTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCustomTag(); } }}
                  placeholder={isRtl ? "+ برچسب جدید" : "+ New tag"}
                  className="w-24 px-2 py-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent text-[11px] font-semibold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-blue-500"
                />
                {customTagInput && (
                  <button
                    type="button"
                    onClick={handleAddCustomTag}
                    className="p-1 rounded-lg bg-blue-600 text-white text-[10px] cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Description Box */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1.5">
              {isRtl ? 'شرح و توضیحات (Description)' : 'Description'}
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Create wireframe for Dashboard page..."
              className="w-full p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/80 text-slate-800 dark:text-slate-100 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-none leading-relaxed"
            />
          </div>

          {/* Sections / Subtasks List with "+ Add Section" trigger */}
          <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                {isRtl ? 'زیرتسک‌ها و بخش‌ها (Subsections)' : 'Subsections & Milestones'}
              </span>
              {!isAddingSection && (
                <button
                  type="button"
                  onClick={() => setIsAddingSection(true)}
                  className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add Section</span>
                </button>
              )}
            </div>

            {sections.map(sec => (
              <div 
                key={sec.id}
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800"
              >
                <div className="flex items-center gap-2">
                  <CheckSquare className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{sec.title}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveSection(sec.id)}
                  className="text-slate-400 hover:text-rose-500 p-1 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}

            {isAddingSection && (
              <div className="flex items-center gap-2 p-2 rounded-xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                <input
                  type="text"
                  autoFocus
                  value={newSectionTitle}
                  onChange={(e) => setNewSectionTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddSection(); } }}
                  placeholder={isRtl ? "عنوان بخش یا تسک فرعی..." : "Section title..."}
                  className="flex-1 px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddSection}
                  className="px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded-lg cursor-pointer"
                >
                  {isRtl ? 'ثبت' : 'Add'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingSection(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          <label className="block text-xs">پیوست واقعی<input aria-label="پیوست وظیفه" type="file" disabled={uploading||isSubmitting||!projectId} onChange={async event=>{const element=event.target,file=element.files?.[0];if(!file)return;const generation=attachmentScope.current;setUploading(true);setSubmitError('');try{const saved=await uploadAsset(file,{name:file.name,projectId});if(generation===attachmentScope.current){setDraftAssets(previous=>[...previous,saved]);element.value='';}}catch(error){if(generation===attachmentScope.current)setSubmitError(error instanceof Error?error.message:'فایل ذخیره نشد.');}finally{if(generation===attachmentScope.current)setUploading(false);}}}/></label>
          {draftAssets.map(file=><p key={file.id} className="text-xs">{file.name}<button type="button" onClick={()=>setDraftAssets(previous=>previous.filter(item=>item.id!==file.id))}>حذف از وظیفه</button></p>)}
          {/* Live Comment Input Box with User Avatar */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80">
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1.5">
              {isRtl ? 'یادداشت یا کامنت اولیه (Comment)' : 'Initial Note / Comment'}
            </label>
            <div className="flex items-center gap-2 p-2 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
              <LocalImage 
                src={currentUser?.avatar || '/avatars/avatar-7.svg'} 
                alt="user" 
                className="w-6 h-6 rounded-full object-cover shrink-0" 
              />
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddComment(); } }}
                placeholder={isRtl ? "افزودن یادداشت..." : "Add a comment..."}
                className="flex-1 bg-transparent text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-none"
              />
              {commentText && (
                <button
                  type="button"
                  onClick={handleAddComment}
                  className="p-1.5 rounded-xl bg-blue-600 text-white text-xs cursor-pointer"
                >
                  <Send className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </form>

        {/* Footer Action Bar (Collaborators avatars + Cancel + Save button) */}
        <div className="flex items-center justify-between p-4 px-6 border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#0d121f] shrink-0">
          <div className="flex items-center -space-x-2 space-x-reverse">
            {selectedMembers.slice(0, 4).map(m => (
              <LocalImage 
                key={m.id} 
                src={m.avatar} 
                alt={m.name} 
                title={m.name}
                className="w-7 h-7 rounded-full border-2 border-white dark:border-slate-900 object-cover shadow-2xs" 
              />
            ))}
            {selectedMembers.length > 4 && (
              <span className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-800 border-2 border-white dark:border-slate-900 text-[10px] font-bold flex items-center justify-center text-slate-600 dark:text-slate-300">
                +{selectedMembers.length - 4}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-all cursor-pointer"
            >
              {isRtl ? 'انصراف' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={uploading || isSubmitting || !title.trim()}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (isRtl ? 'در حال ثبت...' : 'Saving...') : (isRtl ? 'ذخیره تسک' : 'Save')}
            </button>
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
};
