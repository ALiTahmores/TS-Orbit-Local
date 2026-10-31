import React from 'react';
import { cn } from '../../lib/utils';

export type LoaderVariant = 'button' | 'button-wide' | 'workspace' | 'section' | 'page' | 'modal' | 'inline' | 'card';
export type StrandsLoaderVariant = LoaderVariant;

export interface StrandsLoaderProps {
  active?: boolean;
  variant?: LoaderVariant;
  message?: string;
  text?: string;
  className?: string;
  textClassName?: string;
  colors?: string[];
  count?: number;
  speed?: number;
}

// The brand's strand colours: orange, violet, cyan.
const STRAND_COLORS = ['#F97316', '#7C3AED', '#06B6D4'];

/**
 * Bars that rise and fall in turn. The animation is a CSS transform, so the
 * compositor runs it without a graphics context, a shader or a JavaScript frame
 * loop, and it costs next to nothing on phones (styles: .orbit-strands).
 */
const StrandBars: React.FC<{ size: 'xs' | 'sm' | 'md' | 'lg'; colors?: string[]; count?: number; speed?: number }> = ({ size, colors, count, speed }) => {
  const palette = colors?.length ? colors : STRAND_COLORS;
  const bars = Array.from({ length: Math.max(3, Math.min(count ?? (size === 'xs' || size === 'sm' ? 3 : 5), 7)) }, (_, index) => palette[index % palette.length]);
  const duration = 1.1 / Math.max(speed ?? 1, 0.1);
  return (
    <span className={`orbit-strands orbit-strands-${size}`} aria-hidden="true">
      {bars.map((color, index) => (
        <span key={index} style={{ backgroundColor: color, animationDuration: `${duration}s`, animationDelay: `${(index * duration) / (bars.length * 2)}s` }} />
      ))}
    </span>
  );
};

export const StrandsLoader: React.FC<StrandsLoaderProps> = ({
  active = true,
  variant = 'workspace',
  message,
  text,
  className = '',
  textClassName = '',
  colors,
  count,
  speed,
}) => {
  if (!active) return null;
  const displayMessage = message || text;
  const bars = (size: 'xs' | 'sm' | 'md' | 'lg') => <StrandBars size={size} colors={colors} count={count} speed={speed} />;

  // Workspace and page: the content area's placeholder, sized like the page so nothing shifts.
  if (variant === 'workspace' || variant === 'page') {
    return (
      <div role="status" aria-live="polite" aria-busy="true"
        className={cn('w-full min-h-[400px] py-4 flex flex-col items-center justify-center gap-4 pointer-events-none select-none', className)}>
        {bars('lg')}
        {displayMessage && <span className={cn('text-xs font-semibold text-slate-400 dark:text-slate-500 tracking-wider text-center', textClassName)}>{displayMessage}</span>}
        <span className="sr-only">{displayMessage || 'Loading workspace...'}</span>
      </div>
    );
  }

  // Button: covers the button, whose own label is hidden while it works.
  if (variant === 'button-wide' || variant === 'button') {
    return (
      <div role="status" aria-busy="true"
        className={cn('absolute inset-0 w-full h-full flex items-center justify-center gap-2 pointer-events-none select-none z-10', className)}>
        {bars('sm')}
        {displayMessage && <span className={cn('text-xs font-semibold text-white tracking-wide truncate leading-none', textClassName)}>{displayMessage}</span>}
        <span className="sr-only">{displayMessage || 'Loading...'}</span>
      </div>
    );
  }

  if (variant === 'modal') {
    return (
      <div role="status" aria-live="polite" aria-busy="true"
        className={cn('relative w-full min-h-[180px] flex flex-col items-center justify-center p-4 text-center select-none gap-3', className)}>
        {bars('lg')}
        {displayMessage && <p className={cn('text-xs font-medium text-slate-600 dark:text-slate-300', textClassName)}>{displayMessage}</p>}
        <span className="sr-only">{displayMessage || 'Loading modal content...'}</span>
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <div role="status" aria-busy="true" className={cn('inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 select-none', className)}>
        {bars('xs')}
        {displayMessage && <span className={cn('text-[11px] font-medium leading-none', textClassName)}>{displayMessage}</span>}
        <span className="sr-only">{displayMessage || 'Loading...'}</span>
      </div>
    );
  }

  // Section and card
  return (
    <div role="status" aria-live="polite" aria-busy="true"
      className={cn('relative w-full h-full min-h-[200px] flex flex-col items-center justify-center p-3 gap-3 select-none', className)}>
      {bars('md')}
      {displayMessage && <span className={cn('text-xs text-slate-400 dark:text-slate-400 text-center', textClassName)}>{displayMessage}</span>}
      <span className="sr-only">{displayMessage || 'Loading section...'}</span>
    </div>
  );
};

export interface ScopedStrandsLoaderProps extends StrandsLoaderProps {
  active?: boolean;
}

export const ScopedStrandsLoader: React.FC<ScopedStrandsLoaderProps> = ({ active = true, ...props }) => {
  if (!active) return null;
  return <StrandsLoader {...props} />;
};

export default StrandsLoader;
