import React from 'react';
import { Step1NameUsername } from './Step1NameUsername';

export interface RegisterStep1NameUsernameProps {
  name?: string;
  username?: string;
  onNameChange?: (name: string) => void;
  onUsernameChange?: (username: string) => void;
  onNext?: () => void;
  onBack?: () => void;
  isRtl?: boolean;
}

export const RegisterStep1NameUsername: React.FC<RegisterStep1NameUsernameProps> = ({
  name = '',
  username = '',
  onNameChange,
  onUsernameChange,
  onNext,
  onBack,
  isRtl = true
}) => {
  const [internalName, setInternalName] = React.useState(name);
  const [internalUsername, setInternalUsername] = React.useState(username);
  const [isValid, setIsValid] = React.useState(false);

  const handleName = (v: string) => {
    setInternalName(v);
    onNameChange?.(v);
  };

  const handleUsername = (v: string) => {
    setInternalUsername(v);
    onUsernameChange?.(v);
  };

  return (
    <div className="space-y-4">
      <Step1NameUsername
        name={onNameChange ? name : internalName}
        username={onUsernameChange ? username : internalUsername}
        onNameChange={handleName}
        onUsernameChange={handleUsername}
        onValidityChange={setIsValid}
        isRtl={isRtl}
      />
      {(onNext || onBack) && (
        <div className="space-y-2 pt-2">
          {onNext && (
            <button
              type="button"
              disabled={!isValid}
              onClick={onNext}
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

export default RegisterStep1NameUsername;
