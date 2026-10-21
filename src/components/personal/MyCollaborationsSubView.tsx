import React from 'react';
import { Users, MessageSquare, AlertCircle, FileText, CheckCircle2 } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';

const toPersianDigits = (n: string | number): string => {
  if (n === undefined || n === null) return '';
  return n.toString().replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(d, 10)] || '۰');
};

export const MyCollaborationsSubView: React.FC = () => {
  const { tasks, files, teamMembers, locale } = useProject();
  const isRtl = locale === 'fa';
  const currentUser = teamMembers[0] || { name: 'علیرضا شریفی', role: 'مدیر پروژه' };

  // Shared tasks and review requests
  const reviewTasks = tasks.filter(t => t.status === 'review' || t.status === 'blocked');
  const sharedDocs = files.slice(0, 4);

  return (
    <div className="space-y-6 font-sans" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div>
          <h1 className="text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Users className="w-6 h-6 text-purple-500" />
            <span>همکاری‌ها و منشن‌ها (My Collaborations)</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-1">
            پیگیری کارهای مشترک، درخواست‌های بررسی متقابل، منشن‌ها و مستندات به اشتراک گذاشته شده
          </p>
        </div>
      </div>

      {/* GRID SECTION */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* REQUESTED REVIEWS & APPROVALS */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-rose-500" />
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
                درخواست‌های بررسی منتظر تایید شما
              </h3>
            </div>
            <span className="text-xs font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/50 px-2.5 py-1 rounded-lg">
              {toPersianDigits(reviewTasks.length)} مورد
            </span>
          </div>

          <div className="space-y-2.5">
            {reviewTasks.map((t) => (
              <div
                key={t.id}
                className="p-3.5 rounded-xl border border-rose-100 dark:border-rose-950/60 bg-rose-50/30 dark:bg-rose-950/20 space-y-2"
              >
                <div className="flex justify-between items-start">
                  <h4 className="text-xs font-black text-slate-800 dark:text-slate-100">{t.title}</h4>
                  <span className="text-[10px] font-bold text-rose-600 bg-rose-100 dark:bg-rose-900/60 px-2 py-0.5 rounded">
                    نیازمند بازبینی
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">
                  ارسال‌شده توسط مهندس رضایی جهت تایید نهایی کدهای فرانت‌اند
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* SHARED DOCUMENTS & MENTIONS */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-purple-500" />
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
                مستندات و فایل‌های به اشتراک گذاشته شده
              </h3>
            </div>
          </div>

          <div className="space-y-2">
            {sharedDocs.map((f) => (
              <div
                key={f.id}
                className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-bold text-slate-800 dark:text-slate-100">{f.name}</div>
                  <div className="text-[10px] text-slate-400 font-bold mt-0.5">آپلود توسط {f.uploadedBy}</div>
                </div>
                <span className="text-[10px] font-mono text-slate-400">{toPersianDigits(f.size)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
