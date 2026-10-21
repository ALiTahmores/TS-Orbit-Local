import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, ArrowUpRight, TrendingUp, Compass, Activity, CheckCircle, Clock } from 'lucide-react';

interface ComponentProps {
  children?: React.ReactNode;
  className?: string;
  id?: string;
  onClick?: () => void;
}

// 1. MetricCard: For key metrics with high density
export const MetricCard: React.FC<ComponentProps & {
  title: string;
  value: string | number;
  change?: string;
  isPositive?: boolean;
  icon?: React.ReactNode;
}> = ({ title, value, change, isPositive = true, icon, className = "", id }) => {
  return (
    <div 
      id={id}
      className={`bg-surface-primary dark:bg-[#1A1A24] border border-border-primary/85 dark:border-white/5 rounded-xl p-5 hover:border-brand-accent/30 transition-all duration-300 shadow-sm relative overflow-hidden group ${className}`}
    >
      <div className="absolute top-0 left-0 w-1.5 h-full bg-brand-accent/0 group-hover:bg-brand-accent/40 transition-all duration-300" />
      <div className="flex justify-between items-start mb-2.5">
        <span className="text-[10px] uppercase tracking-wider font-extrabold text-text-secondary dark:text-slate-400">
          {title}
        </span>
        {icon && (
          <div className="p-1.5 rounded-lg bg-hover-overlay dark:bg-white/5 text-brand-accent shrink-0">
            {icon}
          </div>
        )}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-xl font-black text-text-primary dark:text-white font-mono">
          {value}
        </span>
        {change && (
          <span className={`text-[9.5px] font-mono font-black ${
            isPositive ? 'text-brand-success dark:text-emerald-400' : 'text-brand-danger dark:text-rose-400'
          }`}>
            {isPositive ? '↑' : '↓'} {change}
          </span>
        )}
      </div>
    </div>
  );
};

// 2. ChartCard: For charts, heatmaps, maps
export const ChartCard: React.FC<ComponentProps & {
  title: string;
  subtitle?: string;
  headerAction?: React.ReactNode;
}> = ({ title, subtitle, headerAction, children, className = "", id }) => {
  return (
    <div 
      id={id}
      className={`bg-surface-primary dark:bg-[#1A1A24] border border-border-primary/85 dark:border-white/5 rounded-xl p-5 hover:border-brand-accent/15 transition-all duration-300 shadow-sm flex flex-col justify-between ${className}`}
    >
      <div className="flex justify-between items-center mb-4 border-b border-border-primary/30 dark:border-white/5 pb-2.5 shrink-0">
        <div>
          <h4 className="text-xs font-black text-text-primary dark:text-white flex items-center gap-1.5">
            {title}
          </h4>
          {subtitle && (
            <p className="text-[10px] text-text-secondary dark:text-slate-450 mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
        {headerAction && <div className="shrink-0">{headerAction}</div>}
      </div>
      <div className="flex-1 w-full min-h-[160px] relative">
        {children}
      </div>
    </div>
  );
};

// 3. ProjectCard: Modern client site monitoring block
export const ProjectCard: React.FC<ComponentProps & {
  title: string;
  subtitle: string;
  progress: number;
  budget?: string;
  isActive?: boolean;
}> = ({ title, subtitle, progress, budget, isActive = false, onClick, className = "", id }) => {
  return (
    <div 
      id={id}
      onClick={onClick}
      className={`p-4 rounded-xl border cursor-pointer transition-all duration-250 flex flex-col justify-between space-y-3 relative group overflow-hidden ${
        isActive 
          ? 'bg-brand-accent/10 border-brand-accent/35 dark:border-brand-accent/40 shadow-sm shadow-brand-accent/5' 
          : 'bg-surface-primary dark:bg-[#1A1A24] border-border-primary/85 dark:border-white/5 hover:bg-hover-overlay hover:border-brand-accent/20'
      } ${className}`}
    >
      <div className="flex justify-between items-start gap-2">
        <div className="text-right">
          <h4 className="text-xs font-black text-text-primary dark:text-white truncate">
            {title}
          </h4>
          <p className="text-[9.5px] text-text-secondary dark:text-slate-400 line-clamp-1 mt-0.5">
            {subtitle}
          </p>
        </div>
        {budget && (
          <span className="text-[9px] font-mono bg-hover-overlay dark:bg-white/5 px-2 py-0.5 rounded text-brand-accent font-bold">
            {budget}
          </span>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between items-center text-[9px] font-bold text-text-secondary dark:text-slate-400">
          <span>{progress}%</span>
          <span>پروژه</span>
        </div>
        <div className="h-1.5 bg-bg-app dark:bg-slate-900 rounded-full overflow-hidden relative">
          <div 
            className="h-full bg-gradient-to-r from-brand-accent to-[#918aff] rounded-full transition-all duration-500" 
            style={{ width: `${progress}%` }} 
          />
        </div>
      </div>
    </div>
  );
};

// 4. TaskCard: Modern list task checklist block
export const TaskCard: React.FC<ComponentProps & {
  title: string;
  priority?: 'high' | 'medium' | 'low';
  assignedTo?: string;
  onComplete?: () => void;
}> = ({ title, priority = 'medium', assignedTo, onComplete, className = "", id }) => {
  return (
    <div 
      id={id}
      className={`p-3 bg-surface-primary dark:bg-[#1A1A24] border border-border-primary/85 dark:border-white/5 rounded-xl flex items-center justify-between gap-3 hover:border-brand-accent/25 transition-all group ${className}`}
    >
      <div className="flex items-center gap-2">
        <span className={`text-[8.5px] font-black px-1.5 py-0.5 rounded ${
          priority === 'high' 
            ? 'bg-rose-500/10 text-rose-500 dark:text-rose-400' 
            : 'bg-blue-500/10 text-blue-500 dark:text-blue-400'
        }`}>
          {priority === 'high' ? 'فوری' : 'عادی'}
        </span>
        {assignedTo && (
          <span className="text-[9px] text-text-secondary dark:text-slate-400 font-mono">
            {assignedTo}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-text-primary dark:text-white line-clamp-1">
          {title}
        </span>
        {onComplete && (
          <button 
            onClick={onComplete}
            className="p-1 rounded bg-hover-overlay dark:bg-white/5 text-text-secondary hover:text-brand-accent hover:bg-brand-accent/10 transition-all shrink-0 cursor-pointer"
          >
            <CheckCircle size={13} />
          </button>
        )}
      </div>
    </div>
  );
};

// 5. TeamCard: Specialist profile indicators
export const TeamCard: React.FC<ComponentProps & {
  name: string;
  role: string;
  isOnline?: boolean;
  taskCount?: number;
}> = ({ name, role, isOnline = true, taskCount = 0, className = "", id }) => {
  return (
    <div 
      id={id}
      className={`p-3 bg-surface-primary dark:bg-[#1A1A24] border border-border-primary/85 dark:border-white/5 rounded-xl flex items-center justify-between hover:border-brand-accent/15 transition-all ${className}`}
    >
      <div className="flex items-center gap-1.5">
        <span className="text-[9.5px] font-mono text-text-secondary dark:text-slate-400">
          {taskCount} کار
        </span>
      </div>

      <div className="flex items-center gap-2.5">
        <div className="text-right">
          <h4 className="text-xs font-black text-text-primary dark:text-white leading-tight">
            {name}
          </h4>
          <p className="text-[9px] text-text-secondary dark:text-slate-400 uppercase font-black">
            {role}
          </p>
        </div>
        <div className="relative shrink-0">
          <div className="w-8 h-8 rounded-full bg-brand-accent/15 dark:bg-[#155DFC]/20 text-text-primary dark:text-white flex items-center justify-center font-bold text-xs border border-border-primary/50">
            {name.substring(0, 1)}
          </div>
          {isOnline && (
            <span className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-500 border border-surface-primary dark:border-[#1A1A24] rounded-full animate-pulse" />
          )}
        </div>
      </div>
    </div>
  );
};

// 6. ActivityCard & Logs System
export const ActivityCard: React.FC<ComponentProps & {
  title: string;
  description: string;
  time: string;
  icon?: React.ReactNode;
}> = ({ title, description, time, icon, className = "", id }) => {
  return (
    <div 
      id={id}
      className={`text-right border-r-2 border-brand-accent/40 pr-3.5 space-y-0.5 relative py-1 ${className}`}
    >
      <div className="absolute right-[-5px] top-2.5 w-2 h-2 rounded-full bg-brand-accent" />
      <h4 className="text-xs font-black text-text-primary dark:text-white line-clamp-1 leading-tight">
        {title}
      </h4>
      <p className="text-[10px] text-text-secondary dark:text-slate-400 truncate leading-tight">
        {description}
      </p>
      <span className="text-[9px] font-mono text-brand-warning dark:text-amber-400 block pt-0.5">
        {time}
      </span>
    </div>
  );
};

// 7. QuickActionCard: Grid item command blocks
export const QuickActionCard: React.FC<ComponentProps & {
  title: string;
  icon?: React.ReactNode;
  bgClass?: string;
}> = ({ title, icon, bgClass = "bg-brand-accent/10 text-brand-accent", onClick, className = "", id }) => {
  return (
    <button 
      id={id}
      onClick={onClick}
      className={`p-3 bg-surface-primary dark:bg-[#1A1A24] hover:bg-hover-overlay dark:hover:bg-white/5 border border-border-primary/85 dark:border-white/5 hover:border-brand-accent/30 rounded-xl transition-all text-center space-y-1.5 group cursor-pointer w-full ${className}`}
    >
      <div className={`mx-auto w-7 h-7 rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform ${bgClass}`}>
        {icon}
      </div>
      <p className="text-[9.5px] font-black text-text-primary dark:text-white leading-none">
        {title}
      </p>
    </button>
  );
};

// 8. Reusable SaaS Floating Panel / Drawer / Dialog
export const Dialog: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}> = ({ isOpen, onClose, title, children }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
            className="relative bg-surface-primary dark:bg-[#1A1A24] border border-border-primary/90 dark:border-white/5 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 text-right"
            style={{ direction: 'rtl' }}
          >
            <div className="flex justify-between items-center pb-2 border-b border-border-primary/50 dark:border-white/5">
              <h3 className="text-xs font-black text-text-primary dark:text-white flex items-center gap-1.5">
                {title}
              </h3>
              <button 
                onClick={onClose}
                className="text-text-secondary dark:text-slate-400 hover:text-text-primary dark:hover:text-white text-[10px] font-bold p-1 bg-hover-overlay dark:bg-white/5 rounded-lg transition-all"
              >
                بستن
              </button>
            </div>
            <div className="pt-1">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
