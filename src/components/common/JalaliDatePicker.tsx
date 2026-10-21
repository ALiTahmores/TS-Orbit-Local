import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Calendar, ChevronDown, Check } from 'lucide-react';

interface JalaliDatePickerProps {
  value: string; // e.g. "1405/05/20" or "۱۴۰۵/۰۵/۲۰"
  onChange: (val: string) => void;
  label?: string;
  placeholder?: string;
}

const toPersianDigits = (n: string | number): string => {
  if (n === null || n === undefined) return '';
  const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(n).replace(/[0-9]/g, (x) => farsiDigits[parseInt(x, 10)]);
};

const toLatinDigits = (n: string): string => {
  if (!n) return '';
  return n.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString());
};

const PERSIAN_MONTHS = [
  { id: '01', name: 'فروردین' },
  { id: '02', name: 'اردیبهشت' },
  { id: '03', name: 'خرداد' },
  { id: '04', name: 'تیر' },
  { id: '05', name: 'مرداد' },
  { id: '06', name: 'شهریور' },
  { id: '07', name: 'مهر' },
  { id: '08', name: 'آبان' },
  { id: '09', name: 'آذر' },
  { id: '10', name: 'دی' },
  { id: '11', name: 'بهمن' },
  { id: '12', name: 'اسفند' },
];

export const JalaliDatePicker: React.FC<JalaliDatePickerProps> = ({
  value,
  onChange,
  label,
  placeholder = 'انتخاب تاریخ'
}) => {
  const currentJalaliYear = useMemo(() => {
    try {
      const parts = new Intl.DateTimeFormat('fa-IR-u-nu-latn').format(new Date()).split('/');
      return parseInt(parts[0], 10) || 1405;
    } catch {
      return 1405;
    }
  }, []);

  const yearsList = useMemo(() => [
    String(currentJalaliYear),
    String(currentJalaliYear + 1),
    String(currentJalaliYear + 2),
    String(currentJalaliYear + 3),
    String(currentJalaliYear + 4),
  ], [currentJalaliYear]);

  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [selectedYear, setSelectedYear] = useState(String(currentJalaliYear));
  const [selectedMonth, setSelectedMonth] = useState('05');
  const [selectedDay, setSelectedDay] = useState('15');

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Parse value prop on change
  useEffect(() => {
    if (value) {
      const latinStr = toLatinDigits(value);
      const parts = latinStr.split('/');
      if (parts.length === 3) {
        if (parts[0]) setSelectedYear(parts[0]);
        if (parts[1]) setSelectedMonth(parts[1].padStart(2, '0'));
        if (parts[2]) setSelectedDay(parts[2].padStart(2, '0'));
      }
    }
  }, [value]);

  const toggleOpen = () => {
    if (!isOpen) {
      setStep(1);
    }
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const monthObj = PERSIAN_MONTHS.find(m => m.id === selectedMonth) || PERSIAN_MONTHS[4];
  const formattedDisplay = `${toPersianDigits(selectedDay)} ${monthObj.name} ${toPersianDigits(selectedYear)}`;

  const emitChange = (y: string, m: string, d: string) => {
    const formattedVal = `${toPersianDigits(y)}/${toPersianDigits(m)}/${toPersianDigits(d.padStart(2, '0'))}`;
    onChange(formattedVal);
  };

  const setQuickPreset = (monthsToAdd: number) => {
    let mNum = parseInt(selectedMonth, 10);
    let yNum = parseInt(selectedYear, 10);

    mNum += monthsToAdd;
    while (mNum > 12) {
      mNum -= 12;
      yNum += 1;
    }

    const newMStr = String(mNum).padStart(2, '0');
    const newYStr = String(yNum);
    const newDStr = '15';

    setSelectedYear(newYStr);
    setSelectedMonth(newMStr);
    setSelectedDay(newDStr);
    emitChange(newYStr, newMStr, newDStr);
    setIsOpen(false);
  };

  const daysInMonth = parseInt(selectedMonth, 10) <= 6 ? 31 : parseInt(selectedMonth, 10) <= 11 ? 30 : 29;

  return (
    <div className="relative w-full text-right font-sans" dir="rtl">
      {label && (
        <label className="text-xs font-extrabold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-1.5">
          <Calendar size={14} className="text-blue-500" />
          <span>{label}</span>
        </label>
      )}

      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={toggleOpen}
        className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 p-3 rounded-2xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold transition-all flex items-center justify-between cursor-pointer hover:bg-slate-100/80 dark:hover:bg-slate-800 text-xs"
      >
        <span className="font-mono text-xs">{formattedDisplay || placeholder}</span>
        <span className="text-[10px] font-black px-2 py-0.5 bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300 rounded-lg flex items-center gap-1">
          <span>تغییر تاریخ</span>
          <ChevronDown size={12} />
        </span>
      </button>

      {/* Inline Absolute Popover Card Anchored Directly Under Field */}
      {isOpen && (
        <div
          ref={popoverRef}
          className="absolute top-full mt-2 right-0 z-[100] w-full min-w-[320px] max-w-[360px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xl space-y-3 animate-in fade-in zoom-in-95 duration-150 dir-rtl font-sans text-right"
          dir="rtl"
        >
          {/* Quick Presets */}
          <div className="flex items-center justify-between gap-1 pb-2 border-b border-slate-100 dark:border-slate-800">
            <span className="text-[10px] font-black text-slate-400">میانبرهای زمان‌بندی:</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setQuickPreset(1)}
                className="px-2 py-1 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-600 hover:text-white text-blue-600 dark:text-blue-300 text-[10px] font-bold rounded-lg transition-all cursor-pointer"
              >
                ۱ ماه آینده
              </button>
              <button
                type="button"
                onClick={() => setQuickPreset(3)}
                className="px-2 py-1 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-600 hover:text-white text-blue-600 dark:text-blue-300 text-[10px] font-bold rounded-lg transition-all cursor-pointer"
              >
                ۳ ماه آینده
              </button>
              <button
                type="button"
                onClick={() => setQuickPreset(6)}
                className="px-2 py-1 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-600 hover:text-white text-blue-600 dark:text-blue-300 text-[10px] font-bold rounded-lg transition-all cursor-pointer"
              >
                ۶ ماه آینده
              </button>
            </div>
          </div>

          {/* Step Navigation Tabs */}
          <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-[10px] font-bold">
            <button
              type="button"
              onClick={() => setStep(1)}
              className={`flex-1 py-1 rounded-lg transition-all cursor-pointer ${
                step === 1
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 font-black shadow-2xs'
                  : 'text-slate-400'
              }`}
            >
              ۱. سال ({toPersianDigits(selectedYear)})
            </button>
            <button
              type="button"
              onClick={() => setStep(2)}
              className={`flex-1 py-1 rounded-lg transition-all cursor-pointer ${
                step === 2
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 font-black shadow-2xs'
                  : 'text-slate-400'
              }`}
            >
              ۲. ماه ({monthObj.name})
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              className={`flex-1 py-1 rounded-lg transition-all cursor-pointer ${
                step === 3
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 font-black shadow-2xs'
                  : 'text-slate-400'
              }`}
            >
              ۳. روز ({toPersianDigits(selectedDay)})
            </button>
          </div>

          {/* Step 1: Select Year */}
          {step === 1 && (
            <div className="grid grid-cols-3 gap-1.5 pt-1">
              {yearsList.map((y) => (
                <button
                  key={y}
                  type="button"
                  onClick={() => {
                    setSelectedYear(y);
                    setStep(2);
                  }}
                  className={`py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                    selectedYear === y
                      ? 'bg-blue-600 text-white font-black shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {toPersianDigits(y)}
                </button>
              ))}
            </div>
          )}

          {/* Step 2: Select Month */}
          {step === 2 && (
            <div className="grid grid-cols-3 gap-1.5 pt-1">
              {PERSIAN_MONTHS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setSelectedMonth(m.id);
                    setStep(3);
                  }}
                  className={`py-2 text-[11px] font-bold rounded-xl transition-all cursor-pointer ${
                    selectedMonth === m.id
                      ? 'bg-blue-600 text-white font-black shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {m.name}
                </button>
              ))}
            </div>
          )}

          {/* Step 3: Select Day */}
          {step === 3 && (
            <div className="space-y-2">
              <div className="grid grid-cols-7 gap-1 text-center pt-1 max-h-40 overflow-y-auto">
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const dStr = String(i + 1).padStart(2, '0');
                  const isSel = selectedDay === dStr;
                  return (
                    <button
                      key={dStr}
                      type="button"
                      onClick={() => {
                        setSelectedDay(dStr);
                        emitChange(selectedYear, selectedMonth, dStr);
                        setIsOpen(false);
                      }}
                      className={`py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        isSel
                          ? 'bg-blue-600 text-white font-black shadow-sm'
                          : 'bg-slate-50 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/40 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {toPersianDigits(dStr)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Footer confirming choice */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px]">
            <span className="font-extrabold text-slate-600 dark:text-slate-300">
              تاریخ انتخابی: <span className="text-blue-600 dark:text-blue-400 font-mono">{formattedDisplay}</span>
            </span>
            <button
              type="button"
              onClick={() => {
                emitChange(selectedYear, selectedMonth, selectedDay);
                setIsOpen(false);
              }}
              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-lg text-[10px] transition-all cursor-pointer flex items-center gap-1"
            >
              <Check size={12} />
              <span>تایید</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

