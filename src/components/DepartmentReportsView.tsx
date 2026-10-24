import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useProject } from '../context/ProjectContext';
import { DepartmentReport } from '../types';
import { ReportDetailModal } from './reports/ReportDetailModal';
import { 
  BarChart3, 
  Sparkles, 
  FileText, 
  Printer, 
  AlertTriangle, 
  CheckCircle2, 
  Building2, 
  Users, 
  TrendingUp, 
  Clock, 
  Zap, 
  ShieldAlert, 
  Layers, 
  Filter,
  ArrowUpRight,
  ChevronRight,
  Activity,
  Eye,
  Download,
  X,
  FileSpreadsheet,
  Award,
  Trash2,
  Calendar,
  AlertOctagon
} from 'lucide-react';
import StrandsLoader from './loading/StrandsLoader';
import { cn } from '../lib/utils';

interface DepartmentReportsViewProps {
  deptId?: string;
  kpiCards?: React.ReactNode;
}

export const DepartmentReportsView: React.FC<DepartmentReportsViewProps> = ({ deptId, kpiCards }) => {
  const {
    currentUser,
    departments,
    departmentReports,
    generateDepartmentReport,
    generateExecutiveReport,
    saveReport,
    deleteReport,
    deleteReportsBulk,
    fetchOrgData,
    projects,
    tasks
  } = useProject();

  const {activeWorkspaceId}=useProject();

  const [reportError,setReportError]=useState('');
  const [generatingExec, setGeneratingExec] = useState(false);
  const [generatingDept, setGeneratingDept] = useState(false);
  const [scopeFilter, setScopeFilter] = useState<'all' | 'agency' | 'department'>('all');
  const [timeFilter, setTimeFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [selectedModalReport, setSelectedModalReport] = useState<DepartmentReport | null>(null);

  // Deletion modals
  const [reportToDelete, setReportToDelete] = useState<DepartmentReport | null>(null);
  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const [purgeOption, setPurgeOption] = useState<'all' | 'older_month' | 'older_week'>('older_month');
  const [isDeleting, setIsDeleting] = useState(false);

  // Multi-step pipeline states
  const [isPipelineRunning, setIsPipelineRunning] = useState(false);
  const [pipelineProgress, setPipelineProgress] = useState(0);
  const [pipelineStepText, setPipelineStepText] = useState('');

  useEffect(() => {
    if (fetchOrgData) {
      fetchOrgData();
    }
  }, []);

  const currentDept = deptId ? departments.find((d: any) => d.id === deptId) : null;

  // Time filter helper
  const isWithinTimeframe = (rep: DepartmentReport, timeframe: 'all' | 'today' | 'week' | 'month') => {
    if (timeframe === 'all') return true;

    const canonical=(rep as any).createdAt || rep.generatedAt;
    let repTime = typeof canonical==='string' && /^\d{4}-\d{2}-\d{2}T/.test(canonical) ? Date.parse(canonical) : 0;
    if (!repTime && rep.id && rep.id.includes('_')) {
      const parts = rep.id.split('_');
      const ts = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(ts) && ts > 1600000000000) repTime = ts;
    }

    if (!Number.isFinite(repTime) || !repTime) {
      return false;
    }

    const now = Date.now();
    const diffMs = now - repTime;
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (timeframe === 'today') return diffDays <= 1;
    if (timeframe === 'week') return diffDays <= 7;
    if (timeframe === 'month') return diffDays <= 30;
    return true;
  };

  // Filter list strictly by active workspace, then by timeFilter
  const workspaceReports = (departmentReports || []).filter((rep: DepartmentReport) => {
    if (rep.workspaceId) {
      return rep.workspaceId === activeWorkspaceId;
    }
    return activeWorkspaceId === 'ws_primary_owner' || activeWorkspaceId.includes('primary');
  });

  const filteredReports = workspaceReports.filter((rep: DepartmentReport) => {
    return isWithinTimeframe(rep, timeFilter);
  });

  // Multi-step Executive Report Generation Pipeline Handler
  const startExecutiveReportPipeline = async () => {
    if(isPipelineRunning) return;
    setIsPipelineRunning(true);setGeneratingExec(true);setReportError('');setPipelineProgress(0);setPipelineStepText('در حال دریافت گزارش از اطلاعات ذخیره‌شده...');
    try {const report=await generateExecutiveReport();if(!report?.id)throw new Error('گزارش ذخیره‌شده دریافت نشد.');setPipelineProgress(100);setScopeFilter('agency');setSelectedModalReport(report);}
    catch(error){setReportError(error instanceof Error?error.message:'صدور گزارش انجام نشد.');}
    finally {setIsPipelineRunning(false);setGeneratingExec(false);}
  };
  const handleGenerateExecReport = startExecutiveReportPipeline;
  const handleGenerateDeptReport = async () => {
    if(!deptId)return;
    setGeneratingDept(true);setReportError('');
    try {const report=await generateDepartmentReport(deptId);if(!report?.id)throw new Error('گزارش ذخیره‌شده دریافت نشد.');setScopeFilter('department');setSelectedModalReport(report);}
    catch(error){setReportError(error instanceof Error?error.message:'صدور گزارش انجام نشد.');}
    finally {setGeneratingDept(false);}
  };

  const handlePrintReport = (rep: DepartmentReport) => {
    const printWindow = window.open('', '_blank', 'width=950,height=1000');
    if (!printWindow) {
      window.print();
      return;
    }

    const totalProjects = rep.projectSummary?.totalProjects || rep.clientProjectsMatrix?.length || projects?.length || 0;
    const avgProgress = rep.projectSummary?.avgProgress || 0;
    const totalTasks = rep.taskSummary?.total || rep.metrics?.totalTasks || tasks?.length || 0;
    const completedTasks = rep.taskSummary?.completed || rep.metrics?.completed || 0;
    const overdueTasks = rep.taskSummary?.overdue || rep.metrics?.overdue || 0;
    const efficiency = totalTasks > 0 ? (rep.metrics?.efficiency || rep.metrics?.velocity || 0) : 0;
    const criticalRiskCount = (rep.bottlenecks?.length || 0) + (rep.memberBottlenecks?.length || 0);

    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="fa">
      <head>
        <meta charset="utf-8">
        <title>${rep.title}</title>
        <style>
          @page { size: A4 portrait; margin: 12mm; }
          body { 
            font-family: 'B Nazanin', 'Tahoma', 'Segoe UI', sans-serif; 
            direction: rtl; 
            text-align: right; 
            padding: 20px; 
            color: #0f172a; 
            line-height: 1.7; 
            background: #fff; 
            unicode-bidi: embed;
          }
          .document-container { border: 2px solid #0284c7; border-radius: 12px; padding: 24px; background: #ffffff; }
          .header { border-bottom: 2px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
          .agency-title { font-size: 11px; font-weight: bold; color: #0284c7; text-transform: uppercase; letter-spacing: 0.5px; }
          .title { font-size: 18px; font-weight: 800; color: #0f172a; margin: 4px 0 0 0; }
          .subtitle { font-size: 11px; color: #64748b; margin-top: 4px; }
          .badge-top { background: #dcfce7; color: #15803d; padding: 6px 14px; border-radius: 999px; font-size: 11px; font-weight: bold; border: 1px solid #bbf7d0; }
          
          .section-header { 
            font-size: 13px; 
            font-weight: 800; 
            margin-top: 22px; 
            margin-bottom: 10px; 
            color: #0f172a; 
            border-right: 4px solid #0284c7; 
            padding-right: 10px;
            display: flex;
            align-items: center;
          }

          .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 18px; }
          .kpi-card { background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; padding: 12px; text-align: center; }
          .kpi-value { font-size: 16px; font-weight: 800; color: #0f172a; margin-top: 4px; direction: ltr; display: inline-block; }
          .kpi-label { font-size: 10.5px; color: #475569; font-weight: bold; }

          .table { width: 100%; border-collapse: collapse; margin-top: 8px; margin-bottom: 16px; font-size: 11px; direction: rtl; }
          .table th, .table td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: right; }
          .table th { background: #f1f5f9; font-weight: bold; color: #1e293b; text-align: right; }

          .status-badge { display: inline-block; padding: 3px 10px; border-radius: 6px; font-size: 10px; font-weight: bold; text-align: center; }
          .status-on_track { background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
          .status-at_risk { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; }
          .status-delayed { background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; }

          .content-box { background: #f8fafc; border: 1px solid #e2e8f0; padding: 14px; border-radius: 10px; font-size: 12px; margin-bottom: 16px; line-height: 1.8; color: #334155; }
          .alert-box { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 12px 16px; border-radius: 10px; margin-bottom: 14px; font-size: 11.5px; }
          .takeaway-box { background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; padding: 12px 16px; border-radius: 10px; margin-bottom: 14px; font-size: 11.5px; }

          .footer { margin-top: 30px; font-size: 10px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 14px; }
        </style>
      </head>
      <body>
        <div class="document-container">

      {/* Header */}
          <div class="header">
            <div>
              <div class="agency-title">سیستم هوشمند گزارش‌دهی سازمانی و مدیریتی</div>
              <h1 class="title">${rep.title}</h1>
              <div class="subtitle">تاریخ صدور: ${rep.generatedAt} | مسئول ثبت: ${rep.createdBy}</div>
            </div>
            <div class="badge-top">
              ${rep.scope === 'agency' || rep.departmentId === 'AGENCY' ? 'گزارش استراتژیک ۳۶۰ درجه کل سازمان (ویژه مدیران ارشد)' : 'گزارش عملکرد دپارتمان'}
            </div>
          </div>

          {/* SECTION 1: Executive KPI Header */}
          <div class="section-header">بخش ۱: شاخص‌های کلیدی عملکرد ارشد</div>
          <div class="kpi-grid">
            <div class="kpi-card">
              <div class="kpi-label">کل پروژه‌های فعال سازمان</div>
              <div class="kpi-value">${totalProjects} <span style="font-size: 10px; color: #0284c7;">(${avgProgress}٪ پیشرفت)</span></div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">وضعیت کل وظایف سازمان</div>
              <div class="kpi-value">${totalTasks > 0 ? `${completedTasks} از ${totalTasks} تکمیل‌شده` : 'در انتظار تعریف وظایف'}</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">وظایف معوقه / پرریسک</div>
              <div class="kpi-value" style="color: ${overdueTasks > 0 ? '#dc2626' : '#16a34a'};">${overdueTasks}</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-label">کارایی کل و هشدارهای ریسک</div>
              <div class="kpi-value" style="color: #0284c7;">${efficiency}٪ <span style="font-size: 10px; color: #dc2626;">(${criticalRiskCount} هشدار)</span></div>
            </div>
          </div>

          {/* Executive Overview Narrative */}
          <div class="content-box">${rep.content}</div>

          {/* SECTION 2: Active Client Projects Status Matrix */}
          ${rep.clientProjectsMatrix && rep.clientProjectsMatrix.length > 0 ? `
            <div class="section-header">بخش ۲: ماتریس وضعیت پروژه‌ها و وب‌سایت‌های مشتریان</div>
            <table class="table">
              <thead>
                <tr>
                  <th>نام پروژه / وب‌سایت مشتری</th>
                  <th>دپارتمان مسئول</th>
                  <th style="text-align: center;">پیشرفت فیزیکی</th>
                  <th style="text-align: center;">وضعیت پروژه</th>
                  <th>مدیر ارشد پروژه</th>
                </tr>
              </thead>
              <tbody>
                ${rep.clientProjectsMatrix.map(p => `
                  <tr>
                    <td><strong>${p.name}</strong></td>
                    <td>${p.departmentName}</td>
                    <td style="text-align: center; font-weight: bold; direction: ltr;">${p.progress}٪</td>
                    <td style="text-align: center;">
                      <span class="status-badge status-${p.status}">
                        ${p.statusLabel || (p.status === 'on_track' ? 'در مسیر' : p.status === 'at_risk' ? 'در معرض ریسک' : 'دارای تأخیر')}
                      </span>
                    </td>
                    <td>${p.manager}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : ''}

          {/* SECTION 3: Departmental Performance Breakdown */}
          ${rep.departmentBreakdown && rep.departmentBreakdown.length > 0 ? `
            <div class="section-header">بخش ۳: تفکیک راندمان و عملکرد دپارتمان‌ها</div>
            <table class="table">
              <thead>
                <tr>
                  <th>نام دپارتمان / سرویس</th>
                  <th style="text-align: center;">کل وظایف</th>
                  <th style="text-align: center;">تکمیل‌شده</th>
                  <th style="text-align: center;">معوقه / پرریسک</th>
                  <th style="text-align: center;">نرخ بازدهی و انجام</th>
                </tr>
              </thead>
              <tbody>
                ${rep.departmentBreakdown.map(d => `
                  <tr>
                    <td><strong>${d.departmentName}</strong></td>
                    <td style="text-align: center;">${d.totalTasks}</td>
                    <td style="text-align: center; color: #16a34a; font-weight: bold;">${d.completedTasks}</td>
                    <td style="text-align: center; color: ${d.overdueTasks > 0 ? '#dc2626' : 'inherit'}; font-weight: bold;">${d.overdueTasks}</td>
                    <td style="text-align: center; font-weight: bold; color: #0284c7; direction: ltr;">${d.completionRate}٪</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : ''}

          {/* SECTION 4: Individual & Workload Bottleneck Analysis */}
          <div class="section-header" style="color: #b91c1c; border-right-color: #dc2626;">بخش ۴: تحلیل گلوگاه‌ها و انباشت کاری اعضای تیم</div>
          ${rep.memberBottlenecks && rep.memberBottlenecks.length > 0 ? `
            <table class="table" style="border-color: #fca5a5;">
              <thead>
                <tr style="background: #fef2f2;">
                  <th>عضو تیم / مسئول</th>
                  <th>دپارتمان مربوطه</th>
                  <th style="text-align: center;">تعداد معوقه</th>
                  <th style="text-align: center;">کل فعال</th>
                  <th>وضعیت و هشدار اختصاصی مدیریت</th>
                </tr>
              </thead>
              <tbody>
                ${rep.memberBottlenecks.map(m => `
                  <tr>
                    <td><strong>${m.memberName}</strong></td>
                    <td>${m.departmentName}</td>
                    <td style="text-align: center; color: #dc2626; font-weight: bold;">${m.overdueCount}</td>
                    <td style="text-align: center;">${m.pendingCount}</td>
                    <td style="color: #991b1b; font-size: 10.5px;">${m.statusText}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : ''}
          
          ${rep.bottlenecks && rep.bottlenecks.length > 0 ? `
            <div class="alert-box">
              <strong style="display: block; margin-bottom: 6px;">هشدارهای سیستم هوشمند پایش گلوگاه‌ها:</strong>
              <ul style="margin: 0; padding-right: 18px;">
                ${rep.bottlenecks.map(b => `<li style="margin-bottom: 4px;">${b}</li>`).join('')}
              </ul>
            </div>
          ` : ''}

          {/* SECTION 5: Strategic Recommendations & Action Plan */}
          ${rep.keyTakeaways && rep.keyTakeaways.length > 0 ? `
            <div class="section-header" style="color: #15803d; border-right-color: #16a34a;">بخش ۵: توصیه‌های استراتژیک و برنامه اقدام مدیران</div>
            <div class="takeaway-box">
              <ul style="margin: 0; padding-right: 18px;">
                ${rep.keyTakeaways.map(k => `<li style="margin-bottom: 6px; font-weight: bold;">${k}</li>`).join('')}
              </ul>
            </div>
          ` : ''}

          <div class="footer">
            نسخه رسمی گزارش ۳۶۰ درجه هوشمند آژانس - صادر شده جهت تصمیم‌گیری مدیران ارشد و تخصیص منابع
          </div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    // Printed from here: the Content-Security-Policy blocks inline scripts in the report window.
    printWindow.focus();
    printWindow.print();
  };

  return (
    <div className="w-full space-y-6 text-right animate-fade-in" style={{ direction: 'rtl' }}>
      {reportError && <p role="alert" className="p-3 text-red-600">{reportError}</p>}
      {/* LEVEL 2 — PROMOTED HERO HEADER BANNER (مرکز گزارش‌دهی و پایش هوشمند سازمانی) */}
      <div className="relative overflow-hidden bg-gradient-to-b from-white via-white to-blue-50/60 dark:from-[#0d121f] dark:via-[#0d121f] dark:to-blue-950/40 rounded-3xl border border-slate-200/90 dark:border-slate-800 p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        {/* Right Column (Header Info) */}
        <div className="relative z-10 space-y-2 max-w-2xl">
          {/* Top Tag Pill */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 rounded-full text-xs font-bold border border-blue-200/60 dark:border-blue-900/40">
              <Sparkles size={14} />
              <span>مرکز هوش تحلیلی و پایش ۳۶۰ درجه سازمانی</span>
            </span>
            {currentDept && (
              <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2.5 py-0.5 rounded-full font-bold">
                دپارتمان {currentDept.name}
              </span>
            )}
          </div>

          {/* Main Page Title */}
          <h1 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
            <span>مرکز گزارش‌دهی و پایش هوشمند سازمانی</span>
          </h1>

          {/* Subtitle */}
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed max-w-2xl">
            ارزیابی لحظه‌ای عملکرد دپارتمان‌ها، تحلیل داده‌محور نرخ پیشرفت طرح‌ها و کشف خودکار گلوگاه‌های عملیاتی جهت تصمیم‌گیری استراتژیک مدیران ارشد.
          </p>
        </div>

        {/* Left Column (Action CTA) */}
        <div className="relative z-10 flex flex-col sm:flex-row items-center gap-2.5 w-full md:w-auto shrink-0 pt-1 md:pt-0">
          <button
            onClick={handleGenerateExecReport}
            disabled={generatingExec || isPipelineRunning}
            aria-busy={generatingExec || isPipelineRunning}
            className="relative overflow-hidden w-full sm:w-auto px-5 py-3 bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 text-white rounded-2xl text-xs font-black transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
          >
            <span className={cn('inline-flex items-center justify-center gap-2', (generatingExec || isPipelineRunning) ? 'opacity-0 invisible pointer-events-none' : 'opacity-100')}>
              <Sparkles size={15} className="animate-pulse" />
              <span>صدور گزارش هوشمند با ۱ کلیک</span>
            </span>
            {(generatingExec || isPipelineRunning) && (
              <StrandsLoader variant="button" message="در حال پایش و صدور..." />
            )}
          </button>

          {deptId && (
            <button
              onClick={handleGenerateDeptReport}
              disabled={generatingDept}
              className="w-full sm:w-auto px-4 py-3 bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200/90 dark:border-slate-700 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
            >
              <Layers size={14} className="text-blue-600 dark:text-blue-400" />
              <span>{generatingDept ? 'در حال پایش دپارتمان...' : 'گزارش هوشمند این دپارتمان'}</span>
            </button>
          )}
        </div>

        {/* Horizontal Luminous Light Beam & Bottom Flare Effect */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/4 sm:w-2/3 h-6 pointer-events-none flex items-end justify-center overflow-visible">
          {/* Layer 1 (Diffused Ambient Bloom): Soft, wide cyan-blue blur */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent blur-xl h-full w-full" />

          {/* Layer 2 (Luminous High-Intensity Core Line): Slim, sharp light beam running horizontally along the bottom border */}
          <div className="relative w-full h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent drop-shadow-[0_0_8px_rgba(56,189,248,0.8)] flex items-center justify-center">
            {/* Center Highlight: Subtle white-hot focal point */}
            <div className="w-16 sm:w-24 h-[3px] bg-white/95 rounded-full blur-[0.5px] shadow-[0_0_12px_rgba(255,255,255,0.95),0_0_20px_rgba(56,189,248,0.9)]" />
          </div>
        </div>
      </div>

      {/* LEVEL 3 — 4 KPI PERFORMANCE METRIC CARDS */}
      {kpiCards && (
        <div className="w-full">
          {kpiCards}
        </div>
      )}

      {/* LEVEL 4 — FILTERS & REPORT ARCHIVE */}

      {/* Streamlined Single-Row Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-2 bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 rounded-2xl">
        {/* Right Side (RTL Title / Status): Clean Title Badge + Total Count */}
        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200/50 dark:border-blue-900/30 rounded-xl text-xs font-bold flex items-center gap-1.5 whitespace-nowrap">
            <FileText size={14} className="text-blue-600 dark:text-blue-400" />
            <span>آرشیو گزارش‌های مدیریتی</span>
          </div>
          <div className="px-3 py-1.5 bg-slate-200/60 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold border border-slate-300/40 dark:border-slate-700/40 whitespace-nowrap">
            <span><strong>{filteredReports.length}</strong> گزارش ثبت شده</span>
          </div>
        </div>

        {/* Middle Section: Time-Based Filters */}
        <div className="flex items-center gap-1 bg-slate-200/60 dark:bg-slate-800/60 p-1 rounded-xl border border-slate-300/40 dark:border-slate-700/40">
          <button
            onClick={() => setTimeFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              timeFilter === 'all'
                ? 'bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-300 shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            همه زمان‌ها
          </button>
          <button
            onClick={() => setTimeFilter('today')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              timeFilter === 'today'
                ? 'bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-300 shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            امروز
          </button>
          <button
            onClick={() => setTimeFilter('week')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              timeFilter === 'week'
                ? 'bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-300 shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            این هفته
          </button>
          <button
            onClick={() => setTimeFilter('month')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              timeFilter === 'month'
                ? 'bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-300 shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            این ماه
          </button>
        </div>

        {/* Left Side: Bulk Actions (Ghost Button for Archive Cleanup) */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPurgeModal(true)}
            className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            title="پاکسازی آرشیو"
          >
            <Trash2 size={15} />
            <span>پاکسازی آرشیو</span>
          </button>
        </div>
      </div>

      {/* Reports Feed - Grid with Document Thumbnails & Hover Action Overlays */}
      {filteredReports.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-10 sm:p-14 text-center space-y-5 shadow-xs">
          <div className="w-16 h-16 rounded-3xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto border border-blue-500/20 shadow-inner">
            <FileText size={32} />
          </div>
          <div className="space-y-2 max-w-md mx-auto">
            <h3 className="text-base font-black text-slate-800 dark:text-slate-100">
              هنوز هیچ گزارش تحلیلی برای این فضای کاری ثبت نشده است
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              جهت سنجش بهره‌وری تیم‌ها، شفاف‌سازی وضعیت پیشرفت پروژه‌ها و دریافت بینش‌های مدیریتی، اولین گزارش هوشمند این دوره را صادر کنید.
            </p>
          </div>
          <button
            onClick={handleGenerateExecReport}
            disabled={generatingExec || isPipelineRunning}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl font-black text-xs transition-all shadow-lg shadow-blue-600/25 flex items-center justify-center gap-2 mx-auto cursor-pointer"
          >
            <Sparkles size={16} />
            <span>+ تولید اولین گزارش تحلیلی</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredReports.map((rep: DepartmentReport) => {
            const isAgencyScope = rep.scope === 'agency' || rep.departmentId === 'AGENCY';
            const deptName = departments.find((d: any) => d.id === rep.departmentId)?.name;

            return (
              <div
                key={rep.id}
                className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-blue-500/50 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden group rounded-2xl flex flex-col justify-between"
              >
                {/* TOP SECTION: Document Thumbnail Graphic Preview */}
                <div className={`p-4 bg-gradient-to-br ${
                  isAgencyScope 
                    ? 'from-emerald-500/10 via-slate-50/80 dark:via-slate-800/40 to-slate-100/50 dark:to-slate-900' 
                    : 'from-blue-500/10 via-slate-50/80 dark:via-slate-800/40 to-slate-100/50 dark:to-slate-900'
                } border-b border-slate-100 dark:border-slate-800/80 relative overflow-hidden`}>
                  
                  {/* Watermark Document Icon */}
                  <FileText size={80} className="absolute -left-3 -bottom-3 text-slate-200/40 dark:text-slate-800/40 pointer-events-none transform -rotate-12" />

                  {/* Miniature Document Header Visual */}
                  <div className="bg-white/80 dark:bg-slate-950/80 backdrop-blur-xs border border-slate-200/80 dark:border-slate-800 rounded-xl p-3 shadow-xs relative z-10 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <FileSpreadsheet size={14} className={isAgencyScope ? 'text-emerald-500' : 'text-blue-500'} />
                        <span className="text-[9px] font-black tracking-wider text-slate-500 dark:text-slate-400 uppercase">
                          {isAgencyScope ? 'AGENCY EXECUTIVE REPORT' : `DEPT REPORT: ${deptName || 'CORE'}`}
                        </span>
                      </div>
                      <span className={`text-[8px] font-extrabold px-2 py-0.5 rounded-full ${
                        isAgencyScope 
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' 
                          : 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                      }`}>
                        {isAgencyScope ? 'مدیران ارشد' : 'دپارتمانی'}
                      </span>
                    </div>

                    {/* Mini Skeleton KPI Pills */}
                    <div className="grid grid-cols-3 gap-1.5 text-center">
                      <div className="bg-slate-50 dark:bg-slate-900/60 p-1.5 rounded-lg border border-slate-200/50 dark:border-slate-800">
                        <span className="text-[8px] text-slate-400 block font-medium">پروژه‌ها</span>
                        <span className="text-[10px] font-bold font-mono text-slate-800 dark:text-slate-200">
                          {rep.projectSummary?.totalProjects || projects.length}
                        </span>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-900/60 p-1.5 rounded-lg border border-slate-200/50 dark:border-slate-800">
                        <span className="text-[8px] text-slate-400 block font-medium">پیشرفت</span>
                        <span className="text-[10px] font-bold font-mono text-blue-600 dark:text-blue-400">
                          {rep.projectSummary?.avgProgress || 0}٪
                        </span>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-900/60 p-1.5 rounded-lg border border-slate-200/50 dark:border-slate-800">
                        <span className="text-[8px] text-slate-400 block font-medium">معوقه</span>
                        <span className={`text-[10px] font-bold font-mono ${
                          (rep.taskSummary?.overdue || 0) > 0 ? 'text-rose-500' : 'text-emerald-500'
                        }`}>
                          {rep.taskSummary?.overdue || 0}
                        </span>
                      </div>
                    </div>

                    {/* Mini Progress Line */}
                    <div className="w-full bg-slate-200 dark:bg-slate-800 h-1 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${isAgencyScope ? 'bg-emerald-500' : 'bg-blue-500'}`}
                        style={{ width: `${Math.min(100, rep.projectSummary?.avgProgress || 0)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* MIDDLE SECTION: Persian Title, Badge, and Concise 2-Line Narrative */}
                <div className="p-4 sm:p-5 space-y-3 flex-1 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold ${
                        isAgencyScope
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/40'
                          : 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/40'
                      }`}>
                        {isAgencyScope ? 'خلاصه مدیریتی' : `دپارتمان ${deptName || 'عملیاتی'}`}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                        <Clock size={11} />
                        {rep.generatedAt}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {rep.title}
                    </h3>

                    {/* 2-line Persian Narrative Summary */}
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                      {rep.content}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex justify-between items-center text-[11px] text-slate-400 font-medium">
                    <span>صادرکننده: <strong className="text-slate-700 dark:text-slate-300 font-semibold">{rep.createdBy}</strong></span>
                    <span className="text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-1 group-hover:translate-x-[-2px] transition-transform">
                      مشاهده جزئیات گزارش <ChevronRight size={13} className="rotate-180" />
                    </span>
                  </div>
                </div>

                {/* HOVER EFFECT & ACTIONS OVERLAY */}
                <div className="absolute inset-0 backdrop-blur-md bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col items-center justify-center gap-3 p-6 z-20">
                  <div className="text-center space-y-1 mb-1">
                    <span className="text-white font-extrabold text-sm block line-clamp-1 px-2">
                      {rep.title}
                    </span>
                    <span className="text-[11px] text-slate-300 font-medium block">
                      تاریخ صدور: {rep.generatedAt}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Action 1: Popup View */}
                    <button
                      onClick={() => setSelectedModalReport(rep)}
                      className="px-3.5 py-2 bg-white text-slate-900 hover:bg-blue-50 hover:text-blue-600 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer transform hover:scale-105"
                    >
                      <Eye size={15} />
                      <span>مشاهده پاپ‌آپ</span>
                    </button>

                    {/* Action 2: Download PDF */}
                    <button
                      onClick={() => handlePrintReport(rep)}
                      className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer transform hover:scale-105"
                    >
                      <Download size={15} />
                      <span>دانلود PDF</span>
                    </button>

                    {/* Action 3: Delete Single Report */}
                    <button
                      onClick={() => setReportToDelete(rep)}
                      className="p-2 bg-rose-500/20 hover:bg-rose-500 text-rose-300 hover:text-white border border-rose-500/40 rounded-xl transition-all cursor-pointer transform hover:scale-105"
                      title="حذف این گزارش"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MULTI-STEP PROGRESS MODAL (MODERN UX PROCESSOR) */}
      {isPipelineRunning && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto" style={{ direction: 'rtl' }}>
          <div 
            className="fixed inset-0 z-0 bg-gradient-to-t from-black/[0.18] via-black/[0.06] to-transparent dark:from-black/[0.5] dark:via-black/[0.25] dark:to-transparent backdrop-blur-[1.5px] transition-opacity duration-300 animate-in fade-in"
          />
          <div className="relative z-10 bg-white/95 dark:bg-slate-900/95 border border-slate-200/90 dark:border-slate-800 shadow-[0_25px_70px_-15px_rgba(0,0,0,0.18),0_10px_30px_-10px_rgba(0,0,0,0.08)] dark:shadow-[0_25px_70px_-15px_rgba(0,0,0,0.6)] rounded-[28px] p-6 sm:p-8 max-w-lg w-full text-center overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 ease-out">
            {/* Ambient background glow rings */}
            <div className="absolute top-0 right-0 w-44 h-44 bg-blue-500/20 blur-3xl rounded-full pointer-events-none animate-pulse" />
            <div className="absolute bottom-0 left-0 w-44 h-44 bg-emerald-500/20 blur-3xl rounded-full pointer-events-none animate-pulse" />

            <div className="relative z-10 space-y-6">
              <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-500/20 via-blue-600/20 to-emerald-500/20 text-brand-accent flex items-center justify-center mx-auto border border-brand-accent/30 shadow-inner">
                <div className="absolute inset-0 rounded-3xl border border-brand-accent/40 animate-ping opacity-25" />
                <Sparkles size={36} className="animate-pulse text-brand-accent" />
              </div>

              <div className="space-y-1">
                <h3 className="text-lg font-black text-text-primary dark:text-white">
                  در حال پردازش و تولید گزارش استراتژیک کل سازمان...
                </h3>
                <p className="text-xs text-text-secondary dark:text-slate-400 leading-relaxed max-w-md mx-auto">
                  سیستم هوشمند در حال تحلیل و استخراج شاخص‌های عملکرد، ریسک‌ها و وضعیت لحظه‌ای تمام پروژه‌ها می‌باشد.
                </p>
              </div>

              {/* Animated Glowing Percentage Counter */}
              <div className="py-1">
                <div className="text-4xl font-black font-mono text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-blue-500 to-emerald-400 tracking-wider drop-shadow-md">
                  {pipelineProgress}٪
                </div>
              </div>

              {/* Glowing Gradient Progress Bar */}
              <div className="w-full bg-slate-200/80 dark:bg-white/10 h-3.5 rounded-full overflow-hidden p-0.5 border border-border-primary/40 dark:border-white/10 shadow-inner">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-600 via-blue-500 to-emerald-400 transition-all duration-500 shadow-lg shadow-blue-500/20"
                  style={{ width: `${pipelineProgress}%` }}
                />
              </div>

              {/* Step-by-Step Status Label */}
              <div className="bg-hover-overlay dark:bg-white/5 border border-border-primary/50 dark:border-white/10 p-3.5 rounded-2xl flex items-center justify-center gap-2.5 shadow-xs">
                <StrandsLoader variant="inline" />
                <span className="text-xs font-bold text-text-primary dark:text-slate-200">
                  {pipelineStepText}
                </span>
              </div>

              {/* Step Progress Indicators */}
              <div className="grid grid-cols-4 gap-2 text-[10px] pt-1">
                <div className={`p-2 rounded-xl border transition-all ${pipelineProgress >= 25 ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 font-extrabold shadow-xs' : 'bg-hover-overlay border-border-primary/40 text-text-secondary dark:text-slate-500'}`}>
                  استخراج پروژه‌ها
                </div>
                <div className={`p-2 rounded-xl border transition-all ${pipelineProgress >= 50 ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 font-extrabold shadow-xs' : 'bg-hover-overlay border-border-primary/40 text-text-secondary dark:text-slate-500'}`}>
                  تحلیل دپارتمان‌ها
                </div>
                <div className={`p-2 rounded-xl border transition-all ${pipelineProgress >= 75 ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 font-extrabold shadow-xs' : 'bg-hover-overlay border-border-primary/40 text-text-secondary dark:text-slate-500'}`}>
                  پایش گلوگاه‌ها
                </div>
                <div className={`p-2 rounded-xl border transition-all ${pipelineProgress >= 100 ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 font-extrabold shadow-xs' : 'bg-hover-overlay border-border-primary/40 text-text-secondary dark:text-slate-500'}`}>
                  خروجی استراتژیک
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* SINGLE ITEM DELETE CONFIRMATION MODAL */}
      {reportToDelete && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto" style={{ direction: 'rtl' }}>
          <div 
            onClick={() => setReportToDelete(null)}
            className="fixed inset-0 z-0 bg-gradient-to-t from-black/[0.18] via-black/[0.06] to-transparent dark:from-black/[0.5] dark:via-black/[0.25] dark:to-transparent backdrop-blur-[1.5px] transition-opacity duration-300 animate-in fade-in cursor-pointer"
          />
          <div className="relative z-10 bg-surface-primary dark:bg-[#181826] border border-rose-500/30 rounded-[28px] p-6 sm:p-7 max-w-md w-full shadow-[0_25px_70px_-15px_rgba(0,0,0,0.18),0_10px_30px_-10px_rgba(0,0,0,0.08)] dark:shadow-[0_25px_70px_-15px_rgba(0,0,0,0.6)] space-y-5 text-center overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 ease-out">
            <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 blur-2xl rounded-full pointer-events-none" />
            <div className="w-14 h-14 rounded-2xl bg-rose-500/15 text-rose-500 flex items-center justify-center mx-auto border border-rose-500/30 shadow-inner">
              <Trash2 size={28} />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-black text-text-primary dark:text-white">
                آیا از حذف این گزارش اطمینان دارید؟
              </h3>
              <p className="text-xs text-text-secondary dark:text-slate-400 leading-relaxed max-w-sm mx-auto">
                گزارش «<span className="font-bold text-text-primary dark:text-slate-200">{reportToDelete.title}</span>» برای همیشه از آرشیو سرور پاک خواهد شد.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={async () => {
                  setIsDeleting(true);
                  if (deleteReport && reportToDelete) {
                    await deleteReport(reportToDelete.id);
                  }
                  setIsDeleting(false);
                  setReportToDelete(null);
                }}
                disabled={isDeleting}
                aria-busy={isDeleting}
                className="relative overflow-hidden px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer flex items-center justify-center gap-1.5 min-w-[130px]"
              >
                <span className={cn('inline-flex items-center justify-center gap-1.5', isDeleting ? 'opacity-0 invisible pointer-events-none' : 'opacity-100')}>
                  <Trash2 size={14} />
                  <span>تأیید و حذف گزارش</span>
                </span>
                {isDeleting && <StrandsLoader variant="button" />}
              </button>
              <button
                onClick={() => setReportToDelete(null)}
                disabled={isDeleting}
                className="px-5 py-2.5 bg-surface-secondary dark:bg-white/10 hover:bg-hover-overlay text-text-primary dark:text-white rounded-xl text-xs font-bold transition-all cursor-pointer border border-border-primary/50 dark:border-white/10"
              >
                انصراف
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* BULK PURGE / ARCHIVE CLEANUP MODAL */}
      {showPurgeModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto" style={{ direction: 'rtl' }}>
          <div 
            onClick={() => setShowPurgeModal(false)}
            className="fixed inset-0 z-0 bg-gradient-to-t from-black/[0.18] via-black/[0.06] to-transparent dark:from-black/[0.5] dark:via-black/[0.25] dark:to-transparent backdrop-blur-[1.5px] transition-opacity duration-300 animate-in fade-in cursor-pointer"
          />
          <div className="relative z-10 bg-surface-primary dark:bg-[#181826] border border-border-primary/80 dark:border-white/10 rounded-[28px] p-6 sm:p-7 max-w-md w-full shadow-[0_25px_70px_-15px_rgba(0,0,0,0.18),0_10px_30px_-10px_rgba(0,0,0,0.08)] dark:shadow-[0_25px_70px_-15px_rgba(0,0,0,0.6)] space-y-5 text-right overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 ease-out">
            <div className="flex items-center justify-between pb-3 border-b border-border-primary/50 dark:border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-rose-500/15 text-rose-500">
                  <Trash2 size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-text-primary dark:text-white">
                    پاکسازی و مدیریت آرشیو گزارش‌ها
                  </h3>
                  <p className="text-[11px] text-text-secondary dark:text-slate-400">
                    حذف دسته‌جمعی گزارش‌های قدیمی جهت بهینه‌سازی دیتابیس
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowPurgeModal(false)}
                className="p-1.5 text-text-secondary hover:text-text-primary rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold text-text-primary dark:text-slate-200 block">
                محدوده پاکسازی را انتخاب کنید:
              </label>

              <div className="space-y-2">
                <label className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${purgeOption === 'older_month' ? 'bg-brand-accent/10 border-brand-accent text-brand-accent font-bold' : 'bg-hover-overlay dark:bg-white/5 border-border-primary/50 dark:border-white/5 text-text-secondary'}`}>
                  <span className="text-xs">حذف گزارش‌های قدیمی‌تر از ۱ ماه پیش</span>
                  <input
                    type="radio"
                    name="purgeOption"
                    checked={purgeOption === 'older_month'}
                    onChange={() => setPurgeOption('older_month')}
                    className="accent-brand-accent"
                  />
                </label>

                <label className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${purgeOption === 'older_week' ? 'bg-brand-accent/10 border-brand-accent text-brand-accent font-bold' : 'bg-hover-overlay dark:bg-white/5 border-border-primary/50 dark:border-white/5 text-text-secondary'}`}>
                  <span className="text-xs">حذف گزارش‌های هفته گذشته</span>
                  <input
                    type="radio"
                    name="purgeOption"
                    checked={purgeOption === 'older_week'}
                    onChange={() => setPurgeOption('older_week')}
                    className="accent-brand-accent"
                  />
                </label>

                <label className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${purgeOption === 'all' ? 'bg-rose-500/10 border-rose-500 text-rose-600 dark:text-rose-400 font-bold' : 'bg-hover-overlay dark:bg-white/5 border-border-primary/50 dark:border-white/5 text-text-secondary'}`}>
                  <span className="text-xs">حذف تمامی گزارش‌های موجود در آرشیو</span>
                  <input
                    type="radio"
                    name="purgeOption"
                    checked={purgeOption === 'all'}
                    onChange={() => setPurgeOption('all')}
                    className="accent-rose-500"
                  />
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border-primary/50 dark:border-white/10">
              <button
                onClick={() => setShowPurgeModal(false)}
                className="px-4 py-2 bg-hover-overlay text-text-secondary dark:text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                انصراف
              </button>
              <button
                onClick={async () => {
                  setIsDeleting(true);
                  if (deleteReportsBulk) {
                    await deleteReportsBulk(purgeOption);
                  }
                  setIsDeleting(false);
                  setShowPurgeModal(false);
                }}
                disabled={isDeleting}
                aria-busy={isDeleting}
                className="relative overflow-hidden px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md flex items-center justify-center gap-1.5 min-w-[120px]"
              >
                <span className={cn('inline-flex items-center justify-center gap-1.5', isDeleting ? 'opacity-0 invisible pointer-events-none' : 'opacity-100')}>
                  <Trash2 size={14} />
                  <span>اجرای پاکسازی</span>
                </span>
                {isDeleting && <StrandsLoader variant="button" />}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* WIDE SCROLLABLE PREVIEW MODAL */}
      <ReportDetailModal
        report={selectedModalReport}
        isOpen={!!selectedModalReport}
        onClose={() => setSelectedModalReport(null)}
      />
    </div>
  );
};




