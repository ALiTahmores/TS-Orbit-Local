import { formatJalaliDate, formatJalaliDateTime } from '../lib/dates';
import { publicFetch as apiFetch } from '../lib/api';
import { downloadAsset,uploadAsset,canPreviewAsset,type ManagedAsset } from '../lib/assets';
import {AssetImagePreview} from './assets/AssetImagePreview';
import {portalAddress,feedbackEventText} from '../lib/portal';
import React, { useState, useEffect, useRef } from 'react';
import { useProject } from '../context/ProjectContext';
import { CustomSelect } from './common/CustomSelect';
import { ClientFeedback } from '../types';
import StrandsLoader from './loading/StrandsLoader';
import { 
  ShieldCheck, 
  Clock, 
  CheckCircle2, 
  FileText, 
  Download, 
  Send, 
  MessageSquare, 
  AlertTriangle, 
  Lock, 
  Sparkles, 
  Rocket, 
  Building2, 
  ArrowLeft,
  Check,
  Tag,
  Paperclip,
  Eye,
  Calendar,
  Sun,
  Moon,
  Languages
} from 'lucide-react';

const toPersianDigits = (n: string | number): string => {
  if (n === null || n === undefined) return '';
  const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(n).replace(/[0-9]/g, (x) => farsiDigits[parseInt(x, 10)]);
};

interface PublicClientPortalProps {
  tokenParam?: string;
  projectIdParam?: string;
  onClosePreview?: () => void;
  isPreview?: boolean;
}

const texts = {
  fa: {
    loading: 'در حال بارگذاری اطلاعات پورتال کارفرما...',
    notFoundTitle: 'پورتال کارفرما یافت نشد',
    notFoundDesc: 'این لینک معتبر نیست. لطفاً لینک جدید را از تیم پروژه بگیرید.',
    disabledTitle: 'پورتال غیرفعال است',
    disabledDesc: 'دسترسی به این پورتال فعلاً بسته است. برای دسترسی دوباره با تیم پروژه تماس بگیرید.',
    previewBanner: 'پیش‌نمایش: این صفحه را کارفرما همین‌طور می‌بیند',
    exitPreview: 'خروج از پیش‌نمایش',
    returnAdmin: 'بازگشت به پنل مدیریت',
    portalTag: 'پورتال اختصاصی کارفرما',
    progress: 'پیشرفت پروژه',
    roadmapTab: 'روند پیشرفت',
    filesTab: 'اسناد و فایل‌های تحویلی',
    feedbackTab: 'ثبت و پیگیری بازخورد',
    objectivesTitle: 'توضیحات و اهداف کلیدی پروژه',
    deadline: 'مهلت تحویل پروژه',
    totalTasks: 'کل وظایف فازها',
    completedTasks: 'وظایف تکمیل‌شده',
    startDate: 'تاریخ شروع پروژه',
    activeStatus: 'وضعیت اجرای پروژه',
    activeLabel: 'در حال اجرای فعال',
    milestonesTitle: 'گام‌های اجرایی پروژه',
    noTasks: 'گام‌های اجرایی به زودی توسط مدیر پروژه بروزرسانی خواهند شد.',
    completed: 'تکمیل‌شده',
    inProgress: 'در حال اجرا',
    pending: 'در صف انجام',
    deliverablesTitle: 'اسناد، بریف‌ها و خروجی‌های تحویلی',
    deliverablesSub: 'مشاهده و دانلود آخرین فایل‌های بریف، طرح‌های فیگما و پروپوزال‌های پروژه',
    download: 'دانلود فایل',
    noFiles: 'هنوز فایلی در این بخش بارگذاری نشده است.',
    submitFeedbackTitle: 'ثبت بازخورد یا درخواست تغییرات جدید',
    senderName: 'نام فرستنده / کارفرما',
    senderPlaceholder: 'نام شما',
    category: 'دسته‌بندی موضوعی',
    catDesign: 'طراحی گرافیک و UI/UX',
    catTechnical: 'فنی، برنامه‌نویسی و عملکرد',
    catContent: 'محتوا و متون وب‌سایت',
    catGeneral: 'نظرات و پیشنهادات عمومی',
    feedbackMsg: 'متن دقیق بازخورد یا تغییرات درخواستی',
    feedbackPlaceholder: 'توضیحات کامل خود درباره تغییرات، اصلاحات گرافیکی یا باگ‌های مشاهده‌شده را وارد کنید...',
    submitBtn: 'ارسال بازخورد',
    submitting: 'در حال ثبت...',
    submitSuccess: 'بازخورد شما با موفقیت در پروژه ثبت شد.',
    feedbackHistoryTitle: 'سابقه و وضعیت بازخوردهای ارسالی شما',
    agencyReply: 'پاسخ تیم پروژه',
    noFeedback: 'هنوز هیچ بازخوردی ثبت نکرده‌اید.',
    statusResolved: 'برطرف شده ✅',
    statusInProgress: 'در حال بررسی 🛠',
    statusPending: 'در انتظار بررسی ⏳',
    footer: 'پورتال اختصاصی کارفرما • ساخته‌شده با TS Orbit',
    tasksSuffix: 'وظیفه'
  },
  en: {
    loading: 'Loading Client Portal information...',
    notFoundTitle: 'Client Portal Not Found',
    notFoundDesc: 'This link is not valid. Please ask the project team for a new one.',
    disabledTitle: 'Portal Disabled',
    disabledDesc: 'Access to this portal is currently closed. Contact the project team to reopen it.',
    previewBanner: 'Preview: this is what your client sees',
    exitPreview: 'Exit Preview',
    returnAdmin: 'Back to Admin',
    portalTag: 'Client Dedicated Portal',
    progress: 'Project Progress',
    roadmapTab: 'Roadmap & Progress',
    filesTab: 'Deliverables & Files',
    feedbackTab: 'Feedback & Support',
    objectivesTitle: 'Project Description & Objectives',
    deadline: 'Project Deadline',
    totalTasks: 'Total Tasks',
    completedTasks: 'Completed Tasks',
    startDate: 'Start Date',
    activeStatus: 'Project Status',
    activeLabel: 'Active Execution',
    milestonesTitle: 'Project Milestones & Steps',
    noTasks: 'Milestones will be updated soon by the project manager.',
    completed: 'Completed',
    inProgress: 'In Progress',
    pending: 'Pending',
    deliverablesTitle: 'Documents & Deliverables',
    deliverablesSub: 'View and download project briefs, Figma designs, and proposals',
    download: 'Download',
    noFiles: 'No files uploaded yet in this section.',
    submitFeedbackTitle: 'Submit Feedback or Change Request',
    senderName: 'Sender / Client Name',
    senderPlaceholder: 'e.g. John Doe',
    category: 'Category',
    catDesign: 'Graphic & UI/UX Design',
    catTechnical: 'Technical & Performance',
    catContent: 'Website Content',
    catGeneral: 'General Feedback',
    feedbackMsg: 'Detailed Feedback or Change Request',
    feedbackPlaceholder: 'Provide full details regarding design revisions, content updates, or issues observed...',
    submitBtn: 'Send feedback',
    submitting: 'Submitting...',
    submitSuccess: 'Your feedback was saved to the project.',
    feedbackHistoryTitle: 'Feedback History & Status',
    agencyReply: 'Project team reply',
    noFeedback: 'No feedback submitted yet.',
    statusResolved: 'Resolved ✅',
    statusInProgress: 'In Progress 🛠',
    statusPending: 'Pending ⏳',
    footer: 'Client portal • Built with TS Orbit',
    tasksSuffix: 'tasks'
  }
};

export const PublicClientPortal: React.FC<PublicClientPortalProps> = props=>{
  const context=useProject();
  const [,updateAddress]=useState(0);
  useEffect(()=>{const changed=()=>updateAddress(previous=>previous+1);window.addEventListener('popstate',changed);window.addEventListener('hashchange',changed);return()=>{window.removeEventListener('popstate',changed);window.removeEventListener('hashchange',changed);};},[]);
  const address=portalAddress(window.location.href);
  const token=props.tokenParam??address.token,projectId=props.projectIdParam??address.projectId;
  const key=JSON.stringify([token,projectId,props.isPreview,props.isPreview?context.currentUser?.id:'',props.isPreview?context.activeWorkspaceId:'']);
  return <PublicClientPortalView key={key} {...props} tokenParam={token} projectIdParam={projectId}/>;
};

const PublicClientPortalView: React.FC<PublicClientPortalProps> = ({ 
  tokenParam, 
  projectIdParam,
  onClosePreview,
  isPreview = false
}) => {
  const privateContext = useProject();
  const [portalData,setPortalData]=useState<any>(null);
  const [portalLoaded,setPortalLoaded]=useState(false);
  const [portalError,setPortalError]=useState('');
  // Public data is fetched separately and never restored from authenticated workspace state.
  const projects = isPreview ? privateContext.projects : [];
  const tasks = isPreview ? privateContext.tasks : portalData?.tasks || [];
  const files = isPreview ? privateContext.files : portalData?.files || [];

  // Theme State (light | dark) & Language State (fa | en)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('portal_theme') as 'light' | 'dark') || 'dark';
  });

  // The portal speaks the interface language; its switch changes that language.
  const lang = privateContext.locale;
  const toggleLang = () => privateContext.setLocale(lang === 'fa' ? 'en' : 'fa');

  useEffect(() => {
    localStorage.setItem('portal_theme', theme);
  }, [theme]);

  const txt = texts[lang];

  const formatNum = (n: string | number): string => {
    if (n === null || n === undefined) return '';
    if (lang === 'en') return String(n);
    return toPersianDigits(n);
  };

  const handleReturnToAdmin = () => {
    if (onClosePreview) {
      onClosePreview();
      return;
    }
    const cleanUrl = window.location.origin + window.location.pathname;
    window.location.href = cleanUrl;
  };

  const queryToken = tokenParam??'';
  const queryProjectId = projectIdParam??'';
  useEffect(()=>{
    if(publicScope.current.controller.signal.aborted)publicScope.current={token:queryToken,controller:new AbortController()};
    const operation=publicScope.current,current=()=>operation===publicScope.current&&!operation.controller.signal.aborted;
    setPortalData(null);setPortalLoaded(false);setPortalError('');
    if(isPreview||!queryToken){setPortalLoaded(true);return()=>operation.controller.abort();}
    apiFetch('/api/public/portal/'+encodeURIComponent(queryToken),{signal:operation.controller.signal}).then(res=>res.json()).then(data=>{if(current())setPortalData(data);}).catch(error=>{if(current())setPortalError(error.message);}).finally(()=>{if(current())setPortalLoaded(true);});
    return()=>operation.controller.abort();
  },[queryToken,isPreview]);
  const project = isPreview ? projects.find(p=>p.id===queryProjectId) || null : portalData?.project || null;

  // Tabs: 'roadmap' | 'files' | 'feedback'
  const [activeTab, setActiveTab] = useState<'roadmap' | 'files' | 'feedback'>('roadmap');

  // New feedback form state
  const [senderName, setSenderName] = useState<string>(project?.clientName || '');
  const [category, setCategory] = useState<'design' | 'content' | 'technical' | 'general'>('design');
  const [message, setMessage] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitSuccess, setSubmitSuccess] = useState<boolean>(false);
  const [pendingAttachments,setPendingAttachments]=useState<any[]>([]);
  const [attachmentBusy,setAttachmentBusy]=useState(false);
  const [previewAsset,setPreviewAsset]=useState<ManagedAsset|null>(null);
  const publicScope=useRef({token:queryToken,controller:new AbortController()});

  // Render sleek loading spinner while hydration is in progress
  if (!portalLoaded) {
    return (
      <div 
        className={`${theme === 'dark' ? 'dark' : ''} min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex items-center justify-center p-4 font-['Vazirmatn'] transition-colors`} 
        dir={lang === 'fa' ? 'rtl' : 'ltr'} 
        style={{ fontFeatureSettings: lang === 'fa' ? '"ss01" 1' : 'normal' }}
      >
        <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center shadow-xl backdrop-blur-xl flex flex-col items-center justify-center">
          <StrandsLoader variant="page" message={txt.loading} />
        </div>
      </div>
    );
  }

  const feedbacks: ClientFeedback[] = isPreview ? project?.clientFeedbacks || [] : portalData?.feedback || project?.clientFeedbacks || [];

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !project) return;

    if(isPreview) return;
    const operation=publicScope.current;const current=()=>operation===publicScope.current&&!operation.controller.signal.aborted;
    setIsSubmitting(true);setPortalError('');
    try {
      await apiFetch('/api/public/portal/'+encodeURIComponent(queryToken)+'/feedback',{method:'POST',signal:operation.controller.signal,body:JSON.stringify({senderName:senderName.trim(),category,content:message.trim(),attachments:pendingAttachments.map(file=>file.id)})});
      const refreshed=await apiFetch('/api/public/portal/'+encodeURIComponent(queryToken),{signal:operation.controller.signal});const data=await refreshed.json();if(!current())return;setPortalData(data);
      setMessage('');setPendingAttachments([]);setSubmitSuccess(true);setTimeout(()=>{if(current())setSubmitSuccess(false);},4000);
    } catch(error) {if(current())setPortalError(error instanceof Error ? error.message : 'ارسال انجام نشد.');}
    finally {if(current())setIsSubmitting(false);}
  };

  const isPortalDisabled = project ? (project.clientPortalEnabled === false || project.isPortalActive === false) : false;

  if (!project) {
    return (
      <div 
        className={`${theme === 'dark' ? 'dark' : ''} min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex items-center justify-center p-4 font-['Vazirmatn'] transition-colors`} 
        dir={lang === 'fa' ? 'rtl' : 'ltr'} 
        style={{ fontFeatureSettings: lang === 'fa' ? '"ss01" 1' : 'normal' }}
      >
        <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center space-y-4 shadow-xl backdrop-blur-xl">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center mx-auto">
            <AlertTriangle size={32} />
          </div>
          <h2 className="text-lg font-black text-slate-900 dark:text-white">{txt.notFoundTitle}</h2>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-bold">
            {portalError || txt.notFoundDesc}
          </p>
        </div>
      </div>
    );
  }

  if (isPortalDisabled && !isPreview) {
    return (
      <div 
        className={`${theme === 'dark' ? 'dark' : ''} min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex items-center justify-center p-4 font-['Vazirmatn'] transition-colors`} 
        dir={lang === 'fa' ? 'rtl' : 'ltr'}
      >
        <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-rose-500/30 rounded-3xl p-8 text-center space-y-4 shadow-xl backdrop-blur-xl">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center mx-auto">
            <Lock size={32} />
          </div>
          <h2 className="text-lg font-black text-slate-900 dark:text-white">{txt.disabledTitle}</h2>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-bold">
            {txt.disabledDesc}
          </p>
        </div>
      </div>
    );
  }

  const projectTasks = tasks.filter(t => t.projectId === project.id);
  const projectFiles = isPreview ? files.filter((file:any)=>file.projectId===project.id&&file.clientVisible===true&&file.approved===true) : files;

  return (
    <div 
      className={`${theme === 'dark' ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'} min-h-screen font-['Vazirmatn'] flex flex-col selection:bg-blue-600 selection:text-white transition-colors duration-200`}
      dir={lang === 'fa' ? 'rtl' : 'ltr'}
      style={{ fontFeatureSettings: lang === 'fa' ? '"ss01" 1' : 'normal' }}
    >
      
      {/* PREVIEW BANNER IF IN ADMIN PREVIEW MODE */}
      {previewAsset&&<AssetImagePreview asset={previewAsset} portalToken={isPreview?undefined:queryToken} onClose={()=>setPreviewAsset(null)}/>}
      {isPreview && (
        <div className="bg-blue-600 text-white text-xs font-bold py-2.5 px-4 flex items-center justify-between sticky top-0 z-50 shadow-md">
          <div className="flex items-center gap-2">
            <Eye size={16} />
            <span>{txt.previewBanner}</span>
          </div>
          {onClosePreview && (
            <button 
              onClick={onClosePreview}
              className="bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1 min-h-[36px]"
            >
              <span>{txt.exitPreview}</span>
              <ArrowLeft size={14} />
            </button>
          )}
        </div>
      )}

      {/* HEADER BAR */}
      <header className="border-b border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl sticky top-0 z-40 transition-colors">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
          
          {/* BRAND & PROJECT TITLE */}
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-blue-700 text-white flex items-center justify-center shadow-md shadow-blue-600/20 font-black text-base shrink-0">
              <Building2 size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/50 px-2.5 py-0.5 rounded-full">
                  {txt.portalTag}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">{project.clientName}</span>
              </div>
              <h1 className="text-base font-black text-slate-900 dark:text-white truncate max-w-xs sm:max-w-md">{project.title}</h1>
            </div>
          </div>

          {/* RIGHT ACTION CONTROLS & METRIC */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            
            {/* LANGUAGE SWITCHER BUTTON: a preview follows the workspace language */}
            {!isPreview && <button
              type="button"
              onClick={toggleLang}
              className="px-3 py-2.5 min-h-[44px] rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 transition-all cursor-pointer flex items-center gap-1.5 font-bold text-xs shadow-2xs"
              title={lang === 'fa' ? 'تغییر زبان' : 'Switch language'}
            >
              <Languages size={16} className="text-blue-600 dark:text-blue-400" />
              <span data-no-translate lang={lang === 'fa' ? 'en' : 'fa'}>{lang === 'fa' ? 'EN' : 'فا'}</span>
            </button>}

            {/* RETURN TO ADMIN: only for a signed-in team member, never for the client */}
            {(isPreview ? !onClosePreview : privateContext.isAuthenticated) && (
              <button
                type="button"
                onClick={handleReturnToAdmin}
                className="px-3.5 py-2.5 min-h-[44px] bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-200 rounded-2xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs shrink-0"
                title={txt.returnAdmin}
              >
                <ArrowLeft size={14} />
                <span className="hidden sm:inline">{txt.returnAdmin}</span>
              </button>
            )}

            {/* PROGRESS METRIC (DESKTOP) */}
            <div className="hidden md:flex items-center gap-3 bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 px-4 py-2 rounded-2xl shrink-0">
              <div className="text-start">
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">{txt.progress}</p>
                <p className="text-xs font-black text-emerald-600 dark:text-emerald-400">{formatNum(project.progress)}٪</p>
              </div>
              <div className="w-24 bg-slate-200 dark:bg-slate-700/60 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-700" 
                  style={{ width: `${project.progress}%` }}
                />
              </div>
            </div>

          </div>

        </div>

        {/* DESKTOP TAB NAVIGATION */}
        <div className="hidden lg:flex max-w-6xl mx-auto px-4 sm:px-6 items-center gap-2 pt-2 pb-0 overflow-x-auto">
          <button
            onClick={() => setActiveTab('roadmap')}
            className={`px-4 py-3 text-xs font-black border-b-2 transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'roadmap'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-950/40 rounded-t-xl'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/40 rounded-t-xl'
            }`}
          >
            <Rocket size={15} />
            <span>{txt.roadmapTab}</span>
          </button>

          <button
            onClick={() => setActiveTab('files')}
            className={`px-4 py-3 text-xs font-black border-b-2 transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'files'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-950/40 rounded-t-xl'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/40 rounded-t-xl'
            }`}
          >
            <FileText size={15} />
            <span>{txt.filesTab} ({formatNum(projectFiles.length)})</span>
          </button>

          <button
            onClick={() => setActiveTab('feedback')}
            className={`px-4 py-3 text-xs font-black border-b-2 transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeTab === 'feedback'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-950/40 rounded-t-xl'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/40 rounded-t-xl'
            }`}
          >
            <MessageSquare size={15} />
            <span>{txt.feedbackTab} ({formatNum(feedbacks.length)})</span>
          </button>
        </div>
      </header>

      {/* MOBILE PROGRESS CARD (Visible on Mobile) */}
      <div className="md:hidden max-w-6xl mx-auto px-4 pt-4 w-full">
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-3.5 flex items-center justify-between shadow-xs">
          <div>
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">{txt.progress}</span>
            <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">{formatNum(project.progress)}٪</span>
          </div>
          <div className="w-36 bg-slate-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
            <div 
              className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-700" 
              style={{ width: `${project.progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* MAIN BODY CONTENT */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 pb-24 lg:pb-8 space-y-6">{portalError&&<p role="alert" className="text-red-600">{portalError}</p>}

        {/* ================================================================== */}
        {/* TAB 1: ROADMAP & PROGRESS                                          */}
        {/* ================================================================== */}
        {activeTab === 'roadmap' && (
          <div className="space-y-6">
            
            {/* PROJECT OVERVIEW CARD */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xs dark:shadow-xl space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
                <div className="space-y-1">
                  <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <Sparkles size={18} className="text-blue-600 dark:text-blue-400" />
                    <span>{txt.objectivesTitle}</span>
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed max-w-3xl">{project.description}</p>
                </div>

                <div className="flex items-center gap-3 shrink-0 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-700/50">
                  <div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-bold">{txt.deadline}</span>
                    <span className="text-xs font-black text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-0.5">
                      <Calendar size={13} />
                      {formatJalaliDate(project.deadline) || '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* STATS METRICS GRID */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 p-3.5 rounded-2xl">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block">{txt.totalTasks}</span>
                  <span className="text-sm font-black text-slate-900 dark:text-slate-100 mt-1 block">{formatNum(project.totalTasks)} {txt.tasksSuffix}</span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 p-3.5 rounded-2xl">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block">{txt.completedTasks}</span>
                  <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 mt-1 block">{formatNum(project.completedTasks)} {txt.tasksSuffix}</span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 p-3.5 rounded-2xl">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block">{txt.startDate}</span>
                  <span className="text-sm font-black text-slate-900 dark:text-slate-100 mt-1 block">{formatJalaliDate(project.startDate) || '—'}</span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 p-3.5 rounded-2xl">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block">{txt.activeStatus}</span>
                  <span className="text-xs font-black text-blue-600 dark:text-blue-400 mt-1 block">{txt.activeLabel}</span>
                </div>
              </div>
            </div>

            {/* MILESTONE TASKS TIMELINE */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xs dark:shadow-xl space-y-4">
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <Rocket size={18} className="text-emerald-600 dark:text-emerald-400" />
                <span>{txt.milestonesTitle}</span>
              </h3>

              {projectTasks.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-8">{txt.noTasks}</p>
              ) : (
                <div className="space-y-3">
                  {projectTasks.map((t, index) => {
                    const isCompleted = t.status === 'completed';
                    const isInProgress = t.status === 'inprogress';

                    return (
                      <div 
                        key={t.id}
                        className={`p-4 rounded-2xl border transition-all space-y-2 ${
                          isCompleted
                            ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40'
                            : isInProgress
                            ? 'bg-blue-50/60 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/40'
                            : 'bg-slate-50 dark:bg-slate-800/30 border-slate-200/80 dark:border-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-3">
                            <span className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                              isCompleted
                                ? 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-slate-950'
                                : isInProgress
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700'
                            }`}>
                              {formatNum(index + 1)}
                            </span>
                            <div>
                              <h4 className="text-xs font-black text-slate-900 dark:text-slate-100">{t.title}</h4>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{t.description}</p>
                            </div>
                          </div>

                          <span className={`px-2.5 py-1 text-[10px] font-black rounded-full flex items-center gap-1 shrink-0 ${
                            isCompleted
                              ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/20'
                              : isInProgress
                              ? 'bg-blue-100 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-500/20'
                              : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                          }`}>
                            {isCompleted ? (
                              <>
                                <CheckCircle2 size={13} />
                                <span>{txt.completed}</span>
                              </>
                            ) : isInProgress ? (
                              <>
                                <Clock size={13} />
                                <span>{txt.inProgress}</span>
                              </>
                            ) : (
                              <span>{txt.pending}</span>
                            )}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        )}

        {/* ================================================================== */}
        {/* TAB 2: DELIVERABLES & SHARED FILES                                 */}
        {/* ================================================================== */}
        {activeTab === 'files' && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xs dark:shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <FileText size={18} className="text-blue-600 dark:text-blue-400" />
                  <span>{txt.deliverablesTitle}</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{txt.deliverablesSub}</p>
              </div>
            </div>

            {projectFiles.length === 0 ? (
              <div className="text-center py-12 space-y-2">
                <FileText size={32} className="mx-auto text-slate-400 dark:text-slate-600" />
                <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">{txt.noFiles}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {projectFiles.map((file) => (
                  <div 
                    key={file.id}
                    className="p-4 bg-slate-50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800/80 border border-slate-200/80 dark:border-slate-800 rounded-2xl flex items-center justify-between gap-3 transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs shrink-0">
                        {file.category === 'client_brief' ? 'PDF' : file.category === 'design' ? 'FIG' : 'DOC'}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-slate-200 truncate">{file.name}</h4>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                          <span>{file.formattedSize || file.size}</span>
                          <span>•</span>
                          <span>{formatJalaliDate(file.uploadDate) || formatNum(file.uploadDate)}</span>
                        </p>
                      </div>
                    </div>

                    <button
                      type="button" disabled={file.contentAvailable===false}
                      onClick={()=>{void downloadAsset(file,undefined,isPreview?undefined:queryToken,publicScope.current.controller.signal).catch(error=>setPortalError(error.message));}}
                      className="p-2.5 min-h-[44px] min-w-[44px] bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all cursor-pointer shrink-0 flex items-center justify-center"
                      title={txt.download}
                    >
                      <Download size={16} />
                    </button>
                    {canPreviewAsset(file)&&<button type="button" onClick={()=>setPreviewAsset(file)} className="text-xs text-blue-600">پیش‌نمایش تصویر</button>}{!!file.versionHistory?.length&&<details className="text-xs"><summary>نسخه‌ها</summary>{file.versionHistory.map((version:any)=><button key={version.id} type="button" disabled={version.contentAvailable===false} className="block p-2 text-blue-600" onClick={()=>{void downloadAsset({...file,name:version.name||file.name,contentAvailable:version.contentAvailable},version.id,isPreview?undefined:queryToken,publicScope.current.controller.signal).catch(error=>setPortalError(error.message));}}>نسخه {version.version} — {version.size}</button>)}</details>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ================================================================== */}
        {/* TAB 3: SUBMIT & TRACK FEEDBACK                                     */}
        {/* ================================================================== */}
        {activeTab === 'feedback' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* FORM TO SUBMIT NEW FEEDBACK (LG: COL-SPAN-5) */}
            <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xs dark:shadow-xl space-y-4">
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <Send size={18} className="text-blue-600 dark:text-blue-400" />
                <span>{txt.submitFeedbackTitle}</span>
              </h3>

              
                  {submitSuccess && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-700/60 rounded-2xl text-xs text-emerald-800 dark:text-emerald-300 font-bold flex items-center gap-2 animate-fadeIn">
                  <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>{txt.submitSuccess}</span>
                </div>
              )}

              <form onSubmit={handleFormSubmit} className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <label className="text-slate-700 dark:text-slate-300 font-bold block">{txt.senderName}</label>
                  <input
                    type="text"
                    required
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    placeholder={txt.senderPlaceholder}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[44px]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-700 dark:text-slate-300 font-bold block">{txt.category}</label>
                  <CustomSelect
                    options={[
                      { value: 'design', label: txt.catDesign },
                      { value: 'technical', label: txt.catTechnical },
                      { value: 'content', label: txt.catContent },
                      { value: 'general', label: txt.catGeneral },
                    ]}
                    value={category}
                    onChange={(val: any) => setCategory(val)}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-slate-700 dark:text-slate-300 font-bold block">{txt.feedbackMsg}</label>
                  <textarea
                    required
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={txt.feedbackPlaceholder}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 leading-relaxed"
                  />
                </div>

                <div className="space-y-2">
                  <span className="block text-xs font-bold text-slate-700 dark:text-slate-300">پیوست بازخورد</span>
                  <label className={`flex items-center justify-center gap-2 w-full min-h-[44px] rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 transition-colors ${isPreview||isSubmitting||attachmentBusy?'opacity-60 cursor-not-allowed':'cursor-pointer hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400'}`}>
                    <Paperclip size={14} className="shrink-0" />
                    <span>{attachmentBusy?'در حال بارگذاری…':'انتخاب فایل'}</span>
                    <input aria-label="پیوست بازخورد" type="file" className="sr-only" disabled={isPreview||isSubmitting||attachmentBusy} onChange={async event=>{const element=event.target,file=element.files?.[0];if(!file)return;const operation=publicScope.current;const current=()=>operation===publicScope.current&&!operation.controller.signal.aborted;setAttachmentBusy(true);setPortalError('');try{const saved=await uploadAsset(file,{name:file.name},undefined,queryToken,operation.controller.signal);if(current()){setPendingAttachments(previous=>[...previous,saved]);element.value='';}}catch(error){if(current())setPortalError(error instanceof Error?error.message:'پیوست ذخیره نشد.');}finally{if(current())setAttachmentBusy(false);}}}/>
                  </label>
                  {pendingAttachments.map(file=>(
                    <div key={file.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs">
                      <span className="flex items-center gap-1.5 min-w-0 text-slate-700 dark:text-slate-200"><FileText size={13} className="shrink-0 text-blue-500" /><span className="truncate">{file.name}</span></span>
                      <button type="button" onClick={()=>setPendingAttachments(previous=>previous.filter(item=>item.id!==file.id))} className="shrink-0 font-bold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer">حذف از بازخورد</button>
                    </div>
                  ))}
                </div>
                <button
                  type="submit"
                  disabled={isPreview || attachmentBusy || isSubmitting || !message.trim() || !senderName.trim()}
                  className="w-full py-3 min-h-[44px] bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-black rounded-xl transition-all shadow-md shadow-blue-600/20 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Send size={15} />
                  <span>{isSubmitting ? txt.submitting : txt.submitBtn}</span>
                </button>
              </form>
            </div>

            {/* FEEDBACK TRACKING LIST (LG: COL-SPAN-7) */}
            <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-xs dark:shadow-xl space-y-4">
              <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                <MessageSquare size={18} className="text-emerald-600 dark:text-emerald-400" />
                <span>{txt.feedbackHistoryTitle}</span>
              </h3>

              {feedbacks.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-12">{txt.noFeedback}</p>
              ) : (
                <div className="space-y-3 max-h-[480px] overflow-y-auto ps-1">
                  {feedbacks.map((fb) => (
                    <div 
                      key={fb.id}
                      className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 rounded-2xl space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-900 dark:text-slate-200">{fb.senderName}</span>
                          <span className="px-2 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] rounded-md font-bold">
                            {fb.category === 'design' ? txt.catDesign.split(' ')[0] : fb.category === 'technical' ? txt.catTechnical.split(' ')[0] : fb.category === 'content' ? txt.catContent.split(' ')[0] : txt.catGeneral.split(' ')[0]}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">{formatJalaliDateTime(fb.createdAt) || formatNum(fb.createdAt)}</span>
                      </div>

                      <p className="text-slate-700 dark:text-slate-300 font-bold leading-relaxed">{fb.message}</p>

                      {(fb.replies||[]).map((reply:any)=><p key={reply.id} className="text-xs text-blue-600">{reply.createdAt} — {reply.message}</p>)}{(fb.attachments||[]).map((attachment:any)=>{const id=typeof attachment==='string'?attachment:attachment.id;const asset=projectFiles.find((file:any)=>file.id===id);return asset?<button type="button" key={id} className="text-xs text-blue-600" onClick={()=>{void downloadAsset(asset,undefined,isPreview?undefined:queryToken,publicScope.current.controller.signal).catch(error=>setPortalError(error.message));}}>پیوست: {asset.name}</button>:<p key={id} className="text-xs text-slate-500">پیوست در انتظار تأیید برای دانلود</p>;})}{(fb.history||[]).map((entry:any,index:number)=><p key={entry.id||index} className="text-xs">{entry.createdAt} — {feedbackEventText(entry,lang)}</p>)}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-200/80 dark:border-slate-800/80">
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">{txt.agencyReply}</span>
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black flex items-center gap-1 ${
                          fb.status === 'resolved'
                            ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30'
                            : fb.status === 'in_progress'
                            ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-500/30'
                            : 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30'
                        }`}>
                          {fb.status === 'resolved' ? (
                            <span>{txt.statusResolved}</span>
                          ) : fb.status === 'in_progress' ? (
                            <span>{txt.statusInProgress}</span>
                          ) : (
                            <span>{fb.status==='approved'?(lang==='fa'?'تأیید شده':'Approved'):fb.status==='rejected'?(lang==='fa'?'رد شده':'Rejected'):txt.statusPending}</span>
                          )}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

      </main>

      {/* MOBILE STICKY BOTTOM NAVIGATION BAR */}
      <div className="lg:hidden fixed bottom-0 end-0 start-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t border-slate-200/90 dark:border-slate-800 px-3 py-2 flex items-center justify-around shadow-2xl transition-colors">
        <button
          type="button"
          onClick={() => setActiveTab('roadmap')}
          className={`flex-1 flex flex-col items-center justify-center py-2 px-1 min-h-[44px] rounded-xl transition-all cursor-pointer ${
            activeTab === 'roadmap'
              ? 'text-blue-600 dark:text-blue-400 font-black bg-blue-50 dark:bg-blue-950/60'
              : 'text-slate-500 dark:text-slate-400 font-bold hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Rocket size={18} />
          <span className="text-[10px] mt-1 truncate">{txt.roadmapTab.split(' ')[0]}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('files')}
          className={`flex-1 flex flex-col items-center justify-center py-2 px-1 min-h-[44px] rounded-xl transition-all cursor-pointer relative ${
            activeTab === 'files'
              ? 'text-blue-600 dark:text-blue-400 font-black bg-blue-50 dark:bg-blue-950/60'
              : 'text-slate-500 dark:text-slate-400 font-bold hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <FileText size={18} />
          <span className="text-[10px] mt-1 truncate">{txt.filesTab.split(' ')[0]} ({formatNum(projectFiles.length)})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('feedback')}
          className={`flex-1 flex flex-col items-center justify-center py-2 px-1 min-h-[44px] rounded-xl transition-all cursor-pointer relative ${
            activeTab === 'feedback'
              ? 'text-blue-600 dark:text-blue-400 font-black bg-blue-50 dark:bg-blue-950/60'
              : 'text-slate-500 dark:text-slate-400 font-bold hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <MessageSquare size={18} />
          <span className="text-[10px] mt-1 truncate">{txt.feedbackTab.split(' ')[0]} ({formatNum(feedbacks.length)})</span>
        </button>
      </div>

      {/* FOOTER BRANDING */}
      <footer className="border-t border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-950 py-4 text-center text-[11px] text-slate-500 dark:text-slate-400 font-bold transition-colors">
        <span>{txt.footer}</span>
      </footer>

    </div>
  );
};

export default PublicClientPortal;


