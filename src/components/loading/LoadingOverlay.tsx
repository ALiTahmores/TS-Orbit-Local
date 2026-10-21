import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import StrandsLoader, { StrandsLoaderVariant } from './StrandsLoader';
import { cn } from '../../lib/utils';

export interface LoadingOverlayProps {
  loading: boolean;
  variant?: StrandsLoaderVariant;
  message?: string;
  className?: string;
  overlayClassName?: string;
  children?: React.ReactNode;
  blur?: boolean;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  loading,
  variant = 'section',
  message,
  className = '',
  overlayClassName = '',
  children,
  blur = true
}) => {
  // If used as a standalone overlay inside an already relative container
  if (!children) {
    return (
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className={cn(
              'absolute inset-0 z-30 flex items-center justify-center rounded-[inherit] transition-all',
              'bg-surface-primary/80 dark:bg-surface-primary/85',
              blur ? 'backdrop-blur-[2px]' : '',
              overlayClassName
            )}
            aria-busy="true"
          >
            <StrandsLoader variant={variant} message={message} />
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  // If wrapping existing children
  return (
    <div className={cn('relative w-full h-full rounded-[inherit]', className)}>
      {children}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className={cn(
              'absolute inset-0 z-30 flex items-center justify-center rounded-[inherit] transition-all',
              'bg-surface-primary/80 dark:bg-surface-primary/85',
              blur ? 'backdrop-blur-[2px]' : '',
              overlayClassName
            )}
            aria-busy="true"
          >
            <StrandsLoader variant={variant} message={message} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LoadingOverlay;
