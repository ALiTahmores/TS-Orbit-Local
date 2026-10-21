import React, { useState, useEffect } from 'react';
import { useProject } from '../context/ProjectContext';
import { CustomSelect, CustomSelectOption } from './common/CustomSelect';
import * as LucideIcons from 'lucide-react';

const MODULE_ICONS_LIST = [
  { value: 'Box', label: 'ماژول استاندارد (Box)' },
  { value: 'Layers', label: 'لایه‌ها (Layers)' },
  { value: 'Database', label: 'پایگاه داده (Database)' },
  { value: 'Folder', label: 'پوشه (Folder)' },
  { value: 'FileText', label: 'اسناد (FileText)' },
  { value: 'CheckSquare', label: 'تسک‌ها (CheckSquare)' },
  { value: 'Sliders', label: 'تنظیمات (Sliders)' },
  { value: 'Grid', label: 'جدول (Grid)' },
];

const detectIconByKeywords = (name: string): string => {
  const lowerName = name.toLowerCase();
  if (/توسعه|فنی|برنامه|کد|نرم|سایت|it|dev|tech/i.test(lowerName)) return 'Code';
  if (/طراحی|گرافیک|دیزاین|رابط|بصری|ui|ux|design/i.test(lowerName)) return 'Palette';
  if (/مارکتینگ|فروش|بازاریابی|تبلیغات|سئو|محتوا|seo|marketing/i.test(lowerName)) return 'Megaphone';
  if (/مالی|حسابداری|اداری|پول|خرید|finance/i.test(lowerName)) return 'CircleDollarSign';
  if (/منابع|انسانی|استخدام|پرسنل|تیم|hr/i.test(lowerName)) return 'Users';
  if (/عملیات|زیرساخت|شبکه|پشتیبانی/i.test(lowerName)) return 'Layers';
  return 'Building2'; // Default fallback icon
};

const PRESET_DEPARTMENTS = [
  {
    name: 'توسعه و فنی',
    icon: 'Code',
    color: '#3b82f6',
    description: 'توسعه نرم‌افزار، وب‌سایت و زیرساخت'
  },
  {
    name: 'دیجیتال مارکتینگ',
    icon: 'Megaphone',
    color: '#f97316',
    description: 'سئو، شبکه‌های اجتماعی و کمپین‌های تبلیغاتی'
  },
  {
    name: 'طراحی و گرافیک',
    icon: 'Palette',
    color: '#ec4899',
    description: 'طراحی رابط کاربری، هویت بصری و گرافیک'
  },
  {
    name: 'مالی و اداری',
    icon: 'CircleDollarSign',
    color: '#10b981',
    description: 'حسابداری، قراردادها و امور مالی'
  },
  {
    name: 'منابع انسانی',
    icon: 'Users',
    color: '#8b5cf6',
    description: 'جذب نیرو، ارزیابی عملکرد و رفاهیات'
  }
];

export const OrgBuilder: React.FC = () => {
  const {
    departments,
    teamMembers,
    moduleDefinitions,
    moduleInstances,
    departmentModules,
    teams,
    createDepartment,
    updateDepartment,
    updateOrgTeam,
    deleteOrgTeam,
    updateModuleDefinition,
    deleteDepartment,
    createModule,
    deleteModule,
    instantiateModule,
    createOrgTeam,
    saveModuleTemplate,
    fetchTemplates
  } = useProject();

  const [editingDept,setEditingDept]=useState<string|null>(null);
  const [editingTeam,setEditingTeam]=useState<string|null>(null);
  const [editingModule,setEditingModule]=useState<string|null>(null);
  const [formError,setFormError]=useState('');
  const perform=async(operation:()=>Promise<any>)=>{setFormError('');try{await operation();}catch(error){setFormError(error instanceof Error?error.message:'عملیات انجام نشد.');throw error;}};
  const [activeTab, setActiveTab] = useState<'depts' | 'modules' | 'teams' | 'templates'>('depts');

  // Form States - Department
  const [deptName, setDeptName] = useState('');
  const [deptIcon, setDeptIcon] = useState('Building2');
  const [deptColor, setDeptColor] = useState('#3B82F6');
  const [deptDesc, setDeptDesc] = useState('');
  const [deptLeader, setDeptLeader] = useState('');

  // Form States - Module Definition
  const [modName, setModName] = useState('');
  const [modIcon, setModIcon] = useState('Box');
  const [modColor, setModColor] = useState('#10B981');
  const [modDesc, setModDesc] = useState('');
  const [modFields, setModFields] = useState<string>('["عنوان تسک", "توضیحات", "وضعیت"]');

  // Form States - Module Instantiation
  const [instModDefId, setInstModDefId] = useState('');
  const [instDeptId, setInstDeptId] = useState('');
  const [instName, setInstName] = useState('');

  // Form States - Team
  const [teamName, setTeamName] = useState('');
  const [teamDeptId, setTeamDeptId] = useState('');
  const [teamLeaderId, setTeamLeaderId] = useState('');
  const [teamMembersList, setTeamMembersList] = useState<string[]>([]);
  const [teamDesc, setTeamDesc] = useState('');
  const [teamColor, setTeamColor] = useState('#155DFC');

  // Form States - Template
  const [tpls, setTpls] = useState<any[]>([]);
  const [tplName, setTplName] = useState('');
  const [tplDesc, setTplDesc] = useState('');

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    if (fetchTemplates) {
      const data = await fetchTemplates();
      setTpls(data || []);
    }
  };

  const renderIcon = (name: string, size = 16, className = "") => {
    const IconComp = (LucideIcons as any)[name] || LucideIcons.Box;
    return <IconComp size={size} className={className} />;
  };

  // Handlers
  const handleCreateDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptName.trim()) return;
    const finalIcon = deptIcon || detectIconByKeywords(deptName);
    await perform(()=>(editingDept ? updateDepartment(editingDept,{
      name: deptName,
      icon: finalIcon,
      color: deptColor,
      description: deptDesc,
      leaderId: deptLeader
    }) : createDepartment({name:deptName,icon:finalIcon,color:deptColor,description:deptDesc,leaderId:deptLeader})));
    setEditingDept(null);
    setDeptName('');
    setDeptDesc('');
    setDeptLeader('');
    setDeptIcon('Building2');
  };

  const handleCreateModuleDef = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modName.trim()) return;
    let structure = {};
    try {
      structure = { fields: JSON.parse(modFields) };
    } catch { setFormError('ساختار فیلدها باید یک آرایه JSON معتبر باشد.');return; }
    await perform(()=>(editingModule ? updateModuleDefinition(editingModule,{
      name: modName,
      icon: modIcon,
      color: modColor,
      description: modDesc,
      structure
    }) : createModule({name:modName,icon:modIcon,color:modColor,description:modDesc,structure})));
    setEditingModule(null);
    setModName('');
    setModDesc('');
  };

  const handleInstantiate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instModDefId || !instDeptId) return;
    await instantiateModule({
      definitionId: instModDefId,
      departmentId: instDeptId,
      name: instName || undefined
    });
    setInstModDefId('');
    setInstDeptId('');
    setInstName('');
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim() || !teamDeptId) return;
    await perform(()=>(editingTeam ? updateOrgTeam(editingTeam,{
      name: teamName,
      departmentId: teamDeptId,
      leaderId: teamLeaderId,
      memberIds: teamMembersList,
      description: teamDesc,
      color: teamColor
    }) : createOrgTeam({name:teamName,departmentId:teamDeptId,leaderId:teamLeaderId,memberIds:teamMembersList,description:teamDesc,color:teamColor})));
    setEditingTeam(null);
    setTeamName('');
    setTeamDesc('');
    setTeamLeaderId('');
    setTeamMembersList([]);
  };

  const handleSaveTpl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tplName.trim()) return;
    await saveModuleTemplate({
      name: tplName,
      description: tplDesc,
      structure: { departments, moduleDefinitions, teams }
    });
    setTplName('');
    setTplDesc('');
    loadTemplates();
  };

  const toggleMemberSelection = (userId: string) => {
    setTeamMembersList(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  return (
    <div className="w-full space-y-6 text-right" style={{ direction: 'rtl' }}>
      {formError && <p role="alert" className="p-3 text-red-600">{formError}</p>}
      {/* Header Banner */}
      <div className="bg-surface-primary border border-border-primary rounded-2xl p-6 relative overflow-hidden shadow-sm">
        <div className="absolute top-0 left-0 w-32 h-32 bg-[#155DFC]/5 blur-3xl rounded-full" />
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          <div>
            <h1 className="text-xl font-black text-text-primary flex items-center gap-2">
              <span className="p-2 bg-[#155DFC]/10 text-[#155DFC] rounded-xl">
                {renderIcon('Cpu', 20)}
              </span>
              پیکربندی هوشمند و سازمان‌دهی آژانس
            </h1>
            <p className="text-xs text-text-secondary mt-2">
              دپارتمان‌ها، تیم‌های فنی و ماژول‌های اختصاصی خود را بسازید. سیستم به صورت کاملاً پویا با ساختار اختصاصی کسب‌وکار شما منطبق می‌شود.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border-primary gap-1">
        <button
          onClick={() => setActiveTab('depts')}
          className={`px-4 py-2.5 text-xs font-black border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'depts'
              ? 'border-[#155DFC] text-[#155DFC]'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          {renderIcon('Building2', 14)}
          دپارتمان‌ها و واحدها
        </button>
        <button
          onClick={() => setActiveTab('modules')}
          className={`px-4 py-2.5 text-xs font-black border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'modules'
              ? 'border-[#155DFC] text-[#155DFC]'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          {renderIcon('Box', 14)}
          سازنده و انتساب ماژول‌ها
        </button>
        <button
          onClick={() => setActiveTab('teams')}
          className={`px-4 py-2.5 text-xs font-black border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'teams'
              ? 'border-[#155DFC] text-[#155DFC]'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          {renderIcon('Users', 14)}
          مدیریت تیم‌ها و اتصالات
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={`px-4 py-2.5 text-xs font-black border-b-2 transition-all flex items-center gap-2 ${
            activeTab === 'templates'
              ? 'border-[#155DFC] text-[#155DFC]'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          {renderIcon('Layers', 14)}
          قالب‌های ساختاری سازمان
        </button>
      </div>

      {/* Main Panel views */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Form/List */}
        <div className="lg:col-span-2 space-y-6">
          {activeTab === 'depts' && (
            <div className="bg-surface-primary border border-border-primary rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-text-primary">دپارتمان‌های فعال سازمان</h3>
              
              {departments.length === 0 ? (
                <div className="text-center py-8 text-xs text-text-secondary">
                  هیچ دپارتمانی تعریف نشده است. از فرم روبرو اولین دپارتمان را ثبت فرمایید.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {departments.map((dept: any) => {
                    const connectedTeams = teams.filter((t: any) => t.departmentId === dept.id);
                    const leader = teamMembers.find((u: any) => u.id === dept.leaderId);

                    return (
                      <div key={dept.id} className="border border-border-primary/60 rounded-xl p-4 flex flex-col justify-between hover:border-border-primary transition-all relative group">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black" style={{ backgroundColor: dept.color || '#3B82F6' }}>
                              {renderIcon(dept.icon, 18)}
                            </div>
                            <div>
                              <h4 className="text-xs font-black text-text-primary">{dept.name}</h4>
                              <p className="text-[10px] text-text-secondary mt-1 max-w-[180px] truncate">{dept.description || 'بدون توضیحات'}</p>
                            </div>
                          </div>
                          
                          <button
                            onClick={() => {void perform(()=>deleteDepartment(dept.id)).catch(()=>{});}}
                            className="p-1 text-text-secondary hover:text-brand-danger rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                            title="حذف دپارتمان"
                          >
                            {renderIcon('Trash2', 13)}
                          </button>
                          <button type="button" onClick={()=>{setEditingDept(dept.id);setDeptName(dept.name);setDeptIcon(dept.icon);setDeptColor(dept.color);setDeptDesc(dept.description || '');setDeptLeader(dept.leaderId || '');}} className="text-xs text-blue-600">ویرایش</button>
                        </div>

                        <div className="border-t border-border-primary/50 mt-4 pt-3 flex items-center justify-between text-[10px] text-text-secondary">
                          <div>
                            <span className="font-bold">مدیر دپارتمان:</span> {leader?.name || 'تعیین نشده'}
                          </div>
                          <div>
                            <span className="font-bold">تعداد تیم‌ها:</span> {connectedTeams.length} تیم
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'modules' && (
            <div className="space-y-6">
              <div className="bg-surface-primary border border-border-primary rounded-xl p-5 space-y-4">
                <h3 className="text-sm font-bold text-text-primary">تعاریف ماژول‌های سیستم</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {moduleDefinitions.map((mod: any) => (
                    <div key={mod.id} className="border border-border-primary/60 rounded-xl p-4 flex items-start justify-between group hover:border-border-primary transition-all">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white" style={{ backgroundColor: mod.color || '#10B981' }}>
                          {renderIcon(mod.icon, 16)}
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-text-primary">{mod.name}</h4><button type="button" onClick={()=>{setEditingModule(mod.id);setModName(mod.name);setModDesc(mod.description || '');setModIcon(mod.icon);setModColor(mod.color);setModFields(JSON.stringify(mod.structure?.fields || []));}} className="text-xs text-blue-600">ویرایش</button>
                          <p className="text-[10px] text-text-secondary mt-1">{mod.description || 'بدون توضیحات'}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => {void perform(()=>deleteModule(mod.id)).catch(()=>{});}}
                        className="p-1 text-text-secondary hover:text-brand-danger rounded-lg opacity-0 group-hover:opacity-100"
                      >
                        {renderIcon('Trash2', 13)}
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-surface-primary border border-border-primary rounded-xl p-5 space-y-4">
                <h3 className="text-sm font-bold text-text-primary">پیکربندی و تخصیص ماژول به دپارتمان</h3>
                
                {moduleInstances.length === 0 ? (
                  <div className="text-center py-6 text-xs text-text-secondary">
                    هیچ تخصیصی انجام نشده است. از فرم روبرو برای اتصال ماژول استفاده فرمایید.
                  </div>
                ) : (
                  <div className="w-full overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
                    <table className="w-full text-xs text-right min-w-[700px]">
                      <thead>
                        <tr className="border-b border-border-primary/50 text-text-secondary font-bold">
                          <th className="pb-2">عنوان نمونه</th>
                          <th className="pb-2">نوع ماژول</th>
                          <th className="pb-2">دپارتمان میزبان</th>
                          <th className="pb-2">شناسه تخصیص</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-primary/30">
                        {moduleInstances.map((inst: any) => {
                          const mapping = departmentModules.find((dm: any) => dm.moduleId === inst.id);
                          const dept = departments.find((d: any) => d.id === mapping?.departmentId);
                          const def = moduleDefinitions.find((m: any) => m.id === inst.definitionId);

                          return (
                            <tr key={inst.id} className="text-text-primary">
                              <td className="py-2.5 font-bold">{inst.name}</td>
                              <td className="py-2.5">
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] text-white" style={{ backgroundColor: def?.color || '#94A3B8' }}>
                                  {renderIcon(def?.icon || 'Box', 10)}
                                  {def?.name}
                                </span>
                              </td>
                              <td className="py-2.5 text-text-secondary">{dept?.name || 'ناشناس'}</td>
                              <td className="py-2.5 font-mono text-[10px]">{inst.id}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'teams' && (
            <div className="bg-surface-primary border border-border-primary rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
                تیم‌های فعال و کانال‌های اتوماتیک متصل
              </h3>
              
              {teams.length === 0 ? (
                <div className="text-center py-8 text-xs text-text-secondary">
                  هیچ تیمی ثبت نشده است. از فرم روبرو برای ایجاد تیم اقدام فرمایید.
                </div>
              ) : (
                <div className="space-y-4">
                  {teams.map((team: any) => {
                    const dept = departments.find((d: any) => d.id === team.departmentId);
                    const leader = teamMembers.find((u: any) => u.id === team.leaderId);

                    return (
                      <div key={team.id} className="border border-border-primary/60 rounded-xl p-4 hover:border-border-primary transition-all space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: team.color || '#155DFC' }}>
                              {team.avatar || team.name.substring(0,1)}
                            </div>
                            <div>
                              <h4 className="text-xs font-black text-text-primary">{team.name}</h4><button type="button" className="text-xs text-blue-600" onClick={()=>{setEditingTeam(team.id);setTeamName(team.name);setTeamDeptId(team.departmentId || '');setTeamLeaderId(team.leaderId || '');setTeamMembersList(team.memberIds || []);setTeamDesc(team.description || '');setTeamColor(team.color || '#155DFC');}}>ویرایش</button><button type="button" className="text-xs text-red-600 px-2" onClick={()=>{void perform(()=>deleteOrgTeam(team.id)).catch(()=>{});}}>حذف</button>
                              <p className="text-[10px] text-text-secondary mt-0.5">دپارتمان: {dept?.name || 'ناشناس'}</p>
                            </div>
                          </div>
                          <span className="text-[10px] bg-[#155DFC]/15 text-[#155DFC] px-2 py-0.5 rounded-full font-bold">
                            تعداد پرسنل: {team.membersCount} نفر
                          </span>
                        </div>

                        {team.description && (
                          <p className="text-[10.5px] text-text-secondary bg-hover-overlay p-2 rounded-lg leading-relaxed">
                            {team.description}
                          </p>
                        )}

                        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border-primary/40">
                          <span className="text-[9.5px] text-text-secondary flex items-center gap-1 bg-hover-overlay px-2 py-1 rounded-md">
                            {renderIcon('Lock', 10, "text-brand-warning")} گپ خصوصی تیمی
                          </span>
                          <span className="text-[9.5px] text-text-secondary flex items-center gap-1 bg-hover-overlay px-2 py-1 rounded-md">
                            {renderIcon('Megaphone', 10, "text-brand-success")} کانال عمومی
                          </span>
                          <span className="text-[9.5px] text-text-secondary flex items-center gap-1 bg-hover-overlay px-2 py-1 rounded-md">
                            {renderIcon('Bell', 10, "text-[#155DFC]")} کانال اعلانات
                          </span>
                          <span className="text-[9.5px] text-text-secondary flex items-center gap-1 bg-hover-overlay px-2 py-1 rounded-md">
                            {renderIcon('ShieldCheck', 10, "text-brand-info")} کانال مدیران تیمی
                          </span>
                        </div>

                        <div className="text-[9px] text-text-secondary flex justify-between items-center mt-1">
                          <span>مدیر تیم: <strong className="text-text-primary">{leader?.name || 'تعیین نشده'}</strong></span>
                          <span className="font-mono text-[9px]">ID: {team.id}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'templates' && (
            <div className="bg-surface-primary border border-border-primary rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-text-primary">لیست قالب‌های ساختاری</h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                می‌توانید پیکربندی فعلی دپارتمان‌ها و الگوهای ساختار سازمانی خود را به عنوان قالب ذخیره کنید تا در پروژه‌های بعدی از نو ساخته نشوند.
              </p>

              {tpls.length === 0 ? (
                <div className="text-center py-8 text-xs text-text-secondary">
                  هیچ قالبی ثبت نشده است. از فرم روبرو اولین الگو را ثبت فرمایید.
                </div>
              ) : (
                <div className="space-y-3">
                  {tpls.map((t: any) => (
                    <div key={t.id} className="border border-border-primary/50 rounded-xl p-4 hover:border-border-primary transition-all">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black text-text-primary">{t.name}</h4>
                        <span className="text-[9px] text-[#155DFC] bg-[#155DFC]/10 px-2 py-0.5 rounded-full font-bold">
                          ثبت شده توسط: {t.createdBy}
                        </span>
                      </div>
                      <p className="text-[10px] text-text-secondary mt-1">{t.description || 'بدون توضیحات'}</p>
                      <div className="mt-3 pt-2 border-t border-border-primary/40 flex justify-between items-center text-[9px] text-text-secondary">
                        <span>قالب ساختار چند دپارتمانه</span>
                        <button className="px-2.5 py-1 bg-[#155DFC] hover:bg-[#0E50D6] text-white rounded-md font-bold transition-all">
                          اعمال این قالب به عنوان ساختار جدید
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right 1 Col: Dynamic form sidebar based on active sub tab */}
        <div className="space-y-6">
          {activeTab === 'depts' && (
            <div className="bg-surface-primary border border-border-primary rounded-xl p-5 space-y-4">
              <h3 className="text-xs font-black text-text-primary flex items-center gap-1.5">
                {renderIcon('PlusCircle', 14, "text-[#155DFC]")}
                تعریف دپارتمان جدید
              </h3>
              
              <form onSubmit={event=>{void handleCreateDept(event).catch(error=>setFormError(error instanceof Error?error.message:'عملیات انجام نشد.'));}} className="space-y-3">
                {/* Quick-Start Department Templates (Auto-fill Chips) */}
                <div className="space-y-1.5 pb-1 border-b border-border-primary/40">
                  <div className="flex items-center gap-1.5 text-[10px] text-text-secondary font-bold">
                    <LucideIcons.Sparkles size={12} className="text-amber-500 shrink-0" />
                    <span>پیشنهادهای متداول:</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {PRESET_DEPARTMENTS.map((preset) => (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => {
                          setDeptName(preset.name);
                          setDeptIcon(preset.icon);
                          setDeptColor(preset.color);
                          setDeptDesc(preset.description);
                        }}
                        className="text-[10px] font-bold border border-border-primary/70 bg-surface-secondary/50 hover:bg-[#155DFC]/10 hover:border-[#155DFC]/50 text-text-primary hover:text-[#155DFC] rounded-full px-2.5 py-1 transition-all cursor-pointer flex items-center gap-1 shrink-0"
                      >
                        {renderIcon(preset.icon, 11, "text-[#155DFC]")}
                        <span>{preset.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-text-secondary font-bold">نام دپارتمان / واحد</label>
                  <input
                    type="text"
                    value={deptName}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDeptName(val);
                      setDeptIcon(detectIconByKeywords(val));
                    }}
                    placeholder="مثال: دپارتمان دیجیتال مارکتینگ"
                    className="w-full px-3 py-2 bg-hover-overlay border border-border-primary/60 rounded-lg text-xs focus:outline-none focus:border-[#155DFC] text-text-primary font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-text-secondary font-bold">توضیحات عملکرد</label>
                  <textarea
                    value={deptDesc}
                    onChange={(e) => setDeptDesc(e.target.value)}
                    placeholder="توضیحات وظایف این دپارتمان..."
                    rows={2}
                    className="w-full px-3 py-2 bg-hover-overlay border border-border-primary/60 rounded-lg text-xs focus:outline-none focus:border-[#155DFC] text-text-primary"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-text-secondary font-bold">رنگ نماد</label>
                    <input
                      type="color"
                      value={deptColor}
                      onChange={(e) => setDeptColor(e.target.value)}
                      className="w-full h-8 bg-hover-overlay rounded-lg cursor-pointer border-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-text-secondary font-bold">نماد هوشمند (خودکار)</label>
                    <div className="h-8 bg-hover-overlay border border-border-primary/60 rounded-lg px-3 flex items-center justify-between text-xs text-text-primary font-bold">
                      <div className="flex items-center gap-2">
                        {renderIcon(deptIcon || detectIconByKeywords(deptName), 15, "text-[#155DFC]")}
                        <span className="text-[10px] text-text-secondary font-medium">شناسایی هوشمند</span>
                      </div>
                      <LucideIcons.Sparkles size={12} className="text-amber-500 shrink-0" />
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-text-secondary font-bold">مدیر ارشد دپارتمان</label>
                  <CustomSelect
                    options={[
                      { value: '', label: 'انتخاب متخصص ارشد...' },
                      ...teamMembers.map((member: any) => ({ value: member.id, label: member.name }))
                    ]}
                    value={deptLeader}
                    onChange={(val) => setDeptLeader(val)}
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-[#155DFC] hover:bg-[#0E50D6] text-white font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  {renderIcon('Plus', 12)}
                  {editingDept?'ذخیره تغییرات دپارتمان':'ایجاد دپارتمان جدید'}
                </button>
              </form>
            </div>
          )}

          {activeTab === 'modules' && (
            <div className="space-y-6">
              {/* Form 1: New Module Def */}
              <div className="bg-surface-primary border border-border-primary rounded-xl p-5 space-y-4">
                <h3 className="text-xs font-black text-text-primary flex items-center gap-1.5">
                  {renderIcon('PlusCircle', 14, "text-brand-success")}
                  ایجاد یک ماژول جدید در سیستم
                </h3>
                
                <form onSubmit={event=>{void handleCreateModuleDef(event).catch(error=>setFormError(error instanceof Error?error.message:'عملیات انجام نشد.'));}} className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-text-secondary font-bold">نام ماژول</label>
                    <input
                      type="text"
                      value={modName}
                      onChange={(e) => setModName(e.target.value)}
                      placeholder="مثال: سئو کلاینت"
                      className="w-full px-3 py-2 bg-hover-overlay border border-border-primary/60 rounded-lg text-xs focus:outline-none focus:border-brand-success text-text-primary font-bold"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-text-secondary font-bold">توضیحات ماژول</label>
                    <input
                      type="text"
                      value={modDesc}
                      onChange={(e) => setModDesc(e.target.value)}
                      placeholder="توضیحات اهداف ماژول"
                      className="w-full px-3 py-2 bg-hover-overlay border border-border-primary/60 rounded-lg text-xs focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] text-text-secondary font-bold">رنگ ماژول</label>
                      <input
                        type="color"
                        value={modColor}
                        onChange={(e) => setModColor(e.target.value)}
                        className="w-full h-8 bg-hover-overlay rounded-lg border-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-text-secondary font-bold">نماد ماژول</label>
                      <CustomSelect
                        options={MODULE_ICONS_LIST}
                        value={modIcon}
                        onChange={(val) => setModIcon(val)}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-text-secondary font-bold">ساختار فیلدهای داده (آرایه JSON)</label>
                    <input
                      type="text"
                      value={modFields}
                      onChange={(e) => setModFields(e.target.value)}
                      className="w-full px-3 py-2 bg-hover-overlay border border-border-primary/60 rounded-lg text-xs font-mono text-left"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2 bg-brand-success text-white font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 hover:bg-opacity-90"
                  >
                    {renderIcon('Plus', 12)}
                    تعریف ماژول پایه
                  </button>
                </form>
              </div>

              {/* Form 2: Instantiate module and bind to department */}
              <div className="bg-surface-primary border border-border-primary rounded-xl p-5 space-y-4">
                <h3 className="text-xs font-black text-text-primary flex items-center gap-1.5">
                  {renderIcon('Layers', 14, "text-[#155DFC]")}
                  تخصیص ماژول به دپارتمان
                </h3>
                
                <form onSubmit={event=>{void handleInstantiate(event).catch(error=>setFormError(error instanceof Error?error.message:'عملیات انجام نشد.'));}} className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-text-secondary font-bold">نام اختصاصی نمونه</label>
                    <input
                      type="text"
                      value={instName}
                      onChange={(e) => setInstName(e.target.value)}
                      placeholder="مثال: ردیاب اهداف سئو کلاینت (پایلوت)"
                      className="w-full px-3 py-2 bg-hover-overlay border border-border-primary/60 rounded-lg text-xs focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-text-secondary font-bold">انتخاب نوع ماژول</label>
                    <CustomSelect
                      options={[
                        { value: '', label: 'نوع ماژول را انتخاب کنید...' },
                        ...moduleDefinitions.map((md: any) => ({ value: md.id, label: md.name }))
                      ]}
                      value={instModDefId}
                      onChange={(val) => setInstModDefId(val)}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-text-secondary font-bold">دپارتمان میزبان</label>
                    <CustomSelect
                      options={[
                        { value: '', label: 'انتخاب دپارتمان هدف...' },
                        ...departments.map((d: any) => ({ value: d.id, label: d.name }))
                      ]}
                      value={instDeptId}
                      onChange={(val) => setInstDeptId(val)}
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2 bg-[#155DFC] hover:bg-[#0E50D6] text-white font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5"
                  >
                    {renderIcon('Plus', 12)}
                    تخصیص و ساخت نمونه ماژول
                  </button>
                </form>
              </div>
            </div>
          )}

          {activeTab === 'teams' && (
            <div className="bg-surface-primary border border-border-primary rounded-xl p-5 space-y-4">
              <h3 className="text-xs font-black text-text-primary flex items-center gap-1.5">
                {renderIcon('PlusCircle', 14, "text-[#155DFC]")}
                تشکیل تیم با کانال‌های خودکار
              </h3>
              
              <form onSubmit={event=>{void handleCreateTeam(event).catch(error=>setFormError(error instanceof Error?error.message:'عملیات انجام نشد.'));}} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-text-secondary font-bold">نام تیم</label>
                  <input
                    type="text"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    placeholder="مثال: تیم متخصصان سئو فنی"
                    className="w-full px-3 py-2 bg-hover-overlay border border-border-primary/60 rounded-lg text-xs focus:outline-none font-bold text-text-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-text-secondary font-bold">دپارتمان مادر</label>
                  <CustomSelect
                    options={[
                      { value: '', label: 'دپارتمان مادر را انتخاب کنید...' },
                      ...departments.map((d: any) => ({ value: d.id, label: d.name }))
                    ]}
                    value={teamDeptId}
                    onChange={(val) => setTeamDeptId(val)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-text-secondary font-bold">سرپرست تیم (لیدر)</label>
                  <CustomSelect
                    options={[
                      { value: '', label: 'لیدر تیم را مشخص کنید...' },
                      ...teamMembers.map((member: any) => ({ value: member.id, label: member.name }))
                    ]}
                    value={teamLeaderId}
                    onChange={(val) => setTeamLeaderId(val)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-text-secondary font-bold">توضیح مأموریت تیم</label>
                  <input
                    type="text"
                    value={teamDesc}
                    onChange={(e) => setTeamDesc(e.target.value)}
                    placeholder="مأموریت کلیدی این تیم..."
                    className="w-full px-3 py-2 bg-hover-overlay border border-border-primary/60 rounded-lg text-xs focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-text-secondary font-bold">رنگ تم تیم</label>
                  <input
                    type="color"
                    value={teamColor}
                    onChange={(e) => setTeamColor(e.target.value)}
                    className="w-full h-8 bg-hover-overlay rounded-lg border-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-text-secondary font-bold">اعضای تیم را اضافه کنید</label>
                  <div className="max-h-24 overflow-y-auto border border-border-primary/60 rounded-lg p-2 space-y-1 text-right">
                    {teamMembers.map((member: any) => {
                      const isSelected = teamMembersList.includes(member.id);
                      return (
                        <button
                          key={member.id}
                          type="button"
                          onClick={() => toggleMemberSelection(member.id)}
                          className={`w-full text-right px-2 py-1 rounded text-[11px] transition-all flex items-center justify-between ${
                            isSelected ? 'bg-[#155DFC]/20 text-[#155DFC] font-bold' : 'hover:bg-hover-overlay'
                          }`}
                        >
                          <span>{member.name}</span>
                          {isSelected && renderIcon('Check', 11)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-[#155DFC] hover:bg-[#0E50D6] text-white font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  {renderIcon('Users', 12)}
                  تشکیل تیم و کانال‌های خودکار
                </button>
              </form>
            </div>
          )}

          {activeTab === 'templates' && (
            <div className="bg-surface-primary border border-border-primary rounded-xl p-5 space-y-4">
              <h3 className="text-xs font-black text-text-primary flex items-center gap-1.5">
                {renderIcon('Layers', 14, "text-[#155DFC]")}
                ذخیره قالب سازمان فعلی
              </h3>
              
              <form onSubmit={event=>{void handleSaveTpl(event).catch(error=>setFormError(error instanceof Error?error.message:'عملیات انجام نشد.'));}} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-text-secondary font-bold">نام قالب</label>
                  <input
                    type="text"
                    value={tplName}
                    onChange={(e) => setTplName(e.target.value)}
                    placeholder="مثال: ساختار استاندارد آژانس‌های سئو"
                    className="w-full px-3 py-2 bg-hover-overlay border border-border-primary/60 rounded-lg text-xs focus:outline-none font-bold text-text-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-text-secondary font-bold">توضیحات قالب ساختار</label>
                  <textarea
                    value={tplDesc}
                    onChange={(e) => setTplDesc(e.target.value)}
                    placeholder="درباره ویژگی‌های ساختار دپارتمان‌ها و تیم‌های این الگو..."
                    rows={3}
                    className="w-full px-3 py-2 bg-hover-overlay border border-border-primary/60 rounded-lg text-xs focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-[#155DFC] hover:bg-[#0E50D6] text-white font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  {renderIcon('Plus', 12)}
                  ذخیره الگو به عنوان قالب
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

