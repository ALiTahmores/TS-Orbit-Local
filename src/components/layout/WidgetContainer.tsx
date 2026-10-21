import React from 'react';
import { motion } from 'motion/react';
import { useProject } from '../../context/ProjectContext';

export interface WidgetContainerProps {
  id: string;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  className?: string;
}

export const WidgetContainer: React.FC<WidgetContainerProps> = ({
  id,
  title,
  subtitle,
  actions,
  children,
  padding = 'md',
  className = '',
}) => {
  const { locale } = useProject();
  const isRtl = locale === 'fa';

  const paddings = {
    none: 'p-0',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  return (
    <motion.div
      id={id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`bg-surface-primary border border-border-primary rounded-radius-20 shadow-md hover:shadow-lg transition-all overflow-hidden flex flex-col font-sans ${className}`}
      style={{ direction: isRtl ? 'rtl' : 'ltr' }}
    >
      {/* Widget Header */}
      {(title || subtitle || actions) && (
        <div className={`flex items-center justify-between px-6 py-4 border-b border-border-primary/50 shrink-0 ${isRtl ? 'text-right' : 'text-left'}`}>
          <div className="flex flex-col space-y-0.5 max-w-[65%]">
            {title && (
              <h4 className="text-xs font-extrabold text-text-primary tracking-tight select-none truncate">
                {title}
              </h4>
            )}
            {subtitle && (
              <span className="text-[10px] text-text-muted select-none truncate">
                {subtitle}
              </span>
            )}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      )}

      {/* Widget Content */}
      <div className={`flex-1 overflow-visible ${paddings[padding]}`}>
        {children}
      </div>
    </motion.div>
  );
};
