import React from 'react';
import { motion } from 'motion/react';
import StrandsLoader from '../loading/StrandsLoader';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'glow' | 'outline' | 'glass' | 'default';
  size?: 'sm' | 'md' | 'lg' | 'default' | 'icon' | 'iconSm';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  isFloating?: boolean;
  id?: string;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  isFloating = false,
  className = '',
  disabled,
  id,
  type = 'button',
  ...props
}) => {
  const baseStyle = 'inline-flex items-center justify-center font-sans font-medium rounded-xl transition-all duration-200 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed select-none cursor-pointer';

  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-500 shadow-md shadow-blue-500/20 active:scale-[0.98]',
    default: 'bg-blue-600 text-white hover:bg-blue-500 shadow-md shadow-blue-500/20 active:scale-[0.98]',
    glow: 'bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:brightness-110 active:scale-[0.98]',
    secondary: 'bg-slate-800 text-slate-100 hover:bg-slate-700 border border-slate-700 active:scale-[0.98]',
    ghost: 'bg-transparent text-slate-300 hover:bg-slate-800/60 hover:text-white',
    outline: 'border border-slate-700/60 bg-slate-900/40 text-slate-200 hover:bg-slate-800/80 hover:text-white hover:border-slate-600 backdrop-blur-md active:scale-[0.98]',
    glass: 'bg-white/5 hover:bg-white/10 text-slate-200 hover:text-white border border-white/10 hover:border-white/20 backdrop-blur-xl shadow-lg transition-all active:scale-[0.98]',
    danger: 'bg-rose-600 text-white hover:bg-rose-500 shadow-sm active:scale-[0.98]',
    success: 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-sm active:scale-[0.98]',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs rounded-lg gap-1.5 h-8 min-w-[70px]',
    md: 'px-4 py-2.5 text-xs rounded-xl gap-2 h-10 min-w-[84px]',
    default: 'px-4 py-2.5 text-xs rounded-xl gap-2 h-10 min-w-[84px]',
    lg: 'px-6 py-3 text-sm rounded-xl gap-2.5 h-12 font-bold min-w-[100px]',
    icon: 'h-10 w-10 p-0',
    iconSm: 'h-8 w-8 p-0 rounded-lg',
  };

  const floatingStyle = isFloating 
    ? 'fixed bottom-6 right-6 z-40 rounded-full w-12 h-12 p-0 shadow-xl !rounded-full' 
    : '';

  return (
    <motion.button
      id={id}
      type={type}
      disabled={disabled || isLoading}
      aria-busy={isLoading}
      whileHover={{ scale: disabled || isLoading ? 1 : 1.01 }}
      whileTap={{ scale: disabled || isLoading ? 1 : 0.98 }}
      className={`relative overflow-hidden ${baseStyle} ${variants[variant] || variants.primary} ${sizes[size] || sizes.md} ${floatingStyle} ${isLoading ? '!bg-[#05060b] !border-[#1d63ff]/40 shadow-[0_0_24px_rgba(29,99,255,0.25)] cursor-wait' : ''} ${className}`}
      {...props}
    >
      <span className={`inline-flex items-center justify-center gap-2 leading-none transition-opacity duration-150 ${isLoading ? 'opacity-0 invisible pointer-events-none' : 'opacity-100'}`}>
        {leftIcon && <span className="flex shrink-0">{leftIcon}</span>}
        <span>{children}</span>
        {rightIcon && <span className="flex shrink-0">{rightIcon}</span>}
      </span>
      {isLoading && <StrandsLoader variant="button" />}
    </motion.button>
  );
};

export default Button;
