import { apiFetch } from '../../lib/api';
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useProject } from '../../context/ProjectContext';
import { AuthEmailInput } from './AuthEmailInput';
import { RegisterWizard } from './RegisterWizard';
import { AdaptivePrismBackground } from './AdaptivePrismBackground';
import { User, Lock, Eye, EyeOff, Check, AlertCircle, ArrowLeft, ArrowRight, Globe } from 'lucide-react';
import { cn } from '../../lib/utils';
import StrandsLoader from '../loading/StrandsLoader';

export interface AuthViewProps {
  onSuccess?: () => void;
  initialMode?: 'auto' | 'login' | 'register';
}

export const AuthView: React.FC<AuthViewProps> = ({
  onSuccess,
}) => {
  const { login, register } = useProject();
  const [authLocale, setAuthLocale] = useState<'fa' | 'en'>('fa');
  const isRtl = authLocale !== 'en';
  const ArrowForward = isRtl ? ArrowLeft : ArrowRight;

  const [currentFlow, setCurrentFlow] = useState<'email_entry' | 'login_password' | 'register_stepper' | 'pending_success'>('email_entry');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({
    name: '',
    username: '',
    phone: '',
    password: '',
  });

  const [existingUserSnippet, setExistingUserSnippet] = useState<{
    name?: string;
    avatar?: string;
    role?: string;
  } | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success' | null; message: string }>({
    type: null,
    message: ''
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleEmailSubmit = async (resolvedEmail: string) => {
    setFeedback({ type: null, message: '' });
    setEmail(resolvedEmail);
    setIsLoading(true);

    const isEmail = resolvedEmail.includes('@');
    const isPhone = /^0?9\d{9}$/.test(resolvedEmail);
    const cleanUsername = isEmail
      ? resolvedEmail.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 30)
      : resolvedEmail.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 30);

    setFormData((prev) => ({
      ...prev,
      username: prev.username || cleanUsername,
      phone: isPhone ? resolvedEmail.replace(/\D/g, '').replace(/^0/, '') : prev.phone
    }));

    try {
      const res = await apiFetch('/api/auth/check-identifier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: resolvedEmail })
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
          setCurrentFlow('register_stepper');
        }
      } else {
        setCurrentFlow('login_password');
      }
    } catch {
      setCurrentFlow('login_password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setIsLoading(true);
    setFeedback({ type: null, message: '' });

    try {
      const success = await login(email.trim(), password);
      if (!success) {
        setFeedback({
          type: 'error',
          message: isRtl ? 'شناسه کاربری یا رمز عبور اشتباه است.' : 'Invalid credentials.'
        });
      } else {
        onSuccess?.();
      }
    } catch {
      setFeedback({
        type: 'error',
        message: isRtl ? 'خطا در ارتباط با سرور.' : 'Server connection failed.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterComplete = async () => {
    setIsLoading(true);
    setFeedback({ type: null, message: '' });

    try {
      const result = await register(
        email.trim(),
        formData.password,
        formData.name.trim(),
        formData.phone.trim(),
        'OWNER',
        formData.username.trim()
      );

      if (result.success) {
        setCurrentFlow('pending_success');
      } else {
        setFeedback({
          type: 'error',
          message: result.message || (isRtl ? 'ثبت نام انجام نشد.' : 'Registration failed.')
        });
      }
    } catch {
      setFeedback({
        type: 'error',
        message: isRtl ? 'خطا در ثبت اطلاعات.' : 'Registration failed.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-4 overflow-hidden bg-slate-950 text-slate-100">
      <AdaptivePrismBackground />

      <div className="relative z-10 w-full max-w-md p-6 sm:p-8 rounded-3xl bg-[#131b2e]/90 border border-slate-800/80 shadow-2xl backdrop-blur-xl">
        {/* Language switcher */}
        <div className="flex justify-end mb-4">
          <button
            type="button"
            onClick={() => setAuthLocale((prev) => (prev === 'fa' ? 'en' : 'fa'))}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#232d3f]/80 text-xs text-slate-300 border border-slate-700/60 hover:bg-[#232d3f] transition-colors cursor-pointer"
          >
            <Globe className="w-3.5 h-3.5 text-cyan-400" />
            <span>{authLocale === 'fa' ? 'English' : 'فارسی'}</span>
          </button>
        </div>

        {/* Global Feedback Banner */}
        {feedback.message && (
          <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{feedback.message}</span>
          </div>
        )}

        <AnimatePresence mode="wait">
          {/* FLOW 1: EMAIL ENTRY WITH DOMAIN BADGE */}
          {currentFlow === 'email_entry' && (
            <motion.div
              key="email_entry"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-6"
            >
              <div className="text-center space-y-2">
                <h1 className="text-2xl font-bold tracking-tight text-white">
                  {isRtl ? 'ورود به سامانه مدیریت' : 'Sign in to Workspace'}
                </h1>
                <p className="text-xs text-slate-400">
                  {isRtl ? 'جهت ورود یا ثبت‌نام، شناسه کاربری یا ایمیل خود را وارد کنید.' : 'Enter your email or username to continue.'}
                </p>
              </div>

              <AuthEmailInput
                onSubmit={handleEmailSubmit}
                loading={isLoading}
                isRtl={isRtl}
                initialValue={email}
              />
            </motion.div>
          )}

          {/* FLOW 2: PASSWORD LOGIN */}
          {currentFlow === 'login_password' && (
            <motion.div
              key="login_password"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-6"
            >
              <div className="text-center space-y-2">
                <h1 className="text-2xl font-bold tracking-tight text-white">
                  {isRtl ? 'رمز عبور خود را وارد کنید' : 'Enter Password'}
                </h1>
                <p className="text-xs text-slate-400 font-mono" dir="ltr">
                  {email}
                </p>
              </div>

              <form onSubmit={handleLoginSubmit} className="space-y-4" dir={isRtl ? 'rtl' : 'ltr'}>
                <div className="relative flex items-center h-12 rounded-2xl bg-[#232d3f]/90 border border-slate-700/80 px-3.5 focus-within:border-cyan-500 focus-within:ring-2 focus-within:ring-cyan-500/20 transition-all">
                  <Lock className="w-5 h-5 text-slate-400 shrink-0" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoFocus
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="flex-1 h-full px-3 bg-transparent text-slate-100 text-sm font-mono outline-none border-none placeholder-slate-500"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-slate-400 hover:text-slate-200 p-1 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !password}
                  className="w-full h-12 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-sm transition-all shadow-md active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
                >
                  {isLoading ? <StrandsLoader variant="button" /> : (
                    <>
                      <span>{isRtl ? 'ورود به حساب کاربری' : 'Sign In'}</span>
                      <ArrowForward className="w-4 h-4" />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setCurrentFlow('email_entry')}
                  className="w-full text-center text-xs text-slate-400 hover:text-slate-200 transition-colors pt-2"
                >
                  {isRtl ? '← تغییر شناسه / ایمیل' : '← Change email'}
                </button>
              </form>
            </motion.div>
          )}

          {/* FLOW 3: REGISTER WIZARD */}
          {currentFlow === 'register_stepper' && (
            <motion.div
              key="register_stepper"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="w-full"
            >
              <RegisterWizard
                formData={formData}
                onInputChange={handleInputChange}
                onSubmit={handleRegisterComplete}
                onBackToEmail={() => setCurrentFlow('email_entry')}
                isLoading={isLoading}
                isRtl={isRtl}
              />
            </motion.div>
          )}

          {/* FLOW 4: PENDING SUCCESS */}
          {currentFlow === 'pending_success' && (
            <motion.div
              key="pending_success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center space-y-4 py-4"
            >
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
                <Check className="w-8 h-8" strokeWidth={2.5} />
              </div>
              <h2 className="text-2xl font-bold text-white">
                {isRtl ? 'ثبت‌نام با موفقیت انجام شد' : 'Registration Complete'}
              </h2>
              <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
                {isRtl
                  ? 'حساب محلی و فضای کاری شما ایجاد شد.'
                  : 'Your local account and workspace have been created.'}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default AuthView;
