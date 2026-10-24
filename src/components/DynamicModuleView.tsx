import { formatJalaliDateTime } from '../lib/dates';
import { apiFetch } from '../lib/api';
import React, { useState } from 'react';
import { useProject } from '../context/ProjectContext';
import { Box } from 'lucide-react';
import { iconByName } from '../lib/icons';

interface DynamicModuleViewProps {
  instanceId: string;
  deptId: string;
}

export const DynamicModuleView: React.FC<DynamicModuleViewProps> = ({ instanceId, deptId }) => {
  const {
    moduleInstances,
    moduleDefinitions,
    departments,
    fetchOrgData
  } = useProject();

  const [recordForm, setRecordForm] = useState<Record<string, string>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [editingId,setEditingId] = useState<string|null>(null);
  const [error,setError] = useState('');
  const [saving,setSaving] = useState(false);

  const inst = moduleInstances.find((i: any) => i.id === instanceId);
  const dept = departments.find((d: any) => d.id === deptId);
  if (!inst) return <div className="text-center py-12 text-xs text-text-secondary">ماژول یافت نشد</div>;

  const def = moduleDefinitions.find((d: any) => d.id === inst.definitionId);
  const fields: string[] = def?.structure?.fields || ["عنوان", "توضیحات", "وضعیت"];
  const records: any[] = inst.config?.records || [];

  const renderIcon = (name: string, size = 16, className = "") => {
    const IconComp = iconByName(name, Box);
    return <IconComp size={size} className={className} />;
  };

  const handleAddRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);setError('');
    try {
      await apiFetch('/api/org/module-instances/'+instanceId+'/records'+(editingId?'/'+editingId:''),{
        method:editingId?'PUT':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({data:recordForm})
      });
      await fetchOrgData();setRecordForm({});setEditingId(null);setIsAdding(false);
    } catch(error) {setError(error instanceof Error?error.message:'ذخیره انجام نشد.');}
    finally {setSaving(false);}
  };
  const deleteRecord = async(id:string) => {
    setError('');
    try {await apiFetch('/api/org/module-instances/'+instanceId+'/records/'+id,{method:'DELETE'});await fetchOrgData();}
    catch(error) {setError(error instanceof Error?error.message:'حذف انجام نشد.');}
  };

  return (
    <div className="w-full space-y-6 text-right" style={{ direction: 'rtl' }}>
      {error && <p role="alert" className="text-red-600 p-3">{error}</p>}
      {/* Banner */}
      <div className="bg-surface-primary border border-border-primary rounded-2xl p-6 relative overflow-hidden shadow-sm">
        <div className="absolute top-0 left-0 w-32 h-32 bg-[#6C63FF]/5 blur-3xl rounded-full" />
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          <div>
            <span className="text-[10px] bg-[#6C63FF]/15 text-[#6C63FF] px-2.5 py-1 rounded-full font-bold">
              دپارتمان {dept?.name || 'ناشناس'}
            </span>
            <h1 className="text-xl font-black text-text-primary flex items-center gap-2 mt-2">
              <span className="p-2 text-white rounded-xl" style={{ backgroundColor: def?.color || '#6C63FF' }}>
                {renderIcon(def?.icon || 'Box', 20)}
              </span>
              {inst.name}
            </h1>
            <p className="text-xs text-text-secondary mt-2">
              {def?.description || 'نمونه فعال‌سازی شده از الگوهای ساختار سازمانی پویا.'}
            </p>
          </div>
          <button
            onClick={() => {setEditingId(null);setRecordForm({});setIsAdding(!isAdding);}}
            className="px-4 py-2 bg-[#6C63FF] hover:bg-[#5B54E0] text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2"
          >
            {renderIcon(isAdding ? 'X' : 'Plus', 14)}
            {isAdding ? 'بستن فرم' : 'ثبت داده جدید'}
          </button>
        </div>
      </div>

      {/* Form or Table */}
      {isAdding && (
        <div className="bg-surface-primary border border-border-primary rounded-xl p-5 space-y-4 animate-slide-up">
          <h3 className="text-xs font-black text-text-primary flex items-center gap-1.5">
            {renderIcon('PlusCircle', 14, "text-[#6C63FF]")}
            ثبت سطر داده جدید در {inst.name}
          </h3>
          <form onSubmit={handleAddRecord} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {fields.map((field) => (
                <div key={field} className="space-y-1">
                  <label className="text-[10px] text-text-secondary font-bold">{field}</label>
                  <input
                    type="text"
                    value={recordForm[field] || ''}
                    onChange={(e) => setRecordForm(prev => ({ ...prev, [field]: e.target.value }))}
                    placeholder={`وارد کردن ${field}...`}
                    className="w-full px-3 py-2 bg-hover-overlay border border-border-primary/60 rounded-lg text-xs text-text-primary"
                    required
                  />
                </div>
              ))}
            </div>
            <button
              disabled={saving}
              type="submit"
              className="px-4 py-2 bg-[#6C63FF] hover:bg-[#5B54E0] text-white font-bold rounded-lg text-xs transition-colors"
            >
              ذخیره و ثبت سطر
            </button>
          </form>
        </div>
      )}

      {/* Records table */}
      <div className="bg-surface-primary border border-border-primary rounded-xl p-5">
        <h3 className="text-xs font-black text-text-primary mb-4 flex items-center gap-2">
          {renderIcon('Database', 13)}
          بانک اطلاعاتی ماژول ({records.length} سطر داده ثبت‌شده)
        </h3>

        {records.length === 0 ? (
          <div className="text-center py-12 text-xs text-text-secondary space-y-3">
            <p>هنوز داده‌ای در این ماژول ثبت نشده است.</p>
            <p className="text-[11px]">با کلیک بر روی دکمه "ثبت داده جدید" در بالا اولین رکورد را ایجاد نمایید.</p>
          </div>
        ) : (
          <div className="w-full overflow-x-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
            <table className="w-full text-right text-xs min-w-[700px]">
              <thead>
                <tr className="border-b border-border-primary/50 text-text-secondary font-black pb-2">
                  <th className="pb-2 text-right pr-2">تاریخ ثبت</th>
                  {fields.map(f => (
                    <th key={f} className="pb-2 text-right">{f}</th>
                  ))}
                  <th className="pb-2 text-left">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-primary/30">
                {records.map((rec: any) => (
                  <tr key={rec.id} className="hover:bg-hover-overlay/40 transition-colors">
                    <td className="py-3 pr-2 text-text-secondary font-mono text-[10px]">{formatJalaliDateTime(rec.createdAt)}</td>
                    {fields.map(f => (
                      <td key={f} className="py-3 text-text-primary font-bold">{rec.data[f] || '—'}</td>
                    ))}
                    <td><button type="button" onClick={()=>{setEditingId(rec.id);setRecordForm(rec.data);setIsAdding(true);}} className="p-2 text-blue-600">ویرایش</button><button type="button" onClick={()=>deleteRecord(rec.id)} className="p-2 text-red-600">حذف</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
