import React, { useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import StrandsLoader from '../loading/StrandsLoader';

export interface AuthEmailInputProps {
  onSubmit: (fullEmail: string) => void;
  loading?: boolean;
  isRtl?: boolean;
  initialValue?: string;
}

export const AuthEmailInput: React.FC<AuthEmailInputProps> = ({ 
  onSubmit, 
  loading = false,
  isRtl = true,
  initialValue = ''
}) => {
  const [emailHandle, setEmailHandle] = useState(initialValue);
  const [domain] = useState('@gmail.com');

  const getResolvedEmail = () => {
    const trimmed = emailHandle.trim();
    if (!trimmed) return '';
    // If user already typed full email with @ or if it's a phone number, return as is
    if (trimmed.includes('@') || /^0?9\d{9}$/.test(trimmed)) {
      return trimmed;
    }
    return `${trimmed}${domain}`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const resolved = getResolvedEmail();
    if (!resolved) return;
    onSubmit(resolved);
  };

  const resolvedDisplay = getResolvedEmail();
  const hasCustomDomain = emailHandle.includes('@');
  const isPhone = /^0?9\d{9}$/.test(emailHandle.trim());

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-2 text-right" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Segmented Badged Input (Matches phone badge UI) */}
      <div className={cn(
        "relative flex items-center h-12 rounded-2xl bg-[#232d3f]/90 border border-slate-700/80 transition-all p-1.5",
        "focus-within:border-cyan-500 focus-within:ring-2 focus-within:ring-cyan-500/20"
      )}>
        
        {/* Right Domain Badge Pill */}
        <div 
          className="h-full px-3 rounded-xl bg-slate-800/90 border border-slate-700/70 text-slate-200 font-mono text-xs font-bold flex items-center justify-center shrink-0 select-none" 
          dir="ltr"
        >
          {isPhone ? '+98 IR' : hasCustomDomain ? '@custom' : domain}
        </div>

        {/* Input field */}
        <input
          type="text"
          required
          autoFocus
          value={emailHandle}
          onChange={(e) => setEmailHandle(e.target.value.replace(/\s+/g, ''))}
          placeholder={isRtl ? "مثال: alitahmores" : "e.g. username"}
          className="flex-1 h-full px-3 bg-transparent text-slate-100 placeholder-slate-500 text-xs font-mono outline-none text-left border-none focus:outline-none focus:ring-0"
          dir="ltr"
        />

        {/* Submit Arrow Button */}
        <button
          type="submit"
          disabled={loading || !emailHandle.trim()}
          aria-busy={loading}
          className="relative w-8 h-8 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed text-white flex items-center justify-center transition-all active:scale-95 cursor-pointer shrink-0 shadow-sm overflow-hidden"
          title={isRtl ? "ادامه" : "Continue"}
        >
          {loading ? (
            <StrandsLoader variant="button" />
          ) : (
            <ArrowLeft className={cn("w-4 h-4", !isRtl && "rotate-180")} />
          )}
        </button>
      </div>

      {/* Helper text & Resolved preview */}
      <div className="flex items-center justify-between px-1 text-[11px] text-slate-400">
        <span>{isRtl ? `وارد کردن پسوند ${domain} اختیاری است.` : `Domain ${domain} is optional.`}</span>
        <span className="font-mono text-slate-500 text-[10px]" dir="ltr">
          {resolvedDisplay || 'example@gmail.com'}
        </span>
      </div>
    </form>
  );
};

export default AuthEmailInput;
