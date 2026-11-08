import React from 'react';
import { cn } from '../../lib/utils';
import { LoaderGooeyBlobs } from '../ui/loaders-gooey-blobs';
import { DashboardSkeleton, SectionSkeleton } from './PageSkeletons';

export type LoaderVariant = 'button' | 'button-wide' | 'workspace' | 'section' | 'page' | 'modal' | 'inline' | 'card';
export type StrandsLoaderVariant = LoaderVariant;

export interface StrandsLoaderProps {
  active?: boolean;
  variant?: LoaderVariant;
  message?: string;
  text?: string;
  className?: string;
  textClassName?: string;
  color?: string;
}

/**
 * The app's loading state. Buttons and inline spots show gooey blobs in the text
 * colour; pages, sections and dialogs show skeletons of their content.
 */
export const StrandsLoader: React.FC<StrandsLoaderProps> = ({
  active = true,
  variant = 'workspace',
  message,
  text,
  className = '',
  textClassName = '',
  color,
}) => {
  if (!active) return null;
  const displayMessage = message || text;

  // Button: covers the button, whose own label is hidden while it works.
  if (variant === 'button-wide' || variant === 'button') {
    return (
      <div role="status" aria-busy="true"
        className={cn('absolute inset-0 w-full h-full flex items-center justify-center gap-2.5 pointer-events-none select-none z-10', className)}>
        <LoaderGooeyBlobs size={7} color={color} />
        {displayMessage && <span className={cn('text-xs font-semibold tracking-wide truncate leading-none', textClassName)}>{displayMessage}</span>}
        <span className="sr-only">{displayMessage || 'در حال انجام…'}</span>
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <div role="status" aria-busy="true" className={cn('inline-flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 select-none', className)}>
        <LoaderGooeyBlobs size={5} color={color} />
        {displayMessage && <span className={cn('text-[11px] font-medium leading-none', textClassName)}>{displayMessage}</span>}
        <span className="sr-only">{displayMessage || 'در حال بارگذاری…'}</span>
      </div>
    );
  }

  if (variant === 'workspace' || variant === 'page') {
    return <div className={cn('w-full', className)}><DashboardSkeleton /></div>;
  }

  // Section, card and dialog content
  return (
    <div className={cn('w-full', className)}>
      <SectionSkeleton />
      {displayMessage && <p className={cn('mt-2 text-xs text-slate-400 text-center', textClassName)}>{displayMessage}</p>}
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
