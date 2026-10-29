import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Check, ChevronDown, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { DEFAULT_TEAMS, ROADMAP_LIMITS, roadmapId, roadmapStepCount, teamRoadmap, type RoadmapPhase, type TeamRoadmap } from '../../lib/teamRoadmaps';
import { TeamAvatar } from './TeamAvatar';

export const TEAM_COLORS = ['#2563EB', '#7C3AED', '#059669', '#DB2777', '#EA580C', '#0891B2', '#DC2626', '#475569'];
const fa = (value: number) => value.toLocaleString('fa-IR');
const input = 'w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 text-[13px] text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 disabled:opacity-60';
const inline = 'w-full min-w-0 bg-transparent rounded-lg px-2 py-1.5 text-[13px] text-slate-800 dark:text-slate-100 placeholder:text-slate-400 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800';
const iconButton = 'shrink-0 w-7 h-7 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none cursor-pointer';

const move = <T,>(items: T[], index: number, offset: number) => {
  const next = [...items], target = index + offset;
  if (target < 0 || target >= next.length) return items;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
};
const freshCopy = (roadmap: TeamRoadmap): TeamRoadmap => structuredClone(roadmap);

interface Props { team?: any; readOnly?: boolean; onClose: () => void }

/** Creates or edits a team: its details, its members and the roadmap its projects start from. */
export const TeamEditor: React.FC<Props> = ({ team, readOnly = false, onClose }) => {
  const { departments, teamMembers, createOrgTeam, updateOrgTeam, deleteOrgTeam } = useProject();
  const [tab, setTab] = useState<'info' | 'roadmap'>('info');
  const [name, setName] = useState(team?.name || '');
  const [description, setDescription] = useState(team?.description || '');
  const [color, setColor] = useState(team?.color || TEAM_COLORS[0]);
  const [departmentId, setDepartmentId] = useState(team?.departmentId || '');
  const [leaderId, setLeaderId] = useState(team?.leaderId || '');
  const [memberIds, setMemberIds] = useState<string[]>(team?.memberIds || []);
  const [roadmap, setRoadmap] = useState<TeamRoadmap>(() => team ? teamRoadmap(team) : { phases: [] });
  const [openPhases, setOpenPhases] = useState<Set<string>>(() => new Set(roadmap.phases.slice(0, 1).map(phase => phase.id)));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const templateKey = team?.customFields?.templateKey as string | undefined;
  const template = DEFAULT_TEAMS.find(row => row.key === templateKey);
  const people = teamMembers.map(person => ({ id: (person as any).userId || person.id, name: person.name }));
  const stepTotal = roadmapStepCount(roadmap);

  useEffect(() => {
    if (!readOnly) nameRef.current?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const setPhase = (phaseId: string, change: (phase: RoadmapPhase) => RoadmapPhase) =>
    setRoadmap(previous => ({ phases: previous.phases.map(phase => phase.id === phaseId ? change(phase) : phase) }));
  const togglePhase = (phaseId: string) => setOpenPhases(previous => {
    const next = new Set(previous);
    if (next.has(phaseId)) next.delete(phaseId); else next.add(phaseId);
    return next;
  });
  const addPhase = () => {
    const phase = { id: roadmapId('phase'), title: '', description: '', steps: [{ id: roadmapId('step'), title: '', required: true }] };
    setRoadmap(previous => ({ phases: [...previous.phases, phase] }));
    setOpenPhases(previous => new Set([...previous, phase.id]));
  };
  const applyTemplate = (key: string) => {
    const source = DEFAULT_TEAMS.find(row => row.key === key);
    if (!source || (stepTotal && !window.confirm('نقشهٔ راه فعلی با این الگو جایگزین شود؟'))) return;
    const next = freshCopy(source.roadmap);
    setRoadmap(next); setOpenPhases(new Set(next.phases.slice(0, 1).map(phase => phase.id)));
  };

  /** Empty rows are dropped; a phase with steps still needs a title. */
  const cleanRoadmap = (): TeamRoadmap | null => {
    const phases = roadmap.phases
      .map(phase => ({ ...phase, title: phase.title.trim(), description: (phase.description || '').trim(), steps: phase.steps.map(step => ({ ...step, title: step.title.trim() })).filter(step => step.title) }))
      .filter(phase => phase.title || phase.steps.length);
    if (phases.some(phase => !phase.title)) { setError('عنوان همهٔ فازها را وارد کنید.'); setTab('roadmap'); return null; }
    if (phases.length > ROADMAP_LIMITS.phases || phases.some(phase => phase.steps.length > ROADMAP_LIMITS.steps)) { setError(`حداکثر ${fa(ROADMAP_LIMITS.phases)} فاز و ${fa(ROADMAP_LIMITS.steps)} مرحله در هر فاز مجاز است.`); setTab('roadmap'); return null; }
    return { phases };
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setError('');
    if (!name.trim()) { setError('نام تیم را وارد کنید.'); setTab('info'); return; }
    const cleaned = cleanRoadmap(); if (!cleaned) return;
    const ids = [...new Set([...memberIds, ...(leaderId ? [leaderId] : [])])];
    const payload = { name: name.trim(), description: description.trim(), color, departmentId: departmentId || null, leaderId, memberIds: ids, roadmap: cleaned };
    setSaving(true);
    try {
      if (team) await updateOrgTeam(team.id, payload); else await createOrgTeam(payload);
      onClose();
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'ذخیره انجام نشد.'); }
    finally { setSaving(false); }
  };
  const remove = async () => {
    if (!team || !window.confirm(`تیم «${team.name}» حذف شود؟ گفتگوهای تیم هم حذف می‌شوند؛ چک‌لیست پروژه‌ها باقی می‌ماند.`)) return;
    setSaving(true);
    try { await deleteOrgTeam(team.id); onClose(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'حذف انجام نشد.'); }
    finally { setSaving(false); }
  };

  const tabButton = (key: 'info' | 'roadmap', text: string) => (
    <button type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
      className={`relative h-11 px-1 text-[13px] font-bold transition-colors cursor-pointer ${tab === key ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}>
      {text}
      {tab === key && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-blue-600" />}
    </button>
  );

  return (
    <div className="fixed inset-0 z-[60] flex justify-end" role="dialog" aria-modal="true" aria-label={team ? 'ویرایش تیم' : 'تیم جدید'}>
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[1px] animate-in fade-in" onClick={onClose} />
      <form onSubmit={save} className="relative w-full sm:max-w-xl h-full flex flex-col bg-white dark:bg-slate-900 shadow-2xl animate-in fade-in duration-200 text-start">
        <header className="shrink-0 px-5 sm:px-6 pt-5 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <TeamAvatar team={{ name: name || '؟', color, customFields: team?.customFields }} />
              <div className="min-w-0">
                <h2 className="text-base font-black text-slate-900 dark:text-white truncate">{team ? (readOnly ? team.name : 'ویرایش تیم') : 'تیم جدید'}</h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{`${fa(roadmap.phases.length)} فاز · ${fa(stepTotal)} مرحله در نقشهٔ راه`}</p>
              </div>
            </div>
            <button type="button" onClick={onClose} aria-label="بستن" className={iconButton}><X size={16} /></button>
          </div>
          <div role="tablist" className="flex items-center gap-6 mt-3">
            {tabButton('info', 'مشخصات')}
            {tabButton('roadmap', 'نقشهٔ راه')}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5">
          {error && <p role="alert" className="mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs font-bold">{error}</p>}

          {tab === 'info' ? (
            <fieldset disabled={readOnly} className="space-y-5">
              <label className="block space-y-1.5">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">نام تیم</span>
                <input ref={nameRef} value={name} maxLength={200} onChange={event => setName(event.target.value)} placeholder="مثلاً تیم توسعهٔ وردپرس" className={input} />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">توضیح</span>
                <textarea value={description} rows={3} maxLength={1000} onChange={event => setDescription(event.target.value)} placeholder="این تیم چه کاری انجام می‌دهد؟" className={`${input} h-auto py-2.5 leading-6`} />
              </label>
              <div className="space-y-1.5">
                <span className="block text-xs font-bold text-slate-700 dark:text-slate-200">رنگ</span>
                <div className="flex flex-wrap gap-2">
                  {TEAM_COLORS.map(value => (
                    <button key={value} type="button" onClick={() => setColor(value)} aria-label={`رنگ ${value}`} aria-pressed={color === value}
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-white transition-transform cursor-pointer ${color === value ? 'ring-2 ring-offset-2 ring-slate-400 dark:ring-offset-slate-900 scale-105' : 'hover:scale-105'}`} style={{ background: value }}>
                      {color === value && <Check size={14} strokeWidth={3} />}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <label className="block space-y-1.5">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">دپارتمان</span>
                  <select value={departmentId} onChange={event => setDepartmentId(event.target.value)} className={input}>
                    <option value="">بدون دپارتمان</option>
                    {departments.map((department: any) => <option key={department.id} value={department.id}>{department.name}</option>)}
                  </select>
                </label>
                <label className="block space-y-1.5">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">سرپرست تیم</span>
                  <select value={leaderId} onChange={event => setLeaderId(event.target.value)} className={input}>
                    <option value="">تعیین نشده</option>
                    {people.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}
                  </select>
                </label>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">اعضا</span>
                  <span className="text-[11px] text-slate-400">{`${fa(memberIds.length)} نفر انتخاب شده`}</span>
                </div>
                {people.length === 0
                  ? <p className="text-[11px] text-slate-500 dark:text-slate-400">هنوز عضوی در این فضای کاری نیست.</p>
                  : <div className="flex flex-wrap gap-2">
                      {people.map(person => {
                        const selected = memberIds.includes(person.id);
                        return (
                          <button key={person.id} type="button" aria-pressed={selected} onClick={() => setMemberIds(previous => selected ? previous.filter(id => id !== person.id) : [...previous, person.id])}
                            className={`inline-flex items-center gap-2 h-8 ps-1 pe-3 rounded-full border text-xs font-semibold transition-colors cursor-pointer ${selected ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300'}`}>
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${selected ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>{selected ? <Check size={12} strokeWidth={3} /> : (person.name || '?')[0]}</span>
                            {person.name}
                          </button>
                        );
                      })}
                    </div>}
              </div>
            </fieldset>
          ) : (
            <div className="space-y-4">
              <p className="text-[11px] leading-5 text-slate-500 dark:text-slate-400 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                با انتخاب این تیم برای یک پروژه، این نقشهٔ راه به‌عنوان چک‌لیست پروژه ساخته می‌شود. تغییرات فقط روی پروژه‌های بعدی اثر دارد و چک‌لیست پروژه‌های فعلی دست نمی‌خورد.
              </p>
              {!readOnly && (
                <div className="flex flex-wrap items-center gap-2">
                  {template && (
                    <button type="button" onClick={() => applyTemplate(template.key)} className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[11px] font-bold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer">
                      <RotateCcw size={13} />بازگردانی الگوی پیش‌فرض
                    </button>
                  )}
                  <select aria-label="شروع از الگو" value="" onChange={event => applyTemplate(event.target.value)} className="h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60 text-[11px] font-bold text-slate-600 dark:text-slate-300 focus:outline-none focus:border-blue-500 cursor-pointer">
                    <option value="">شروع از الگوی آماده…</option>
                    {DEFAULT_TEAMS.map(row => <option key={row.key} value={row.key}>{row.name}</option>)}
                  </select>
                </div>
              )}

              {roadmap.phases.length === 0 && (
                <div className="text-center px-6 py-10 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                  <p className="text-xs text-slate-500 dark:text-slate-400">این تیم هنوز نقشهٔ راهی ندارد. یک فاز اضافه کنید یا از الگوی آماده شروع کنید.</p>
                </div>
              )}

              <ol className="space-y-3">
                {roadmap.phases.map((phase, index) => {
                  const open = openPhases.has(phase.id);
                  return (
                    <li key={phase.id} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                      <div className="flex items-center gap-1 p-2 ps-3">
                        <span className="shrink-0 w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-[11px] font-black text-slate-500 dark:text-slate-400 flex items-center justify-center">{fa(index + 1)}</span>
                        {readOnly
                          ? <span className="flex-1 px-2 text-[13px] font-bold text-slate-900 dark:text-white">{phase.title}</span>
                          : <input aria-label={`عنوان فاز ${fa(index + 1)}`} value={phase.title} maxLength={ROADMAP_LIMITS.title} placeholder="عنوان فاز" onChange={event => setPhase(phase.id, row => ({ ...row, title: event.target.value }))} className={`${inline} font-bold`} />}
                        <span className="shrink-0 text-[10px] font-bold text-slate-400 px-1">{fa(phase.steps.length)}</span>
                        {!readOnly && <>
                          <button type="button" onClick={() => setRoadmap(previous => ({ phases: move(previous.phases, index, -1) }))} disabled={index === 0} aria-label="انتقال به بالا" className={iconButton}><ArrowUp size={14} /></button>
                          <button type="button" onClick={() => setRoadmap(previous => ({ phases: move(previous.phases, index, 1) }))} disabled={index === roadmap.phases.length - 1} aria-label="انتقال به پایین" className={iconButton}><ArrowDown size={14} /></button>
                          <button type="button" onClick={() => { if (!phase.steps.some(step => step.title.trim()) || window.confirm(`فاز «${phase.title || fa(index + 1)}» و مراحلش حذف شود؟`)) setRoadmap(previous => ({ phases: previous.phases.filter(row => row.id !== phase.id) })); }} aria-label="حذف فاز" className={`${iconButton} hover:!text-rose-600`}><Trash2 size={14} /></button>
                        </>}
                        <button type="button" onClick={() => togglePhase(phase.id)} aria-expanded={open} aria-label={open ? 'بستن فاز' : 'باز کردن فاز'} className={iconButton}><ChevronDown size={15} className={`transition-transform ${open ? 'rotate-180' : ''}`} /></button>
                      </div>
                      {open && (
                        <div className="border-t border-slate-100 dark:border-slate-800 p-3 space-y-2">
                          {readOnly
                            ? phase.description && <p className="text-[11px] text-slate-500 dark:text-slate-400 px-2">{phase.description}</p>
                            : <input aria-label="توضیح فاز" value={phase.description || ''} maxLength={ROADMAP_LIMITS.description} placeholder="توضیح کوتاه فاز (اختیاری)" onChange={event => setPhase(phase.id, row => ({ ...row, description: event.target.value }))} className={`${inline} text-[11px] text-slate-500`} />}
                          <ul className="space-y-1">
                            {phase.steps.map((step, stepIndex) => (
                              <li key={step.id} className="flex items-center gap-1 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/40 ps-1">
                                <button type="button" disabled={readOnly} onClick={() => setPhase(phase.id, row => ({ ...row, steps: row.steps.map(item => item.id === step.id ? { ...item, required: item.required === false } : item) }))}
                                  title={step.required === false ? 'اختیاری — برای ضروری کردن کلیک کنید' : 'ضروری — برای اختیاری کردن کلیک کنید'}
                                  className={`shrink-0 h-6 px-2 rounded-md text-[10px] font-bold transition-colors cursor-pointer disabled:cursor-default ${step.required === false ? 'bg-slate-100 dark:bg-slate-800 text-slate-500' : 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300'}`}>
                                  {step.required === false ? 'اختیاری' : 'ضروری'}
                                </button>
                                {readOnly
                                  ? <span className="flex-1 px-2 py-1.5 text-[13px] text-slate-700 dark:text-slate-200">{step.title}</span>
                                  : <input aria-label={`مرحلهٔ ${fa(stepIndex + 1)}`} value={step.title} maxLength={ROADMAP_LIMITS.stepTitle} placeholder="عنوان مرحله"
                                      onChange={event => setPhase(phase.id, row => ({ ...row, steps: row.steps.map(item => item.id === step.id ? { ...item, title: event.target.value } : item) }))}
                                      onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); const next = { id: roadmapId('step'), title: '', required: true }; setPhase(phase.id, row => ({ ...row, steps: [...row.steps.slice(0, stepIndex + 1), next, ...row.steps.slice(stepIndex + 1)] })); requestAnimationFrame(() => document.querySelector<HTMLInputElement>(`[data-step="${next.id}"]`)?.focus()); } }}
                                      data-step={step.id} className={inline} />}
                                {!readOnly && <>
                                  <button type="button" onClick={() => setPhase(phase.id, row => ({ ...row, steps: move(row.steps, stepIndex, -1) }))} disabled={stepIndex === 0} aria-label="انتقال به بالا" className={iconButton}><ArrowUp size={13} /></button>
                                  <button type="button" onClick={() => setPhase(phase.id, row => ({ ...row, steps: move(row.steps, stepIndex, 1) }))} disabled={stepIndex === phase.steps.length - 1} aria-label="انتقال به پایین" className={iconButton}><ArrowDown size={13} /></button>
                                  <button type="button" onClick={() => setPhase(phase.id, row => ({ ...row, steps: row.steps.filter(item => item.id !== step.id) }))} aria-label="حذف مرحله" className={`${iconButton} hover:!text-rose-600`}><X size={14} /></button>
                                </>}
                              </li>
                            ))}
                          </ul>
                          {!readOnly && (
                            <button type="button" disabled={phase.steps.length >= ROADMAP_LIMITS.steps}
                              onClick={() => { const next = { id: roadmapId('step'), title: '', required: true }; setPhase(phase.id, row => ({ ...row, steps: [...row.steps, next] })); requestAnimationFrame(() => document.querySelector<HTMLInputElement>(`[data-step="${next.id}"]`)?.focus()); }}
                              className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 disabled:opacity-40 cursor-pointer">
                              <Plus size={13} />افزودن مرحله
                            </button>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
              {!readOnly && (
                <button type="button" onClick={addPhase} disabled={roadmap.phases.length >= ROADMAP_LIMITS.phases}
                  className="w-full inline-flex items-center justify-center gap-1.5 h-11 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 hover:border-blue-500 hover:text-blue-600 disabled:opacity-40 cursor-pointer">
                  <Plus size={14} />افزودن فاز
                </button>
              )}
            </div>
          )}
        </div>

        <footer className="shrink-0 flex items-center justify-between gap-2 px-5 sm:px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
          {team && !readOnly
            ? <button type="button" onClick={() => void remove()} disabled={saving} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:opacity-50 cursor-pointer"><Trash2 size={14} />حذف تیم</button>
            : <span />}
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="h-9 px-4 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">{readOnly ? 'بستن' : 'انصراف'}</button>
            {!readOnly && <button type="submit" disabled={saving} className="h-9 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold disabled:opacity-50 cursor-pointer">{saving ? 'در حال ذخیره…' : team ? 'ذخیرهٔ تغییرات' : 'ساخت تیم'}</button>}
          </div>
        </footer>
      </form>
    </div>
  );
};
