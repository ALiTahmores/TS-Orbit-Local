import React, { useState } from 'react';
import { useProject } from '../context/ProjectContext';
import * as LucideIcons from 'lucide-react';

const ACTIONS_LIST = [
  { id: 'create', label: 'ایجاد تسک/مدرک', icon: 'PlusCircle' },
  { id: 'read', label: 'مشاهده اطلاعات', icon: 'Eye' },
  { id: 'update', label: 'ویرایش ساختار', icon: 'Edit3' },
  { id: 'delete', label: 'حذف داده‌ها', icon: 'Trash2' },
  { id: 'assign', label: 'تخصیص کارشناس', icon: 'UserPlus' },
  { id: 'approve', label: 'تایید نهایی', icon: 'CheckCircle' },
  { id: 'report', label: 'خروجی گزارش', icon: 'FileText' },
  { id: 'export', label: 'اکسپورت اکسل', icon: 'Download' },
  { id: 'chat', label: 'پیام‌رسانی تیمی', icon: 'MessageSquare' },
  { id: 'notifications', label: 'دریافت نوتیفیکیشن', icon: 'Bell' }
];

export const OrgPermissions: React.FC = () => {
  const {
    departments,
    teams,
    departmentPermissions,
    updatePermission
  } = useProject();

  const [selectedDeptId, setSelectedDeptId] = useState<string>('');

  const renderIcon = (name: string, size = 14, className = "") => {
    const IconComp = (LucideIcons as any)[name] || LucideIcons.Shield;
    return <IconComp size={size} className={className} />;
  };

  // Get active department
  const activeDept = departments.find(d => d.id === selectedDeptId) || departments[0];

  // Set default if empty and depts exist
  if (!selectedDeptId && departments.length > 0) {
    setSelectedDeptId(departments[0].id);
  }

  // Get teams of active department
  const activeTeams = teams.filter(t => t.departmentId === (activeDept?.id || ''));

  const handlePermissionToggle = async (teamId: string, actionId: string, currentVal: boolean) => {
    if (!activeDept || !updatePermission) return;
    await updatePermission(activeDept.id, teamId, actionId, !currentVal);
  };

  const checkPermission = (teamId: string, actionId: string): boolean => {
    const perm = departmentPermissions.find(
      p => p.departmentId === activeDept?.id && p.role === teamId && p.action === actionId
    );
    return perm ? perm.isAllowed : false;
  };

  return (
    <div className="space-y-6 text-right animate-fade-in" style={{ direction: 'rtl' }}>
      {/* Top Banner */}
      <div className="bg-surface-primary border border-border-primary rounded-2xl p-6 relative overflow-hidden shadow-sm">
        <div className="absolute top-0 left-0 w-32 h-32 bg-brand-info/5 blur-3xl rounded-full" />
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          <div>
            <h1 className="text-xl font-black text-text-primary flex items-center gap-2">
              <span className="p-2 bg-brand-info/10 text-brand-info rounded-xl">
                {renderIcon('ShieldCheck', 20)}
              </span>
              کنترل دسترسی و مجوزهای دپارتمان‌ها
            </h1>
            <p className="text-xs text-text-secondary mt-2">
              سطوح دسترسی هر یک از تیم‌ها و نقش‌های تیمی را در سطح دپارتمان‌های مربوطه به صورت تفکیک‌شده مدیریت کنید. تغییرات به صورت بلادرنگ ذخیره می‌شوند.
            </p>
          </div>
        </div>
      </div>

      {/* Select Department Selector */}
      <div className="bg-surface-primary border border-border-primary rounded-xl p-5 space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <label className="text-xs font-black text-text-primary">دپارتمان مورد نظر را انتخاب کنید</label>
            <p className="text-[11px] text-text-secondary">مجوزها بر اساس ساختار هر دپارتمان بارگذاری می‌شوند</p>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 max-w-full">
            {departments.map((dept: any) => (
              <button
                key={dept.id}
                onClick={() => setSelectedDeptId(dept.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all ${
                  selectedDeptId === dept.id
                    ? 'bg-brand-info/10 text-brand-info border-brand-info/35 shadow-sm'
                    : 'border-border-primary hover:bg-hover-overlay text-text-secondary'
                }`}
              >
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: dept.color }} />
                {dept.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Matrix Board */}
      {activeDept ? (
        <div className="bg-surface-primary border border-border-primary rounded-xl p-5 overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border-primary/50 pb-4 mb-4">
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: activeDept.color }} />
            <h3 className="text-sm font-bold text-text-primary">ماتریس مجوزهای دپارتمان: {activeDept.name}</h3>
          </div>

          {activeTeams.length === 0 ? (
            <div className="text-center py-12 text-xs text-text-secondary space-y-2">
              <p>هیچ تیمی در این دپارتمان تعریف نشده است.</p>
              <p className="text-[11px]">ابتدا در بخش "سازنده دپارتمان و ماژول" برای دپارتمان {activeDept.name} تیمی تعریف کنید تا بتوانید مجوزهای آن را مدیریت نمایید.</p>
            </div>
          ) : (
            <div className="w-full overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
              <table className="w-full text-right text-xs min-w-[700px]">
                <thead>
                  <tr className="border-b border-border-primary/50 text-text-secondary font-black">
                    <th className="pb-3 pr-2 w-48 text-right">تیم‌ها و نقش‌ها</th>
                    {ACTIONS_LIST.map(act => (
                      <th key={act.id} className="pb-3 text-center px-3" title={act.label}>
                        <div className="flex flex-col items-center gap-1">
                          {renderIcon(act.icon, 14, "text-[#155DFC]")}
                          <span className="text-[9.5px] mt-1 whitespace-nowrap">{act.label}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-primary/30">
                  {activeTeams.map((team: any) => (
                    <tr key={team.id} className="hover:bg-hover-overlay/40 transition-colors">
                      <td className="py-4 pr-2 font-black text-text-primary flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] text-white font-bold" style={{ backgroundColor: team.color }}>
                          {team.avatar || team.name.substring(0,1)}
                        </div>
                        <div>
                          <span>{team.name}</span>
                          <span className="block text-[8px] text-text-secondary font-mono mt-0.5">{team.id}</span>
                        </div>
                      </td>
                      {ACTIONS_LIST.map(act => {
                        const isAllowed = checkPermission(team.id, act.id);
                        return (
                          <td key={act.id} className="py-4 text-center px-3">
                            <button
                              onClick={() => handlePermissionToggle(team.id, act.id, isAllowed)}
                              className={`w-7 h-7 rounded-lg flex items-center justify-center mx-auto transition-all ${
                                isAllowed
                                  ? 'bg-brand-success/15 text-brand-success border border-brand-success/20'
                                  : 'bg-hover-overlay text-text-secondary/50 border border-transparent hover:border-border-primary'
                              }`}
                              title={`${isAllowed ? 'دارد' : 'ندارد'} - ${act.label}`}
                            >
                              {renderIcon(isAllowed ? 'Check' : 'X', 12)}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-12 text-xs text-text-secondary">
          لطفاً برای مدیریت مجوزها، ابتدا یک دپارتمان ایجاد کنید.
        </div>
      )}
    </div>
  );
};
