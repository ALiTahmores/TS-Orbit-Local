import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { StrandsLoader, StrandsLoaderVariant } from './StrandsLoader';
import { useProject } from '../../context/ProjectContext';
import { cn } from '../../lib/utils';

export interface SectionLoadingBoundaryProps {
  isLoading?: boolean;
  message?: string;
  variant?: StrandsLoaderVariant;
  minHeight?: string | number;
  className?: string;
  overlayClassName?: string;
  children: React.ReactNode;
}

/**
 * SectionLoadingBoundary provides scoped Strands loading for sub-sections,
 * cards, tables, charts, and modal contents without affecting the surrounding layout.
 */
export const SectionLoadingBoundary: React.FC<SectionLoadingBoundaryProps> = ({
  isLoading = false,
  message,
  variant = 'section',
  minHeight,
  className = '',
  overlayClassName = '',
  children
}) => {
  const { locale, t } = useProject();
  const isRtl = locale === 'fa';
  const displayMessage = message || (isRtl ? 'در حال بارگذاری...' : 'Loading...');

  return (
    <div
      className={cn(
        'relative w-full h-full flex flex-col rounded-[inherit]',
        typeof minHeight === 'string' ? minHeight : '',
        className
      )}
      style={typeof minHeight === 'number' ? { minHeight: `${minHeight}px` } : undefined}
      aria-busy={isLoading}
    >
      {/* SECTION-SCOPED STRANDS OVERLAY */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            key="section-strands-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeInOut' }}
            className={cn(
              'absolute inset-0 z-10 flex flex-col items-center justify-center bg-surface-primary/75 dark:bg-surface-primary/85 backdrop-blur-[2px] rounded-[inherit] select-none',
              overlayClassName
            )}
            role="status"
            aria-live="polite"
          >
            <StrandsLoader variant={variant} message={displayMessage} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* SECTION CONTENT CONTAINER */}
      <div
        className={cn(
          'w-full h-full flex-1 flex flex-col transition-opacity duration-200',
          isLoading ? 'opacity-40 pointer-events-none select-none' : 'opacity-100'
        )}
      >
        {children}
      </div>
    </div>
  );
};

export default SectionLoadingBoundary;
