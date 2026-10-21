import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';

// 1. DIALOG (CENTER MODAL)
export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  id: string;
}

export const Dialog: React.FC<DialogProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  id,
}) => {
  const { locale } = useProject();
  const isRtl = locale === 'fa';

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = '';
        window.removeEventListener('keydown', handleKeyDown);
      };
    } else {
      document.body.style.overflow = '';
    }
  }, [isOpen, onClose]);

  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div id={id} className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-gradient-to-t from-black/[0.18] via-black/[0.06] to-transparent dark:from-black/[0.5] dark:via-black/[0.25] dark:to-transparent backdrop-blur-[1.5px] cursor-pointer"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', duration: 0.4 }}
            onClick={(e) => e.stopPropagation()}
            className={`relative z-10 w-full ${sizes[size]} bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-[28px] shadow-[0_25px_70px_-15px_rgba(0,0,0,0.18),0_10px_30px_-10px_rgba(0,0,0,0.08)] dark:shadow-[0_25px_70px_-15px_rgba(0,0,0,0.6)] flex flex-col overflow-hidden max-h-[90vh] font-sans cursor-default`}
            style={{ direction: isRtl ? 'rtl' : 'ltr' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-primary">
              <h3 className="text-sm font-bold text-text-primary select-none">{title}</h3>
              <button
                type="button"
                onClick={onClose}
                className="text-text-muted hover:text-text-primary p-1 rounded-radius-8 hover:bg-hover-overlay transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-6 text-xs text-text-secondary leading-relaxed">
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div className="px-6 py-4 border-t border-border-primary bg-surface-secondary/40 flex items-center justify-end gap-3">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

// 2. DRAWER / SLIDE PANEL
export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  position?: 'right' | 'left';
  id: string;
}

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  position,
  id,
}) => {
  const { locale } = useProject();
  const isRtl = locale === 'fa';
  
  // Resolve default slide side based on language direction
  const defaultSide = position || (isRtl ? 'right' : 'left');

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = '';
        window.removeEventListener('keydown', handleKeyDown);
      };
    } else {
      document.body.style.overflow = '';
    }
  }, [isOpen, onClose]);

  const sizes = {
    sm: 'max-w-xs',
    md: 'max-w-md',
    lg: 'max-w-xl',
  };

  const slideVariants = {
    right: {
      initial: { x: '100%' },
      animate: { x: 0 },
      exit: { x: '100%' },
    },
    left: {
      initial: { x: '-100%' },
      animate: { x: 0 },
      exit: { x: '-100%' },
    },
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div id={id} className="fixed inset-0 z-50 flex overflow-hidden">
          {/* Backdrop blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-xs cursor-pointer"
          />

          {/* Drawer Container */}
          <motion.div
            variants={slideVariants[defaultSide]}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            onClick={(e) => e.stopPropagation()}
            className={`relative w-full ${sizes[size]} h-full bg-surface-primary border-l border-border-strong shadow-floating flex flex-col z-10 font-sans cursor-default ${
              defaultSide === 'right' ? 'mr-auto border-l' : 'ml-auto border-r'
            }`}
            style={{ direction: isRtl ? 'rtl' : 'ltr' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-border-primary shrink-0">
              <h3 className="text-sm font-bold text-text-primary select-none">{title}</h3>
              <button
                type="button"
                onClick={onClose}
                className="text-text-muted hover:text-text-primary p-1 rounded-radius-8 hover:bg-hover-overlay transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-6 text-xs text-text-secondary leading-relaxed">
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div className="px-6 py-4 border-t border-border-primary bg-surface-secondary/40 flex items-center justify-end gap-3 shrink-0">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
