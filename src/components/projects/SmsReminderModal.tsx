import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useProject } from '../../context/ProjectContext';
import { Project } from '../../types';
import { CustomSelect, CustomSelectOption } from '../common/CustomSelect';
import { WheelTimePicker } from '../common/WheelTimePicker';
import { 
  X, 
  Check, 
  Bell, 
  MessageSquare, 
  Phone, 
  Calendar, 
  Clock, 
  AlertTriangle, 
  ShieldCheck, 
  Sparkles 
} from 'lucide-react';

interface SmsReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project | null;
  onSaveSuccess: (reminderData: {
    projectId: string;
    schedule: string;
    customDateTime?: string;
    mobileNumber: string;
    sendSms: boolean;
    sendPanelAlert: boolean;
    customNote: string;
  }) => void;
}

const toPersianDigits = (n: string | number): string => {
  if (n === null || n === undefined) return '';
  const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(n).replace(/[0-9]/g, (x) => farsiDigits[parseInt(x, 10)]);
};

const PERSIAN_MONTHS = [
  { id: '01', name: 'فروردین' },
  { id: '02', name: 'اردیبهشت' },
  { id: '03', name: 'خرداد' },
  { id: '04', name: 'تیر' },
  { id: '05', name: 'مرداد' },
  { id: '06', name: 'شهریور' },
  { id: '07', name: 'مهر' },
  { id: '08', name: 'آبان' },
  { id: '09', name: 'آذر' },
  { id: '10', name: 'دی' },
  { id: '11', name: 'بهمن' },
  { id: '12', name: 'اسفند' },
];

export const SmsReminderModal: React.FC<SmsReminderModalProps> = ({
  isOpen,
  onClose,
  project,
  onSaveSuccess
}) => {
  const { currentUser } = useProject();

  const [schedule, setSchedule] = useState('24h_before');
  const [mobileNumber, setMobileNumber] = useState('');
  const [sendSms, setSendSms] = useState(true);
  const [sendPanelAlert, setSendPanelAlert] = useState(true);
  const [customNote, setCustomNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Custom Jalali Date & Time Picker State
  const [customYear, setCustomYear] = useState('1405');
  const [customMonth, setCustomMonth] = useState('05');
  const [customDay, setCustomDay] = useState('15');
  const [customTime, setCustomTime] = useState('10:00');

  const scheduleOptions: CustomSelectOption[] = [
    { value: '24h_before', label: '۲۴ ساعت قبل از رسیدن ددلاین (پیش‌فرض)' },
    { value: '48h_before', label: '۴۸ ساعت قبل از رسیدن ددلاین' },
    { value: '1w_before', label: '۱ هفته قبل از رسیدن ددلاین' },
    { value: '2h_before', label: '۲ ساعت قبل از ددلاین (هشدار فوری)' },
    { value: 'custom', label: 'تاریخ و ساعت سفارشی (انتخاب دستی)' },
  ];

  const dayOptions: CustomSelectOption[] = Array.from({ length: 31 }, (_, i) => {
    const d = String(i + 1).padStart(2, '0');
    return { value: d, label: toPersianDigits(d) };
  });

  const monthOptions: CustomSelectOption[] = PERSIAN_MONTHS.map(m => ({
    value: m.id,
    label: m.name
  }));

  const yearOptions: CustomSelectOption[] = [
    { value: '1405', label: '۱۴۰۵' },
    { value: '1406', label: '۱۴۰۶' },
  ];

  useEffect(() => {
    if (isOpen) {
      setSchedule('24h_before');
      // Requirement 7: Auto-fill logged-in user registered phone number
      const userPhone = currentUser?.phone || currentUser?.mobile || currentUser?.phoneNumber || '۰۹۱۲۳۴۵۶۷۸۹';
      setMobileNumber(userPhone);
      setSendSms(true);
      setSendPanelAlert(true);
      setCustomNote('');
      setCustomYear('1405');
      setCustomMonth('05');
      setCustomDay('15');
      setCustomTime('10:00');
    }
  }, [isOpen, currentUser]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;
    setIsSubmitting(true);

    const formattedCustomDateTime = schedule === 'custom' 
      ? `${customYear}/${customMonth}/${customDay} - ${customTime}` 
      : undefined;

    setTimeout(() => {
      onSaveSuccess({
        projectId: project.id,
        schedule,
        customDateTime: formattedCustomDateTime,
        mobileNumber,
        sendSms,
        sendPanelAlert,
        customNote
      });
      setIsSubmitting(false);
      onClose();
    }, 300);
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !project) return null;

  return createPortal(
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto dir-rtl font-sans" 
      dir="rtl" 
      style={{ fontFeatureSettings: '"ss01" 1' }}
    >
      {/* 1. Translucent Gradient Backdrop (Background remains bright, sharp & readable) */}
      <div 
        onClick={onClose}
        className="fixed inset-0 z-0 bg-gradient-to-t from-black/[0.18] via-black/[0.06] to-transparent dark:from-black/[0.5] dark:via-black/[0.25] dark:to-transparent backdrop-blur-[1.5px] transition-opacity duration-300 animate-in fade-in cursor-pointer"
      />

      {/* 2. Modal Card Container with High-Contrast Elevation */}
      <div 
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-[28px] p-6 sm:p-7 max-w-xl w-full shadow-[0_25px_70px_-15px_rgba(0,0,0,0.18),0_10px_30px_-10px_rgba(0,0,0,0.08)] dark:shadow-[0_25px_70px_-15px_rgba(0,0,0,0.6)] space-y-5 text-right animate-in fade-in zoom-in-95 duration-200 overflow-y-auto max-h-[90vh] cursor-default"
      >
        
        {/* MODAL HEADER */}
        <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 rounded-2xl border border-emerald-500/20 shrink-0">
              <MessageSquare size={22} className="stroke-[2]" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-800 dark:text-slate-100">
                تنظیم یادآوری SMS و هشدار پنل
              </h3>
              <p className="text-xs font-medium text-slate-400 mt-0.5">
                پایش زمان‌بندی ددلاین، ارسال پیامک خودکار و نوتیفیکیشن فوری
              </p>
            </div>
          </div>

          <button 
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* FORM CONTENT */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Project Summary Banner */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 rounded-2xl space-y-1">
            <div className="flex justify-between items-center text-xs">
              <span className="font-black text-slate-800 dark:text-slate-100">{project.title}</span>
              <span className="text-[10px] px-2.5 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400 font-bold rounded-full">
                کارفرما: {project.clientName}
              </span>
            </div>
            <div className="flex justify-between items-center text-[11px] text-slate-500 dark:text-slate-400 font-bold mt-1">
              <span>ددلاین پروژه:</span>
              <span className="font-mono text-emerald-600 dark:text-emerald-400 font-black">{project.deadline || '۱۴۰۵/۰۵/۲۰'}</span>
            </div>
          </div>

          {/* Schedule selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Clock size={14} className="text-emerald-600" />
              <span>زمان‌بندی ارسال یادآوری *</span>
            </label>
            <CustomSelect
              options={scheduleOptions}
              value={schedule}
              onChange={(val) => setSchedule(val)}
            />
          </div>

          {/* Requirement 6: Custom Date & Time Picker */}
          {schedule === 'custom' && (
            <div className="p-4 bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center gap-2 text-xs font-black text-emerald-800 dark:text-emerald-300">
                <Calendar size={15} />
                <span>تنظیم تاریخ و ساعت سفارشی هشدار</span>
              </div>

              {/* Date Selectors */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 mb-1 block">روز</label>
                  <CustomSelect
                    options={dayOptions}
                    value={customDay}
                    onChange={(val) => setCustomDay(val)}
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 mb-1 block">ماه</label>
                  <CustomSelect
                    options={monthOptions}
                    value={customMonth}
                    onChange={(val) => setCustomMonth(val)}
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 mb-1 block">سال</label>
                  <CustomSelect
                    options={yearOptions}
                    value={customYear}
                    onChange={(val) => setCustomYear(val)}
                  />
                </div>
              </div>

              {/* Time Selector */}
              <div>
                <label className="text-[10px] font-bold text-slate-500 mb-1 block">ساعت دقیق ارسال پیامک</label>
                <WheelTimePicker
                  value={customTime}
                  onChange={(val) => setCustomTime(val)}
                  lang="fa"
                />
              </div>
            </div>
          )}

          {/* Mobile Number - Auto filled from user registered phone number */}
          <div className="space-y-1.5">
            <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Phone size={14} className="text-emerald-600" />
                <span>شماره همراه دریافت‌کننده پیامک *</span>
              </span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                (خودکار از پروفایل کاربر)
              </span>
            </label>
            <input
              type="text"
              value={mobileNumber}
              onChange={(e) => setMobileNumber(e.target.value)}
              placeholder="۰۹۱۲۳۴۵۶۷۸۹"
              className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 p-3 rounded-2xl text-xs font-bold font-mono text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-left transition-all"
              required
            />
          </div>

          {/* Notification Options Toggles */}
          <div className="space-y-2.5 pt-1">
            <label className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <div className="flex items-center gap-2.5">
                <MessageSquare size={16} className="text-emerald-600" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  ارسال پیامک SMS خودکار به شماره همراه
                </span>
              </div>
              <input
                type="checkbox"
                checked={sendSms}
                onChange={(e) => setSendSms(e.target.checked)}
                className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <div className="flex items-center gap-2.5">
                <Bell size={16} className="text-blue-600" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  ثبت هشدار و نوتیفیکیشن فوری در پنل
                </span>
              </div>
              <input
                type="checkbox"
                checked={sendPanelAlert}
                onChange={(e) => setSendPanelAlert(e.target.checked)}
                className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
              />
            </label>
          </div>

          {/* Optional Note */}
          <div className="space-y-1.5">
            <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300">
              متن سفارشی یا یادداشت ضمیمه (اختیاری)
            </label>
            <input
              type="text"
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              placeholder="مثال: تحویل نهایی فاز ۱ به کارفرما"
              className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 p-3 rounded-2xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all placeholder:text-slate-400"
            />
          </div>

          {/* SUBMIT BUTTON */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-2xl font-black text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 cursor-pointer disabled:opacity-50 mt-3"
          >
            <ShieldCheck size={18} />
            <span>{isSubmitting ? 'در حال فعال‌سازی...' : 'تایید و فعال‌سازی یادآوری'}</span>
          </button>

        </form>

      </div>
    </div>,
    document.body
  );
};
