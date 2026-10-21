import React from 'react';
import { motion } from 'motion/react';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md';
  showDot?: boolean;
  id?: string;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  showDot = false,
  id,
  className = '',
}) => {
  const baseStyle = 'inline-flex items-center font-sans font-semibold rounded-full select-none leading-none border transition-all';
  
  const variants = {
    primary: 'bg-brand-accent/10 text-brand-accent border-brand-accent/20 hover:bg-brand-accent/20',
    secondary: 'bg-surface-secondary text-text-secondary border-border-primary hover:bg-hover-overlay',
    success: 'bg-brand-success/10 text-brand-success border-brand-success/20 hover:bg-brand-success/20',
    warning: 'bg-brand-warning/10 text-brand-warning border-brand-warning/20 hover:bg-brand-warning/20',
    danger: 'bg-brand-danger/10 text-brand-danger border-brand-danger/20 hover:bg-brand-danger/20',
    info: 'bg-blue-500/10 text-blue-500 border-blue-500/20 hover:bg-blue-500/20',
  };

  const sizes = {
    sm: 'px-2 py-1 text-[10px] gap-1',
    md: 'px-2.5 py-1.5 text-xs gap-1.5',
  };

  const dotColors = {
    primary: 'bg-brand-accent',
    secondary: 'bg-text-secondary',
    success: 'bg-brand-success',
    warning: 'bg-brand-warning',
    danger: 'bg-brand-danger',
    info: 'bg-blue-500',
  };

  return (
    <motion.span
      id={id}
      whileHover={{ y: -1 }}
      className={`${baseStyle} ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {showDot && (
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColors[variant]}`} />
      )}
      {children}
    </motion.span>
  );
};
