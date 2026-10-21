import React from 'react';
import { Step2Phone } from './Step2Phone';

export interface RegisterStep2PhoneProps {
  onNext?: (phone: string) => void;
  onBack?: () => void;
  phone?: string;
  onPhoneChange?: (phone: string) => void;
  isRtl?: boolean;
}

export const RegisterStep2Phone: React.FC<RegisterStep2PhoneProps> = ({
  onNext,
  onBack,
  phone = '',
  onPhoneChange,
  isRtl = true
}) => {
  const [internalPhone, setInternalPhone] = React.useState(phone);

  const handleChange = (val: string) => {
    setInternalPhone(val);
    onPhoneChange?.(val);
  };

  return (
    <div className="space-y-4">
      <Step2Phone
        phone={onPhoneChange ? phone : internalPhone}
        onPhoneChange={handleChange}
        isRtl={isRtl}
      />
      {(onNext || onBack) && (
        <div className="space-y-2 pt-2">
          {onNext && (
            <button
              type="button"
              disabled={(onPhoneChange ? phone : internalPhone).length < 10}
              onClick={() => onNext(`+98${onPhoneChange ? phone : internalPhone}`)}
              className="w-full h-11 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold text-xs transition-all active:scale-95 cursor-pointer shadow-md shadow-blue-500/20"
            >
              {isRtl ? 'ادامه' : 'Continue'}
            </button>
          )}
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="w-full h-9 rounded-xl text-slate-400 hover:text-slate-200 text-xs font-semibold transition-colors"
            >
              {isRtl ? 'مرحله قبل' : 'Go Back'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default RegisterStep2Phone;
