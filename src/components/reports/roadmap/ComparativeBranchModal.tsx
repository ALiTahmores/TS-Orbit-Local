import React from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  GitBranch, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRightLeft, 
  Clock, 
  DollarSign, 
  Zap, 
  ShieldCheck, 
  Cpu, 
  Sparkles,
  Info,
  Check
} from 'lucide-react';
import { RoadmapNode } from './roadmapData';

export interface ComparativeBranchModalProps {
  isOpen: boolean;
  onClose: () => void;
  clickedNode: RoadmapNode | null;
  activeBranch: 'wp' | 'custom';
  onSwitchBranch: (newBranch: 'wp' | 'custom') => void;
  projectName?: string;
}

export const ComparativeBranchModal: React.FC<ComparativeBranchModalProps> = ({
  isOpen,
  onClose,
  clickedNode,
  activeBranch,
  onSwitchBranch,
  projectName = 'پروژه فعال'
}) => {
  if (!isOpen || !clickedNode || typeof document === 'undefined') return null;

  const targetBranch: 'wp' | 'custom' = clickedNode.branch === 'custom' ? 'custom' : 'wp';
  const isTargetCustom = targetBranch === 'custom';

  // Architectural Comparison Profiles
  const comparisons = [
    {
      metric: 'زمان تحویل و سرعت پیاده‌سازی (Time-to-Market)',
      wp: '۳ الی ۵ هفته (بسیار سریع با بهره‌گیری از هسته آماده و قالب بهینه)',
      custom: '۸ الی ۱۲ هفته (نیازمند طراحی صفر تا صد API، فرانت‌اند و ساختار داده)',
      winner: 'wp',
      icon: Clock
    },
    {
      metric: 'هزینه سرمایه‌گذاری اولیه و نگهداری (Budget & TCO)',
      wp: 'اقتصادی و بهینه؛ هزینه نگهداری پایین با امکان مدیریت توسط ادمین بدون دانش کدنویسی',
      custom: 'سرمایه‌گذاری بالاتر؛ نیازمند تیم فنی پشتیبان، سرور اختصاصی و توسعه مستمر',
      winner: 'wp',
      icon: DollarSign
    },
    {
      metric: 'انعطاف‌پذیری در منطق پیچیده تجاری (Business Logic)',
      wp: 'مناسب برای ساختار استاندارد فروشگاهی، شرکتی و وبلاگ؛ محدودیت در سناریوهای غیرمعمول',
      custom: '۱۰۰٪ آزادی عمل بدون هیچ‌گونه محدودیت در میکروسرویس‌ها، منطق مالی و الگوریتم‌ها',
      winner: 'custom',
      icon: Zap
    },
    {
      metric: 'مقیاس‌پذیری زیر بار ترافیک سنگین (High Concurrency)',
      wp: 'پاسخگو تا ده‌ها هزار بازدیدکننده با کشینگ لایت‌اسپید/ردیس؛ نیازمند بهینه‌سازی دقیق دیتابیس',
      custom: 'معماری توزیع‌شده و مقیاس‌پذیری نامحدود افقی (Horizontal Scaling) در کلاود',
      winner: 'custom',
      icon: Cpu
    },
    {
      metric: 'امنیت و استقلال زیرساخت (Security & Independence)',
      wp: 'وابستگی به امنیت پلاگین‌ها؛ نیازمند آپدیت مداوم هسته و فایروال قوی WAF',
      custom: 'کد کاملاً ایزوله، احراز هویت کنترل‌شده و عدم وجود اکسپلویت‌های عمومی افزونه‌ها',
      winner: 'custom',
      icon: ShieldCheck
    }
  ];

  return createPortal(
    <div 
      className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-6 overflow-y-auto font-vazirmatn"
      dir="rtl"
    >
      {/* 1. Backdrop */}
      <div 
        onClick={onClose} 
        className="fixed inset-0 z-0 bg-black/60 dark:bg-black/80 backdrop-blur-md transition-opacity animate-in fade-in cursor-pointer" 
      />

      {/* 2. Modal Body */}
      <div className="relative z-10 w-full max-w-2xl bg-slate-900/95 border border-slate-700/90 rounded-3xl shadow-2xl overflow-hidden flex flex-col text-right animate-in zoom-in-95 duration-200 backdrop-blur-xl">
        
        {/* Header Ribbon */}
        <div className="p-5 sm:p-6 border-b border-slate-800 flex items-start justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/10">
              <GitBranch size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  شاخه مقایسه‌ای / خاموش
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {clickedNode.phaseNumber}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-white mt-1">
                تحلیل معماری: چرا این مسیر انتخاب نشد؟
              </h2>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer"
            title="بستن پنجره"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Scrollable */}
        <div className="p-5 sm:p-6 space-y-6 max-h-[70vh] overflow-y-auto scrollbar-thin">
          
          {/* Target Node Focus Box */}
          <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/80 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Info size={14} className="text-blue-400" />
                <span>نود انتخابی شما در این شاخه:</span>
              </span>
              <span className="text-xs font-mono font-bold text-cyan-400">
                {clickedNode.teamLead}
              </span>
            </div>
            <h3 className="text-sm font-black text-white">
              {clickedNode.title}
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              {clickedNode.description}
            </p>
          </div>

          {/* Trade-off Explanation Statement */}
          <div className="p-4 rounded-2xl bg-blue-950/30 border border-blue-800/40 text-xs leading-relaxed text-slate-300 space-y-1.5">
            <div className="flex items-center gap-2 font-black text-blue-300">
              <Sparkles size={15} />
              <span>منطق تصمیم‌گیری تیم فنی در فاز ۰۲:</span>
            </div>
            <p>
              {activeBranch === 'wp' ? (
                <>
                  در پروژه <strong className="text-white">«{projectName}»</strong>، به دلیل اولویت کارفرما در <strong className="text-emerald-400">زمان تحویل سریع، هزینه نگهداری اقتصادی و مدیریت آسان محتوا</strong>، پایپ‌لاین هسته بهینه‌سازی‌شده وردپرس انتخاب شده است. شاخه کدنویسی اختصاصی فول‌استک جهت مقایسه فنی، شفافیت تصمیم‌گیری و ارزیابی توسعه‌های آتی در دسترس نگهداری شده است.
                </>
              ) : (
                <>
                  در پروژه <strong className="text-white">«{projectName}»</strong>، به دلیل نیازمندی به <strong className="text-cyan-400">انعطاف‌پذیری حداکثری، پردازش با تاخیر کم و معماری مستقل دیتابیس</strong>، پایپ‌لاین توسعه اختصاصی (Full-Stack) به عنوان مسیر فعال انتخاب شده است.
                </>
              )}
            </p>
          </div>

          {/* Comparative Metrics Grid */}
          <div className="space-y-3">
            <h4 className="text-xs font-black text-slate-300 flex items-center gap-2">
              <ArrowRightLeft size={14} className="text-amber-400" />
              <span>ماتریس مقایسه ابعاد فنی و تجاری دو رویکرد:</span>
            </h4>

            <div className="grid grid-cols-1 gap-2.5">
              {comparisons.map((item, idx) => {
                const IconComp = item.icon;
                return (
                  <div 
                    key={idx}
                    className="p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition-colors flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-bold text-white">
                        <IconComp size={14} className="text-slate-400" />
                        <span>{item.metric}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-800/80">
                      {/* WordPress Pipeline */}
                      <div className={`p-2.5 rounded-xl border ${
                        activeBranch === 'wp' 
                          ? 'bg-blue-500/10 border-blue-500/30 text-slate-200' 
                          : 'bg-slate-900/50 border-slate-800 text-slate-400'
                      }`}>
                        <div className="flex items-center justify-between font-bold text-slate-300 mb-1">
                          <span>شاخه وردپرس</span>
                          {activeBranch === 'wp' && (
                            <span className="text-[9px] text-blue-400 font-bold px-1.5 py-0.2 rounded bg-blue-500/20">فعال</span>
                          )}
                        </div>
                        <p className="leading-snug">{item.wp}</p>
                      </div>

                      {/* Custom Code Pipeline */}
                      <div className={`p-2.5 rounded-xl border ${
                        activeBranch === 'custom' 
                          ? 'bg-blue-500/10 border-blue-500/30 text-slate-200' 
                          : 'bg-slate-900/50 border-slate-800 text-slate-400'
                      }`}>
                        <div className="flex items-center justify-between font-bold text-slate-300 mb-1">
                          <span>توسعه اختصاصی</span>
                          {activeBranch === 'custom' && (
                            <span className="text-[9px] text-cyan-400 font-bold px-1.5 py-0.2 rounded bg-cyan-500/20">فعال</span>
                          )}
                        </div>
                        <p className="leading-snug">{item.custom}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Footer Action */}
        <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950/80 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <AlertCircle size={14} className="text-amber-400 shrink-0" />
            <span>تغییر معماری موجب تغییر مسیر اجرایی و پالس‌های بوم خواهد شد.</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer"
            >
              انصراف
            </button>
            <button
              onClick={() => {
                onSwitchBranch(targetBranch);
                onClose();
              }}
              className="flex-1 sm:flex-none px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 cursor-pointer"
            >
              <ArrowRightLeft size={13} />
              <span>تغییر معماری فعال به {isTargetCustom ? 'کدنویسی اختصاصی' : 'پایپ‌لاین وردپرس'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
};
