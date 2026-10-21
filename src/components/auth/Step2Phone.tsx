import React from 'react';
import { Phone, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';

export interface Step2PhoneProps {
  phone: string;
  onPhoneChange: (phone: string) => void;
  isRtl?: boolean;
}

export const formatPhoneMask = (raw: string) => {
  const clean = raw.replace(/\D/g, '').slice(0, 10);
  const digits = clean.padEnd(10, '-');
  return `${digits.slice(0, 3)}  ${digits.slice(3, 6)}  ${digits.slice(6, 10)}`;
};

export const Step2Phone: React.FC<Step2PhoneProps> = ({
  phone,
  onPhoneChange,
  isRtl = true
}) => {
  const rawPhone = (phone || '').replace(/\D/g, '').replace(/^0/, '').slice(0, 10);
  const isPhoneComplete = rawPhone.length === 10;

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const clean = e.target.value.replace(/\D/g, '').slice(0, 10);
    onPhoneChange(clean);
  };

  return (
    <div className="space-y-3 text-right" dir={isRtl ? 'rtl' : 'ltr'}>
      <label className="text-xs font-semibold text-slate-300 block">
        {isRtl ? 'شماره تلفن همراه' : 'Mobile Phone Number'}
      </label>

      {/* Unified Input Container */}
      <div
        className={cn(
          'relative flex items-center h-12 rounded-2xl border transition-all p-1.5',
          isPhoneComplete
            ? 'border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.25)] bg-emerald-950/20'
            : 'bg-[#232d3f]/90 border-slate-700/80 focus-within:border-cyan-500 focus-within:ring-2 focus-within:ring-cyan-500/20'
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
          onChange={handlePhoneChange}
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
  );
};

export default Step2Phone;
