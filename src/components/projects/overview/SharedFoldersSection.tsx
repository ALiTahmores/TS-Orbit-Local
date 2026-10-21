import { LocalImage } from '../../common/LocalImage';
import React, { useState } from 'react';
import { 
  FolderPlus, 
  Sparkles, 
  Folder, 
  Globe, 
  ShieldCheck, 
  MoreHorizontal,
  GripVertical,
  Edit3,
  HelpCircle,
  ArrowRight,
  ArrowLeft,
  Trash2,
  Plus,
  Pencil,
  Check
} from 'lucide-react';
import { toPersianDigits } from './utils';

interface FolderData {
  id: string;
  title: string;
  fileCount: number;
  sizeGB: string;
  theme: 'dark-blue' | 'blue' | 'amber' | 'emerald';
  isSpecial?: boolean;
  avatars: string[];
  extraAvatarsCount?: number;
}

interface SharedFoldersSectionProps {
  onFolderClick?: (folder: FolderData) => void;
  onViewAllClick?: () => void;
}

// Organic SVG Top Folder Notch Component
const FolderNotchHeader: React.FC<{ theme: string; isSpecial?: boolean }> = ({ theme, isSpecial }) => {
  let fillClass = 'fill-blue-200/70 dark:fill-blue-900/50';
  if (theme === 'dark-blue') fillClass = 'fill-blue-500/40';
  if (theme === 'amber') fillClass = 'fill-amber-200/70 dark:fill-amber-900/50';
  if (theme === 'emerald') fillClass = 'fill-emerald-200/70 dark:fill-emerald-900/50';

  return (
    <div className="absolute top-0 right-0 left-0 h-6 overflow-hidden pointer-events-none rounded-t-3xl">
      <svg 
        className={`w-full h-full ${fillClass} transition-colors`} 
        viewBox="0 0 280 24" 
        preserveAspectRatio="none"
      >
        <path d="
          M 0 24 
          L 130 24 
          C 142 24 148 0 162 0 
          L 260 0 
          C 272 0 280 8 280 24 
          Z
        " />
      </svg>
    </div>
  );
};

const INITIAL_FOLDERS: FolderData[] = [];

export const SharedFoldersSection: React.FC<SharedFoldersSectionProps> = ({
  onFolderClick,
  onViewAllClick
}) => {
  const [folders, setFolders] = useState<FolderData[]>(INITIAL_FOLDERS);
  const [isReorderMode, setIsReorderMode] = useState<boolean>(false);
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState<string>('');

  const moveFolder = (index: number, direction: 'left' | 'right') => {
    setFolders(prev => {
      const list = [...prev];
      const targetIndex = direction === 'left' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= list.length) return list;
      const temp = list[index];
      list[index] = list[targetIndex];
      list[targetIndex] = temp;
      return list;
    });
  };

  const handleDeleteFolder = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('آیا از حذف این پوشه اطمینان دارید؟')) {
      setFolders(prev => prev.filter(f => f.id !== id));
    }
  };

  const handleStartRename = (folder: FolderData, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(folder.id);
    setEditTitle(folder.title);
  };

  const handleSaveRename = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (editTitle.trim()) {
      setFolders(prev => prev.map(f => f.id === id ? { ...f, title: editTitle.trim() } : f));
    }
    setEditingId(null);
  };

  const handleAddNewFolder = () => {
    const newFolder: FolderData = {
      id: `f_new_${Date.now()}`,
      title: 'پوشه جدید / New Project Folder',
      fileCount: 0,
      sizeGB: '۰ مگابایت',
      theme: 'blue',
      avatars: ['/avatars/avatar-1.svg']
    };
    setFolders(prev => [...prev, newFolder]);
  };

  return (
    <div className="space-y-4">
      {/* HEADER CONTAINER DIRECTLY OPPOSITE TITLE */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-900/40 p-2.5 rounded-2xl border border-slate-200/60 dark:border-slate-800">
        
        {/* RIGHT SIDE (RTL): TITLE */}
        <h3 className="font-black text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2 shrink-0">
          <FolderPlus size={18} className="text-blue-600 dark:text-blue-400" />
          <span>پوشه‌ها و دپارتمان‌های پروژه</span>
        </h3>

        {/* LEFT SIDE (RTL): TOGGLE BUTTONS & GUIDE / HELPER TEXT */}
        <div className="flex flex-wrap items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
          
          {/* HELPER TEXT / GUIDE BADGE */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/60 rounded-xl text-[11px] font-bold">
            <HelpCircle size={13} className="text-blue-600 dark:text-blue-400 shrink-0" />
            <span>جهت تغییر چیدمان یا ویرایش پوشه‌ها از کلیدهای روبرو استفاده کنید:</span>
          </div>

          {/* TOGGLE 1: REORDER / MOVE MODE */}
          <button
            type="button"
            onClick={() => {
              setIsReorderMode(!isReorderMode);
              if (!isReorderMode) setIsEditMode(false);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs border ${
              isReorderMode
                ? 'bg-blue-600 text-white border-blue-600 shadow-blue-500/20'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title="فعال/غیرفعال‌سازی حالت جابه‌جایی چیدمان کارت‌ها"
          >
            <GripVertical size={14} className={isReorderMode ? 'animate-bounce' : ''} />
            <span>حالت جابه‌جایی</span>
            {isReorderMode && <span className="w-2 h-2 rounded-full bg-white animate-pulse" />}
          </button>

          {/* TOGGLE 2: EDIT MODE */}
          <button
            type="button"
            onClick={() => {
              setIsEditMode(!isEditMode);
              if (!isEditMode) setIsReorderMode(false);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs border ${
              isEditMode
                ? 'bg-slate-800 text-white border-slate-800 shadow-slate-500/20'
                : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            title="فعال/غیرفعال‌سازی حالت ویرایش و مدیریت کارت‌ها"
          >
            <Edit3 size={14} />
            <span>حالت ویرایش</span>
            {isEditMode && <span className="w-2 h-2 rounded-full bg-white animate-pulse" />}
          </button>

          {/* VIEW ALL BUTTON */}
          {onViewAllClick && (
            <button 
              type="button" 
              onClick={onViewAllClick}
              className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer transition-colors px-2 py-1"
            >
              <span>مشاهده همه</span>
              <span>←</span>
            </button>
          )}

        </div>
      </div>

      {/* ACTIVE MODE INFORMATIONAL STATUS BANNER */}
      {isReorderMode && (
        <div className="p-2.5 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900/60 rounded-xl flex items-center justify-between text-xs font-bold text-blue-900 dark:text-blue-200 shadow-2xs animate-fadeIn">
          <div className="flex items-center gap-2">
            <GripVertical size={16} className="text-blue-600 dark:text-blue-400" />
            <span>حالت جابه‌جایی فعال است: می‌توانید با فلش‌های چپ و راست چیدمان کارت‌ها را جابه‌جا کنید.</span>
          </div>
          <button 
            onClick={() => setIsReorderMode(false)}
            className="text-[10px] font-black underline hover:text-blue-700 cursor-pointer"
          >
            بستن حالت جابه‌جایی
          </button>
        </div>
      )}

      {isEditMode && (
        <div className="p-2.5 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900/60 rounded-xl flex items-center justify-between text-xs font-bold text-blue-900 dark:text-blue-200 shadow-2xs animate-fadeIn">
          <div className="flex items-center gap-2">
            <Edit3 size={16} className="text-blue-600 dark:text-blue-400" />
            <span>حالت ویرایش فعال است: امکان تغییر عنوان، حذف یا افزودن پوشه جدید فراهم گردیده است.</span>
          </div>
          <button 
            onClick={handleAddNewFolder}
            className="px-2.5 py-1 bg-blue-600 text-white rounded-lg text-[10px] font-black flex items-center gap-1 hover:bg-blue-700 cursor-pointer transition-colors"
          >
            <Plus size={12} />
            <span>+ پوشه جدید</span>
          </button>
        </div>
      )}

      {/* CARDS GRID CONTAINER */}
      {folders.length === 0 ? (
        <div className="p-8 text-center bg-slate-50/50 dark:bg-slate-900/30 rounded-2xl border-2 border-dashed border-slate-200/80 dark:border-slate-800 text-slate-500 font-['Vazirmatn'] [font-feature-settings:'ss01'_1] flex flex-col items-center justify-center space-y-3 col-span-full">
          <div className="p-3 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-xl">
            <Folder size={28} />
          </div>
          <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
            هیچ فایل یا پوشه‌ای هنوز ایجاد نشده است
          </p>
          <button
            type="button"
            onClick={handleAddNewFolder}
            className="mt-2 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-black px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-blue-500/20 transition-all cursor-pointer font-['Vazirmatn'] [font-feature-settings:'ss01'_1]"
          >
            <Plus size={14} />
            <span>+ ایجاد پوشه جدید</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 w-full">
          {folders.map((folder, index) => {
          const isDark = folder.theme === 'dark-blue';
          const isBlue = folder.theme === 'blue';
          const isAmber = folder.theme === 'amber';
          const isBeingEdited = editingId === folder.id;

          return (
            <div 
              key={folder.id}
              onClick={() => {
                if (!isReorderMode && !isEditMode) {
                  onFolderClick?.(folder);
                }
              }}
              className={`rounded-3xl relative pt-6 pb-5 px-5 transition-all duration-300 shadow-xs border overflow-hidden group ${
                isReorderMode ? 'ring-2 ring-blue-500/80 cursor-grab active:cursor-grabbing scale-[0.99]' : ''
              } ${
                isEditMode ? 'ring-2 ring-blue-500/80' : ''
              } ${
                !isReorderMode && !isEditMode ? 'hover:-translate-y-1 cursor-pointer' : ''
              } ${
                isDark 
                  ? 'bg-slate-900 text-white shadow-xl shadow-blue-950/20 border-slate-800' 
                  : isBlue 
                  ? 'bg-blue-50/80 dark:bg-blue-950/30 text-blue-950 dark:text-blue-100 border-blue-200/70 dark:border-blue-800/40'
                  : isAmber
                  ? 'bg-amber-50/80 dark:bg-amber-950/30 text-amber-950 dark:text-amber-100 border-amber-200/70 dark:border-amber-800/40'
                  : 'bg-emerald-50/80 dark:bg-emerald-950/30 text-emerald-950 dark:text-emerald-100 border-emerald-200/70 dark:border-emerald-800/40'
              }`}
            >
              <FolderNotchHeader theme={folder.theme} isSpecial={folder.isSpecial} />

              {/* REORDER OVERLAY CONTROLS */}
              {isReorderMode && (
                <div className="absolute top-2 left-2 z-20 flex items-center gap-1 bg-blue-950/90 text-white p-1 rounded-xl shadow-md border border-blue-500/50">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); moveFolder(index, 'left'); }}
                    disabled={index === 0}
                    className="p-1 hover:bg-blue-700 disabled:opacity-30 rounded-lg transition-colors cursor-pointer"
                    title="انتقال به قبلی"
                  >
                    <ArrowRight size={13} />
                  </button>
                  <span className="text-[10px] font-mono font-bold px-1">{index + 1}</span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); moveFolder(index, 'right'); }}
                    disabled={index === folders.length - 1}
                    className="p-1 hover:bg-blue-700 disabled:opacity-30 rounded-lg transition-colors cursor-pointer"
                    title="انتقال به بعدی"
                  >
                    <ArrowLeft size={13} />
                  </button>
                </div>
              )}

              {/* EDIT MODE OVERLAY CONTROLS */}
              {isEditMode && !isReorderMode && (
                <div className="absolute top-2 left-2 z-20 flex items-center gap-1 bg-blue-950/90 text-white p-1 rounded-xl shadow-md border border-blue-500/50">
                  <button
                    type="button"
                    onClick={(e) => handleStartRename(folder, e)}
                    className="p-1 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer"
                    title="ویرایش عنوان"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleDeleteFolder(folder.id, e)}
                    className="p-1 hover:bg-rose-700 text-rose-300 rounded-lg transition-colors cursor-pointer"
                    title="حذف پوشه"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              )}

              {/* CARD ICON HEADER */}
              <div className="flex justify-between items-start mb-5 relative z-10">
                <div className={`p-3 rounded-2xl shadow-2xs ${
                  isDark ? 'bg-blue-600/30 text-blue-300 border border-blue-500/30' :
                  isBlue ? 'bg-blue-200/70 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' :
                  isAmber ? 'bg-amber-200/70 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300' :
                  'bg-emerald-200/70 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300'
                }`}>
                  {isDark ? <Sparkles size={22} /> : isBlue ? <Folder size={22} /> : isAmber ? <Globe size={22} /> : <ShieldCheck size={22} />}
                </div>

                {!isReorderMode && !isEditMode && (
                  <button type="button" className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg">
                    <MoreHorizontal size={18} />
                  </button>
                )}
              </div>

              {/* CARD TITLE / EDIT INLINE INPUT */}
              {isBeingEdited ? (
                <div className="flex items-center gap-1 my-1 z-10 relative" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full text-xs font-bold px-2 py-1 bg-white dark:bg-slate-800 border border-blue-500 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={(e) => handleSaveRename(folder.id, e)}
                    className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer"
                  >
                    <Check size={13} />
                  </button>
                </div>
              ) : (
                <h4 className={`font-black text-xs sm:text-sm transition-colors line-clamp-1 ${
                  isDark ? 'text-white group-hover:text-blue-300' :
                  isBlue ? 'text-blue-900 dark:text-blue-100 group-hover:text-blue-700' :
                  isAmber ? 'text-amber-900 dark:text-amber-100 group-hover:text-amber-700' :
                  'text-emerald-900 dark:text-emerald-100 group-hover:text-emerald-700'
                }`}>
                  {folder.title}
                </h4>
              )}

              <p className={`text-[11px] font-bold mt-1 ${
                isDark ? 'text-slate-400' :
                isBlue ? 'text-blue-600/80 dark:text-blue-300/80' :
                isAmber ? 'text-amber-600/80 dark:text-amber-300/80' :
                'text-emerald-600/80 dark:text-emerald-300/80'
              }`}>
                {toPersianDigits(folder.fileCount)} فایل، {folder.sizeGB}
              </p>

              {/* FOOTER AVATARS */}
              <div className="flex items-center justify-between mt-5 pt-3.5 border-t border-slate-200/40 dark:border-slate-800/60">
                <div className="flex items-center -space-x-2 rtl:space-x-reverse">
                  {folder.avatars.map((img, idx) => (
                    <LocalImage 
                      key={idx} 
                      src={img} 
                      alt="Collaborator" 
                      className="w-7 h-7 rounded-full ring-2 ring-white/80 dark:ring-slate-900/80 object-cover" 
                    />
                  ))}
                  {folder.extraAvatarsCount && (
                    <span className={`w-7 h-7 rounded-full ring-2 ring-white/80 dark:ring-slate-900/80 text-[10px] font-black flex items-center justify-center ${
                      isDark ? 'bg-blue-900 text-blue-200' :
                      isBlue ? 'bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200' :
                      isAmber ? 'bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200' :
                      'bg-emerald-200 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-200'
                    }`}>
                      +{toPersianDigits(folder.extraAvatarsCount)}
                    </span>
                  )}
                </div>

                {folder.isSpecial && (
                  <span className="text-[10px] font-black bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/30">
                    ویژه
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
};

