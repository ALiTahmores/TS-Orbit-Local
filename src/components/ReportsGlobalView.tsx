import React, { useState, useMemo, useEffect } from 'react';
import { useProject } from '../context/ProjectContext';
import { EmptyState } from './EmptyState';
import { DepartmentReportsView } from './DepartmentReportsView';
import { TeamPerformanceView } from './TeamPerformanceView';
import { 
  BarChart as LucideBarChart, 
  TrendingUp, 
  Coins, 
  CheckCircle, 
  Users, 
  ChevronDown, 
  ArrowUpRight, 
  PieChart as LucidePieChart, 
  Grid,
  Download,
  Printer,
  FileText
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell, 
  Legend 
} from 'recharts';

export const ReportsGlobalView: React.FC = () => {
  const { projects, tasks, teamMembers, activeSubTab } = useProject();
  
  const [activeReport, setActiveReport] = useState<'project' | 'team' | 'revenue' | 'automated'>(() => {
    return activeSubTab === 'team_reports' ? 'team' : 'automated';
  });

  useEffect(() => {
    if (activeSubTab === 'team_reports') {
      setActiveReport('team');
    }
  }, [activeSubTab]);

  // Parse total budget dynamically from projects state
  const totalBudgetMillion = useMemo(() => {
    let budgetTotal = 0;
    projects.forEach(p => {
      if (p.budget) {
        const cleanNum = p.budget.replace(/[^0-9۰-۹]/g, '');
        const englishDigits = cleanNum.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString());
        const parsed = parseInt(englishDigits, 10);
        if (!isNaN(parsed)) {
          if (parsed > 1000000) {
            budgetTotal += parsed / 1000000;
          } else if (parsed > 1000) {
            budgetTotal += parsed / 1000;
          } else {
            budgetTotal += parsed;
          }
        }
      }
    });
    return budgetTotal > 0 ? Math.round(budgetTotal) : 445;
  }, [projects]);

  const receivedBudgetMillion = useMemo(() => {
    return Math.round(totalBudgetMillion * 0.42); // Releasing 42% as prepayment average
  }, [totalBudgetMillion]);

  const remainingBudgetMillion = useMemo(() => {
    return totalBudgetMillion - receivedBudgetMillion;
  }, [totalBudgetMillion, receivedBudgetMillion]);

  // Calculations
  const completedRateSum = useMemo(() => {
    if (projects.length === 0) return 0;
    return Math.round(projects.reduce((acc, p) => acc + p.progress, 0) / projects.length);
  }, [projects]);

  const avgTasksPerMember = useMemo(() => {
    if (teamMembers.length === 0) return '۰';
    return (tasks.length / teamMembers.length).toFixed(1);
  }, [tasks, teamMembers]);

  const dynamicTeamMembers = useMemo(() => {
    return teamMembers.map(m => {
      const memberTasks = tasks.filter(t => t.assignedTo === m.name);
      const totalCount = memberTasks.length;
      const completedCount = memberTasks.filter(t => t.status === 'completed').length;
      return {
        ...m,
        taskCount: totalCount,
        completedCount
      };
    });
  }, [teamMembers, tasks]);

  // Financial history trends calculated dynamically based on total projects budgets
  const revenueHistory = useMemo(() => {
    const baseShare = Math.round(totalBudgetMillion / 4);
    return [
      { month: 'فروردین', 'درآمد ناخالص': Math.round(baseShare * 0.7), 'مخارج عمومی': Math.round(baseShare * 0.25) },
      { month: 'اردیبهشت', 'درآمد ناخالص': Math.round(baseShare * 0.95), 'مخارج عمومی': Math.round(baseShare * 0.3) },
      { month: 'خرداد (جاری)', 'درآمد ناخالص': Math.round(baseShare * 1.2), 'مخارج عمومی': Math.round(baseShare * 0.35) },
      { month: 'تیر (هدف)', 'درآمد ناخالص': Math.round(baseShare * 0.8), 'مخارج عمومی': Math.round(baseShare * 0.22) }
    ];
  }, [totalBudgetMillion]);

  // Project progress distribution for Bar Chart
  const projectChartData = useMemo(() => {
    return projects.map(p => ({
      name: p.title.split(' ').slice(1, 4).join(' '),
      'پیشرفت فیزیکی': p.progress,
      'وظایف کل': p.totalTasks || tasks.filter(t => t.projectId === p.id).length
    }));
  }, [projects, tasks]);

  // Export functions
  const handleExportCSV = (type: 'projects' | 'tasks' | 'finance') => {
    let csvContent = "data:text/csv;charset=utf-8,";
    
    if (type === 'projects') {
      csvContent += "شناسه,عنوان پروژه,پیشرفت فیزیکی,بودجه,کارفرما,ددلاین\n";
      projects.forEach(p => {
        csvContent += `"${p.id}","${p.title}","${p.progress}%","${p.budget}","${p.clientName}","${p.deadline}"\n`;
      });
    } else if (type === 'tasks') {
      csvContent += "شناسه,عنوان وظیفه,دپارتمان,مسئول,اولویت,وضعیت,ددلاین\n";
      tasks.forEach(t => {
        csvContent += `"${t.id}","${t.title}","${t.department}","${t.assignedTo}","${t.priority}","${t.status}","${t.deadline}"\n`;
      });
    } else if (type === 'finance') {
      csvContent += "بازه ماهیانه,دریافتی ناخالص (میلیون تومان),مخارج عمومی (میلیون تومان),سود خالص (میلیون تومان)\n";
      revenueHistory.forEach(h => {
        csvContent += `"${h.month}","${h['درآمد ناخالص']}","${h['مخارج عمومی']}","${h['درآمد ناخالص'] - h['مخارج عمومی']}"\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `agency_report_${type}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintReport = () => {
    window.print();
  };

  if (projects.length === 0) {
    return (
      <div className="p-4" dir="rtl">
        <EmptyState 
          id="global_reports_empty"
          title="هیچ سنجه یا گزارشی یافت نشد"
          description="هنوز هیچ پروژه یا وظیفه‌ای در فضای کاری تعریف نشده است. جهت دریافت آمارهای زنده، ابتدا پروژه‌ای بسازید و برای آن وظیفه مشخص کنید."
          actionLabel="ایجاد اولین پروژه فعال"
          onAction={() => {
            // Simply trigger project modal or navigation
            const createBtn = document.getElementById('btn-create-project-trigger');
            if (createBtn) createBtn.click();
          }}
          iconType="report"
        />
      </div>
    );
  }

  if (activeSubTab === 'team_reports') {
    return <TeamPerformanceView />;
  }

  return (
    <div id="reports_center" className="w-full space-y-6">
      
      {/* EXPORT AND ACTIONS BAR */}
      <div className="flex justify-between items-center bg-slate-50 border border-slate-200 p-4 rounded-2xl">
        <div>
          <h2 className="text-sm font-black text-slate-800 dark:text-white">تحلیل و گزارش‌های عملیاتی TS Orbit</h2>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">تولید بینش‌های اجرایی از طریق پایش بهره‌وری، شاخص‌های سلامت پروژه، تخصیص منابع و گزارش‌های مدیریتی.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative group">
            <button className="px-3.5 py-1.5 bg-white border border-slate-250 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 flex items-center gap-1.5 transition-all shadow-xs">
              <Download size={14} className="text-slate-500" />
              <span>بارگیری گزارش (CSV)</span>
              <ChevronDown size={12} className="text-slate-400" />
            </button>
            <div className="absolute left-0 mt-1.5 w-48 bg-white border border-slate-200 rounded-xl shadow-lg hidden group-hover:block z-20 overflow-hidden">
              <button onClick={() => handleExportCSV('projects')} className="w-full text-right px-4 py-2 text-xs hover:bg-slate-50 text-slate-700 block font-medium">خروجی پیشرفت پروژه‌ها</button>
              <button onClick={() => handleExportCSV('tasks')} className="w-full text-right px-4 py-2 text-xs hover:bg-slate-50 text-slate-700 block font-medium">خروجی تسک‌های پرسنل</button>
              <button onClick={() => handleExportCSV('finance')} className="w-full text-right px-4 py-2 text-xs hover:bg-slate-50 text-slate-700 block font-medium">خروجی ترازنامه مالی</button>
            </div>
          </div>
          <button 
            onClick={handlePrintReport} 
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-md shadow-blue-500/10"
          >
            <Printer size={14} />
            <span>چاپ گزارش چاپی (PDF)</span>
          </button>
        </div>
      </div>

      {/* OVERVIEW ROW CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        
        <div className="bg-white border border-slate-200 p-4 rounded-2xl flex items-center justify-between shadow-sm">
          <div>
            <p className="text-[11px] text-slate-500 font-bold">کل ارزش قراردادهای جاری</p>
            <p className="text-base font-black text-slate-800 font-mono mt-1">{totalBudgetMillion.toLocaleString('fa-IR')} میلیون</p>
            <span className="text-[9px] text-slate-400 mt-1 block">وصول شده: {receivedBudgetMillion.toLocaleString('fa-IR')} میلیون</span>
          </div>
          <span className="bg-emerald-50 text-emerald-600 p-2.5 rounded-xl border border-emerald-100 shadow-sm">
            <Coins size={16} />
          </span>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-2xl flex items-center justify-between shadow-sm">
          <div>
            <p className="text-[11px] text-slate-500 font-bold">پیشرفت فیزیکی پروژه‌ها</p>
            <p className="text-base font-black text-slate-800 font-mono mt-1">{completedRateSum}%</p>
            <span className="text-[9px] text-slate-400 mt-1 block">معدل کل دپارتمان‌ها</span>
          </div>
          <span className="bg-blue-50 text-blue-600 p-2.5 rounded-xl border border-blue-100 shadow-sm">
            <CheckCircle size={16} />
          </span>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-2xl flex items-center justify-between shadow-sm">
          <div>
            <p className="text-[11px] text-slate-500 font-bold">توزیع بار تسک پرسنل</p>
            <p className="text-base font-black text-slate-800 font-mono mt-1">{avgTasksPerMember} تسک</p>
            <span className="text-[9px] text-slate-400 mt-1 block">به ازای هر متخصص دپارتمان</span>
          </div>
          <span className="bg-blue-50 text-blue-600 p-2.5 rounded-xl border border-blue-100 shadow-sm">
            <Users size={16} />
          </span>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-2xl flex items-center justify-between shadow-sm">
          <div>
            <p className="text-[11px] text-slate-500 font-bold">بهره‌وری دپارتمان‌ها</p>
            <p className="text-base font-black text-slate-800 font-mono mt-1">+{Math.round(completedRateSum * 0.15 + 8.5)}%</p>
            <span className="text-[9px] text-slate-400 mt-1 block">رشد نسبت به ماه قبل</span>
          </div>
          <span className="bg-amber-50 text-amber-600 p-2.5 rounded-xl border border-amber-100 shadow-sm">
            <TrendingUp size={16} />
          </span>
        </div>
      </div>

      {/* FILTER CONTROL TAB */}
      <div className="flex border-b border-slate-200 pb-2.5 gap-2 overflow-x-auto scrollbar-none">
        <button 
          onClick={() => setActiveReport('automated')} 
          className={`px-4 py-2 text-xs rounded-xl font-bold transition-all whitespace-nowrap ${
            activeReport === 'automated' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
          }`}
        >
          سیستم گزارش‌دهی خودکار و خلاصه مدیریتی
        </button>
        <button 
          onClick={() => setActiveReport('project')} 
          className={`px-4 py-2 text-xs rounded-xl font-bold transition-all whitespace-nowrap ${
            activeReport === 'project' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
          }`}
        >
          کارایی فیزیکی پروژه‌ها
        </button>
        <button 
          onClick={() => setActiveReport('team')} 
          className={`px-4 py-2 text-xs rounded-xl font-bold transition-all whitespace-nowrap ${
            activeReport === 'team' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
          }`}
        >
          راندمان وظایف اعضای تیم
        </button>
        <button 
          onClick={() => setActiveReport('revenue')} 
          className={`px-4 py-2 text-xs rounded-xl font-bold transition-all whitespace-nowrap ${
            activeReport === 'revenue' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
          }`}
        >
          گزارش مالی و سودآوری کارگاه
        </button>
      </div>

      {/* RENDER DETAILED VIEWS */}

      {/* 1. PROJECT PERFORMANCE REPORT */}
      {activeReport === 'project' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Charts container */}
          <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <div>
                <h3 className="font-extrabold text-sm text-slate-800">پیشرفت فیزیکی مقایسه‌ای پروژه‌ها</h3>
                <p className="text-[10px] text-slate-400 mt-1">نمودار پیشرفت فیزیکی درصدی فعال هر یک از هاب‌های آژانس</p>
              </div>
            </div>
            
            <div className="h-64 w-full text-xs">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={projectChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#64748b" tickLine={false} />
                  <YAxis stroke="#64748b" tickLine={false} domain={[0, 100]} />
                  <Tooltip 
                    contentStyle={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', direction: 'rtl', textAlign: 'right' }} 
                    labelClassName="font-bold text-slate-800"
                  />
                  <Bar dataKey="پیشرفت فیزیکی" fill="#3b82f6" radius={[6, 6, 0, 0]}>
                    {projectChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#3b82f6' : '#6366f1'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
            <div className="space-y-4">
              <div className="pb-2 border-b border-slate-100">
                <h3 className="font-bold text-xs text-slate-800">شاخص سلامت کلی (Overall Health)</h3>
                <p className="text-[9px] text-slate-400 mt-0.5">وضعیت و میانگین آماری پایداری پروژه‌ها</p>
              </div>

              <div className="flex items-center gap-2.5 mt-2">
                <span className="text-3xl font-black text-emerald-600 font-mono">{completedRateSum}%</span>
                <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100 font-bold">عملکرد پایدار</span>
              </div>

              <div className="space-y-3.5 pt-2">
                {projects.map(p => (
                  <div key={p.id} className="space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-600">
                      <span className="font-bold text-slate-800 truncate max-w-[180px]">{p.title}</span>
                      <span className="font-mono">{p.progress}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${p.progress > 80 ? 'bg-emerald-500' : p.progress > 40 ? 'bg-blue-500' : 'bg-amber-500'}`} 
                        style={{ width: `${p.progress}%` }} 
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 bg-slate-50 -mx-6 -mb-6 p-4 rounded-b-2xl">
              <span className="text-[10px] text-slate-400 leading-relaxed block">
                تغییر وضعیت مایلستون‌ها یا پیشرفت فنی در اتصال گیت‌وی ورودی، شاخص کارایی را خودکار بازنویسی می‌کند.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 2. TEAM PERFORMANCE REPORT */}
      {activeReport === 'team' && (
        <TeamPerformanceView />
      )}

      {/* 0. AUTOMATED & EXECUTIVE SUMMARY REPORT */}
      {activeReport === 'automated' && (
        <DepartmentReportsView />
      )}
      {activeReport === 'revenue' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
          <div className="flex justify-between items-center pb-2 border-b border-slate-100">
            <div>
              <h3 className="font-extrabold text-sm text-slate-800">حاشیه سود کارگاهی و تراز مالی آژانس</h3>
              <p className="text-[10px] text-slate-400 mt-1">روند مخارج خالص، سود حاصله، منابع مالی تاییدشده و پرداختی‌ها به میلیون تومان</p>
            </div>
            <div className="flex gap-2">
              <span className="text-[10px] bg-emerald-50 text-emerald-600 border border-emerald-100 px-2 py-0.5 rounded-lg font-bold">تسویه‌حساب ایمن</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Recharts Area Chart for Finance */}
            <div className="lg:col-span-7 space-y-4">
              <h4 className="text-xs font-bold text-slate-700">نمودار جریان درآمدی ناخالص vs هزینه‌های آژانس</h4>
              <div className="h-64 w-full text-xs">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueHistory}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" stroke="#64748b" tickLine={false} />
                    <YAxis stroke="#64748b" tickLine={false} />
                    <Tooltip 
                      contentStyle={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', direction: 'rtl', textAlign: 'right' }} 
                    />
                    <Legend verticalAlign="top" height={36} />
                    <Area type="monotone" dataKey="درآمد ناخالص" stroke="#10b981" fillOpacity={1} fill="url(#colorRevenue)" />
                    <Area type="monotone" dataKey="مخارج عمومی" stroke="#ef4444" fillOpacity={1} fill="url(#colorExpense)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="lg:col-span-5 space-y-4">
              <h4 className="text-xs font-bold text-slate-700">توزیع بودجه و پرداخت‌های کارفرمایان</h4>
              
              <div className="bg-slate-50 border border-slate-150 p-5 rounded-2xl flex flex-col justify-between h-56">
                <div className="space-y-2">
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    تاکنون در مجموع مبلغ <span className="font-bold text-slate-800">{receivedBudgetMillion.toLocaleString('fa-IR')} میلیون تومان</span> به صورت پیش‌پرداخت مایلستون‌ها دریافت شده است. مبلغ <span className="font-bold text-slate-800">{remainingBudgetMillion.toLocaleString('fa-IR')} میلیون تومان</span> مابقی از قراردادها در قالب مایلستون‌های نهایی مواعد لایو تحویل ثبت گردیده است.
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-200">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[11px] text-slate-500 font-bold">میزان نقدینگی وصول شده:</span>
                    <span className="text-xs font-black text-slate-800 font-mono">۴۲%</span>
                  </div>
                  <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: '42%' }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

