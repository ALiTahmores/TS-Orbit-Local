import React, { useState } from 'react';
import { useProject } from '../context/ProjectContext';
import { CustomSelect, CustomSelectOption } from './common/CustomSelect';
import { DynamicModule } from '../types';
import { 
  Sliders, 
  Plus, 
  Trash2, 
  Edit2, 
  Check, 
  Eye, 
  EyeOff, 
  Shield, 
  LayoutGrid, 
  FolderGit, 
  CheckSquare, 
  Palette, 
  Code, 
  FileText, 
  Compass, 
  ShieldCheck, 
  LineChart, 
  Users, 
  UserCheck2, 
  Cpu, 
  Workflow, 
  Settings, 
  Sparkles,
  Info
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';

export const TabManager: React.FC = () => {
  const { 
    activeModules, 
    addCustomModule, 
    removeModule, 
    updateModule,
    getRoleLabel
  } = useProject();

  const [isAdding, setIsAdding] = useState(false);
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);

  // New module states
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('Sparkles');
  const [newRoles, setNewRoles] = useState<string[]>([]);
  const [newContent, setNewContent] = useState('');

  // Editing states
  const [editName, setEditName] = useState('');
  const [editIcon, setEditIcon] = useState('');
  const [editRoles, setEditRoles] = useState<string[]>([]);
  const [editOrder, setEditOrder] = useState<number>(0);
  const [editContent, setEditContent] = useState('');

  const availableIcons = [
    'LayoutGrid', 'FolderGit', 'CheckSquare', 'Palette', 'Code', 'FileText', 
    'Compass', 'ShieldCheck', 'LineChart', 'Users', 'UserCheck2', 'Cpu', 
    'Workflow', 'Settings', 'Sparkles'
  ];

  const availableRoles = [
    { key: 'OWNER', label: 'مدیر سیستم (Owner)' },
    { key: 'PROJECT_MANAGER', label: 'مدیر پروژه (Project Manager)' },
    { key: 'DEVELOPER', label: 'توسعه‌دهنده / سئو (Developer)' },
    { key: 'CLIENT', label: 'کارفرما (Client)' }
  ];

  const renderIcon = (iconName: string) => {
    const IconComp = (LucideIcons as any)[iconName] || Sparkles;
    return <IconComp size={16} className="text-blue-600" />;
  };

  const handleCreateCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName) return;
    addCustomModule(newName, newIcon, newRoles, newContent);
    setNewName('');
    setNewIcon('Sparkles');
    setNewRoles([]);
    setNewContent('');
    setIsAdding(false);
  };

  const startEditing = (m: DynamicModule) => {
    setEditingModuleId(m.id);
    setEditName(m.name);
    setEditIcon(m.icon);
    setEditRoles(m.accessRoles || []);
    setEditOrder(m.order);
    setEditContent(m.customContent || '');
  };

  const saveEdit = (id: string) => {
    updateModule(id, {
      name: editName,
      icon: editIcon,
      accessRoles: editRoles,
      order: Number(editOrder),
      customContent: editContent
    });
    setEditingModuleId(null);
  };

  const toggleRole = (roles: string[], setRoles: React.Dispatch<React.SetStateAction<string[]>>, roleKey: string) => {
    if (roles.includes(roleKey)) {
      setRoles(roles.filter(r => r !== roleKey));
    } else {
      setRoles([...roles, roleKey]);
    }
  };

  return (
    <div className="bg-white border border-slate-200 shadow-sm p-6 rounded-2xl max-w-5xl mx-auto space-y-6 text-right" id="tab-manager-section">
      
      {/* Header */}
      <div className="flex justify-between items-center border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-base font-black text-slate-800 flex items-center gap-2">
            <Sliders size={18} className="text-blue-600" /> مدیریت تب‌ها و منوهای ناوبری (SaaS Modules)
          </h2>
          <p className="text-[11px] text-slate-500 mt-1">مدیر کل سیستم می‌تواند تب‌های پیش‌فرض را مدیریت کرده، دسترسی نقش‌ها را محدود کرده یا تب سفارشی بسازد.</p>
        </div>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
        >
          <Plus size={14} /> ساخت منو/تب سفارشی
        </button>
      </div>

      {/* 1. Add Custom Tab Form */}
      {isAdding && (
        <form onSubmit={handleCreateCustom} className="bg-slate-50 border border-slate-200/60 p-5 rounded-2xl space-y-4">
          <h3 className="font-bold text-xs text-slate-700 border-b border-slate-200/50 pb-2 flex items-center gap-1.5">
            <Plus size={14} className="text-blue-600" /> افزودن تب سفارشی جدید
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-slate-550 block mb-1">نام تب (فارسی)</label>
              <input 
                type="text" 
                placeholder="مثال: آموزش وردپرس برای کلاینت"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className="w-full bg-white border border-slate-200 px-3 py-2 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-550 block mb-1">انتخاب آیکون منو</label>
              <CustomSelect
                options={availableIcons.map(icon => ({ value: icon, label: icon }))}
                value={newIcon}
                onChange={val => setNewIcon(val)}
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-550 block mb-1">نقش‌های مجاز به دسترسی (خالی بودن به معنای دسترسی همگانی است)</label>
            <div className="flex flex-wrap gap-3 bg-white p-3 border border-slate-200 rounded-xl">
              {availableRoles.map(role => (
                <label key={role.key} className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={newRoles.includes(role.key)}
                    onChange={() => toggleRole(newRoles, setNewRoles, role.key)}
                    className="rounded border-slate-300 text-blue-600"
                  />
                  <span>{role.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-550 block mb-1">محتوای نمایش داده شده در این تب (توضیحات / متن راهنما)</label>
            <textarea 
              rows={3}
              placeholder="یک متن راهنما یا محتوای سفارشی که با کلیک روی این تب به کاربران نمایش داده می‌شود..."
              value={newContent}
              onChange={e => setNewContent(e.target.value)}
              className="w-full bg-white border border-slate-200 p-3 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-sans leading-relaxed"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1 border-t border-slate-200/40">
            <button 
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-xl"
            >
              افزودن و فعال‌سازی تب
            </button>
            <button 
              type="button"
              onClick={() => setIsAdding(false)}
              className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold px-4 py-2 rounded-xl"
            >
              انصراف
            </button>
          </div>
        </form>
      )}

      {/* 2. Modules List Table */}
      <div className="border border-slate-100 rounded-2xl overflow-hidden">
        <table className="w-full text-right border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-[10px] font-bold border-b border-slate-100">
              <th className="p-3">ترتیب</th>
              <th className="p-3">آیکون</th>
              <th className="p-3">عنوان تب ناوبری</th>
              <th className="p-3">محدودیت دسترسی نقش‌ها</th>
              <th className="p-3">نوع ماژول</th>
              <th className="p-3 text-center">وضعیت نمایش</th>
              <th className="p-3 text-left">عملیات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {activeModules.map(module => {
              const isEditing = editingModuleId === module.id;

              return (
                <tr key={module.id} className="hover:bg-slate-50/50 transition-colors">
                  {/* Order */}
                  <td className="p-3 font-mono font-bold text-slate-400">
                    {isEditing ? (
                      <input 
                        type="number"
                        value={editOrder}
                        onChange={e => setEditOrder(Number(e.target.value))}
                        className="w-12 bg-white border border-slate-200 px-1 py-1 rounded text-center text-xs font-bold"
                      />
                    ) : (
                      module.order
                    )}
                  </td>

                  {/* Icon */}
                  <td className="p-3">
                    {isEditing ? (
                      <CustomSelect
                        options={availableIcons.map(icon => ({ value: icon, label: icon }))}
                        value={editIcon}
                        onChange={val => setEditIcon(val)}
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                        {renderIcon(module.icon)}
                      </div>
                    )}
                  </td>

                  {/* Name */}
                  <td className="p-3">
                    {isEditing ? (
                      <input 
                        type="text"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        className="bg-white border border-slate-200 px-2 py-1 rounded text-xs font-bold text-slate-800"
                      />
                    ) : (
                      <span className="font-extrabold text-slate-800">{module.name}</span>
                    )}
                  </td>

                  {/* Roles */}
                  <td className="p-3">
                    {isEditing ? (
                      <div className="flex flex-col gap-1 bg-white p-2 border border-slate-200 rounded-lg max-w-xs">
                        {availableRoles.map(role => (
                          <label key={role.key} className="flex items-center gap-1.5 text-[10px] text-slate-600">
                            <input 
                              type="checkbox" 
                              checked={editRoles.includes(role.key)}
                              onChange={() => toggleRole(editRoles, setEditRoles, role.key)}
                            />
                            <span>{role.label}</span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {!module.accessRoles || module.accessRoles.length === 0 ? (
                          <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">✓ همگانی</span>
                        ) : (
                          module.accessRoles.map(r => (
                            <span key={r} className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-extrabold flex items-center gap-0.5">
                              <Shield size={9} /> {getRoleLabel ? getRoleLabel(r) : r}
                            </span>
                          ))
                        )}
                      </div>
                    )}
                  </td>

                  {/* Type */}
                  <td className="p-3">
                    {module.isCustom ? (
                      <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded-full font-bold">سفارشی</span>
                    ) : (
                      <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">پیش‌فرض سیستم</span>
                    )}
                  </td>

                  {/* Enabled Toggle */}
                  <td className="p-3 text-center">
                    <button 
                      onClick={() => updateModule(module.id, { enabled: !module.enabled })}
                      className={`p-1.5 rounded-lg transition-all ${
                        module.enabled 
                          ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' 
                          : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                      }`}
                      title={module.enabled ? 'غیرفعال کردن تب ناوبری' : 'فعال کردن تب ناوبری'}
                    >
                      {module.enabled ? <Eye size={15} /> : <EyeOff size={15} />}
                    </button>
                  </td>

                  {/* Actions */}
                  <td className="p-3 text-left">
                    <div className="flex justify-end gap-1.5">
                      {isEditing ? (
                        <>
                          <button 
                            onClick={() => saveEdit(module.id)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white p-1 rounded-lg transition-all"
                            title="ذخیره تغییرات"
                          >
                            <Check size={14} />
                          </button>
                          <button 
                            onClick={() => setEditingModuleId(null)}
                            className="bg-slate-200 hover:bg-slate-300 text-slate-700 p-1 rounded-lg transition-all"
                            title="انصراف"
                          >
                            <Plus className="rotate-45" size={14} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button 
                            onClick={() => startEditing(module.id === 'manage_tabs' ? module : module)}
                            className="text-blue-600 hover:bg-blue-50 p-1.5 rounded-lg transition-all"
                            title="ویرایش منو"
                          >
                            <Edit2 size={14} />
                          </button>
                          
                          {module.isCustom && (
                            <button 
                              onClick={() => removeModule(module.id)}
                              className="text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition-all"
                              title="حذف منوی سفارشی"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Detail information box */}
      <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4 flex gap-3 text-xs leading-relaxed text-blue-800">
        <Info size={18} className="text-blue-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-extrabold block">توضیحاتی پیرامون ماژول‌ها و امنیت دسترسی</span>
          تغییرات شما در منوی سیستم بلافاصله بر روی تمام کاربران وارد شده به پورتال اعمال خواهد شد. 
          تب‌های غیرفعال شده برای بقیه کاربران غیب می‌شوند. همچنین می‌توانید با زدن تیک نقش‌های مجاز، دسترسی یک بخش خاص (مثلاً توسعه وردپرس) را منحصراً به نقش برنامه‌نویس یا سئو محدود کنید.
        </div>
      </div>

    </div>
  );
};
