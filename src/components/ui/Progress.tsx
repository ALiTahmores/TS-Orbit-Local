import React from 'react';
import { motion } from 'motion/react';

export interface ProgressProps {
  value: number;
  variant?: 'primary' | 'success' | 'warning' | 'danger';
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  id?: string;
  className?: string;
}

export const ProgressBar: React.FC<ProgressProps> = ({
  value,
  variant = 'primary',
  showLabel = false,
  size = 'md',
  id,
  className = '',
}) => {
  const clampedValue = Math.min(100, Math.max(0, value));

  const bgColors = {
    primary: 'bg-brand-accent',
    success: 'bg-brand-success',
    warning: 'bg-brand-warning',
    danger: 'bg-brand-danger',
  };

  const heights = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3.5',
  };

  return (
    <div id={id} className={`w-full font-sans ${className}`}>
      {showLabel && (
        <div className="flex justify-between items-center mb-1 text-[10px] font-bold text-text-secondary select-none">
          <span>{clampedValue}%</span>
        </div>
      )}
      <div className={`w-full bg-surface-secondary rounded-full overflow-hidden border border-border-primary/50 ${heights[size]}`}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${clampedValue}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className={`h-full rounded-full ${bgColors[variant]}`}
        />
      </div>
    </div>
  );
};

export interface CircularProgressProps extends Omit<ProgressProps, 'size'> {
  size?: number; // size in pixels
  strokeWidth?: number;
}

export const CircularProgress: React.FC<CircularProgressProps> = ({
  value,
  variant = 'primary',
  showLabel = false,
  size = 64,
  strokeWidth = 6,
  id,
  className = '',
}) => {
  const clampedValue = Math.min(100, Math.max(0, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (clampedValue / 100) * circumference;

  const strokeColors = {
    primary: 'stroke-brand-accent',
    success: 'stroke-brand-success',
    warning: 'stroke-brand-warning',
    danger: 'stroke-brand-danger',
  };

  return (
    <div id={id} className={`relative flex items-center justify-center font-sans ${className}`} style={{ width: size, height: size }}>
      <svg className="w-full h-full -rotate-90" viewBox={`0 0 ${size} ${size}`}>
        {/* Background Track */}
        <circle
          className="stroke-border-primary/40 fill-transparent"
          strokeWidth={strokeWidth}
          cx={size / 2}
          cy={size / 2}
          r={radius}
        />
        {/* Progress Circle */}
        <motion.circle
          className={`${strokeColors[variant]} fill-transparent transition-all`}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          strokeLinecap="round"
          cx={size / 2}
          cy={size / 2}
          r={radius}
        />
      </svg>
      {showLabel && (
        <span className="absolute text-xs font-bold text-text-primary select-none">
          {clampedValue}%
        </span>
      )}
    </div>
  );
};
