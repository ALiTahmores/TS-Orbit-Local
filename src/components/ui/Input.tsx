import React, { useState } from 'react';
import { Eye, EyeOff, Search } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { cn } from '../../lib/utils';

// Common shared container properties
interface BaseInputProps {
  id?: string;
  label?: string;
  error?: string;
  helperText?: string;
}

// 1. TEXT INPUT
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement>, BaseInputProps {
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  id,
  label,
  error,
  helperText,
  leftIcon,
  rightIcon,
  startIcon,
  endIcon,
  className = '',
  value,
  ...props
}) => {
  const { locale } = useProject();
  const isRtl = locale === 'fa';

  const effectiveLeftIcon = isRtl ? (startIcon || leftIcon) : (startIcon || leftIcon);
  const effectiveRightIcon = isRtl ? (endIcon || rightIcon) : (endIcon || rightIcon);

  const hasValue = typeof value === 'string' ? value.trim().length > 0 : false;

  return (
    <div className={`flex flex-col space-y-1 w-full ${isRtl ? 'rtl text-right' : 'ltr text-left'}`} style={{ direction: isRtl ? 'rtl' : 'ltr' }}>
      {label && (
        <label htmlFor={id} className="text-xs font-semibold text-neutral-300 select-none block mb-1">
          {label}
        </label>
      )}
      <div className="relative flex items-center w-full">
        {effectiveLeftIcon && (
          <span className={`absolute ${isRtl ? 'right-3.5' : 'left-3.5'} text-neutral-400 flex items-center z-10 pointer-events-none`}>
            {effectiveLeftIcon}
          </span>
        )}
        <input
          id={id}
          value={value}
          style={{ outline: 'none', boxShadow: 'none' }}
          className={cn(
            'w-full h-11 px-3.5 text-xs rounded-xl font-medium transition-all duration-200',
            'outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 shadow-none',
            hasValue
              ? 'bg-[#edf3ff] text-black placeholder-neutral-500 border border-transparent font-medium'
              : 'bg-[#0e0e11] text-white placeholder-neutral-500 border border-[#222227] focus:border-white/50',
            effectiveLeftIcon ? (isRtl ? 'pr-10' : 'pl-10') : '',
            effectiveRightIcon ? (isRtl ? 'pl-10' : 'pr-10') : '',
            error ? 'border-rose-500 focus:border-rose-500' : '',
            className
          )}
          {...props}
        />
        {effectiveRightIcon && (
          <span className={`absolute ${isRtl ? 'left-3.5' : 'right-3.5'} text-neutral-400 flex items-center z-10`}>
            {effectiveRightIcon}
          </span>
        )}
      </div>
      {error && <span className="text-[10px] font-bold text-rose-500 mt-1 block">{error}</span>}
      {!error && helperText && <span className="text-[10px] text-neutral-400 mt-1 block">{helperText}</span>}
    </div>
  );
};

// 2. PASSWORD INPUT
export interface PasswordInputProps extends Omit<InputProps, 'type' | 'leftIcon' | 'rightIcon'> {}

export const PasswordInput: React.FC<PasswordInputProps> = ({ id, ...props }) => {
  const [show, setShow] = useState(false);
  const ToggleIcon = show ? <EyeOff size={16} /> : <Eye size={16} />;

  return (
    <Input
      id={id}
      type={show ? 'text' : 'password'}
      rightIcon={
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="text-neutral-400 hover:text-white focus:outline-none cursor-pointer"
        >
          {ToggleIcon}
        </button>
      }
      {...props}
    />
  );
};

// 3. SEARCH INPUT
export interface SearchInputProps extends Omit<InputProps, 'leftIcon' | 'type'> {}

export const SearchInput: React.FC<SearchInputProps> = ({ id, placeholder, ...props }) => {
  const { t } = useProject();
  
  return (
    <Input
      id={id}
      type="text"
      placeholder={placeholder || t('search_placeholder')}
      leftIcon={<Search size={14} />}
      {...props}
    />
  );
};

// 4. TEXTAREA
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement>, BaseInputProps {}

export const Textarea: React.FC<TextareaProps> = ({
  id,
  label,
  error,
  helperText,
  className = '',
  rows = 4,
  value,
  ...props
}) => {
  const { locale } = useProject();
  const isRtl = locale === 'fa';
  const hasValue = typeof value === 'string' ? value.trim().length > 0 : false;

  return (
    <div className={`flex flex-col space-y-1 w-full ${isRtl ? 'rtl text-right' : 'ltr text-left'}`} style={{ direction: isRtl ? 'rtl' : 'ltr' }}>
      {label && (
        <label htmlFor={id} className="text-xs font-semibold text-neutral-300 select-none block mb-1">
          {label}
        </label>
      )}
      <textarea
        id={id}
        rows={rows}
        value={value}
        style={{ outline: 'none', boxShadow: 'none' }}
        className={cn(
          'w-full p-3.5 text-xs rounded-xl font-medium transition-all duration-200 leading-relaxed',
          'outline-none ring-0 focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 shadow-none',
          hasValue
            ? 'bg-[#edf3ff] text-black placeholder-neutral-500 border border-transparent font-medium'
            : 'bg-[#0e0e11] text-white placeholder-neutral-500 border border-[#222227] focus:border-white/50',
          error ? 'border-rose-500 focus:border-rose-500' : '',
          className
        )}
        {...props}
      />
      {error && <span className="text-[10px] font-bold text-rose-500 mt-1 block">{error}</span>}
      {!error && helperText && <span className="text-[10px] text-neutral-400 mt-1 block">{helperText}</span>}
    </div>
  );
};

// 5. CHECKBOX
export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  id: string;
  label: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({ id, label, className = '', ...props }) => {
  const { locale } = useProject();
  const isRtl = locale === 'fa';

  return (
    <label className="flex items-center gap-2 cursor-pointer select-none py-1 text-right" style={{ direction: isRtl ? 'rtl' : 'ltr' }}>
      <input
        id={id}
        type="checkbox"
        className={`w-4 h-4 bg-[#0e0e11] border border-[#222227] rounded text-blue-500 focus:ring-0 cursor-pointer accent-blue-500 ${className}`}
        {...props}
      />
      <span className="text-xs font-medium text-neutral-200 leading-none">{label}</span>
    </label>
  );
};

// 6. SWITCH
export interface SwitchProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  id: string;
  label?: string;
  checked: boolean;
}

export const Switch: React.FC<SwitchProps> = ({ id, label, checked, onChange, className = '', ...props }) => {
  const { locale } = useProject();
  const isRtl = locale === 'fa';

  return (
    <label className="flex items-center justify-between gap-4 cursor-pointer select-none py-1" style={{ direction: isRtl ? 'rtl' : 'ltr' }}>
      {label && <span className="text-xs font-bold text-neutral-300 leading-none">{label}</span>}
      <div className="relative">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={onChange}
          className="sr-only peer"
          {...props}
        />
        <div className="w-9 h-5 bg-[#0e0e11] border border-[#222227] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-neutral-400 peer-checked:after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600 peer-checked:border-blue-600 duration-200"></div>
      </div>
    </label>
  );
};

// 7. RADIO
export interface RadioProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  id: string;
  label: string;
}

export const Radio: React.FC<RadioProps> = ({ id, label, className = '', ...props }) => {
  const { locale } = useProject();
  const isRtl = locale === 'fa';

  return (
    <label className="flex items-center gap-2 cursor-pointer select-none py-1" style={{ direction: isRtl ? 'rtl' : 'ltr' }}>
      <input
        id={id}
        type="radio"
        className={`w-4 h-4 bg-[#0e0e11] border border-[#222227] text-blue-500 focus:ring-0 cursor-pointer accent-blue-500 ${className}`}
        {...props}
      />
      <span className="text-xs font-medium text-neutral-200 leading-none">{label}</span>
    </label>
  );
};

export default Input;
