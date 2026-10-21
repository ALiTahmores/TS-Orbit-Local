import { LocalImage } from '../common/LocalImage';
import React, { useState, useEffect } from 'react';
import { useProject } from '../../context/ProjectContext';
import { CustomSelect, CustomSelectOption } from '../common/CustomSelect';
import { DepartmentKey } from '../../types';
import { 
  UserPlus, 
  X, 
  User, 
  Mail, 
  Phone, 
  Briefcase, 
  Layers, 
  DollarSign, 
  Sparkles, 
  Upload, 
  Tag, 
  Check, 
  Image as ImageIcon 
} from 'lucide-react';

const toPersianDigits = (n: string | number): string => {
  if (n === null || n === undefined) return '';
  const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(n).replace(/[0-9]/g, (x) => farsiDigits[parseInt(x, 10)]);
};

const DEPARTMENT_OPTIONS: CustomSelectOption[] = [
  { value: 'wp_dev', label: 'توسعه وب (WordPress & React)' },
  { value: 'ui_ux', label: 'طراحی UI/UX و محصول' },
  { value: 'seo', label: 'سئو و بهینه‌سازی موتورهای جستجو' },
  { value: 'content', label: 'تولید و استراتژی محتوا' },
  { value: 'qa', label: 'تضمین کیفیت (QA) و تست' },
];

const ROLE_OPTIONS: CustomSelectOption[] = [
  { value: 'عضو ارشد تیم (Senior)', label: 'عضو ارشد تیم (Senior)' },
  { value: 'راهبر فنی / تیم لید (Team Lead)', label: 'راهبر فنی / تیم لید (Team Lead)' },
  { value: 'متخصص اجرایی (Specialist)', label: 'متخصص اجرایی (Specialist)' },
  { value: 'کارآموز / جونیور (Junior)', label: 'کارآموز / جونیور (Junior)' },
];

const DEFAULT_AVATARS = [
  '/avatars/avatar-7.svg',
  '/avatars/avatar-7.svg',
  '/avatars/avatar-7.svg',
  '/avatars/avatar-0.svg',
  '/avatars/avatar-7.svg'
];

interface AddSpecialistModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddSpecialistModal: React.FC<AddSpecialistModalProps> = ({
  isOpen,
  onClose
}) => {
  const { addTeamMember } = useProject();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState<DepartmentKey>('wp_dev');
  const [role, setRole] = useState('عضو ارشد تیم (Senior)');
  const [hourlyRate, setHourlyRate] = useState('');
  const [skills, setSkills] = useState<string[]>(['React', 'TypeScript', 'Tailwind']);
  const [skillInput, setSkillInput] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(DEFAULT_AVATARS[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setFullName('');
      setEmail('');
      setPhone('');
      setDepartment('wp_dev');
      setRole('عضو ارشد تیم (Senior)');
      setHourlyRate('');
      setSkills(['React', 'TypeScript', 'Tailwind']);
      setSkillInput('');
      setSelectedAvatar(DEFAULT_AVATARS[0]);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const handleAddSkill = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Enter' || e.key === ',') && skillInput.trim()) {
      e.preventDefault();
      const newSkill = skillInput.trim();
      if (!skills.includes(newSkill)) {
        setSkills([...skills, newSkill]);
      }
      setSkillInput('');
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setSkills(skills.filter((s) => s !== skillToRemove));
  };

  const isFormValid = fullName.trim().length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    setIsSubmitting(true);
    try {
      await addTeamMember({
        name: fullName.trim(),
        role: role.trim() || 'متخصص اجرایی',
        department: department,
        avatar: selectedAvatar,
        taskCount: 0,
        completedCount: 0,
        status: 'online',
        rating: '۹.۵',
        email: email.trim() || 'specialist@agency.com',
        phone: phone.trim() || '۰۹۱۲۰۰۰۰۰۰۰',
        hourlyRate: hourlyRate.trim() || '۲۵۰,۰۰۰ تومان',
        skills: skills.length > 0 ? skills : ['توسعه وب', 'طراحی UI']
      });

      onClose();
    } catch (err) {
      console.error('Failed to add specialist:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto dir-rtl font-sans" 
      dir="rtl"
      style={{ fontFeatureSettings: '"ss01" 1' }}
    >
      {/* 1. Translucent Gradient Backdrop (Background remains bright, sharp & readable) */}
      <div 
        onClick={onClose}
        className="fixed inset-0 z-0 bg-gradient-to-t from-black/[0.18] via-black/[0.06] to-transparent dark:from-black/[0.5] dark:via-black/[0.25] dark:to-transparent backdrop-blur-[1.5px] transition-opacity duration-300 animate-in fade-in cursor-pointer"
      />

      {/* 2. Modal Card Container with High-Contrast Elevation */}
      <div 
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-[28px] p-6 sm:p-8 max-w-2xl w-full shadow-[0_25px_70px_-15px_rgba(0,0,0,0.18),0_10px_30px_-10px_rgba(0,0,0,0.08)] dark:shadow-[0_25px_70px_-15px_rgba(0,0,0,0.6)] space-y-5 text-right animate-in fade-in zoom-in-95 duration-200 overflow-y-auto max-h-[90vh] pb-8 cursor-default"
      >
        {/* MODAL HEADER */}
        <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/10 text-blue-600 dark:text-blue-400 rounded-2xl border border-blue-500/20 shrink-0">
              <UserPlus size={22} className="stroke-[2]" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-800 dark:text-slate-100">
                افزودن متخصص جدید به تیم
              </h3>
              <p className="text-xs font-medium text-slate-400 mt-0.5">
                تکمیل اطلاعات فردی، دپارتمان تخصصی، دستمزد ساعتی و سطح دسترسی
              </p>
            </div>
          </div>

          <button 
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* FORM CONTENT */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-medium">
          
          {/* AVATAR SELECTOR / UPLOAD WIDGET */}
          <div className="space-y-2 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
            <label className="text-xs text-slate-700 dark:text-slate-300 font-extrabold flex items-center gap-1.5">
              <ImageIcon size={14} className="text-blue-500" />
              <span>تصویر پروفایل متخصص</span>
            </label>
            <div className="flex items-center gap-4 pt-1">
              <LocalImage 
                src={selectedAvatar} 
                alt="Avatar preview" 
                className="w-14 h-14 rounded-full object-cover ring-4 ring-blue-500/20 border-2 border-white dark:border-slate-800 shadow-md shrink-0" 
              />
              <div className="flex flex-col gap-1.5 flex-1">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  انتخاب از آواتارهای آماده یا آپلود تصویر شخصی:
                </span>
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {DEFAULT_AVATARS.map((avatar, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedAvatar(avatar)}
                      className={`w-8 h-8 rounded-full overflow-hidden border-2 transition-all cursor-pointer shrink-0 ${
                        selectedAvatar === avatar 
                          ? 'border-blue-600 scale-110 ring-2 ring-blue-500/30' 
                          : 'border-transparent opacity-70 hover:opacity-100'
                      }`}
                    >
                      <LocalImage src={avatar} alt={`Avatar ${idx}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* GRID: FULL NAME & EMAIL */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* FULL NAME */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-700 dark:text-slate-300 font-extrabold flex items-center gap-1.5">
                <User size={14} className="text-slate-400" />
                <span>نام و نام خانوادگی</span>
                <span className="text-rose-500 font-black">*</span>
              </label>
              <input 
                type="text" 
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="مثال: علی طهمورث"
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 p-3 rounded-2xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold transition-all placeholder:text-slate-400"
              />
            </div>

            {/* EMAIL */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-700 dark:text-slate-300 font-extrabold flex items-center gap-1.5">
                <Mail size={14} className="text-slate-400" />
                <span>پست الکترونیک (ایمیل)</span>
              </label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ali.tahmasebi@example.com"
                dir="ltr"
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 p-3 rounded-2xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold transition-all placeholder:text-slate-400 text-left font-mono"
              />
            </div>

          </div>

          {/* GRID: PHONE & HOURLY RATE */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* PHONE NUMBER */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-700 dark:text-slate-300 font-extrabold flex items-center gap-1.5">
                <Phone size={14} className="text-slate-400" />
                <span>شماره تماس</span>
              </label>
              <input 
                type="text" 
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                dir="ltr"
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 p-3 rounded-2xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold transition-all placeholder:text-slate-400 text-left font-mono"
              />
            </div>

            {/* HOURLY RATE */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-700 dark:text-slate-300 font-extrabold flex items-center gap-1.5">
                <DollarSign size={14} className="text-emerald-500" />
                <span>نرخ ساعتی / دستمزد ($/h یا تومان)</span>
              </label>
              <input 
                type="text" 
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                placeholder="مثال: ۲۵۰,۰۰۰ تومان / ساعت"
                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 p-3 rounded-2xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold transition-all placeholder:text-slate-400"
              />
            </div>

          </div>

          {/* GRID: DEPARTMENT & ROLE */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* DEPARTMENT */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-700 dark:text-slate-300 font-extrabold flex items-center gap-1.5">
                <Layers size={14} className="text-blue-500" />
                <span>دپارتمان تخصصی</span>
                <span className="text-rose-500 font-black">*</span>
              </label>
              <CustomSelect
                options={DEPARTMENT_OPTIONS}
                value={department}
                onChange={(val) => setDepartment(val as DepartmentKey)}
                placeholder="-- انتخاب دپارتمان --"
              />
            </div>

            {/* ROLE / ACCESS LEVEL */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-700 dark:text-slate-300 font-extrabold flex items-center gap-1.5">
                <Briefcase size={14} className="text-indigo-500" />
                <span>سمت / سطح دسترسی</span>
                <span className="text-rose-500 font-black">*</span>
              </label>
              <CustomSelect
                options={ROLE_OPTIONS}
                value={role}
                onChange={(val) => setRole(val)}
                placeholder="-- انتخاب سطح دسترسی --"
              />
            </div>

          </div>

          {/* SKILLS TAG INPUT */}
          <div className="space-y-1.5">
            <label className="text-xs text-slate-700 dark:text-slate-300 font-extrabold flex items-center gap-1.5">
              <Tag size={14} className="text-amber-500" />
              <span>مهارت‌های تخصصی (کلید Enter جهت افزودن)</span>
            </label>
            <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 p-2.5 rounded-2xl flex flex-wrap items-center gap-2 min-h-[48px]">
              {skills.map((skill, idx) => (
                <span 
                  key={idx}
                  className="bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-[11px] font-bold px-2.5 py-1 rounded-xl flex items-center gap-1 border border-blue-200/60 dark:border-blue-800/50"
                >
                  <span>{skill}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveSkill(skill)}
                    className="hover:text-rose-600 p-0.5 rounded-full transition-colors cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
              <input 
                type="text" 
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={handleAddSkill}
                placeholder={skills.length === 0 ? "مثال: React, Node.js (تایپ و Enter)..." : "+ افزودن skill..."}
                className="bg-transparent border-none text-slate-800 dark:text-slate-100 focus:outline-none text-xs font-bold flex-1 min-w-[120px]"
              />
            </div>
          </div>

          {/* BUTTONS */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-2xl px-6 py-3.5 font-extrabold text-xs transition-all cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !isFormValid}
              className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-2xl px-6 py-3.5 font-black text-xs transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Sparkles size={16} />
              <span>
                {isSubmitting ? 'در حال ثبت متخصص...' : '+ افزودن متخصص جدید به سیستم'}
              </span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

export default AddSpecialistModal;
