import { apiFetch } from '../../lib/api';
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useProject } from '../../context/ProjectContext';
import { MultiStepForm, StepItem } from '../ui/multistep-form';
import { AuthEmailInput } from './AuthEmailInput';
import { AdaptivePrismBackground } from './AdaptivePrismBackground';
import { cn } from '../../lib/utils';
import { 
  Mail, 
  Lock, 
  ArrowRight, 
  ArrowLeft, 
  Eye, 
  EyeOff, 
  Check, 
  Clock, 
  AlertCircle,
  RefreshCw,
  Orbit,
  User,
  Globe
} from 'lucide-react';
import StrandsLoader from '../loading/StrandsLoader';

export interface AuthModalProps {
  isOpen?: boolean;
  initialNotice?: string;
  onClose?: () => void;
  initialMode?: 'auto' | 'login' | 'register';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen = true,
  initialNotice = '',
}) => {
  const { 
    login, 
    register, 

  } = useProject();

  // Authentication page is permanently dark mode, with Persian/English localization toggle
  const [authLocale, setAuthLocale] = useState<'fa' | 'en'>('fa');

  const isRtl = authLocale !== 'en';
  const ArrowForward = isRtl ? ArrowLeft : ArrowRight;

  // Apply dark mode & locale to the document root only for the active auth screen
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('dark');

    const dir = authLocale === 'fa' ? 'rtl' : 'ltr';
    root.setAttribute('dir', dir);
    root.setAttribute('lang', authLocale);
    document.body.style.direction = dir;
    document.body.style.textAlign = authLocale === 'fa' ? 'right' : 'left';
  }, [authLocale]);

  const toggleAuthLocale = () => {
    setAuthLocale((prev) => (prev === 'fa' ? 'en' : 'fa'));
  };

  // Flow State Machine
  // 'email_entry' -> 'login_password' OR 'register_stepper' | 'pending_success' | 'forgot_password'
  const [currentFlow, setCurrentFlow] = useState<'email_entry' | 'login_password' | 'register_stepper' | 'pending_success' | 'forgot_password'>('email_entry');
  const [regStep, setRegStep] = useState<number>(1);

  // Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Registration MultiStep Form Data
  const [formData, setFormData] = useState<Record<string, string>>({
    name: '',
    phone: '',
    password: '',
  });

  // Existing User snippet for login screen
  const [existingUserSnippet, setExistingUserSnippet] = useState<{
    name?: string;
    avatar?: string;
    role?: string;
  } | null>(null);

  // Local Loading & Feedback States
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'error' | 'success' | 'info' | null;
    message: string;
  }>({ type: initialNotice ? 'info' : null, message: initialNotice });

  const clearFeedback = () => setFeedback({ type: null, message: '' });

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Step 0: Check Email / Username / Phone Existence (Dynamic Resolver)
  const handleResolvedEmailSubmit = async (resolvedInput: string) => {
    clearFeedback();

    const rawInput = resolvedInput.trim();
    if (!rawInput) {
      setFeedback({
        type: 'error',
        message: isRtl ? 'لطفاً نشانی ایمیل، نام کاربری یا شماره همراه را وارد نمایید.' : 'Please enter your email, username, or phone number.'
      });
      return;
    }

    setEmail(rawInput);
    const normalizedInput = rawInput.toLowerCase();
    const isEmail = rawInput.includes('@');
    const isPhone = /^0?9\d{9}$/.test(rawInput);
    const isUsername = /^@?[a-zA-Z0-9_]{3,30}$/.test(rawInput);

    // Prepopulate fields for registration stepper
    if (isUsername && !isEmail) {
      const cleanU = rawInput.replace(/^@/, '').toLowerCase();
      setFormData(prev => ({ ...prev, username: cleanU }));
    } else if (isPhone) {
      const cleanP = rawInput.replace(/\D/g, '').replace(/^0/, '');
      setFormData(prev => ({ ...prev, phone: cleanP }));
    } else if (isEmail) {
      const localPart = rawInput.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 30);
      setFormData(prev => ({ ...prev, username: prev.username || localPart }));
    }

    setIsLoading(true);
    try {
      const res = await apiFetch('/api/auth/check-identifier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: normalizedInput })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.exists) {
          setExistingUserSnippet(null);

          setPassword('');
          setCurrentFlow('login_password');
        } else {
          setExistingUserSnippet(null);
          setPassword('');
          setRegStep(1);
          setCurrentFlow('register_stepper');
        }
      } else {
        // Fallback to login
        setCurrentFlow('login_password');
      }
    } catch {
      // Offline fallback: prompt password
      setCurrentFlow('login_password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    handleResolvedEmailSubmit(email);
  };

  // Flow 1: Login Submit
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearFeedback();

    if (!password) {
      setFeedback({
        type: 'error',
        message: isRtl ? 'لطفاً رمز عبور را وارد کنید.' : 'Please enter your password.'
      });
      return;
    }

    setIsLoading(true);
    try {
      const success = await login(email.trim(), password);
      if (!success) {
        setFeedback({
          type: 'error',
          message: isRtl ? 'شناسه کاربری، ایمیل یا کلمه عبور وارد شده نادرست است.' : 'Invalid email, username, or password.'
        });
      }
    } catch {
      setFeedback({
        type: 'error',
        message: isRtl ? 'خطا در برقراری ارتباط با سرور.' : 'Failed to connect to authentication server.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Flow 2: Multi-step Registration Stepper Definition
  const registrationSteps: StepItem[] = [
    {
      id: 1,
      field: 'name',
      label: isRtl ? 'مشخصات و نام کاربری' : 'Profile & Username',
      title: isRtl ? 'مشخصات و نام کاربری' : 'Profile & Username',
      placeholder: isRtl ? 'نام و نام خانوادگی' : 'Full Name',
      description: isRtl ? 'شناسه یکتای اختصاصی جهت یافتن شما در فضاهای کاری' : 'Unique handle & name'
    },
    {
      id: 2,
      field: 'phone',
      label: isRtl ? 'شماره تلفن همراه' : 'Phone Number',
      title: isRtl ? 'شماره تلفن همراه' : 'Phone Number',
      placeholder: '9 - -   - - -   - - - -',
      description: isRtl ? 'شماره همراه را بدون صفر اول وارد کنید' : 'Enter without leading zero'
    },
    {
      id: 3,
      field: 'password',
      label: isRtl ? 'تعیین گذرواژه' : 'Create Password',
      title: isRtl ? 'تعیین گذرواژه' : 'Create Password',
      placeholder: '••••••••',
      description: isRtl ? 'حداقل ۱۲ کاراکتر و حداکثر ۷۲ بایت امنیتی شامل حروف بزرگ، کوچک، عدد و نماد' : 'Must meet all security criteria'
    }
  ];

  const handleRegisterStepNext = async () => {
    clearFeedback();

    if (regStep === 1) {
      const nameVal = (formData.name || '').trim();
      const rawUser = (formData.username || '').replace(/^@/, '').trim();
      if (!nameVal || nameVal.length < 3) {
        setFeedback({
          type: 'error',
          message: isRtl ? 'نام و نام خانوادگی باید حداقل ۳ حرف باشد.' : 'Full name must be at least 3 characters.'
        });
        return;
      }
      if (!rawUser || !/^[a-zA-Z0-9_]{3,20}$/.test(rawUser)) {
        setFeedback({
          type: 'error',
          message: isRtl ? 'نام کاربری باید ۳ تا ۲۰ کاراکتر انگلیسی، اعداد یا _ باشد.' : 'Username must be 3-20 chars (a-z, 0-9, _).'
        });
        return;
      }
      setRegStep(2);
      return;
    }

    if (regStep === 2) {
      const cleanPhone = (formData.phone || '').replace(/\D/g, '').replace(/^0/, '').slice(0, 10);
      if (cleanPhone.length !== 10) {
        setFeedback({
          type: 'error',
          message: isRtl ? 'شماره تلفن همراه باید دقیقاً ۱۰ رقم (بدون صفر اول) باشد.' : 'Phone number must be exactly 10 digits without leading zero.'
        });
        return;
      }
      setRegStep(3);
      return;
    }

    if (regStep === 3) {
      const passVal = formData.password || '';
      const isLengthValid = passVal.length >= 12 && new TextEncoder().encode(passVal).length <= 72;
      const isCaseValid = /[a-z]/.test(passVal) && /[A-Z]/.test(passVal);
      const isNumberValid = /[0-9]/.test(passVal);
      const isSpecialValid = /[!@#$%^&*(),.?":{}|<>]/.test(passVal);

      if (!isLengthValid || !isCaseValid || !isNumberValid || !isSpecialValid) {
        setFeedback({
          type: 'error',
          message: isRtl ? 'لطفاً تمامی الزامات امنیتی گذرواژه را رعایت فرمایید.' : 'Please fulfill all password security rules.'
        });
        return;
      }

      setIsLoading(true);
      try {
        const cleanPhone = (formData.phone || '').replace(/\D/g, '').replace(/^0/, '').slice(0, 10);
        let userEmail = email.trim().toLowerCase();
        if (!userEmail.includes('@')) {
          userEmail = `${(formData.username || 'user').toLowerCase().replace(/[^a-z0-9_]/g, '')}@workspace.local`;
        }

        const result = await register(
          userEmail,
          passVal,
          (formData.name || '').trim(),
          cleanPhone,
          'OWNER',
          (formData.username || '').replace(/^@/, '').trim()
        );

        if (result && result.success) {
          setFeedback({
            type: 'success',
            message: isRtl ? 'فضای کاری شما با موفقیت ایجاد شد!' : 'Workspace created successfully!'
          });
        } else {
          setFeedback({
            type: 'error',
            message: isRtl ? 'ثبت نام انجام نشد. نشانی ایمیل یا نام کاربری ممکن است تکراری باشد.' : 'Registration failed. Email or username may already be registered.'
          });
        }
      } catch {
        setFeedback({
          type: 'error',
          message: isRtl ? 'خطای غیرمنتظره در ثبت‌نام.' : 'Unexpected error during registration.'
        });
      } finally {
        setIsLoading(false);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center min-h-screen p-4 overflow-y-auto select-none text-neutral-100"
      dir={isRtl ? 'rtl' : 'ltr'}
      style={{ fontFeatureSettings: '"ss01" 1' }}
    >
      {/* ========================================================
          ISOLATED FLOATING CONTROLS (Language Switcher Only - Permanently Top-Right)
         ======================================================== */}
      <div
        className="fixed top-5 right-5 z-50 flex items-center p-1 rounded-full border border-white/[0.12] bg-[#11131d]/70 backdrop-blur-xl transition-all shadow-[0_4px_20px_rgba(0,0,0,0.35)]"
      >
        {/* Language switch */}
        <button
          type="button"
          onClick={toggleAuthLocale}
          className="h-8 px-3 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer text-white/85 hover:text-white hover:bg-white/10"
          title={isRtl ? 'تغییر زبان به انگلیسی' : 'Switch language to Persian'}
        >
          <Globe className="w-3.5 h-3.5 text-blue-400" />
          <span>{authLocale === 'fa' ? 'فارسی' : 'EN'}</span>
        </button>
      </div>

      {/* ========================================================
          LAYER 0 & 1: ADAPTIVE PRISM 3D BACKGROUND
         ======================================================== */}
      <AdaptivePrismBackground />

      {/* ========================================================
          LAYER 2: LIQUID GLASS AUTHENTICATION CARD
         ======================================================== */}
      <div 
        className="relative z-10 w-full max-w-[460px] p-8 md:p-10 rounded-[36px] bg-white/[0.05] dark:bg-black/[0.25] border border-white/20 dark:border-white/15 shadow-[0_20px_60px_rgba(0,0,0,0.4),inset_0_1px_1px_rgba(255,255,255,0.3),inset_0_-1px_2px_rgba(0,0,0,0.5)] flex flex-col items-center text-center backdrop-blur-2xl md:backdrop-blur-3xl transition-all duration-300 my-auto text-neutral-100"
      >
        
        {/* Feedback Alert Pill */}
        <AnimatePresence>
          {feedback.message && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              className={`mb-6 p-3 rounded-2xl text-xs font-semibold flex items-center justify-center gap-2 border backdrop-blur-md shadow-sm ${
                feedback.type === 'error'
                  ? 'bg-rose-950/40 border-rose-500/30 text-rose-300'
                  : feedback.type === 'success'
                  ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                  : 'bg-blue-950/40 border-blue-500/30 text-blue-300'
              }`}
            >
              {feedback.type === 'error' ? (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              ) : feedback.type === 'success' ? (
                <Check className="w-4 h-4 shrink-0 text-emerald-400" />
              ) : (
                <Clock className="w-4 h-4 shrink-0 text-blue-400" />
              )}
              <span>{feedback.message}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {/* ========================================================
              SCREEN 1: LIQUID GLASS AUTH VIEW (Email Entry & Social)
             ======================================================== */}
          {currentFlow === 'email_entry' && (
            <motion.div
              key="email_entry"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col items-center w-full"
            >
              {/* 1. Top TS Squircle Brand Badge */}
              <div className="h-14 w-14 mx-auto mb-6 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/30 ring-1 ring-white/25 border border-white/20">
                <span className="text-xl font-black tracking-wider text-white font-sans">TS</span>
              </div>

              {/* 2. Welcome Headline & Subtitle */}
              <h1 className="text-2xl md:text-3xl font-bold text-white/95 tracking-tight mb-2">
                {isRtl ? 'خوش آمدید به TS Orbit' : 'Welcome to TS Orbit'}
              </h1>

              <p className="text-xs md:text-sm text-white/60 font-medium mb-6">
                {isRtl ? 'برای ورود یا عضویت در سامانه، ایمیل خود را وارد کنید' : 'Sign in or create an account to get started'}
              </p>

              {/* 5. Smart Email Input with Optional Domain Badge Pill */}
              <div className="w-full">
                <AuthEmailInput
                  onSubmit={handleResolvedEmailSubmit}
                  loading={isLoading}
                  isRtl={isRtl}
                  initialValue={email}
                />
              </div>
            </motion.div>
          )}

          {/* ========================================================
              SCREEN 2: EXISTING USER PASSWORD PROMPT
             ======================================================== */}
          {currentFlow === 'login_password' && (
            <motion.div
              key="login_password"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col items-center w-full"
            >
              {/* Brand Logo Badge */}
              <div className="h-14 w-14 mx-auto mb-6 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/30 ring-1 ring-white/25 border border-white/20">
                <span className="text-xl font-black tracking-wider text-white font-sans">TS</span>
              </div>

              {/* Title */}
              <h1 className="text-2xl md:text-3xl font-bold text-white/95 tracking-tight mb-2">
                {isRtl ? 'رمز عبور خود را وارد کنید' : 'Enter your password'}
              </h1>

              {/* User Snippet Pill */}
              <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-white/[0.055] border border-white/[0.12] shadow-sm backdrop-blur-md mb-6">
                <div className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-300 flex items-center justify-center text-[10px] font-bold">
                  {existingUserSnippet?.name ? existingUserSnippet.name.charAt(0).toUpperCase() : <User className="w-3 h-3" />}
                </div>
                <span className="text-xs font-semibold text-white/80">
                  {existingUserSnippet?.name || email}
                </span>
              </div>

              {/* Password Input */}
              <form onSubmit={handleLoginSubmit} className="w-full space-y-4">
                <div
                  className={cn(
                    'w-full h-14 px-4 rounded-xl flex items-center gap-3 transition-all duration-200 backdrop-blur-md',
                    'bg-white/[0.055] border border-white/[0.12]',
                    'focus-within:bg-white/[0.09] focus-within:border-blue-500/60 focus-within:shadow-[0_0_0_3px_rgba(59,130,246,0.15)]'
                  )}
                >
                  <Lock className="w-5 h-5 shrink-0 text-white/50" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoFocus
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-transparent border-0 border-none outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 shadow-none text-base font-mono text-white placeholder-white/40 px-0"
                    style={{ outline: 'none', boxShadow: 'none' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-white/45 hover:text-white transition-colors cursor-pointer p-1"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Login Button */}
                <button
                  type="submit"
                  disabled={isLoading || !password}
                  aria-busy={isLoading}
                  className={cn(
                    'relative h-12 w-full rounded-xl text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-[0.99] overflow-hidden',
                    isLoading
                      ? '!bg-[#05060b] !border-[#1d63ff]/40 text-white shadow-[0_0_24px_rgba(29,99,255,0.25)] opacity-100 cursor-wait'
                      : password
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-500/25 border border-blue-400/30'
                      : 'bg-white/10 text-white/30 border border-white/5 cursor-not-allowed'
                  )}
                >
                  <span className={cn('flex items-center justify-center gap-2', isLoading ? 'opacity-0 invisible pointer-events-none' : 'opacity-100')}>
                    <span>{isRtl ? 'ورود به محیط کارگاه' : 'Log in to Workspace'}</span>
                    <ArrowForward className="w-4 h-4" strokeWidth={2.2} />
                  </span>
                  {isLoading && <StrandsLoader variant="button" />}
                </button>

                {/* Links */}
                <div className="flex items-center justify-between text-xs text-white/55 pt-2 px-1">
                  <button
                    type="button"
                    onClick={() => {
                      clearFeedback();
                      setCurrentFlow('email_entry');
                    }}
                    className="hover:text-white transition-colors cursor-pointer"
                  >
                    {isRtl ? '← تغییر نشانی ایمیل' : '← Change email'}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      clearFeedback();
                      setCurrentFlow('forgot_password');
                    }}
                    className="hover:text-white transition-colors cursor-pointer"
                  >
                    {isRtl ? 'فراموشی کلمه عبور؟' : 'Forgot password?'}
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {/* ========================================================
              SCREEN 3: 3-STEP REGISTRATION STEPPER
             ======================================================== */}
          {currentFlow === 'register_stepper' && (
            <motion.div
              key="register_stepper"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col items-center w-full"
            >
              <MultiStepForm
                steps={registrationSteps}
                currentStep={regStep}
                formData={formData}
                onInputChange={handleInputChange}
                onNext={handleRegisterStepNext}
                onBack={() => {
                  if (regStep === 1) {
                    setCurrentFlow('email_entry');
                  } else {
                    setRegStep((prev) => prev - 1);
                  }
                }}
                onStepClick={(s) => setRegStep(s)}
                isRtl={isRtl}
                isLoading={isLoading}
                submitLabel={isRtl ? 'ایجاد حساب و فضای کاری' : 'Complete Registration'}
                nextLabel={isRtl ? 'ادامه' : 'Continue'}
                backLabel={isRtl ? (regStep === 1 ? 'بازگشت به ابتدا' : 'مرحله قبل') : 'Go back'}
              />
            </motion.div>
          )}

          {/* ========================================================
              SCREEN 4: COMPLETION / PENDING APPROVAL QUEUE
             ======================================================== */}
          {currentFlow === 'pending_success' && (
            <motion.div
              key="pending_success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center text-center space-y-5 py-4"
            >
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/10">
                <Check className="w-8 h-8" strokeWidth={2.5} />
              </div>

              <div className="space-y-1">
                <h2 className="text-2xl md:text-3xl font-serif text-white/95 tracking-tight font-normal">
                  {isRtl ? 'حساب کاربری شما ایجاد شد' : "You're all set"}
                </h2>
                <p className="text-xs text-white/60 leading-relaxed max-w-sm mx-auto">
                  {isRtl
                    ? 'اطلاعات شما با موفقیت ثبت گردید. درخواست عضویت در صف تایید مدیریت سامانه قرار گرفت و به زودی فعال خواهد شد.'
                    : 'Your account has been registered and submitted to the workspace admin for verification.'}
                </p>
              </div>

              {/* Status Details Card */}
              <div className="p-4 rounded-2xl bg-white/[0.055] border border-white/[0.12] shadow-sm backdrop-blur-md w-full text-start space-y-2.5 text-xs">
                <div className="flex justify-between items-center text-white/55">
                  <span>{isRtl ? 'نام کاربر:' : 'User:'}</span>
                  <span className="font-bold text-white/90">{formData.name}</span>
                </div>
                <div className="flex justify-between items-center text-white/55">
                  <span>{isRtl ? 'شناسه ایمیل:' : 'Email:'}</span>
                  <span className="font-mono text-white/90" dir="ltr">{email}</span>
                </div>
                <div className="flex justify-between items-center text-white/55">
                  <span>{isRtl ? 'وضعیت دسترسی:' : 'Status:'}</span>
                  <span className="text-amber-400 font-semibold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    {isRtl ? 'در انتظار تایید مدیر' : 'Pending Approval'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  clearFeedback();
                  setCurrentFlow('email_entry');
                }}
                className="h-12 w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold transition-all cursor-pointer text-xs shadow-md mt-2 border border-blue-400/30"
              >
                {isRtl ? 'بازگشت به صفحه ورود' : 'Return to Login'}
              </button>
            </motion.div>
          )}

          {/* ========================================================
              PASSWORD RECOVERY FLOW
             ======================================================== */}
          {currentFlow === 'forgot_password' && (
            <motion.div
              key="forgot_password"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col items-center w-full"
            >
              <h2 className="text-2xl font-serif text-white/95 mb-2 font-normal">
                {isRtl ? 'بازیابی کلمه عبور' : 'Reset Password'}
              </h2>
              <p className="text-sm text-white/70 mb-6 leading-7 text-center">
                {isRtl
                  ? 'بازیابی رمز روی سیستم میزبان توسط صاحب سیستم انجام می‌شود. در پوشه پروژه دستور زیر را اجرا کنید؛ رمز جدید در ترمینال به صورت مخفی دریافت می‌شود. شناسه و داده‌های حساب حفظ می‌شوند.'
                  : 'The host computer owner can reset the password locally. Run the command below in the project folder; the terminal asks for the new password privately. Your account ID and data are preserved.'}
              </p>
              <code dir="ltr" className="block w-full break-words rounded-xl bg-black/30 p-4 text-xs text-blue-200 select-text">
                npm run local:account -- set-password --email EMAIL
              </code>
              <p className="text-xs text-white/60 my-4">
                {isRtl ? 'EMAIL را با ایمیل حساب جایگزین کنید. هیچ کد یا ایمیلی ارسال نمی‌شود.' : 'Replace EMAIL with the account email. No code or email is sent.'}
              </p>
              <button type="button" onClick={() => { clearFeedback(); setCurrentFlow('email_entry'); }} className="text-sm text-white/70 hover:text-white cursor-pointer">
                {isRtl ? 'بازگشت به ورود' : 'Back to sign in'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default AuthModal;
