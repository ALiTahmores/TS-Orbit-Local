import React from 'react';
import { createPortal } from 'react-dom';
import { LogOut } from 'lucide-react';

export interface LogoutConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const LogoutConfirmModal: React.FC<LogoutConfirmModalProps> = ({ isOpen, onClose, onConfirm }) => {
  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4" dir="rtl">
      {/* Backdrop */}
      <div 
        onClick={onClose} 
        className="fixed inset-0 bg-black/[0.08] dark:bg-black/[0.35] backdrop-blur-[1.5px] transition-opacity animate-in fade-in" 
      />

      {/* Centered Modal Card */}
      <div className="relative z-10 w-full max-w-sm p-6 rounded-[24px] bg-white dark:bg-[#0d121f] border border-slate-200/90 dark:border-slate-800 shadow-[0_20px_50px_-10px_rgba(0,0,0,0.2)] animate-in fade-in zoom-in-95 duration-150 text-center select-none">
        
        {/* Warning Icon */}
        <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center mx-auto mb-3.5">
          <LogOut className="w-6 h-6 rtl:rotate-180"/>
        </div>

        {/* Text */}
        <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 mb-1.5">
          خروج از حساب کاربری
        </h3>
        <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed mb-6">
          آیا مطمئن هستید که می‌خواهید از حساب کاربری خود خارج شوید؟ برای دسترسی دوباره باید مجدداً وارد شوید.
        </p>

        {/* Buttons Grid */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs transition-all active:scale-95 cursor-pointer"
          >
            انصراف
          </button>

          <button
            type="button"
            onClick={onConfirm}
            className="h-10 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-all active:scale-95 cursor-pointer shadow-sm shadow-rose-600/20"
          >
            خروج از حساب
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default LogoutConfirmModal;
