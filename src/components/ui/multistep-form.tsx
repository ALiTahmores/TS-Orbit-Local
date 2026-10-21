import { apiFetch } from '../../lib/api';
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, X, ArrowRight, ArrowLeft, Eye, EyeOff, CheckCircle2, XCircle, User, Phone, Lock, AtSign, Loader2, AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';
import StrandsLoader from '../loading/StrandsLoader';

export interface StepItem {
  id: number;
  field?: string;
  label?: string;
  title: string;
  description?: string;
  placeholder?: string;
  icon?: React.ReactNode;
}

export interface MultiStepFormProps {
  steps: StepItem[];
  currentStep: number;
  formData?: Record<string, string>;
  onInputChange?: (field: string, value: string) => void;
  onNext?: () => void;
  onBack?: () => void;
  onStepClick?: (stepIndex: number) => void;
  className?: string;
  isRtl?: boolean;
  isLoading?: boolean;
  submitLabel?: string;
  nextLabel?: string;
  backLabel?: string;
  children?: React.ReactNode;
}

// Phone Mask Formatter Helper
export const formatPhoneMask = (raw: string) => {
  const digits = raw.replace(/\D/g, '').slice(0, 10);
  const mask = ['-', '-', '-', '-', '-', '-', '-', '-', '-', '-'];
  for (let i = 0; i < digits.length; i++) {
    mask[i] = digits[i];
  }
  return `${mask.slice(0, 3).join('')}  ${mask.slice(3, 6).join('')}  ${mask.slice(6, 10).join('')}`;
};

export const MultiStepForm: React.FC<MultiStepFormProps> = ({
  steps,
  currentStep,
  formData = {},
  onInputChange,
  onNext,
  onBack,
  onStepClick,
  className,
  isRtl = false,
  isLoading = false,
  submitLabel,
  nextLabel,
  backLabel,
  children,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<{ checking: boolean; available: boolean | null; error?: string }>({
    checking: false,
    available: null
  });

  const ArrowIcon = isRtl ? ArrowLeft : ArrowRight;

  // Step 1: Username & Name Validation
  const nameVal = (formData['name'] || '').trim();
  const rawUsername = (formData['username'] || '').replace(/^@/, '').trim();
  const isUsernameFormatValid = /^[a-zA-Z0-9_]{3,30}$/.test(rawUsername);

  // Debounced username check with local database and backend server
  useEffect(() => {
    if (!rawUsername) {
      setUsernameStatus({ checking: false, available: null });
      return;
    }

    if (rawUsername.length < 3) {
      setUsernameStatus({
        checking: false,
        available: false,
        error: isRtl ? 'نام کاربری باید حداقل ۳ حرف انگلیسی باشد.' : 'Username must be at least 3 English characters.'
      });
      return;
    }

    if (!/^[a-zA-Z0-9_]{3,30}$/.test(rawUsername)) {
      setUsernameStatus({
        checking: false,
        available: false,
        error: isRtl ? 'فقط حروف انگلیسی (a-z)، اعداد و زیرخط (_) مجاز هستند.' : 'Only English letters (a-z), numbers, and underscore (_) are allowed.'
      });
      return;
    }

    const timer = setTimeout(async () => {
      setUsernameStatus({ checking: true, available: null });
      try {
        const res = await apiFetch('/api/auth/check-username', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: rawUsername })
        });
        const data = await res.json();
        if (data.available) {
          setUsernameStatus({ checking: false, available: true });
        } else {
          setUsernameStatus({
            checking: false,
            available: false,
            error: data.message || (isRtl ? 'این نام کاربری قبلاً توسط کاربر دیگری ثبت شده است.' : 'This username is already taken by another user.')
          });
        }
      } catch {
        setUsernameStatus({ checking: false, available: false, error: isRtl ? 'بررسی نام کاربری انجام نشد؛ دوباره تلاش کنید.' : 'Username could not be checked. Retry.' });
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [rawUsername, isRtl]);

  // Step 2: Phone calculation
  const rawPhone = (formData['phone'] || '').replace(/\D/g, '').replace(/^0/, '').slice(0, 10);
  const isPhoneComplete = rawPhone.length === 10;

  // Step 3: Password Evaluation
  const currentPassword = formData['password'] || '';
  const passwordRules = [
    {
      id: 'length',
      label: isRtl ? 'حداقل ۱۲ کاراکتر و حداکثر ۷۲ بایت' : '12+ characters, up to 72 UTF-8 bytes',
      valid: currentPassword.length >= 12 && new TextEncoder().encode(currentPassword).length <= 72,
    },
    {
      id: 'case',
      label: isRtl ? 'حروف بزرگ و کوچک انگلیسی (A-z)' : 'Uppercase & lowercase letters (A-z)',
      valid: /[a-z]/.test(currentPassword) && /[A-Z]/.test(currentPassword),
    },
    {
      id: 'numbers',
      label: isRtl ? 'شامل اعداد (۰-۹)' : 'Contains numbers (0-9)',
      valid: /[0-9]/.test(currentPassword),
    },
    {
      id: 'special',
      label: isRtl ? 'شامل کاراکترهای خاص (@, #, $, %, !)' : 'Special characters (@, #, $, %, !)',
      valid: /[!@#$%^&*(),.?":{}|<>]/.test(currentPassword),
    },
  ];
  const allPasswordRulesValid = passwordRules.every((r) => r.valid);

  // Button disabled logic depending on step
  const isNextDisabled = () => {
    if (isLoading) return true;
    if (currentStep === 1) {
      const isNameValid = nameVal.length >= 3;
      const isUserValid = isUsernameFormatValid && usernameStatus.available !== false && !usernameStatus.checking;
      return !isNameValid || !isUserValid;
    }
    if (currentStep === 2) {
      return !isPhoneComplete;
    }
    if (currentStep === 3) {
      return !allPasswordRulesValid;
    }
    return false;
  };

  const handlePhoneChange = (val: string) => {
    let clean = val.replace(/\D/g, '');
    if (clean.startsWith('0')) {
      clean = clean.slice(1);
    }
    clean = clean.slice(0, 10);
    onInputChange?.('phone', clean);
  };

  return (
    <div className={cn('w-full flex flex-col items-center', className)}>
      {/* 1. Top Numbered Stepper (1 -> 2 -> 3) */}
      <div className="flex items-center justify-center w-full max-w-xs relative py-2 mb-8">
        {steps.map((step, index) => {
          const stepNum = index + 1;
          const isCompleted = currentStep > stepNum;
          const isCurrent = currentStep === stepNum;
          const isPending = currentStep < stepNum;

          return (
            <React.Fragment key={step.id || index}>
              {/* Step Circle */}
              <div className="flex flex-col items-center relative z-10">
                <button
                  type="button"
                  onClick={() => {
                    if (onStepClick && isCompleted) {
                      onStepClick(stepNum);
                    }
                  }}
                  disabled={!isCompleted}
                  className={cn(
                    'w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300',
                    isCurrent &&
                      'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25 scale-105 ring-4 ring-blue-500/20 border border-blue-400/30',
                    isCompleted &&
                      'bg-blue-600 text-white cursor-pointer hover:bg-blue-500 hover:scale-105 shadow-md shadow-blue-500/20',
                    isPending &&
                      'bg-white/[0.055] text-white/40 cursor-default border border-white/[0.12] font-semibold'
                  )}
                >
                  {isCompleted ? (
                    <Check className="w-4 h-4 text-white" strokeWidth={2.5} />
                  ) : (
                    <span>{stepNum}</span>
                  )}
                </button>
              </div>

              {/* Connecting Progress Line */}
              {index < steps.length - 1 && (
                <div className="flex-1 h-[2px] bg-white/10 mx-2 relative overflow-hidden rounded-full">
                  <motion.div
                    className="h-full bg-blue-500"
                    initial={false}
                    animate={{
                      width: currentStep > stepNum ? '100%' : '0%',
                    }}
                    transition={{ duration: 0.35, ease: 'easeInOut' }}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* If custom children are provided, render them */}
      {children ? (
        children
      ) : (
        /* Default Step Input & Action Structure */
        <div className="w-full space-y-5">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: isRtl ? -10 : 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isRtl ? 10 : -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-4 text-start"
            >
              {/* Header Title & Step Indicator */}
              <div className="flex items-baseline justify-between">
                <label className={cn('text-xl font-bold text-white/95 tracking-tight', isRtl ? 'text-right' : 'text-left')}>
                  {currentStep === 1 && (isRtl ? 'مشخصات و نام کاربری' : 'Profile & Username')}
                  {currentStep === 2 && (isRtl ? 'شماره تلفن همراه' : 'Phone Number')}
                  {currentStep === 3 && (isRtl ? 'تعیین گذرواژه' : 'Create Password')}
                </label>
                <span className="text-xs font-semibold text-white/40 tabular-nums font-mono">
                  {currentStep}/{steps.length}
                </span>
              </div>

              {/* Subtitle / Description */}
              <p className={cn('text-xs text-white/60', isRtl ? 'text-right' : 'text-left')}>
                {currentStep === 1 && (isRtl ? 'نام و شناسه یکتای اختصاصی جهت یافتن شما در فضاهای کاری' : 'Unique identity to discover you across workspaces')}
                {currentStep === 2 && (isRtl ? 'شماره همراه جهت بازیابی، ورود و جستجوی همکاران' : 'Phone for workspace invites, recovery, and login')}
                {currentStep === 3 && (isRtl ? 'حداقل ۱۲ کاراکتر و حداکثر ۷۲ بایت امنیتی شامل حروف بزرگ، کوچک، عدد و نماد' : 'Must meet all security criteria below')}
              </p>

              {/* ========================================================
                  STEP 1: FULL NAME & @USERNAME INPUTS
                 ======================================================== */}
              {currentStep === 1 && (
                <div className="space-y-4 text-right" dir={isRtl ? 'rtl' : 'ltr'}>
                  {/* Full Name Input */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 block">
                      {isRtl ? 'نام و نام خانوادگی' : 'Full Name'}
                    </label>
                    <div
                      className={cn(
                        'relative flex items-center h-12 rounded-2xl bg-slate-900/80 border border-slate-700/80 transition-all p-1.5',
                        'focus-within:border-cyan-500 focus-within:ring-2 focus-within:ring-cyan-500/20'
                      )}
                    >
                      <User className="w-4 h-4 text-slate-500 mr-2 shrink-0" />
                      <input
                        id="name_input"
                        type="text"
                        dir={isRtl ? 'rtl' : 'ltr'}
                        placeholder={isRtl ? 'مثلاً: علی طهمورثی' : 'e.g. John Doe'}
                        value={formData['name'] || ''}
                        onChange={(e) => onInputChange?.('name', e.target.value)}
                        autoFocus
                        autoComplete="name"
                        className={cn(
                          'flex-1 h-full px-2 bg-transparent border-0 outline-none ring-0 text-slate-100 placeholder-slate-500 text-xs font-medium',
                          isRtl ? 'text-right' : 'text-left'
                        )}
                      />
                    </div>
                  </div>

                  {/* Username Unique Handle Input Section */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-300 block">
                        {isRtl ? 'نام کاربری (شناسه یکتا)' : 'Username (Unique Handle)'}
                      </label>
                      {rawUsername && (
                        <span className={cn('text-[11px] font-mono', usernameStatus.available === true ? 'text-emerald-400' : 'text-slate-400')} dir="ltr">
                          @{rawUsername}
                        </span>
                      )}
                    </div>

                    {/* State A: Warning banner ABOVE input when username is duplicate/taken */}
                    {usernameStatus.available === false && (usernameStatus.error?.includes('قبلاً') || usernameStatus.error?.includes('taken') || usernameStatus.error?.includes('دیگری')) && (
                      <div className="text-xs font-bold text-rose-500 bg-rose-500/10 border border-rose-500/30 p-2.5 rounded-xl flex items-center gap-2 mb-2 animate-in fade-in">
                        <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                        <span>{isRtl ? 'این نام کاربری قبلاً توسط کاربر دیگری ثبت شده است.' : 'This username is already taken by another user.'}</span>
                      </div>
                    )}

                    {/* Username Input with Live Dynamic States */}
                    <div
                      className={cn(
                        'relative flex items-center h-12 rounded-2xl transition-all p-1.5',
                        // State A - Taken
                        usernameStatus.available === false && (usernameStatus.error?.includes('قبلاً') || usernameStatus.error?.includes('taken') || usernameStatus.error?.includes('دیگری'))
                          ? 'border-rose-500 focus-within:border-rose-500 focus-within:ring-2 focus-within:ring-rose-500/20 bg-rose-950/20 border'
                          // State B - Invalid format
                          : usernameStatus.available === false
                          ? 'border-rose-500/80 bg-rose-950/20 border'
                          // State C - Valid & Available
                          : usernameStatus.available === true
                          ? 'border-emerald-500 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 bg-emerald-950/20 border'
                          // Default
                          : 'bg-slate-900/80 border border-slate-700/80 focus-within:border-cyan-500 focus-within:ring-2 focus-within:ring-cyan-500/20'
                      )}
                    >
                      <AtSign className="w-4 h-4 text-slate-500 mr-2 shrink-0" />
                      <input
                        id="username_input"
                        type="text"
                        dir="ltr"
                        placeholder={isRtl ? 'alitahmores' : 'username'}
                        value={rawUsername}
                        onChange={(e) => {
                          const clean = e.target.value.replace(/^@/, '').replace(/[^a-zA-Z0-9_]/g, '');
                          onInputChange?.('username', clean);
                        }}
                        maxLength={30}
                        autoComplete="username"
                        className="flex-1 h-full px-2 bg-transparent border-0 outline-none ring-0 text-slate-100 placeholder-slate-500 text-xs font-mono text-left"
                      />

                      {/* Right Status Indicator */}
                      <div className="shrink-0 w-8 h-8 flex items-center justify-center">
                        {usernameStatus.checking ? (
                          <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
                        ) : usernameStatus.available === true ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        ) : usernameStatus.available === false ? (
                          <XCircle className="w-4 h-4 text-rose-500" />
                        ) : null}
                      </div>
                    </div>

                    {/* Dynamic Status Helper Text */}
                    <div className="space-y-1 pt-1 text-[11px]">
                      {/* Invalid format notice */}
                      {usernameStatus.available === false && !usernameStatus.error?.includes('قبلاً') && !usernameStatus.error?.includes('taken') && !usernameStatus.error?.includes('دیگری') && (
                        <p className="text-rose-400 font-medium">
                          {usernameStatus.error || (isRtl ? 'نام کاربری باید حداقل ۳ حرف انگلیسی باشد.' : 'Username must be at least 3 English characters.')}
                        </p>
                      )}

                      {/* Valid & Available notice */}
                      {usernameStatus.available === true && (
                        <p className="text-emerald-400 font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{isRtl ? 'نام کاربری مجاز و در دسترس است.' : 'Username is valid and available.'}</span>
                        </p>
                      )}

                      {/* Persistent Guidelines Helper Text */}
                      <p className="text-slate-400 text-[11px] leading-relaxed">
                        {isRtl
                          ? 'نام کاربری باید به انگلیسی، حداقل ۳ کاراکتر و شامل حروف و اعداد بدون کاراکترهای خاص باشد.'
                          : 'Username must be in English, at least 3 characters, and contain letters and numbers without special characters.'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================================
                  STEP 2: MASKED PHONE (+98) WITH COMPLETION ANIMATION
                 ======================================================== */}
              {currentStep === 2 && (
                <div className="space-y-3 text-right" dir={isRtl ? 'rtl' : 'ltr'}>
                  <label className="text-xs font-semibold text-slate-300 block">
                    {isRtl ? 'شماره تلفن همراه' : 'Mobile Phone Number'}
                  </label>

                  {/* Unified Input Container */}
                  <div
                    className={cn(
                      'relative flex items-center h-12 rounded-2xl bg-slate-900/80 border transition-all p-1.5',
                      isPhoneComplete
                        ? 'border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.25)] bg-emerald-950/20'
                        : 'border-slate-700/80 focus-within:border-cyan-500 focus-within:ring-2 focus-within:ring-cyan-500/20'
                    )}
                  >
                    {/* Right Badge Pill */}
                    <div
                      className="h-full px-3 rounded-xl bg-slate-800/90 border border-slate-700/70 text-slate-200 font-mono text-xs font-bold flex items-center justify-center shrink-0 select-none gap-1"
                      dir="ltr"
                    >
                      <span>+98 IR</span>
                    </div>

                    {/* Numeric Input - strict LTR */}
                    <input
                      id="phone_input"
                      type="tel"
                      inputMode="numeric"
                      dir="ltr"
                      autoFocus
                      autoComplete="off"
                      maxLength={10}
                      value={rawPhone}
                      onChange={(e) => handlePhoneChange(e.target.value)}
                      placeholder="912 345 6789"
                      className="flex-1 h-full px-3 bg-transparent text-slate-100 placeholder-slate-500 text-xs font-mono outline-none text-left border-none focus:outline-none focus:ring-0"
                    />

                    {/* Completion Icon Indicator */}
                    <div className="shrink-0 w-8 h-8 flex items-center justify-center">
                      {isPhoneComplete ? (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                        >
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        </motion.div>
                      ) : (
                        <Phone className="w-4 h-4 text-slate-500" />
                      )}
                    </div>
                  </div>

                  {/* Fixed LTR Phone Mask Helper: Left is LTR dynamic digits, Right is RTL pattern */}
                  <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 font-mono">
                    <span dir="ltr" className={cn('font-bold tracking-wider text-left', isPhoneComplete ? 'text-emerald-400' : 'text-cyan-400')}>
                      {formatPhoneMask(rawPhone)}
                    </span>
                    <span dir="rtl" className="text-slate-400">
                      {isRtl ? 'الگو: ۰۹۱۲۳۴۵۶۷۸۹' : 'Format: 09123456789'}
                    </span>
                  </div>
                </div>
              )}

              {/* ========================================================
                  STEP 3: PASSWORD WITH LIVE INTERACTIVE CHECKLIST
                 ======================================================== */}
              {currentStep === 3 && (
                <div className="space-y-4 pt-1">
                  <div
                    className={cn(
                      'w-full h-14 px-4 rounded-xl transition-all duration-200 backdrop-blur-md flex items-center gap-3',
                      'bg-white/[0.055] border text-white',
                      allPasswordRulesValid
                        ? 'border-emerald-500/80 shadow-[0_0_20px_rgba(16,185,129,0.3)] bg-emerald-950/15'
                        : 'border-white/[0.12] focus-within:bg-white/[0.09] focus-within:border-blue-500/60 focus-within:shadow-[0_0_0_3px_rgba(59,130,246,0.15)]'
                    )}
                  >
                    <Lock className="w-5 h-5 text-white/40 shrink-0" />
                    <input
                      id="password_input"
                      type={showPassword ? 'text' : 'password'}
                      dir="ltr"
                      autoFocus
                      autoComplete="new-password"
                      placeholder="••••••••"
                      value={currentPassword}
                      onChange={(e) => onInputChange?.('password', e.target.value)}
                      className="w-full bg-transparent border-0 outline-none ring-0 text-white placeholder-white/40 text-base font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-white/40 hover:text-white transition-colors cursor-pointer p-1 shrink-0"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Real-time 4-Point Security Checklist */}
                  <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-md space-y-2 text-xs">
                    <div className="text-[11px] font-semibold text-white/50 mb-1.5 flex items-center justify-between">
                      <span>{isRtl ? 'الزامات امنیتی گذرواژه:' : 'Password Security Rules:'}</span>
                      <span className={cn('font-mono font-bold', allPasswordRulesValid ? 'text-emerald-400' : 'text-white/40')}>
                        {passwordRules.filter(r => r.valid).length}/4
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                      {passwordRules.map((rule) => (
                        <div
                          key={rule.id}
                          className={cn(
                            'flex items-center gap-2 transition-all duration-200 text-[12px]',
                            isRtl ? 'flex-row' : 'flex-row'
                          )}
                        >
                          <div className="shrink-0 flex items-center justify-center">
                            {rule.valid ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" strokeWidth={3} />
                            ) : (
                              <X className="w-3.5 h-3.5 text-rose-400/70" strokeWidth={2.5} />
                            )}
                          </div>
                          <span
                            className={cn(
                              'transition-colors',
                              rule.valid ? 'text-emerald-400 font-medium' : 'text-slate-400'
                            )}
                          >
                            {rule.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Action Button */}
          <button
            type="button"
            onClick={onNext}
            disabled={isNextDisabled()}
            aria-busy={isLoading}
            className={cn(
              'relative w-full h-12 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-2 mt-6 shadow-md cursor-pointer overflow-hidden',
              isLoading
                ? '!bg-[#1d63ff] !border-[#1d63ff] text-white shadow-[0_0_24px_rgba(29,99,255,0.45)] opacity-100 cursor-wait'
                : !isNextDisabled()
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-500/25 active:scale-[0.99] border border-blue-400/30'
                : 'bg-white/10 text-white/30 border border-white/5 cursor-not-allowed opacity-50'
            )}
          >
            <span className={cn('flex items-center justify-center gap-2', isLoading ? 'opacity-0 invisible pointer-events-none' : 'opacity-100')}>
              <span>
                {currentStep === steps.length
                  ? submitLabel || (isRtl ? 'ایجاد فضای کاری و ورود' : 'Create Workspace & Enter')
                  : nextLabel || (isRtl ? 'ادامه' : 'Continue')}
              </span>
              <ArrowIcon className="h-4 w-4" strokeWidth={2} />
            </span>
            {isLoading && <StrandsLoader variant="button" />}
          </button>

          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="text-xs text-white/55 hover:text-white transition-colors cursor-pointer block mx-auto pt-2"
            >
              {backLabel || (isRtl ? 'مرحله قبل' : 'Go back')}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default MultiStepForm;
