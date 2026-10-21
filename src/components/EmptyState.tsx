import React from 'react';
import { 
  FolderGit, 
  CheckSquare, 
  Database, 
  Activity, 
  TrendingUp, 
  Plus, 
  HelpCircle,
  Cpu
} from 'lucide-react';

interface EmptyStateProps {
  id?: string;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  iconType?: 'project' | 'task' | 'api' | 'activity' | 'report' | 'automation';
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  id = "empty_state",
  title,
  description,
  actionLabel,
  onAction,
  iconType = 'project'
}) => {
  const renderIcon = () => {
    const baseClass = "w-12 h-12 rounded-2xl flex items-center justify-center border shadow-sm transition-all duration-300";
    switch (iconType) {
      case 'project':
        return (
          <div className={`${baseClass} bg-blue-50 border-blue-105 text-blue-600`}>
            <FolderGit size={22} className="animate-pulse" />
          </div>
        );
      case 'task':
        return (
          <div className={`${baseClass} bg-amber-50 border-amber-105 text-amber-600`}>
            <CheckSquare size={22} />
          </div>
        );
      case 'api':
        return (
          <div className={`${baseClass} bg-emerald-50 border-emerald-105 text-emerald-600`}>
            <Database size={22} />
          </div>
        );
      case 'activity':
        return (
          <div className={`${baseClass} bg-rose-50 border-rose-105 text-rose-600`}>
            <Activity size={22} />
          </div>
        );
      case 'report':
        return (
          <div className={`${baseClass} bg-blue-50 border-blue-105 text-blue-600`}>
            <TrendingUp size={22} />
          </div>
        );
      case 'automation':
        return (
          <div className={`${baseClass} bg-blue-50 border-blue-105 text-blue-600`}>
            <Cpu size={22} />
          </div>
        );
      default:
        return (
          <div className={`${baseClass} bg-slate-50 border-slate-105 text-slate-600`}>
            <HelpCircle size={22} />
          </div>
        );
    }
  };

  return (
    <div 
      id={id} 
      className="flex flex-col items-center justify-center text-center p-8 bg-white border border-slate-200 rounded-3xl space-y-5 max-w-xl mx-auto my-6 hover:shadow-md transition-all duration-300 relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-full blur-2xl opacity-50 -z-10" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-blue-50/30 rounded-full blur-xl opacity-40 -z-10" />
      
      {renderIcon()}
      
      <div className="space-y-2">
        <h3 className="text-sm font-black text-slate-800 leading-snug">{title}</h3>
        <p className="text-xs text-slate-500 leading-relaxed max-w-sm">{description}</p>
      </div>

      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="px-4.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black border border-blue-400/20 shadow-xs hover:shadow-md hover:shadow-blue-500/15 transition-all duration-200 active:scale-[0.98] flex items-center gap-1.5 cursor-pointer"
        >
          <Plus size={14} />
          <span>{actionLabel}</span>
        </button>
      )}
    </div>
  );
};
