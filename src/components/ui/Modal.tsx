import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/utils';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  maxWidth?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  children,
  className = '',
  maxWidth = 'max-w-2xl'
}) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  // Mount directly to document.body via Portal to bypass any parent CSS transform/overflow trapping
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto" dir="rtl">
      {/* 1. Full-Screen Translucent Backdrop (Covers Header + Sidebar + Workspace) */}
      <div 
        onClick={onClose}
        className="fixed inset-0 z-0 bg-gradient-to-t from-black/[0.18] via-black/[0.06] to-transparent dark:from-black/[0.5] dark:via-black/[0.25] dark:to-transparent backdrop-blur-[1.5px] transition-opacity duration-300 animate-in fade-in cursor-pointer"
      />

      {/* 2. Elevated Modal Card */}
      <div 
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "relative z-10 w-full bg-white dark:bg-slate-900",
          "rounded-[28px] p-6 sm:p-8",
          "border border-slate-200/90 dark:border-slate-800",
          "shadow-[0_25px_70px_-15px_rgba(0,0,0,0.18),0_10px_30px_-10px_rgba(0,0,0,0.08)] dark:shadow-[0_25px_70px_-15px_rgba(0,0,0,0.6)]",
          "animate-in fade-in zoom-in-95 duration-200",
          maxWidth,
          className
        )}
      >
        {children}
      </div>
    </div>,
    document.body
  );
};

export default Modal;

