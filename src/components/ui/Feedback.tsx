import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { HelpCircle } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';

// 1. EMPTY STATE
export interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  actionButton?: React.ReactNode;
  id?: string;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  actionButton,
  id,
  className = '',
}) => {
  return (
    <div
      id={id}
      className={`flex flex-col items-center justify-center text-center p-8 border border-dashed border-border-primary rounded-radius-20 bg-surface-primary/30 font-sans ${className}`}
    >
      {icon && (
        <div className="p-4 bg-surface-secondary rounded-full text-text-muted mb-4 shadow-sm">
          {icon}
        </div>
      )}
      <h3 className="text-sm font-bold text-text-primary mb-2 select-none">{title}</h3>
      <p className="text-xs text-text-secondary max-w-sm mb-6 leading-relaxed select-none">{description}</p>
      {actionButton && <div>{actionButton}</div>}
    </div>
  );
};

// 2. SKELETON
export interface SkeletonProps {
  variant?: 'text' | 'rect' | 'circle';
  width?: string | number;
  height?: string | number;
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'rect',
  width,
  height,
  className = '',
}) => {
  const styles = {
    text: 'h-3 w-3/4 rounded-radius-8',
    rect: 'rounded-radius-12',
    circle: 'rounded-full',
  };

  return (
    <div
      className={`bg-border-primary animate-pulse shrink-0 ${styles[variant]} ${className}`}
      style={{
        width: width ?? undefined,
        height: height ?? undefined,
      }}
    />
  );
};

// 3. TOOLTIP
export interface TooltipProps {
  content: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
  className = '',
}) => {
  const [active, setActive] = useState(false);
  const { locale } = useProject();
  const isRtl = locale === 'fa';

  const positionStyles = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
    >
      {children}
      <AnimatePresence>
        {active && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 100, ease: 'easeOut' }}
            className={`absolute z-50 px-2 py-1.5 text-[10px] font-semibold text-text-primary bg-surface-primary border border-border-strong rounded-radius-8 shadow-floating select-none whitespace-nowrap leading-none ${positionStyles[position]} ${className}`}
            style={{ direction: isRtl ? 'rtl' : 'ltr' }}
          >
            {content}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
