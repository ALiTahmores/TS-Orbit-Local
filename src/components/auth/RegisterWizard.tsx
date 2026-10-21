import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, ArrowRight, Lock, Eye, EyeOff, Check, X, ShieldCheck } from 'lucide-react';
import { Step1NameUsername } from './Step1NameUsername';
import { Step2Phone } from './Step2Phone';
import { cn } from '../../lib/utils';
import StrandsLoader from '../loading/StrandsLoader';

export interface RegisterWizardProps {
  formData: Record<string, string>;
  onInputChange: (field: string, value: string) => void;
  onSubmit: () => void;
  onBackToEmail: () => void;
  isLoading?: boolean;
  isRtl?: boolean;
}

export const RegisterWizard: React.FC<RegisterWizardProps> = ({
  formData,
  onInputChange,
  onSubmit,
  onBackToEmail,
  isLoading = false,
  isRtl = true
}) => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isStep1Valid, setIsStep1Valid] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const ArrowIcon = isRtl ? ArrowLeft : ArrowRight;

  const rawPhone = (formData['phone'] || '').replace(/\D/g, '').replace(/^0/, '').slice(0, 10);
  const isPhoneComplete = rawPhone.length === 10;

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

  const isNextDisabled = () => {
    if (isLoading) return true;
    if (currentStep === 1) return !isStep1Valid;
    if (currentStep === 2) return !isPhoneComplete;
    if (currentStep === 3) return !allPasswordRulesValid;
    return false;
  };

  const handleNext = () => {
    if (currentStep === 1) {
      if (isStep1Valid) setCurrentStep(2);
    } else if (currentStep === 2) {
      if (isPhoneComplete) setCurrentStep(3);
    } else if (currentStep === 3) {
      if (allPasswordRulesValid) onSubmit();
    }
  };

  const handleBack = () => {
    if (currentStep === 1) {
      onBackToEmail();
    } else {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const steps = [
    { id: 1, title: isRtl ? 'مشخصات و نام کاربری' : 'Name & Handle' },
    { id: 2, title: isRtl ? 'شماره تلفن همراه' : 'Phone' },
    { id: 3, title: isRtl ? 'تعیین گذرواژه' : 'Password' },
  ];

  return (
    <div className="w-full flex flex-col items-center">
      {/* Top Numbered Stepper (1 -> 2 -> 3) */}
      <div className="flex items-center justify-center w-full max-w-xs relative py-2 mb-6">
        {steps.map((step, index) => {
          const stepNum = index + 1;
          const isCompleted = currentStep > stepNum;
          const isCurrent = currentStep === stepNum;
          const isPending = currentStep < stepNum;

          return (
            <React.Fragment key={step.id}>
              {/* Step Circle */}
              <div className="flex flex-col items-center relative z-10">
                <button
                  type="button"
                  onClick={() => {
                    if (isCompleted) setCurrentStep(stepNum);
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

      <div className="w-full space-y-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: isRtl ? -10 : 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: isRtl ? 10 : -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {/* Header Title & Step Indicator */}
            <div className="flex items-baseline justify-between text-right" dir={isRtl ? 'rtl' : 'ltr'}>
              <label className="text-xl font-bold text-white/95 tracking-tight">
                {currentStep === 1 && (isRtl ? 'مشخصات و نام کاربری' : 'Profile & Username')}
                {currentStep === 2 && (isRtl ? 'شماره تلفن همراه' : 'Phone Number')}
                {currentStep === 3 && (isRtl ? 'تعیین گذرواژه' : 'Create Password')}
              </label>
              <span className="text-xs font-semibold text-white/40 tabular-nums font-mono" dir="ltr">
                {currentStep}/{steps.length}
              </span>
            </div>

            {/* Subtitle */}
            <p className="text-xs text-white/60 text-right leading-relaxed" dir={isRtl ? 'rtl' : 'ltr'}>
              {currentStep === 1 && (isRtl ? 'نام و شناسه یکتای اختصاصی جهت یافتن شما در فضاهای کاری' : 'Unique identity to discover you across workspaces')}
              {currentStep === 2 && (isRtl ? 'شماره همراه جهت بازیابی، ورود و جستجوی همکاران' : 'Phone for workspace invites, recovery, and login')}
              {currentStep === 3 && (isRtl ? 'حداقل ۱۲ کاراکتر و حداکثر ۷۲ بایت امنیتی شامل حروف بزرگ، کوچک، عدد و نماد' : 'Must meet all security criteria below')}
            </p>

            {/* Step 1: Name & Username Entry */}
            {currentStep === 1 && (
              <Step1NameUsername
                name={formData['name'] || ''}
                username={formData['username'] || ''}
                onNameChange={(val) => onInputChange('name', val)}
                onUsernameChange={(val) => onInputChange('username', val)}
                isRtl={isRtl}
                onValidityChange={setIsStep1Valid}
              />
            )}

            {/* Step 2: Phone Entry */}
            {currentStep === 2 && (
              <Step2Phone
                phone={formData['phone'] || ''}
                onPhoneChange={(val) => onInputChange('phone', val)}
                isRtl={isRtl}
              />
            )}

            {/* Step 3: Password Entry */}
            {currentStep === 3 && (
              <div className="space-y-4 text-right" dir={isRtl ? 'rtl' : 'ltr'}>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 block">
                    {isRtl ? 'رمز عبور' : 'Password'}
                  </label>
                  <div
                    className={cn(
                      'relative flex items-center h-12 rounded-2xl border transition-all p-1.5',
                      allPasswordRulesValid
                        ? 'border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.25)] bg-emerald-950/20'
                        : 'bg-[#232d3f]/90 border-slate-700/80 focus-within:border-cyan-500 focus-within:ring-2 focus-within:ring-cyan-500/20'
                    )}
                  >
                    <Lock className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
                    <input
                      id="password_input"
                      type={showPassword ? 'text' : 'password'}
                      dir="ltr"
                      autoFocus
                      autoComplete="new-password"
                      placeholder="••••••••"
                      value={currentPassword}
                      onChange={(e) => onInputChange('password', e.target.value)}
                      className="flex-1 h-full px-2 bg-transparent border-0 outline-none ring-0 text-slate-100 placeholder-slate-500 text-xs font-mono text-left"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-slate-400 hover:text-slate-200 transition-colors cursor-pointer p-1.5 shrink-0"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Password Security Checklist */}
                <div className="p-3.5 rounded-2xl bg-[#1a2233]/70 border border-slate-800 backdrop-blur-md space-y-2 text-xs">
                  <div className="text-[11px] font-semibold text-white/50 mb-1.5 flex items-center justify-between">
                    <span>{isRtl ? 'الزامات امنیتی گذرواژه:' : 'Password Security Rules:'}</span>
                    <span className={cn('font-mono font-bold', allPasswordRulesValid ? 'text-emerald-400' : 'text-white/40')}>
                      {passwordRules.filter(r => r.valid).length}/4
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    {passwordRules.map((rule) => (
                      <div key={rule.id} className="flex items-center gap-2 text-[12px]">
                        <div className="shrink-0 flex items-center justify-center">
                          {rule.valid ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" strokeWidth={3} />
                          ) : (
                            <X className="w-3.5 h-3.5 text-rose-400/70" strokeWidth={2.5} />
                          )}
                        </div>
                        <span className={cn('transition-colors', rule.valid ? 'text-emerald-400 font-medium' : 'text-slate-400')}>
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

        {/* Action Next / Submit Button */}
        <button
          type="button"
          onClick={handleNext}
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
              {currentStep === 3
                ? (isRtl ? 'تکمیل و ایجاد حساب کاربری' : 'Complete & Create Account')
                : (isRtl ? 'ادامه' : 'Continue')}
            </span>
            <ArrowIcon className="h-4 w-4" strokeWidth={2} />
          </span>
          {isLoading && <StrandsLoader variant="button" />}
        </button>

        {/* Back Step Button */}
        <button
          type="button"
          onClick={handleBack}
          className="text-xs text-white/55 hover:text-white transition-colors cursor-pointer block mx-auto pt-2"
        >
          {isRtl ? (currentStep === 1 ? '← تغییر نشانی ایمیل / شناسه' : '← مرحله قبل') : (currentStep === 1 ? '← Change email / handle' : '← Go back')}
        </button>
      </div>
    </div>
  );
};

export default RegisterWizard;
