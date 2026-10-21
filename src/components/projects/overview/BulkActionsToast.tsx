import React from 'react';
import { 
  CheckCircle, 
  Download, 
  Link as LinkIcon, 
  Trash2, 
  XCircle 
} from 'lucide-react';
import { toPersianDigits } from './utils';

interface BulkActionsToastProps {
  selectedCount: number;
  onClearSelection: () => void;
  onDownloadSelected: () => void;
  onDeleteSelected: () => void;
  onCopyLinks: () => void;
}

export const BulkActionsToast: React.FC<BulkActionsToastProps> = ({
  selectedCount,
  onClearSelection,
  onDownloadSelected,
  onDeleteSelected,
  onCopyLinks
}) => {
  if (selectedCount <= 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 dark:bg-slate-950/95 text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-800 flex items-center gap-4 animate-in fade-in slide-in-from-bottom-5 duration-200 backdrop-blur-md font-sans">
      
      <span className="text-xs font-black text-blue-400 flex items-center gap-1.5 border-l border-slate-800 pl-4">
        <CheckCircle size={16} />
        <span>{toPersianDigits(selectedCount)} مورد انتخاب شده</span>
      </span>

      <div className="flex items-center gap-2">
        <button 
          type="button" 
          onClick={onDownloadSelected}
          className="bg-slate-800 hover:bg-slate-700 active:scale-95 text-xs font-bold px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <Download size={14} className="text-emerald-400" />
          <span>دانلود</span>
        </button>

        <button 
          type="button" 
          onClick={onCopyLinks}
          className="bg-slate-800 hover:bg-slate-700 active:scale-95 text-xs font-bold px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <LinkIcon size={14} className="text-blue-400" />
          <span>لینک مستقیم</span>
        </button>

        <button 
          type="button" 
          onClick={onDeleteSelected}
          className="bg-rose-950/80 hover:bg-rose-900 active:scale-95 text-rose-300 text-xs font-bold px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer border border-rose-800/50"
        >
          <Trash2 size={14} />
          <span>حذف</span>
        </button>
      </div>

      <button
        type="button"
        onClick={onClearSelection}
        className="text-slate-400 hover:text-white p-1 mr-2 transition-colors cursor-pointer"
        title="لغو انتخاب"
      >
        <XCircle size={18} />
      </button>

    </div>
  );
};
