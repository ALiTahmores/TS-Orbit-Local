import { LocalImage } from './common/LocalImage';
import React, { useState, useEffect, useCallback } from 'react';
import { TeamMember, Task, Project } from '../types';
import { 
  X, 
  Printer, 
  Award, 
  Briefcase, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Star, 
  Mail, 
  Phone, 
  Globe, 
  Github, 
  Linkedin, 
  FileText, 
  ShieldCheck, 
  Code, 
  Layers, 
  Activity, 
  Download, 
  UserCheck, 
  Key, 
  Lock, 
  Zap, 
  TrendingUp, 
  BarChart2, 
  ChevronRight,
  ExternalLink,
  MessageSquare,
  Check
} from 'lucide-react';

const toPersianDigits = (n: string | number): string => {
  if (n === null || n === undefined) return '';
  const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(n).replace(/[0-9]/g, (x) => farsiDigits[parseInt(x, 10)]);
};

interface MemberProfileModalProps {
  member: TeamMember | null;
  isOpen: boolean;
  onClose: () => void;
  allTasks?: Task[];
  allProjects?: Project[];
}

export const MemberProfileModal: React.FC<MemberProfileModalProps> = ({
  member,
  isOpen,
  onClose,
  allTasks = [],
  allProjects = []
}) => {
  const [activeTab, setActiveTab] = useState<
    'bio' | 'projects' | 'tasks' | 'kpi' | 'skills' | 'timeline' | 'docs' | 'security'
  >('bio');
  const [animateIn, setAnimateIn] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => setAnimateIn(true), 20);
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') handleClose();
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('keydown', handleKeyDown);
      };
    } else {
      setAnimateIn(false);
    }
  }, [isOpen]);

  const handleClose = useCallback(() => {
    setAnimateIn(false);
    setTimeout(() => {
      onClose();
    }, 200);
  }, [onClose]);

  if (!isOpen || !member) return null;

  // Filter tasks & projects for this member
  const memberTasks = allTasks.filter(
    t => t.assignedTo === member.name || t.assignedTo === member.id
  );
  const memberProjects = allProjects.filter(
    p => p.teamLead === member.name || memberTasks.some(t => t.projectId === p.id)
  );

  const completedTasksCount = memberTasks.filter(t => t.status === 'completed' || t.status === 'done').length;
  const taskCompletionPercentage = memberTasks.length > 0 
    ? Math.round((completedTasksCount / memberTasks.length) * 100) 
    : 85;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 overflow-y-auto font-sans" 
      dir="rtl"
    >
      {/* 1. Translucent Gradient Backdrop (Background remains bright, sharp & readable) */}
      <div 
        onClick={handleClose}
        className={`fixed inset-0 z-0 bg-gradient-to-t from-black/[0.18] via-black/[0.06] to-transparent dark:from-black/[0.5] dark:via-black/[0.25] dark:to-transparent backdrop-blur-[1.5px] transition-opacity duration-300 ease-out cursor-pointer ${
          animateIn ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* 2. Modal Card Container with High-Contrast Elevation */}
      <div 
        className={`relative z-10 w-full max-w-7xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-[28px] shadow-[0_25px_70px_-15px_rgba(0,0,0,0.18),0_10px_30px_-10px_rgba(0,0,0,0.08)] dark:shadow-[0_25px_70px_-15px_rgba(0,0,0,0.6)] p-5 md:p-8 my-auto overflow-hidden max-h-[92vh] flex flex-col font-sans cursor-default transition-all duration-300 ease-out transform ${
          animateIn ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-4'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* STICKY MODAL HEADER */}
        <div className="flex items-center justify-between pb-5 mb-6 border-b border-slate-200 dark:border-slate-800/80 shrink-0">
          <div className="flex items-center gap-4">
            <div className="relative">
              <LocalImage 
                src={member.avatar || "/avatars/avatar-5.svg"} 
                alt={member.name}
                className="w-14 h-14 rounded-2xl object-cover ring-2 ring-blue-500/80 shadow-md"
              />
              <span className={`absolute -bottom-1 -left-1 w-4 h-4 rounded-full border-2 border-white dark:border-slate-950 ${
                member.status === 'online' ? 'bg-emerald-500' : 'bg-slate-400'
              }`} />
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-black text-slate-900 dark:text-slate-100">
                  {member.name}
                </h2>
                <span className="px-3 py-1 bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-400 text-xs font-bold rounded-full border border-blue-200 dark:border-blue-800/80">
                  شناسه: usr_{member.id.substring(0, 6)}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-2">
                <span>{member.role || 'مدیر ارشد فنی و متخصص آژانس'}</span>
                <span>•</span>
                <span className="text-blue-600 dark:text-blue-400">{member.department || 'توسعه وب و محتوا'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => window.print()}
              className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-800 transition-all cursor-pointer shadow-2xs"
            >
              <Printer size={15} />
              <span>چاپ رزومه / شناسنامه</span>
            </button>

            <button
              onClick={handleClose}
              className="p-2.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* SCROLLABLE BODY CONTENT */}
        <div className="flex-1 overflow-y-auto space-y-8 pr-1 pl-1 scrollbar-thin">
          
          {/* SECTION A: MODAL HERO ANALYTICS GRID (UPPER SECTION - 6 WIDGETS) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            
            {/* Widget 1: Profile Summary & Radial Gauge */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                <span>شناسنامه فنی</span>
                <Award size={16} className="text-amber-500" />
              </div>
              
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-2xl font-black text-slate-900 dark:text-white">
                    {toPersianDigits(taskCompletionPercentage)}٪
                  </div>
                  <div className="text-[10px] text-slate-400 font-medium">راندمان تکمیل وظایف</div>
                </div>

                {/* Circular Gauge */}
                <div className="relative w-12 h-12 flex items-center justify-center">
                  <svg className="w-12 h-12 transform -rotate-90">
                    <circle cx="24" cy="24" r="18" stroke="currentColor" strokeWidth="4" className="text-slate-100 dark:text-slate-800" fill="transparent" />
                    <circle cx="24" cy="24" r="18" stroke="currentColor" strokeWidth="4" className="text-blue-600" strokeDasharray={113} strokeDashoffset={113 - (113 * taskCompletionPercentage) / 100} strokeLinecap="round" fill="transparent" />
                  </svg>
                  <Star size={12} className="absolute text-amber-500 fill-amber-500" />
                </div>
              </div>
              <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 rounded-lg text-center">
                وضعیت: ممتاز / High Performer
              </div>
            </div>

            {/* Widget 2: Workload & Attendance Chart */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                <span>حضور و مرخصی (Vacation)</span>
                <Clock size={16} className="text-blue-500" />
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-black text-slate-900 dark:text-white">{toPersianDigits(18)}</span>
                <span className="text-xs text-slate-500">روز مانده از مرخصی</span>
              </div>
              <div className="flex items-center gap-1.5 pt-1">
                {[65, 80, 95, 70, 90, 85, 100].map((h, i) => (
                  <div key={i} className="flex-1 bg-slate-100 dark:bg-slate-800 h-8 rounded-md overflow-hidden flex flex-col justify-end">
                    <div className="bg-blue-600 rounded-md transition-all" style={{ height: `${h}%` }} />
                  </div>
                ))}
              </div>
            </div>

            {/* Widget 3: Speedometer Performance Gauge */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                <span>شاخص سرعت (Speedometer)</span>
                <Zap size={16} className="text-amber-500" />
              </div>
              <div className="text-center py-1">
                <div className="text-2xl font-black text-slate-900 dark:text-white">{toPersianDigits(350)}</div>
                <div className="text-[10px] text-emerald-600 font-black">عالی - فوق‌العاده سریع</div>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                <div className="bg-gradient-to-r from-blue-500 to-emerald-500 h-full w-[88%]" />
              </div>
            </div>

            {/* Widget 4: Live Shift & Check-In Widget */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                <span>تایمر شیفت کاری</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              </div>
              <div className="space-y-1">
                <div className="text-[11px] text-slate-500 font-medium">ورود امروز: ۰۷:۳۲ صبح</div>
                <div className="text-lg font-black font-mono text-blue-600 dark:text-blue-400">۰۷:۴۲:۱۵</div>
              </div>
              <span className="inline-block w-full text-center py-1 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold text-[10px] rounded-lg">
                شیفت فعال (حضور کامل)
              </span>
            </div>

            {/* Widget 5: Mini Calendar Deadlines Widget */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                <span>سررسیدهای مرداد</span>
                <Calendar size={16} className="text-indigo-500" />
              </div>
              <div className="grid grid-cols-7 gap-1 text-[9px] text-center font-bold text-slate-400 pt-1">
                <span>ش</span><span>۱ش</span><span>۲ش</span><span>۳ش</span><span>۴ش</span><span>۵ش</span><span>ج</span>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map(day => (
                  <span key={day} className={`p-0.5 rounded ${day === 12 ? 'bg-blue-600 text-white font-black' : day === 8 ? 'bg-amber-500/20 text-amber-600' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}>
                    {toPersianDigits(day)}
                  </span>
                ))}
              </div>
            </div>

            {/* Widget 6: Active Tasks Summary */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                <span>تسک‌های جاری</span>
                <CheckCircle2 size={16} className="text-emerald-500" />
              </div>
              <div className="space-y-1">
                <div className="text-xl font-black text-slate-900 dark:text-white">
                  {toPersianDigits(memberTasks.length || 5)} تسک
                </div>
                <div className="text-[10px] text-slate-500 font-medium">مانده تا تحویل: 7D 24H</div>
              </div>
              <div className="flex items-center gap-2 pt-1 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>۲ تسک در دست بررسی QA</span>
              </div>
            </div>

          </div>

          {/* SECTION B: 8 DEEP-DIVE INTELLIGENCE TABS */}
          <div className="space-y-6">
            
            {/* Tab Bar Navigation */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200 dark:border-slate-800 select-none scrollbar-none">
              {[
                { id: 'bio', label: 'شناسنامه و بیوگرافی', icon: FileText },
                { id: 'projects', label: 'پروژه‌ها و لایه‌ها', icon: Briefcase },
                { id: 'tasks', label: 'تسک‌ها و زمان‌بندی', icon: CheckCircle2 },
                { id: 'kpi', label: 'نمودار راندمان و KPI', icon: TrendingUp },
                { id: 'skills', label: 'مهارت‌ها و تخصص‌ها', icon: Code },
                { id: 'timeline', label: 'خط زمانی فعالیت‌ها', icon: Activity },
                { id: 'docs', label: 'فایل‌ها و مدارک', icon: Download },
                { id: 'security', label: 'امنیتی و دسترسی‌ها', icon: ShieldCheck },
              ].map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
                      isActive 
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' 
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <Icon size={15} />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* TAB CONTENT PANELS */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
              
              {/* TAB 1: Bio & Overview */}
              {activeTab === 'bio' && (
                <div className="space-y-6 text-xs text-slate-700 dark:text-slate-300">
                  <div className="space-y-2">
                    <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                      <FileText size={16} className="text-blue-600" />
                      <span>بیوگرافی و سوابق حرفه‌ای</span>
                    </h3>
                    <p className="leading-relaxed text-slate-600 dark:text-slate-400 font-medium bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800">
                      متخصص ارشد با بیش از ۶ سال سابقه فعالیت تخصصی در پیاده‌سازی و مدیریت پروژه‌های وب سازمانی. دارای مدرک بین‌المللی ارزیابی کارایی، تسلط بر فریم‌ورک‌های مدرن، بهینه‌سازی ساختاری دیتابیس و مدیریت معماری کلاینت-سرور.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                    <div className="space-y-3">
                      <h4 className="font-extrabold text-slate-900 dark:text-white">اطلاعات تماس و لینک‌ها</h4>
                      <div className="space-y-2 font-medium">
                        <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800">
                          <Mail size={16} className="text-blue-500" />
                          <span>ایمیل سازمانی:</span>
                          <span className="font-mono text-slate-900 dark:text-slate-100 font-bold">{member.email || `${member.id}@example.test`}</span>
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800">
                          <Phone size={16} className="text-emerald-500" />
                          <span>تلفن مستقیم:</span>
                          <span className="font-mono text-slate-900 dark:text-slate-100 font-bold">۰۲۱-۸۸۹۹۰۰۱۱</span>
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800">
                          <Globe size={16} className="text-indigo-500" />
                          <span>پورتفولیو / گیت‌هاب:</span>
                          <a href="#" className="text-blue-600 hover:underline font-mono">github.com/{member.id}</a>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h4 className="font-extrabold text-slate-900 dark:text-white">تحصیلات و گواهینامه‌ها</h4>
                      <div className="space-y-2">
                        <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800 space-y-1">
                          <div className="font-extrabold text-slate-900 dark:text-white">کارشناسی ارشد مهندسی نرم‌افزار</div>
                          <div className="text-slate-500">دانشگاه صنعتی شریف • ۱۳۹۸ - ۱۴۰۰</div>
                        </div>
                        <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800 space-y-1">
                          <div className="font-extrabold text-slate-900 dark:text-white">مدرک بین‌المللی Certified Frontend Architect</div>
                          <div className="text-slate-500">صادرشده توسط Frontend Masters • سال ۲۰۲۳</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: Projects History */}
              {activeTab === 'projects' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <Briefcase size={16} className="text-blue-600" />
                    <span>پروژه‌های تحت نظارت و مشارکت</span>
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {memberProjects.length > 0 ? memberProjects.map(proj => (
                      <div key={proj.id} className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-black text-slate-900 dark:text-white text-sm">{proj.title}</span>
                          <span className="px-2.5 py-1 bg-blue-100 text-blue-700 text-[10px] font-extrabold rounded-lg">
                            پیشرفت: {toPersianDigits(proj.progress)}٪
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 line-clamp-2">{proj.description}</p>
                        <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-blue-600 h-full rounded-full" style={{ width: `${proj.progress}%` }} />
                        </div>
                      </div>
                    )) : (
                      [1, 2, 3, 4].map(i => (
                        <div key={i} className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
                          <div className="flex items-center justify-between font-black text-slate-900 dark:text-white">
                            <span>پروژه وب‌سایت شرکتی لایه {toPersianDigits(i)}</span>
                            <span className="text-emerald-600 font-mono text-xs">فعال</span>
                          </div>
                          <div className="text-xs text-slate-500">نقش: توسعه‌دهنده ارشد فرانت‌اند و اتصال APIها</div>
                          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-200/60 dark:border-slate-800">
                            <span>شروع: ۱۴۰۲/۰۴/۱۵</span>
                            <span>تحویل: ۱۴۰۲/۰۸/۳۰</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: Tasks & Deadlines */}
              {activeTab === 'tasks' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-emerald-500" />
                      <span>لیست وظایف و بررسی سررسیدها</span>
                    </h3>
                    <span className="text-xs font-bold text-slate-500">
                      مجموع تسک‌ها: {toPersianDigits(memberTasks.length || 8)}
                    </span>
                  </div>

                  <div className="w-full overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
                    <table className="w-full text-right text-xs min-w-[700px]">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold">
                          <th className="py-3 px-2">عنوان وظیفه</th>
                          <th className="py-3 px-2">اولویت</th>
                          <th className="py-3 px-2">وضعیت</th>
                          <th className="py-3 px-2">سررسید</th>
                          <th className="py-3 px-2">زمان باقی‌مانده</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                        {(memberTasks.length > 0 ? memberTasks : [
                          { id: '1', title: 'بهینه‌سازی سرعت لود صفحه اصلی', priority: 'high', status: 'inprogress', deadline: '۱۴۰۲/۰۶/۱۰' },
                          { id: '2', title: 'طراحی کامپوننت‌های مدرن سیستم', priority: 'critical', status: 'review', deadline: '۱۴۰۲/۰۶/۰۵' },
                          { id: '3', title: 'اتصال هدر هوشمند به سرور', priority: 'medium', status: 'completed', deadline: '۱۴۰۲/۰۵/۲۸' }
                        ]).map((t: any) => (
                          <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-950">
                            <td className="py-3 px-2 font-bold text-slate-900 dark:text-white">{t.title}</td>
                            <td className="py-3 px-2">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                                t.priority === 'critical' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                              }`}>
                                {t.priority === 'critical' ? 'بحرانی' : 'بالا'}
                              </span>
                            </td>
                            <td className="py-3 px-2">
                              <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-700 text-[10px] font-bold">
                                {t.status}
                              </span>
                            </td>
                            <td className="py-3 px-2 font-mono text-slate-500">{t.deadline || '۱۴۰۲/۰۶/۱۲'}</td>
                            <td className="py-3 px-2 font-mono text-emerald-600 font-bold">7D 24H 12S</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 4: Performance KPI */}
              {activeTab === 'kpi' && (
                <div className="space-y-6">
                  <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <BarChart2 size={16} className="text-blue-600" />
                    <span>تحلیل تفکیکی عملکرد و KPI فصلی</span>
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2 text-center">
                      <div className="text-xs text-slate-500 font-bold">امتیاز رضایت کلاینت‌ها</div>
                      <div className="text-3xl font-black text-amber-500">۴.۹ / ۵.۰</div>
                      <div className="text-[10px] text-slate-400">بر اساس ۱۲ نظرسنجی کارفرما</div>
                    </div>
                    <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2 text-center">
                      <div className="text-xs text-slate-500 font-bold">تعهد به تحویل به‌موقع (SLA)</div>
                      <div className="text-3xl font-black text-emerald-600">۹۸٪</div>
                      <div className="text-[10px] text-slate-400">پاسخگویی بسیار سریع</div>
                    </div>
                    <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2 text-center">
                      <div className="text-xs text-slate-500 font-bold">همکاری و روحیه تیمی</div>
                      <div className="text-3xl font-black text-blue-600">۹۵٪</div>
                      <div className="text-[10px] text-slate-400">مشارکت فعال در چت‌ها</div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: Skills Matrix */}
              {activeTab === 'skills' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <Code size={16} className="text-indigo-600" />
                    <span>ماتریس مهارت‌های فنی و سطح تسلط</span>
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { name: 'React.js / Next.js Framework', val: 95 },
                      { name: 'TypeScript & Type Systems', val: 92 },
                      { name: 'Tailwind CSS & Responsive Design', val: 98 },
                      { name: 'Node.js & Express REST APIs', val: 85 },
                      { name: 'UI/UX Prototyping in Figma', val: 90 },
                      { name: 'SEO Technical Audit & Web Vitals', val: 88 }
                    ].map((s, idx) => (
                      <div key={idx} className="p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 rounded-xl space-y-2">
                        <div className="flex items-center justify-between font-extrabold text-xs text-slate-900 dark:text-white">
                          <span>{s.name}</span>
                          <span className="font-mono text-blue-600">{toPersianDigits(s.val)}٪</span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div className="bg-blue-600 h-full rounded-full transition-all" style={{ width: `${s.val}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 6: Activity Timeline */}
              {activeTab === 'timeline' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <Activity size={16} className="text-emerald-500" />
                    <span>خط زمانی فعالیت‌های اخیر (Log)</span>
                  </h3>

                  <div className="space-y-3 relative before:absolute before:top-2 before:bottom-2 before:right-3.5 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800 pr-8">
                    {[
                      { time: 'امروز ۱۰:۴۵', text: 'تغییر وضعیت تسک "بهینه‌سازی لود" به وضعیت Completed' },
                      { time: 'دیروز ۱۶:۲۰', text: 'آپلود فایل جدید طراحی مستندات UI به پروژه شماره ۲' },
                      { time: '۲ روز پیش', text: 'ثبت کامنت فنی در جلسه هماهنگی دپارتمان فرانت‌اند' },
                      { time: '۳ روز پیش', text: 'ثبت درخواست مرخصی ساعتی (تایید شده توسط مدیریت)' }
                    ].map((item, idx) => (
                      <div key={idx} className="relative space-y-0.5">
                        <span className="absolute -right-8 top-1 w-3 h-3 rounded-full bg-blue-600 border-2 border-white dark:border-slate-900" />
                        <div className="font-bold text-slate-900 dark:text-white">{item.text}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{item.time}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 7: Files & Documents */}
              {activeTab === 'docs' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <Download size={16} className="text-blue-600" />
                    <span>فایل‌ها، قراردادها و مدارک پرسنلی</span>
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[
                      { name: 'قرارداد همکاری سال ۱۴۰۲.pdf', size: '2.4 MB', date: '۱۴۰۲/۰۱/۱۵' },
                      { name: 'فرم عدم افشای اطلاعات (NDA).pdf', size: '1.1 MB', date: '۱۴۰۲/۰۱/۱۵' },
                      { name: 'تصویر مدارک شناسایی و کارت ملی.jpg', size: '850 KB', date: '۱۴۰۲/۰۱/۱۰' },
                      { name: 'گواهی دوره‌های تخصصی آموزش آژانس.pdf', size: '4.2 MB', date: '۱۴۰۲/۰۴/۲۰' }
                    ].map((doc, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
                        <div className="flex items-center gap-3">
                          <FileText size={20} className="text-blue-500 shrink-0" />
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white text-xs">{doc.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{doc.size} • {doc.date}</div>
                          </div>
                        </div>
                        <button className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 rounded-lg cursor-pointer">
                          <Download size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 8: Security & Admin Log */}
              {activeTab === 'security' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <ShieldCheck size={16} className="text-rose-500" />
                    <span>پنل نظارت امنیتی و تاریخچه ورود (مدیریت سیستم)</span>
                  </h3>

                  <div className="space-y-3">
                    <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
                      <div className="font-bold text-xs text-slate-900 dark:text-white flex items-center justify-between">
                        <span>آخرین نشست‌های فعال (Active Sessions)</span>
                        <span className="text-emerald-600 text-[10px] font-mono">IP: ثبت نشده</span>
                      </div>
                      <div className="text-xs text-slate-500">مرورگر Chrome روی سیستم عامل Windows 11 • آخرین فعالیت: چند دقیقه پیش</div>
                    </div>

                    <div className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2">
                      <div className="font-bold text-xs text-slate-900 dark:text-white">سطح دسترسی و نقش سازمانی</div>
                      <div className="text-xs text-slate-500">نقش فعلی: Senior Specialist (دسترسی ویرایش وظایف دپارتمان مربوطه و آپلود دارایی‌ها)</div>
                    </div>
                  </div>
                </div>
              )}

            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
