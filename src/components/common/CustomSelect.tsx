import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Trash2 } from 'lucide-react';

export interface CustomSelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string;
  badgeClass?: string;
}

export interface CustomSelectProps {
  options: CustomSelectOption[];
  value: string;
  onChange: (value: string) => void;
  onDeleteOption?: (value: string, e: React.MouseEvent) => void;
  deleteTooltip?: string;
  placeholder?: string;
  className?: string;
  buttonClassName?: string;
  disabled?: boolean;
  dir?: 'rtl' | 'ltr';
  icon?: React.ReactNode;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  options,
  value,
  onChange,
  onDeleteOption,
  deleteTooltip = 'حذف',
  placeholder = 'انتخاب کنید...',
  className = '',
  buttonClassName = '',
  disabled = false,
  dir = 'rtl',
  icon
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  const calculatePosition = useCallback(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const popoverMaxHeight = 260;
      const spaceBelow = window.innerHeight - rect.bottom;

      let top = rect.bottom + 6;
      if (spaceBelow < popoverMaxHeight && rect.top > popoverMaxHeight) {
        top = rect.top - popoverMaxHeight - 6;
      }

      setPopoverPos({
        top: Math.max(10, top),
        left: Math.max(10, Math.min(rect.left, window.innerWidth - rect.width - 10)),
        width: Math.max(180, rect.width)
      });
    }
  }, []);

  const toggleOpen = () => {
    if (disabled) return;
    if (!isOpen) {
      calculatePosition();
    }
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleScrollOrResize = () => {
      calculatePosition();
    };

    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, calculatePosition]);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  return (
    <div 
      className={`relative inline-block w-full text-right ${className}`}
      dir={dir}
    >
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleOpen}
        disabled={disabled}
        className={`w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 hover:border-blue-500/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 rounded-xl px-3.5 py-2.5 flex items-center justify-between cursor-pointer transition-all text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 disabled:opacity-50 disabled:cursor-not-allowed ${buttonClassName}`}
      >
        <div className="flex items-center gap-2 truncate">
          {icon && <span className="shrink-0 text-slate-400">{icon}</span>}
          {selectedOption?.icon && <span className="shrink-0">{selectedOption.icon}</span>}
          <span className="truncate">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          {selectedOption?.badge && (
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${selectedOption.badgeClass || 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'}`}>
              {selectedOption.badge}
            </span>
          )}
        </div>
        <ChevronDown 
          size={16} 
          className={`text-slate-400 transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180 text-blue-600 dark:text-blue-400' : ''}`} 
        />
      </button>

      {isOpen && popoverPos && createPortal(
        <div 
          ref={popoverRef}
          style={{
            position: 'fixed',
            top: `${popoverPos.top}px`,
            left: `${popoverPos.left}px`,
            width: `${popoverPos.width}px`,
            zIndex: 99999
          }}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl p-1.5 space-y-1 max-h-64 overflow-y-auto animate-in fade-in zoom-in-95 duration-100 font-sans text-right"
          dir={dir}
        >
          {options.length > 0 ? (
            options.map((option) => {
              const isSelected = option.value === value;
              return (
                <div
                  key={option.value}
                  onClick={() => handleSelect(option.value)}
                  className={`w-full px-3 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-between transition-all cursor-pointer group/item ${
                    isSelected
                      ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-extrabold'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate min-w-0 flex-1">
                    {option.icon && <span className="shrink-0">{option.icon}</span>}
                    <span className="truncate">{option.label}</span>
                    {option.badge && (
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono shrink-0 ${option.badgeClass || 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
                        {option.badge}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 me-0.5">
                    {isSelected && <Check size={16} className="text-blue-600 dark:text-blue-400 shrink-0" />}
                    {onDeleteOption && (
                      <button
                        type="button"
                        title={deleteTooltip}
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteOption(option.value, e);
                        }}
                        className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 dark:hover:text-rose-400 transition-colors cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="px-3 py-2 text-xs text-slate-400 text-center font-medium">
              موردی یافت نشد
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
};

export default CustomSelect;
