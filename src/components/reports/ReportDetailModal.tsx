import React from 'react';
import { createPortal } from 'react-dom';
import { Download, X } from 'lucide-react';
import { reportSnapshot } from '../../lib/domain';

export interface ReportDetailModalProps { report:any;isOpen:boolean;onClose:()=>void; }

function savedDate(report:any):string {
  const raw=report.generatedAt || report.createdAt || report.date;
  if(typeof raw!=='string' || !raw.trim())return 'ثبت نشده';
  if(/^\d{4}-\d{2}-\d{2}T/.test(raw) && Number.isFinite(Date.parse(raw))) {
    return new Intl.DateTimeFormat('fa-IR',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Tehran'}).format(new Date(raw));
  }
  return raw;
}

/** Render only the persisted report DTO, including its scope, date and historical metrics. */
export const ReportDetailModal:React.FC<ReportDetailModalProps> = ({report,isOpen,onClose}) => {
  if(!isOpen || !report || typeof document==='undefined')return null;
  const snapshot=reportSnapshot(report);
  const scope=report.scope==='department' || (report.departmentId && report.departmentId!=='AGENCY') ? 'گزارش دپارتمان' : 'گزارش فضای کاری';
  const author=typeof report.createdBy==='string' ? report.createdBy : typeof report.creatorName==='string' ? report.creatorName : 'ثبت نشده';
  const value=(number:number|undefined,suffix='')=>number===undefined?'ثبت نشده':number.toLocaleString('fa-IR')+suffix;
  const label=(...values:any[])=>values.find(item=>typeof item==='string' && item.trim()) || '—';
  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-6 overflow-y-auto" dir="rtl">
      <div onClick={onClose} className="fixed inset-0 z-0 bg-black/20 dark:bg-black/50 backdrop-blur-sm"/>
      <div role="dialog" aria-modal="true" aria-label={report.title || 'گزارش ذخیره‌شده'} className="relative z-10 w-full max-w-4xl max-h-[90vh] flex flex-col rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl text-right">
        <header className="flex items-center justify-between gap-4 p-5 border-b border-slate-200 dark:border-slate-800">
          <div><h2 className="text-base font-bold">{report.title || 'گزارش ذخیره‌شده'}</h2><p className="mt-2 text-xs text-slate-500">{scope} — تاریخ صدور: {savedDate(report)} — صادرکننده: {author}</p></div>
          <div className="flex items-center gap-2"><button type="button" onClick={()=>window.print()} className="flex gap-2 rounded-xl bg-blue-600 text-white px-3 py-2 text-xs"><Download size={14}/>چاپ / ذخیره PDF</button><button type="button" onClick={onClose} aria-label="بستن گزارش" className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800"><X size={18}/></button></div>
        </header>
        <div className="p-5 space-y-5 overflow-y-auto">
          <p className="text-xs text-slate-500">این نما اطلاعات ذخیره‌شده هنگام صدور همین گزارش را نشان می‌دهد.</p>
          <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 text-center"><p className="text-xs">کل پروژه‌ها</p><p data-testid="report-total-projects" className="font-bold text-xl my-2">{value(snapshot.totalProjects)}</p><p className="text-xs">میانگین پیشرفت: {value(snapshot.avgProgress,'٪')}</p></div>
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 text-center"><p className="text-xs">کل وظایف</p><p data-testid="report-total-tasks" className="font-bold text-xl my-2">{value(snapshot.totalTasks)}</p><p className="text-xs">تکمیل‌شده: {value(snapshot.completed)}</p><p className="text-xs">باز: {value(snapshot.pending)} — لغوشده: {value(snapshot.cancelled)}</p></div>
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 text-center"><p className="text-xs">وظایف معوقه</p><p className="font-bold text-xl my-2">{value(snapshot.overdue)}</p></div>
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 text-center"><p className="text-xs">نرخ تکمیل</p><p className="font-bold text-xl my-2">{value(snapshot.velocity,'٪')}</p></div>
          </section>
          <section className="space-y-3"><h3 className="font-bold text-sm">متن گزارش</h3><p className="whitespace-pre-wrap text-sm leading-7 p-4 rounded-xl border border-slate-200 dark:border-slate-700">{typeof report.content==='string' && report.content ? report.content : 'متنی در این گزارش ذخیره نشده است.'}</p></section>
          <section className="space-y-3"><h3 className="font-bold text-sm">جزئیات پروژه‌های ثبت‌شده در گزارش</h3>
            {snapshot.projects.length===0 ? <p className="text-xs text-slate-500">جزئیات پروژه‌ها در این گزارش ذخیره نشده است.</p> : <div className="overflow-x-auto"><table className="w-full text-right text-xs"><thead><tr><th className="p-2">پروژه</th><th className="p-2">دپارتمان</th><th className="p-2">پیشرفت</th><th className="p-2">وضعیت</th></tr></thead><tbody>{snapshot.projects.map((project:any,index:number)=><tr key={typeof project.id==='string'?project.id:index} className="border-t border-slate-200 dark:border-slate-700"><td className="p-2">{label(project.name,project.title)}</td><td className="p-2">{label(project.departmentName,project.department)}</td><td className="p-2">{typeof project.progress==='number'?value(project.progress,'٪'):'ثبت نشده'}</td><td className="p-2">{label(project.statusLabel,project.status)}</td></tr>)}</tbody></table></div>}
          </section>
          <section className="space-y-3"><h3 className="font-bold text-sm">گلوگاه‌های ثبت‌شده</h3>{snapshot.bottlenecks.length ? <ul className="list-disc pr-5 text-sm space-y-2">{snapshot.bottlenecks.map((item:string,index:number)=><li key={index}>{item}</li>)}</ul> : <p className="text-xs text-slate-500">گلوگاهی در این گزارش ثبت نشده است.</p>}</section>
          <section className="space-y-3"><h3 className="font-bold text-sm">یادداشت‌ها و پیشنهادهای ثبت‌شده</h3>{snapshot.takeaways.length ? <ul className="list-disc pr-5 text-sm space-y-2">{snapshot.takeaways.map((item:string,index:number)=><li key={index}>{item}</li>)}</ul> : <p className="text-xs text-slate-500">یادداشتی در این گزارش ذخیره نشده است.</p>}</section>
          {report.custom && typeof report.custom==='object' && <section className="space-y-3"><h3 className="font-bold text-sm">اطلاعات تکمیلی ذخیره‌شده</h3><pre className="whitespace-pre-wrap text-xs p-3 rounded-xl bg-slate-50 dark:bg-slate-800" dir="ltr">{JSON.stringify(report.custom,null,2)}</pre></section>}
        </div>
        <footer className="flex justify-between items-center gap-3 p-4 border-t border-slate-200 dark:border-slate-800"><button type="button" onClick={onClose} className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs">بستن پنجره</button><span className="text-xs text-slate-500">شناسه گزارش: {report.id || '—'}</span></footer>
      </div>
    </div>,document.body,
  );
};
export default ReportDetailModal;
