import React, { useState, useEffect } from 'react';
import { Project } from '../../types';
import { 
  X, 
  MessageSquare, 
  AlertTriangle, 
  CheckCircle2, 
  ShieldAlert, 
  ArrowLeft 
} from 'lucide-react';

const toPersianDigits = (n: string | number): string => {
  if (n === null || n === undefined) return '';
  const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(n).replace(/[0-9]/g, (x) => farsiDigits[parseInt(x, 10)]);
};

interface StatusChangeReasonModalProps {
  isOpen: boolean;
  project: Project;
  targetStatus: string;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void> | void;
}

export const StatusChangeReasonModal: React.FC<StatusChangeReasonModalProps> = ({
  isOpen,
  project,
  targetStatus,
  onClose,
  onConfirm
}) => {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const charCount = reason.trim().length;
  const isValidMin = charCount >= 15;
  const isValidMax = reason.length <= 250;
  const isValid = isValidMin && isValidMax;

  // Contextual question generator
  const getModalQuestion = (st: string) => {
    switch (st) {
      case 'suspended':
      case 'on_hold':
      case 'pending':
        return 'علت تعلیق یا وقفه در پیشرفت این پروژه چیست؟';
      case 'canceled':
      case 'terminated':
        return 'دلیل اصلی لغو نهایی قرارداد چیست؟';
      case 'completed':
        return 'توضیحات تحویل نهایی و یا علت بایگانی این پروژه چیست؟';
      case 'active':
      case 'in_progress':
      default:
        return 'علت خارج شدن پروژه از حالت تعلیق/آرشیو و شروع مجدد چیست؟';
    }
  };

  const getStatusLabel = (st: string) => {
    switch (st) {
      case 'active':
      case 'in_progress':
        return '🟢 فعالسازی پروژه';
      case 'suspended':
      case 'on_hold':
      case 'pending':
        return '🟡 تعلیق / در انتظار';
      case 'canceled':
      case 'terminated':
        return '🔴 لغو نهایی قرارداد';
      case 'completed':
        return '⚪ بایگانی / تکمیل پروژه';
      default:
        return 'تغییر وضعیت';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    setIsSubmitting(true);
    try {
      await onConfirm(reason.trim());
      setReason('');
      onClose();
    } catch (err) {
      console.error('Failed to record status reason:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto dir-rtl text-right font-sans" 
      dir="rtl"
    >
      {/* 1. Translucent Gradient Backdrop (Background remains bright, sharp & readable) */}
      <div 
        onClick={onClose}
        className="fixed inset-0 z-0 bg-gradient-to-t from-black/[0.18] via-black/[0.06] to-transparent dark:from-black/[0.5] dark:via-black/[0.25] dark:to-transparent backdrop-blur-[1.5px] transition-opacity duration-300 animate-in fade-in cursor-pointer"
      />

      {/* 2. Modal Card Container with High-Contrast Elevation */}
      <div 
        className="relative z-10 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-[28px] w-full max-w-lg shadow-[0_25px_70px_-15px_rgba(0,0,0,0.18),0_10px_30px_-10px_rgba(0,0,0,0.08)] dark:shadow-[0_25px_70px_-15px_rgba(0,0,0,0.6)] overflow-hidden animate-in fade-in zoom-in-95 duration-200 cursor-default"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-2xl shrink-0">
              <MessageSquare size={20} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
                ثبت علت تغییر وضعیت: <span className="text-blue-600 dark:text-blue-400">{getStatusLabel(targetStatus)}</span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                پروژه: <span className="font-bold text-slate-700 dark:text-slate-300">{project.title}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl transition-all cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-800 dark:text-slate-200 block">
              {getModalQuestion(targetStatus)}
            </label>
            <p className="text-[11px] text-slate-400 font-medium">
              جهت حفظ تاریخچه عملکرد و گزارش‌گیری شفاف، ثبت توضیحات الزامی است (بین ۱۵ تا ۲۵۰ کاراکتر).
            </p>

            <div className="relative mt-2">
              <textarea
                rows={4}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={270}
                placeholder="توضیحات و دلایل خود را با جزئیات وارد کنید..."
                className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border rounded-2xl text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 transition-all resize-none ${
                  reason.length === 0 
                    ? 'border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-blue-500/20'
                    : isValid 
                    ? 'border-emerald-400 dark:border-emerald-600 focus:border-emerald-500 focus:ring-emerald-500/20' 
                    : 'border-rose-400 dark:border-rose-600 focus:border-rose-500 focus:ring-rose-500/20'
                }`}
              />
            </div>

            {/* Helper Validation & Counter Bar */}
            <div className="flex items-center justify-between text-[11px] font-bold px-1">
              <div>
                {reason.length === 0 ? (
                  <span className="text-slate-400 flex items-center gap-1">
                    <ShieldAlert size={12} />
                    <span>حداقل ۱۵ کاراکتر الزامی است.</span>
                  </span>
                ) : !isValidMin ? (
                  <span className="text-rose-500 dark:text-rose-400 flex items-center gap-1">
                    <AlertTriangle size={12} />
                    <span>حداقل ۱۵ کاراکتر نیاز است ({toPersianDigits(15 - charCount)} کاراکتر دیگر)</span>
                  </span>
                ) : !isValidMax ? (
                  <span className="text-rose-500 dark:text-rose-400 flex items-center gap-1">
                    <AlertTriangle size={12} />
                    <span>تعداد کاراکتر بیش از حد مجاز (۲۵۰) است!</span>
                  </span>
                ) : (
                  <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 size={12} />
                    <span>متن توضیحات مجاز و تایید شده است.</span>
                  </span>
                )}
              </div>

              <div className={`font-mono text-[11px] ${
                isValid ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-400'
              }`}>
                {toPersianDigits(reason.length)} / {toPersianDigits(250)}
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-2xl text-xs font-bold transition-all cursor-pointer"
            >
              انصراف
            </button>

            <button
              type="submit"
              disabled={!isValid || isSubmitting}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-black shadow-md shadow-blue-600/20 transition-all cursor-pointer flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span>{isSubmitting ? 'در حال ثبت...' : 'تایید و تغییر وضعیت'}</span>
              <ArrowLeft size={14} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StatusChangeReasonModal;
