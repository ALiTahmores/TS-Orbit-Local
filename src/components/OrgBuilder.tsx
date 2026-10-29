import React, { useEffect, useState } from 'react';
import { Box, Check, Layers, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useProject } from '../context/ProjectContext';
import { iconByName } from '../lib/icons';
import { formatJalaliDate } from '../lib/dates';
import { SideSheet, sheetInput, sheetLabel } from './common/SideSheet';
import { TeamDirectory } from './team/TeamDirectory';
import { TEAM_COLORS } from './team/TeamEditor';

const fa = (value: number) => value.toLocaleString('fa-IR');
const DEPARTMENT_ICONS = ['Building2', 'Code', 'Palette', 'Megaphone', 'CircleDollarSign', 'Users', 'Layers', 'Target', 'PenTool', 'Server', 'ShoppingBag', 'Rocket'];
const MODULE_ICONS = ['Box', 'Layers', 'Database', 'Folder', 'FileText', 'CheckSquare', 'Sliders', 'Grid', 'Kanban', 'Calendar', 'LineChart', 'MessageSquare'];

const PRESET_DEPARTMENTS = [
  { name: 'توسعه و فنی', icon: 'Code', color: '#2563EB', description: 'توسعه نرم‌افزار، وب‌سایت و زیرساخت' },
  { name: 'دیجیتال مارکتینگ', icon: 'Megaphone', color: '#EA580C', description: 'سئو، شبکه‌های اجتماعی و کمپین‌های تبلیغاتی' },
  { name: 'طراحی و گرافیک', icon: 'Palette', color: '#DB2777', description: 'طراحی رابط کاربری، هویت بصری و گرافیک' },
  { name: 'مالی و اداری', icon: 'CircleDollarSign', color: '#059669', description: 'حسابداری، قراردادها و امور مالی' },
  { name: 'منابع انسانی', icon: 'Users', color: '#7C3AED', description: 'جذب نیرو، ارزیابی عملکرد و رفاهیات' },
];

type Tab = 'depts' | 'modules' | 'teams' | 'templates';
type Sheet = { kind: 'dept'; row?: any; preset?: typeof PRESET_DEPARTMENTS[number] } | { kind: 'module'; row?: any } | { kind: 'assign' } | null;

const Icon: React.FC<{ name?: string; size?: number; className?: string }> = ({ name, size = 16, className }) => {
  const Component = iconByName(name, Box);
  return <Component size={size} className={className} />;
};
const Tile: React.FC<{ icon?: string; color?: string; size?: 'sm' | 'md' }> = ({ icon, color, size = 'md' }) => (
  <span className={`shrink-0 rounded-xl flex items-center justify-center text-white ${size === 'md' ? 'w-10 h-10' : 'w-8 h-8'}`} style={{ background: color || '#2563EB' }}>
    <Icon name={icon} size={size === 'md' ? 18 : 15} />
  </span>
);
const Empty: React.FC<{ text: string; children?: React.ReactNode }> = ({ text, children }) => (
  <div className="flex flex-col items-center text-center gap-3 px-6 py-12 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
    <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md leading-6">{text}</p>
    {children}
  </div>
);
const Toolbar: React.FC<{ text: string; children?: React.ReactNode }> = ({ text, children }) => (
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
    <p className="text-xs leading-6 text-slate-500 dark:text-slate-400 max-w-2xl">{text}</p>
    {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
  </div>
);
const primary = 'shrink-0 inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold disabled:opacity-50 cursor-pointer';
const secondary = 'shrink-0 inline-flex items-center gap-1.5 h-9 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-bold disabled:opacity-50 cursor-pointer';
const iconAction = 'w-8 h-8 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer';
const card = 'rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900';

const ColorPicker: React.FC<{ value: string; onChange: (value: string) => void }> = ({ value, onChange }) => (
  <div className="flex flex-wrap gap-2">
    {TEAM_COLORS.map(color => (
      <button key={color} type="button" onClick={() => onChange(color)} aria-label={`رنگ ${color}`} aria-pressed={value.toLowerCase() === color.toLowerCase()}
        className={`w-8 h-8 rounded-full flex items-center justify-center text-white transition-transform cursor-pointer ${value.toLowerCase() === color.toLowerCase() ? 'ring-2 ring-offset-2 ring-slate-400 dark:ring-offset-slate-900' : 'hover:scale-105'}`} style={{ background: color }}>
        {value.toLowerCase() === color.toLowerCase() && <Check size={14} strokeWidth={3} />}
      </button>
    ))}
  </div>
);
const IconPicker: React.FC<{ icons: string[]; value: string; color: string; onChange: (value: string) => void }> = ({ icons, value, color, onChange }) => (
  <div className="grid grid-cols-6 gap-2">
    {icons.map(name => (
      <button key={name} type="button" onClick={() => onChange(name)} aria-label={name} aria-pressed={value === name}
        className={`h-10 rounded-xl border flex items-center justify-center transition-colors cursor-pointer ${value === name ? 'border-transparent text-white' : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600'}`}
        style={value === name ? { background: color } : undefined}>
        <Icon name={name} size={17} />
      </button>
    ))}
  </div>
);

/** Departments, modules, teams and saved structures of the agency. */
export const OrgBuilder: React.FC = () => {
  const {
    departments, teamMembers, moduleDefinitions, moduleInstances, departmentModules, teams,
    createDepartment, updateDepartment, deleteDepartment, createModule, updateModuleDefinition, deleteModule, instantiateModule,
    saveModuleTemplate, fetchTemplates,
  } = useProject();
  const [tab, setTab] = useState<Tab>('depts');
  const [sheet, setSheet] = useState<Sheet>(null);
  const [error, setError] = useState('');
  const [templates, setTemplates] = useState<any[]>([]);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const loadTemplates = async () => { if (fetchTemplates) setTemplates((await fetchTemplates()) || []); };
  useEffect(() => { void loadTemplates().catch(() => {}); }, []);

  const memberName = (id?: string) => teamMembers.find((person: any) => (person.userId || person.id) === id)?.name || '';
  const departmentOf = (instance: any) => departments.find((row: any) => row.id === (instance.departmentId || departmentModules.find((link: any) => link.moduleId === instance.id)?.departmentId));
  const remove = async (text: string, action: () => Promise<any>) => {
    if (!window.confirm(text)) return;
    setError('');
    try { await action(); } catch (failure) { setError(failure instanceof Error ? failure.message : 'عملیات انجام نشد.'); }
  };
  const saveTemplate = async (event: React.FormEvent) => {
    event.preventDefault(); if (!templateName.trim()) return;
    setSaving(true); setError('');
    try {
      await saveModuleTemplate({ name: templateName.trim(), description: templateDescription.trim(), structure: { departments, moduleDefinitions, teams } });
      setTemplateName(''); setTemplateDescription(''); await loadTemplates();
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'ذخیره انجام نشد.'); }
    finally { setSaving(false); }
  };

  const tabs: [Tab, string, number][] = [['depts', 'دپارتمان‌ها', departments.length], ['modules', 'ماژول‌ها', moduleDefinitions.length], ['teams', 'تیم‌ها', teams.length], ['templates', 'قالب‌ها', templates.length]];

  return (
    <div className="w-full space-y-6 text-start">
      <header className="space-y-1">
        <h1 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">سازنده دپارتمان و ماژول</h1>
        <p className="text-xs leading-6 text-slate-500 dark:text-slate-400 max-w-3xl">ساختار آژانس را از اینجا بسازید: دپارتمان‌ها، تیم‌ها و ماژول‌هایی که هر دپارتمان با آن‌ها کار می‌کند.</p>
      </header>

      <nav role="tablist" aria-label="بخش‌های ساختار سازمان" className="tab-scroller page-bleed gap-6 border-b border-slate-200 dark:border-slate-800">
        {tabs.map(([key, text, count]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => { setTab(key); setError(''); }}
            className={`relative h-11 inline-flex items-center gap-2 text-[13px] font-bold transition-colors cursor-pointer ${tab === key ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}>
            {text}
            <span className={`min-w-5 h-5 px-1.5 rounded-full text-[10px] font-bold inline-flex items-center justify-center ${tab === key ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>{fa(count)}</span>
            {tab === key && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-blue-600" />}
          </button>
        ))}
      </nav>

      {error && <p role="alert" className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs font-bold">{error}</p>}

      {tab === 'depts' && (
        <section className="space-y-4">
          <Toolbar text="دپارتمان‌ها واحدهای اصلی آژانس هستند. تیم‌ها و ماژول‌ها به یک دپارتمان وصل می‌شوند.">
            <button type="button" onClick={() => setSheet({ kind: 'dept' })} className={primary}><Plus size={14} />دپارتمان جدید</button>
          </Toolbar>
          {departments.length === 0 ? (
            <Empty text="هنوز دپارتمانی ندارید. با یکی از پیشنهادها شروع کنید یا دپارتمان دلخواه بسازید.">
              <div className="flex flex-wrap justify-center gap-2">
                {PRESET_DEPARTMENTS.map(preset => (
                  <button key={preset.name} type="button" onClick={() => setSheet({ kind: 'dept', preset })} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:border-blue-500 hover:text-blue-600 cursor-pointer">
                    <Icon name={preset.icon} size={13} />{preset.name}
                  </button>
                ))}
              </div>
            </Empty>
          ) : (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {departments.map((department: any) => {
                const teamCount = teams.filter((team: any) => team.departmentId === department.id).length;
                const moduleCount = moduleInstances.filter((instance: any) => departmentOf(instance)?.id === department.id).length;
                return (
                  <article key={department.id} className={`${card} p-4 flex flex-col gap-3`}>
                    <div className="flex items-start gap-3">
                      <Tile icon={department.icon} color={department.color} />
                      <div className="min-w-0 flex-1">
                        <h3 className="text-[13px] font-black text-slate-900 dark:text-white truncate">{department.name}</h3>
                        <p className="text-[11px] leading-5 text-slate-500 dark:text-slate-400 line-clamp-2">{department.description || 'بدون توضیح'}</p>
                      </div>
                      <div className="flex items-center -me-1.5">
                        <button type="button" onClick={() => setSheet({ kind: 'dept', row: department })} aria-label={`ویرایش ${department.name}`} className={iconAction}><Pencil size={14} /></button>
                        <button type="button" onClick={() => void remove(`دپارتمان «${department.name}» حذف شود؟`, () => deleteDepartment(department.id))} aria-label={`حذف ${department.name}`} className={`${iconAction} hover:!text-rose-600`}><Trash2 size={14} /></button>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-3 mt-auto border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
                      <span>{`مدیر: ${memberName(department.leaderId) || 'تعیین نشده'}`}</span>
                      <span>{`${fa(teamCount)} تیم`}</span>
                      <span>{`${fa(moduleCount)} ماژول`}</span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {tab === 'modules' && (
        <section className="space-y-8">
          <div className="space-y-4">
            <Toolbar text="هر ماژول یک فرم کاری با فیلدهای مشخص است؛ پس از ساخت، آن را به دپارتمانی که با آن کار می‌کند اضافه کنید.">
              <button type="button" onClick={() => setSheet({ kind: 'assign' })} disabled={!moduleDefinitions.length || !departments.length} className={secondary}><Layers size={14} />افزودن به دپارتمان</button>
              <button type="button" onClick={() => setSheet({ kind: 'module' })} className={primary}><Plus size={14} />ماژول جدید</button>
            </Toolbar>
            {moduleDefinitions.length === 0 ? <Empty text="هنوز ماژولی تعریف نشده است." /> : (
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {moduleDefinitions.map((module: any) => {
                  const fields: string[] = module.structure?.fields || [];
                  return (
                    <article key={module.id} className={`${card} p-4 flex flex-col gap-3`}>
                      <div className="flex items-start gap-3">
                        <Tile icon={module.icon} color={module.color} size="sm" />
                        <div className="min-w-0 flex-1">
                          <h3 className="text-[13px] font-black text-slate-900 dark:text-white truncate">{module.name}</h3>
                          <p className="text-[11px] leading-5 text-slate-500 dark:text-slate-400 line-clamp-2">{module.description || 'بدون توضیح'}</p>
                        </div>
                        <div className="flex items-center -me-1.5">
                          <button type="button" onClick={() => setSheet({ kind: 'module', row: module })} aria-label={`ویرایش ${module.name}`} className={iconAction}><Pencil size={14} /></button>
                          <button type="button" onClick={() => void remove(`ماژول «${module.name}» حذف شود؟`, () => deleteModule(module.id))} aria-label={`حذف ${module.name}`} className={`${iconAction} hover:!text-rose-600`}><Trash2 size={14} /></button>
                        </div>
                      </div>
                      {fields.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-3 mt-auto border-t border-slate-100 dark:border-slate-800">
                          {fields.slice(0, 5).map(field => <span key={field} className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold text-slate-600 dark:text-slate-300">{field}</span>)}
                          {fields.length > 5 && <span className="px-1 text-[10px] font-bold text-slate-400">{`+${fa(fields.length - 5)}`}</span>}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <h2 className="text-sm font-black text-slate-900 dark:text-white">ماژول‌های فعال در دپارتمان‌ها</h2>
            {moduleInstances.length === 0 ? <Empty text="هنوز ماژولی به دپارتمانی اضافه نشده است." /> : (
              <ul className={`${card} divide-y divide-slate-100 dark:divide-slate-800`}>
                {moduleInstances.map((instance: any) => {
                  const definition = moduleDefinitions.find((row: any) => row.id === (instance.definitionId || instance.moduleDefinitionId));
                  const department = departmentOf(instance);
                  return (
                    <li key={instance.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                      <Tile icon={definition?.icon} color={definition?.color || '#94A3B8'} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-bold text-slate-800 dark:text-slate-100 truncate">{instance.name}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">{definition?.name || 'ماژول حذف‌شده'}</p>
                      </div>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: department?.color || '#94A3B8' }} />
                        {department?.name || 'بدون دپارتمان'}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      )}

      {tab === 'teams' && <TeamDirectory />}

      {tab === 'templates' && (
        <section className="grid lg:grid-cols-[minmax(0,1fr)_20rem] gap-6 items-start">
          <div className="space-y-3 order-2 lg:order-1">
            <h2 className="text-sm font-black text-slate-900 dark:text-white">قالب‌های ذخیره‌شده</h2>
            {templates.length === 0 ? <Empty text="هنوز قالبی ذخیره نشده است. ساختار فعلی را به‌عنوان قالب نگه دارید تا برای فضاهای کاری بعدی مرجع داشته باشید." /> : (
              <ul className={`${card} divide-y divide-slate-100 dark:divide-slate-800`}>
                {templates.map((template: any) => {
                  const structure = template.structure || {};
                  return (
                    <li key={template.id} className="px-4 py-3.5 space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-[13px] font-black text-slate-900 dark:text-white">{template.name}</h3>
                        <span className="text-[10px] text-slate-400">{[template.createdBy, formatJalaliDate(template.createdAt)].filter(Boolean).join(' · ')}</span>
                      </div>
                      {template.description && <p className="text-[11px] leading-5 text-slate-500 dark:text-slate-400">{template.description}</p>}
                      <p className="text-[10px] font-semibold text-slate-400">{`${fa(structure.departments?.length || 0)} دپارتمان · ${fa(structure.moduleDefinitions?.length || 0)} ماژول · ${fa(structure.teams?.length || 0)} تیم`}</p>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <form onSubmit={event => void saveTemplate(event)} className={`${card} p-4 space-y-4 order-1 lg:order-2`}>
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white">ذخیرهٔ ساختار فعلی</h2>
              <p className="text-[11px] leading-5 text-slate-500 dark:text-slate-400 mt-0.5">{`${fa(departments.length)} دپارتمان، ${fa(moduleDefinitions.length)} ماژول و ${fa(teams.length)} تیم در قالب ذخیره می‌شود.`}</p>
            </div>
            <label className="block space-y-1.5">
              <span className={sheetLabel}>نام قالب</span>
              <input value={templateName} onChange={event => setTemplateName(event.target.value)} maxLength={200} placeholder="مثلاً ساختار استاندارد آژانس" className={sheetInput} />
            </label>
            <label className="block space-y-1.5">
              <span className={sheetLabel}>توضیح</span>
              <textarea value={templateDescription} onChange={event => setTemplateDescription(event.target.value)} rows={3} placeholder="این ساختار برای چه نوع آژانسی مناسب است؟" className={`${sheetInput} h-auto py-2.5 leading-6`} />
            </label>
            <button type="submit" disabled={saving || !templateName.trim()} className={`${primary} w-full justify-center`}>{saving ? 'در حال ذخیره…' : 'ذخیرهٔ قالب'}</button>
          </form>
        </section>
      )}

      {sheet?.kind === 'dept' && <DepartmentSheet row={sheet.row} preset={sheet.preset} people={teamMembers} onClose={() => setSheet(null)}
        save={async values => { if (sheet.row) await updateDepartment(sheet.row.id, values); else await createDepartment(values); }} />}
      {sheet?.kind === 'module' && <ModuleSheet row={sheet.row} onClose={() => setSheet(null)}
        save={async values => { if (sheet.row) await updateModuleDefinition(sheet.row.id, values); else await createModule(values); }} />}
      {sheet?.kind === 'assign' && <AssignSheet modules={moduleDefinitions} departments={departments} onClose={() => setSheet(null)} save={instantiateModule} />}
    </div>
  );
};

const useSheetSave = (onClose: () => void) => {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const submit = async (action: () => Promise<any>) => {
    setSaving(true); setError('');
    try { await action(); onClose(); } catch (failure) { setError(failure instanceof Error ? failure.message : 'ذخیره انجام نشد.'); }
    finally { setSaving(false); }
  };
  return { saving, error, setError, submit };
};

const DepartmentSheet: React.FC<{ row?: any; preset?: typeof PRESET_DEPARTMENTS[number]; people: any[]; onClose: () => void; save: (values: any) => Promise<any> }> = ({ row, preset, people, onClose, save }) => {
  const source = row || preset;
  const [name, setName] = useState(source?.name || '');
  const [description, setDescription] = useState(source?.description || '');
  const [icon, setIcon] = useState(source?.icon || 'Building2');
  const [color, setColor] = useState(source?.color || TEAM_COLORS[0]);
  const [leaderId, setLeaderId] = useState(row?.leaderId || '');
  const { saving, error, setError, submit } = useSheetSave(onClose);
  return (
    <SideSheet title={row ? 'ویرایش دپارتمان' : 'دپارتمان جدید'} description="نام، نماد و مدیر دپارتمان را مشخص کنید." submitLabel={row ? 'ذخیرهٔ تغییرات' : 'ساخت دپارتمان'}
      saving={saving} error={error} onClose={onClose}
      onSubmit={event => { event.preventDefault(); if (!name.trim()) { setError('نام دپارتمان را وارد کنید.'); return; } void submit(() => save({ name: name.trim(), description: description.trim(), icon, color, leaderId })); }}>
      {!row && (
        <div className="space-y-2">
          <span className={sheetLabel}>شروع سریع</span>
          <div className="flex flex-wrap gap-1.5">
            {PRESET_DEPARTMENTS.map(item => (
              <button key={item.name} type="button" onClick={() => { setName(item.name); setDescription(item.description); setIcon(item.icon); setColor(item.color); }}
                className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:border-blue-500 hover:text-blue-600 cursor-pointer">
                <Icon name={item.icon} size={12} />{item.name}
              </button>
            ))}
          </div>
        </div>
      )}
      <label className="block space-y-1.5"><span className={sheetLabel}>نام دپارتمان</span><input autoFocus value={name} maxLength={200} onChange={event => setName(event.target.value)} placeholder="مثلاً دیجیتال مارکتینگ" className={sheetInput} /></label>
      <label className="block space-y-1.5"><span className={sheetLabel}>توضیح</span><textarea value={description} rows={3} onChange={event => setDescription(event.target.value)} placeholder="این دپارتمان چه کارهایی انجام می‌دهد؟" className={`${sheetInput} h-auto py-2.5 leading-6`} /></label>
      <div className="space-y-2"><span className={sheetLabel}>نماد</span><IconPicker icons={DEPARTMENT_ICONS} value={icon} color={color} onChange={setIcon} /></div>
      <div className="space-y-2"><span className={sheetLabel}>رنگ</span><ColorPicker value={color} onChange={setColor} /></div>
      <label className="block space-y-1.5">
        <span className={sheetLabel}>مدیر دپارتمان</span>
        <select value={leaderId} onChange={event => setLeaderId(event.target.value)} className={sheetInput}>
          <option value="">تعیین نشده</option>
          {people.map((person: any) => <option key={person.id} value={person.userId || person.id}>{person.name}</option>)}
        </select>
      </label>
    </SideSheet>
  );
};

const ModuleSheet: React.FC<{ row?: any; onClose: () => void; save: (values: any) => Promise<any> }> = ({ row, onClose, save }) => {
  const [name, setName] = useState(row?.name || '');
  const [description, setDescription] = useState(row?.description || '');
  const [icon, setIcon] = useState(row?.icon || 'Box');
  const [color, setColor] = useState(row?.color || TEAM_COLORS[2]);
  const [fields, setFields] = useState<string[]>(row?.structure?.fields || ['عنوان', 'توضیحات', 'وضعیت']);
  const [draft, setDraft] = useState('');
  const { saving, error, setError, submit } = useSheetSave(onClose);
  const addField = () => { const value = draft.trim(); if (value && !fields.includes(value)) setFields([...fields, value]); setDraft(''); };
  return (
    <SideSheet title={row ? 'ویرایش ماژول' : 'ماژول جدید'} description="ماژول فرمی است که دپارتمان‌ها برای ثبت کارهایشان استفاده می‌کنند." submitLabel={row ? 'ذخیرهٔ تغییرات' : 'ساخت ماژول'}
      saving={saving} error={error} onClose={onClose}
      onSubmit={event => {
        event.preventDefault();
        if (!name.trim()) { setError('نام ماژول را وارد کنید.'); return; }
        if (!fields.length) { setError('دست‌کم یک فیلد وارد کنید.'); return; }
        void submit(() => save({ name: name.trim(), description: description.trim(), icon, color, structure: { fields } }));
      }}>
      <label className="block space-y-1.5"><span className={sheetLabel}>نام ماژول</span><input autoFocus value={name} maxLength={200} onChange={event => setName(event.target.value)} placeholder="مثلاً پیگیری سئوی مشتری" className={sheetInput} /></label>
      <label className="block space-y-1.5"><span className={sheetLabel}>توضیح</span><input value={description} onChange={event => setDescription(event.target.value)} placeholder="هدف این ماژول" className={sheetInput} /></label>
      <div className="space-y-2"><span className={sheetLabel}>نماد</span><IconPicker icons={MODULE_ICONS} value={icon} color={color} onChange={setIcon} /></div>
      <div className="space-y-2"><span className={sheetLabel}>رنگ</span><ColorPicker value={color} onChange={setColor} /></div>
      <div className="space-y-2">
        <span className={sheetLabel}>فیلدهای فرم</span>
        <div className="flex flex-wrap gap-1.5">
          {fields.map(field => (
            <span key={field} className="inline-flex items-center gap-1 h-7 ps-2.5 pe-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-200">
              {field}
              <button type="button" onClick={() => setFields(fields.filter(item => item !== field))} aria-label={`حذف فیلد ${field}`} className="w-5 h-5 inline-flex items-center justify-center rounded-md text-slate-400 hover:text-rose-600 cursor-pointer"><X size={12} /></button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addField(); } }} placeholder="نام فیلد جدید" aria-label="نام فیلد جدید" className={sheetInput} />
          <button type="button" onClick={addField} className={secondary}><Plus size={14} />افزودن</button>
        </div>
      </div>
    </SideSheet>
  );
};

const AssignSheet: React.FC<{ modules: any[]; departments: any[]; onClose: () => void; save: (values: any) => Promise<any> }> = ({ modules, departments, onClose, save }) => {
  const [definitionId, setDefinitionId] = useState(modules[0]?.id || '');
  const [departmentId, setDepartmentId] = useState(departments[0]?.id || '');
  const [name, setName] = useState('');
  const { saving, error, setError, submit } = useSheetSave(onClose);
  return (
    <SideSheet title="افزودن ماژول به دپارتمان" description="دپارتمان انتخاب‌شده از این ماژول برای ثبت کارهایش استفاده می‌کند." submitLabel="افزودن"
      saving={saving} error={error} onClose={onClose}
      onSubmit={event => { event.preventDefault(); if (!definitionId || !departmentId) { setError('ماژول و دپارتمان را انتخاب کنید.'); return; } void submit(() => save({ definitionId, departmentId, name: name.trim() || undefined })); }}>
      <label className="block space-y-1.5">
        <span className={sheetLabel}>ماژول</span>
        <select value={definitionId} onChange={event => setDefinitionId(event.target.value)} className={sheetInput}>{modules.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select>
      </label>
      <label className="block space-y-1.5">
        <span className={sheetLabel}>دپارتمان</span>
        <select value={departmentId} onChange={event => setDepartmentId(event.target.value)} className={sheetInput}>{departments.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select>
      </label>
      <label className="block space-y-1.5">
        <span className={sheetLabel}>نام نمایشی (اختیاری)</span>
        <input value={name} maxLength={200} onChange={event => setName(event.target.value)} placeholder="پیش‌فرض: نام ماژول" className={sheetInput} />
      </label>
    </SideSheet>
  );
};
