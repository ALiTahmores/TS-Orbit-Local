import React, { useState } from 'react';
import { ChevronDown, Calendar as CalendarIcon } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';

// 1. DROPDOWN COMPONENT FOR FORMS
export interface DropdownOption {
  value: string;
  label: string;
}

export interface DropdownProps {
  id: string;
  label?: string;
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  error?: string;
  helperText?: string;
  placeholder?: string;
  className?: string;
}

export const Dropdown: React.FC<DropdownProps> = ({
  id,
  label,
  options,
  value,
  onChange,
  error,
  helperText,
  placeholder = 'انتخاب کنید...',
  className = '',
}) => {
  const { locale } = useProject();
  const isRtl = locale === 'fa';
  const [isOpen, setIsOpen] = useState(false);

  const selectedOption = options.find((o) => o.value === value);

  return (
    <div className={`flex flex-col space-y-1 w-full relative ${isRtl ? 'rtl text-right' : 'ltr text-left'}`} style={{ direction: isRtl ? 'rtl' : 'ltr' }}>
      {label && (
        <label htmlFor={id} className="text-xs font-bold text-text-secondary select-none block mb-1">
          {label}
        </label>
      )}

      <div className="relative">
        <button
          id={id}
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full bg-surface-secondary border border-border-primary rounded-radius-12 text-text-primary px-3.5 text-xs focus:outline-none focus:border-brand-accent transition-all font-medium h-10 flex items-center justify-between text-right cursor-pointer
            ${error ? 'border-brand-danger' : ''}
            ${className}`}
        >
          <span className={selectedOption ? 'text-text-primary' : 'text-text-muted'}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <ChevronDown
            size={14}
            className={`text-text-muted transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {isOpen && (
          <>
            {/* Backdrop cover for outside click */}
            <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
            
            {/* Options list dropdown */}
            <ul className="absolute z-20 w-full mt-1.5 bg-surface-primary border border-border-strong rounded-radius-12 shadow-floating py-1 max-h-56 overflow-y-auto overflow-x-hidden text-xs text-text-secondary">
              {options.length === 0 ? (
                <li className="px-3.5 py-2.5 text-text-muted text-center select-none">موردی یافت نشد</li>
              ) : (
                options.map((option) => (
                  <li key={option.value}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange(option.value);
                        setIsOpen(false);
                      }}
                      className={`w-full text-right px-3.5 py-2.5 hover:bg-hover-overlay hover:text-text-primary transition-colors cursor-pointer block font-medium ${
                        option.value === value ? 'text-brand-accent bg-brand-accent/5 font-bold' : ''
                      }`}
                    >
                      {option.label}
                    </button>
                  </li>
                ))
              )}
            </ul>
          </>
        )}
      </div>

      {error && <span className="text-[10px] font-bold text-brand-danger mt-1 block">{error}</span>}
      {!error && helperText && <span className="text-[10px] text-text-muted mt-1 block">{helperText}</span>}
    </div>
  );
};

// 2. DATE PICKER COMPONENT FOR FORMS
export interface DatePickerProps {
  id: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  helperText?: string;
  placeholder?: string;
  className?: string;
}

export const DatePicker: React.FC<DatePickerProps> = ({
  id,
  label,
  value,
  onChange,
  error,
  helperText,
  placeholder,
  className = '',
}) => {
  const { locale } = useProject();
  const isRtl = locale === 'fa';

  const defaultPlaceholder = placeholder || (isRtl ? 'مثال: ۱۴۰۵/۰۴/۱۵' : 'YYYY/MM/DD');

  return (
    <div className={`flex flex-col space-y-1 w-full relative ${isRtl ? 'rtl text-right' : 'ltr text-left'}`} style={{ direction: isRtl ? 'rtl' : 'ltr' }}>
      {label && (
        <label htmlFor={id} className="text-xs font-bold text-text-secondary select-none block mb-1">
          {label}
        </label>
      )}

      <div className="relative flex items-center">
        <span className={`absolute ${isRtl ? 'right-3' : 'left-3'} text-text-muted flex items-center pointer-events-none`}>
          <CalendarIcon size={14} />
        </span>
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={defaultPlaceholder}
          className={`w-full bg-surface-secondary border border-border-primary rounded-radius-12 text-text-primary pr-10 pl-3.5 py-2.5 text-xs focus:outline-none focus:border-brand-accent transition-all font-medium placeholder-text-muted h-10 rtl:pr-10 ltl:pl-10
            ${isRtl ? 'pr-10' : 'pl-10'}
            ${error ? 'border-brand-danger focus:border-brand-danger' : ''}
            ${className}`}
        />
      </div>

      {error && <span className="text-[10px] font-bold text-brand-danger mt-1 block">{error}</span>}
      {!error && helperText && <span className="text-[10px] text-text-muted mt-1 block">{helperText}</span>}
    </div>
  );
};
