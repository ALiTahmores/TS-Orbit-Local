import { apiFetch } from '../../lib/api';
import React, { useState, useEffect } from 'react';
import { User, AtSign, Loader2, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface Step1NameUsernameProps {
  name: string;
  username: string;
  onNameChange: (name: string) => void;
  onUsernameChange: (username: string) => void;
  isRtl?: boolean;
  onValidityChange?: (isValid: boolean) => void;
}

export const Step1NameUsername: React.FC<Step1NameUsernameProps> = ({
  name,
  username,
  onNameChange,
  onUsernameChange,
  isRtl = true,
  onValidityChange
}) => {
  const [checking, setChecking] = useState(false);
  const [isTaken, setIsTaken] = useState(false);
  const [formatError, setFormatError] = useState<string | null>(null);

  const cleanUsername = username.replace(/^@/, '').trim();
  const isLengthValid = cleanUsername.length >= 3 && cleanUsername.length <= 30;
  const isFormatValid = /^[a-zA-Z0-9_]{3,30}$/.test(cleanUsername);
  const isNameValid = name.trim().length >= 3;

  // Real-time Live DB Uniqueness & Format Engine
  useEffect(() => {
    if (!cleanUsername) {
      setIsTaken(false);
      setFormatError(null);
      setChecking(false);
      onValidityChange?.(false);
      return;
    }

    // Check invalid characters (< 3 chars or illegal chars / Persian / symbols)
    if (cleanUsername.length < 3) {
      setFormatError(isRtl ? 'نام کاربری باید حداقل ۳ حرف انگلیسی باشد.' : 'Username must be at least 3 English characters.');
      setIsTaken(false);
      setChecking(false);
      onValidityChange?.(false);
      return;
    }

    if (!/^[a-zA-Z0-9_]{3,30}$/.test(cleanUsername)) {
      setFormatError(isRtl ? 'فقط حروف انگلیسی (a-z)، اعداد و زیرخط (_) مجاز هستند.' : 'Only English letters (a-z), numbers, and underscore (_) are allowed.');
      setIsTaken(false);
      setChecking(false);
      onValidityChange?.(false);
      return;
    }

    // Format is valid, clear format error
    setFormatError(null);

    // Debounced API check with backend server
    const timer = setTimeout(async () => {
      setChecking(true);
      try {
        const res = await apiFetch('/api/auth/check-username', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: cleanUsername })
        });
        const data = await res.json();
        if (data.available === false) {
          setIsTaken(true);
          onValidityChange?.(false);
        } else {
          setIsTaken(false);
          onValidityChange?.(isNameValid);
        }
      } catch {
        setIsTaken(false);
        setFormatError(isRtl ? 'بررسی نام کاربری انجام نشد؛ دوباره تلاش کنید.' : 'Username could not be checked. Retry.');
        onValidityChange?.(false);
      } finally {
        setChecking(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [cleanUsername, isRtl, isNameValid]);

  // Overall validity update for parent form
  useEffect(() => {
    const valid = isNameValid && isFormatValid && !isTaken && !checking;
    onValidityChange?.(valid);
  }, [isNameValid, isFormatValid, isTaken, checking]);

  const isValidAndAvailable = cleanUsername && isFormatValid && !isTaken && !checking;
  const isInvalidFormat = cleanUsername && (!isFormatValid || Boolean(formatError));

  return (
    <div className="space-y-4 text-right" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Full Name Input */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-slate-300 block">
          {isRtl ? 'نام و نام خانوادگی' : 'Full Name'}
        </label>
        <div
          className={cn(
            'relative flex items-center h-12 rounded-2xl bg-[#232d3f]/90 border border-slate-700/80 transition-all p-1.5',
            'focus-within:border-cyan-500 focus-within:ring-2 focus-within:ring-cyan-500/20'
          )}
        >
          <User className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
          <input
            id="name_input"
            type="text"
            dir={isRtl ? 'rtl' : 'ltr'}
            placeholder={isRtl ? 'مثلاً: علی طهمورثی' : 'e.g. John Doe'}
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            autoFocus
            autoComplete="name"
            className={cn(
              'flex-1 h-full px-2 bg-transparent border-0 outline-none ring-0 text-slate-100 placeholder-slate-500 text-xs font-medium',
              isRtl ? 'text-right' : 'text-left'
            )}
          />
        </div>
      </div>

      {/* Username Section */}
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-slate-300 block">
            {isRtl ? 'نام کاربری (شناسه یکتا)' : 'Username (Unique Handle)'}
          </label>
          {cleanUsername && (
            <span className={cn('text-[11px] font-mono', isValidAndAvailable ? 'text-emerald-400' : 'text-slate-400')} dir="ltr">
              @{cleanUsername}
            </span>
          )}
        </div>

        {/* State A: Warning Banner ABOVE input for duplicate / taken username */}
        {isTaken && (
          <div className="text-xs font-bold text-rose-500 bg-rose-500/10 border border-rose-500/30 p-2.5 rounded-xl flex items-center gap-2 mb-2 animate-in fade-in transition-all">
            <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{isRtl ? 'این نام کاربری قبلاً توسط کاربر دیگری ثبت شده است.' : 'This username is already taken by another user.'}</span>
          </div>
        )}

        {/* Username Input Container with Dynamic States */}
        <div
          className={cn(
            'relative flex items-center h-12 rounded-2xl transition-all p-1.5',
            // State A - Taken
            isTaken
              ? 'border-rose-500 focus-within:border-rose-500 focus-within:ring-2 focus-within:ring-rose-500/20 bg-rose-950/20 border'
              // State B - Invalid Format
              : isInvalidFormat
              ? 'border-rose-500/80 bg-rose-950/20 border'
              // State C - Valid & Available
              : isValidAndAvailable
              ? 'border-emerald-500 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 bg-emerald-950/20 border'
              // Default
              : 'bg-[#232d3f]/90 border border-slate-700/80 focus-within:border-cyan-500 focus-within:ring-2 focus-within:ring-cyan-500/20'
          )}
        >
          <AtSign className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
          <input
            id="username_input"
            type="text"
            dir="ltr"
            placeholder={isRtl ? 'alitahmores' : 'username'}
            value={cleanUsername}
            onChange={(e) => {
              // English letters, numbers, and underscore only
              const sanitized = e.target.value.replace(/^@/, '').replace(/[^a-zA-Z0-9_]/g, '');
              onUsernameChange(sanitized);
            }}
            maxLength={30}
            autoComplete="username"
            className="flex-1 h-full px-2 bg-transparent border-0 outline-none ring-0 text-slate-100 placeholder-slate-500 text-xs font-mono text-left"
          />

          {/* Right Status Indicator */}
          <div className="shrink-0 w-8 h-8 flex items-center justify-center">
            {checking ? (
              <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
            ) : isTaken ? (
              <XCircle className="w-4 h-4 text-rose-500" />
            ) : isInvalidFormat ? (
              <XCircle className="w-4 h-4 text-rose-400" />
            ) : isValidAndAvailable ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            ) : null}
          </div>
        </div>

        {/* Dynamic Status Helper Text */}
        <div className="space-y-1 pt-1 text-[11px]">
          {/* Dynamic notices for format error / availability */}
          {formatError && (
            <p className="text-rose-400 font-medium">{formatError}</p>
          )}
          {isValidAndAvailable && (
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
  );
};

export default Step1NameUsername;
