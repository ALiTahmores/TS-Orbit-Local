import React, { useState } from 'react';
import { ArrowLeft, AtSign, Phone, User } from 'lucide-react';
import { cn } from '../../lib/utils';
import StrandsLoader from '../loading/StrandsLoader';

export interface AuthEmailInputProps {
  onSubmit: (identifier: string) => void;
  loading?: boolean;
  isRtl?: boolean;
  initialValue?: string;
}

const PHONE = /^(?:\+98|0)?9\d{9}$/;

/** Email, username or mobile number, sent as typed; the badge shows which one it is. */
export const AuthEmailInput: React.FC<AuthEmailInputProps> = ({
  onSubmit,
  loading = false,
  isRtl = true,
  initialValue = ''
}) => {
  const [identifier, setIdentifier] = useState(initialValue);
  const value = identifier.trim();
  const kind = !value ? 'empty' : value.includes('@') && !value.startsWith('@') ? 'email' : PHONE.test(value) ? 'phone' : 'username';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value) onSubmit(value);
  };

  const Icon = kind === 'phone' ? Phone : kind === 'email' || kind === 'empty' ? AtSign : User;
  const hint = kind === 'email' ? 'ورود با ایمیل' : kind === 'phone' ? 'ورود با شماره همراه' : kind === 'username' ? 'ورود با نام کاربری' : 'ایمیل، نام کاربری یا شماره همراه خود را وارد کنید.';

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-2 text-start">
      <div className={cn(
        "relative flex items-center h-12 rounded-2xl bg-[#232d3f]/90 border border-slate-700/80 transition-all p-1.5",
        "focus-within:border-cyan-500 focus-within:ring-2 focus-within:ring-cyan-500/20"
      )}>
        <div className="h-full w-9 rounded-xl bg-slate-800/90 border border-slate-700/70 text-slate-300 flex items-center justify-center shrink-0" aria-hidden="true">
          <Icon className="w-4 h-4" />
        </div>
        <input
          type="text"
          required
          autoFocus
          autoComplete="username"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value.replace(/\s+/g, ''))}
          placeholder={isRtl ? 'ایمیل، نام کاربری یا شماره همراه' : 'Email, username or mobile number'}
          aria-label={isRtl ? 'ایمیل، نام کاربری یا شماره همراه' : 'Email, username or mobile number'}
          className="flex-1 h-full px-3 bg-transparent text-slate-100 placeholder-slate-500 text-sm outline-none text-left border-none focus:outline-none focus:ring-0"
          dir="ltr"
        />
        <button
          type="submit"
          disabled={loading || !value}
          aria-busy={loading}
          className="relative w-8 h-8 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed text-white flex items-center justify-center transition-all active:scale-95 cursor-pointer shrink-0 shadow-sm overflow-hidden"
          title={isRtl ? 'ادامه' : 'Continue'}
          aria-label={isRtl ? 'ادامه' : 'Continue'}
        >
          {loading ? <StrandsLoader variant="button" /> : <ArrowLeft className="w-4 h-4" />}
        </button>
      </div>
      <p className="px-1 text-[11px] text-slate-400">{hint}</p>
    </form>
  );
};

export default AuthEmailInput;
