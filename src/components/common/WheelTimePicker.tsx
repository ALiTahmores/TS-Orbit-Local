import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Clock, Check } from 'lucide-react';

interface WheelTimePickerProps {
  value: string; // e.g. "10:00" or "10:00 AM" or "۱۰:۰۰ ب.ظ"
  onChange: (val: string) => void;
  lang?: 'fa' | 'en';
}

const toPersianDigits = (n: string | number): string => {
  if (n === null || n === undefined) return '';
  const farsiDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(n).replace(/[0-9]/g, (x) => farsiDigits[parseInt(x, 10)]);
};

const ITEM_HEIGHT = 40; // px
const VIEWPORT_HEIGHT = 176; // px (h-44)
const PADDING = (VIEWPORT_HEIGHT - ITEM_HEIGHT) / 2; // 68px

interface WheelColumnProps {
  items: string[];
  value: string;
  onChange: (val: string) => void;
  displayFormatter?: (val: string) => string;
  isInfinite?: boolean;
  isOpen: boolean;
}

const WheelColumn: React.FC<WheelColumnProps> = ({
  items,
  value,
  onChange,
  displayFormatter = (v) => v,
  isInfinite = true,
  isOpen
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isSelfScrolling = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const baseLen = items.length;
  const fullItems = isInfinite ? [...items, ...items, ...items] : items;
  const activeBaseIndex = items.indexOf(value) !== -1 ? items.indexOf(value) : 0;

  // Initial centering on popover open or value change
  useEffect(() => {
    if (isOpen && containerRef.current && !isSelfScrolling.current) {
      const targetIndex = isInfinite ? baseLen + activeBaseIndex : activeBaseIndex;
      containerRef.current.scrollTop = targetIndex * ITEM_HEIGHT;
    }
  }, [isOpen, value, isInfinite, baseLen, activeBaseIndex]);

  const handleScroll = () => {
    if (!containerRef.current) return;

    isSelfScrolling.current = true;
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);

    scrollTimeoutRef.current = setTimeout(() => {
      isSelfScrolling.current = false;
    }, 150);

    const scrollTop = containerRef.current.scrollTop;

    // Boundary wrap for infinite looping
    if (isInfinite) {
      const minScroll = (baseLen / 2) * ITEM_HEIGHT;
      const maxScroll = (baseLen * 2 + baseLen / 2) * ITEM_HEIGHT;

      if (scrollTop < minScroll) {
        containerRef.current.scrollTop = scrollTop + baseLen * ITEM_HEIGHT;
        return;
      } else if (scrollTop > maxScroll) {
        containerRef.current.scrollTop = scrollTop - baseLen * ITEM_HEIGHT;
        return;
      }
    }

    const rawIndex = Math.round(scrollTop / ITEM_HEIGHT);
    const itemIndex = ((rawIndex % baseLen) + baseLen) % baseLen;
    const selectedVal = items[itemIndex];

    if (selectedVal && selectedVal !== value) {
      onChange(selectedVal);
    }
  };

  const handleClickItem = (idx: number) => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: idx * ITEM_HEIGHT,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="relative w-full h-44 overflow-y-auto snap-y snap-mandatory scrollbar-none flex flex-col items-center"
      style={{
        paddingTop: `${PADDING}px`,
        paddingBottom: `${PADDING}px`
      }}
    >
      {fullItems.map((itemVal, idx) => {
        const itemBaseIdx = idx % baseLen;
        const isSelected = items[itemBaseIdx] === value;
        const isNumeric = !isNaN(Number(itemVal));

        return (
          <button
            key={`${itemVal}-${idx}`}
            type="button"
            onClick={() => handleClickItem(idx)}
            style={{ height: `${ITEM_HEIGHT}px` }}
            className={`snap-center w-full flex items-center justify-center shrink-0 cursor-pointer select-none transition-all duration-150 ${
              isNumeric ? 'font-mono' : 'font-sans'
            } ${
              isSelected
                ? 'text-3xl font-bold text-slate-900 dark:text-white opacity-100 scale-100'
                : 'text-lg font-normal text-slate-400 dark:text-slate-500 opacity-30 scale-90'
            }`}
          >
            {displayFormatter(itemVal)}
          </button>
        );
      })}
    </div>
  );
};

export const WheelTimePicker: React.FC<WheelTimePickerProps> = ({
  value,
  onChange,
  lang = 'fa'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedHour, setSelectedHour] = useState('09');
  const [selectedMinute, setSelectedMinute] = useState('00');
  const [selectedPeriod, setSelectedPeriod] = useState<'AM' | 'PM'>('AM');

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0, width: 280 });

  const periodLabel = useCallback((p: 'AM' | 'PM') => {
    if (lang === 'fa') {
      return p === 'AM' ? 'ق.ظ' : 'ب.ظ';
    }
    return p;
  }, [lang]);

  // Parse initial value or set clean defaults
  useEffect(() => {
    if (value) {
      if (value.includes('ب.ظ') || value.includes('PM')) {
        setSelectedPeriod('PM');
      } else if (value.includes('ق.ظ') || value.includes('AM')) {
        setSelectedPeriod('AM');
      }

      const match = value.match(/(\d{1,2})[:_](\d{2})/);
      if (match) {
        let h = parseInt(match[1], 10);
        const m = match[2];
        if (h > 12) {
          h = h - 12;
          setSelectedPeriod('PM');
        } else if (h === 0) {
          h = 12;
          setSelectedPeriod('AM');
        }
        setSelectedHour(String(h).padStart(2, '0'));
        setSelectedMinute(m);
      }
    } else {
      // Default fallback
      setSelectedHour('09');
      setSelectedMinute('00');
      setSelectedPeriod('AM');
    }
  }, [value]);

  const calculatePosition = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const popoverHeight = 280;
      const spaceBelow = window.innerHeight - rect.bottom;

      let top = rect.bottom + 8;
      if (spaceBelow < popoverHeight && rect.top > popoverHeight) {
        top = rect.top - popoverHeight - 8;
      }

      setPopoverPos({
        top: Math.max(10, top),
        left: Math.max(10, Math.min(rect.left, window.innerWidth - 300)),
        width: Math.max(280, rect.width)
      });
    }
  };

  const toggleOpen = () => {
    if (!isOpen) {
      calculatePosition();
    }
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    const handleScrollOrResize = () => {
      if (isOpen) calculatePosition();
    };
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);
    return () => {
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [isOpen]);

  useEffect(() => {
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
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const hours = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
  const minutes = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'));

  const emitFormattedChange = useCallback((h: string, m: string, p: 'AM' | 'PM') => {
    const pLabel = periodLabel(p);
    const formatted = lang === 'fa'
      ? `${toPersianDigits(h)}:${toPersianDigits(m)} ${pLabel}`
      : `${h}:${m} ${pLabel}`;
    onChange(formatted);
  }, [lang, periodLabel, onChange]);

  const handleHourChange = (h: string) => {
    setSelectedHour(h);
    emitFormattedChange(h, selectedMinute, selectedPeriod);
  };

  const handleMinuteChange = (m: string) => {
    setSelectedMinute(m);
    emitFormattedChange(selectedHour, m, selectedPeriod);
  };

  const handlePeriodChange = (p: 'AM' | 'PM') => {
    setSelectedPeriod(p);
    emitFormattedChange(selectedHour, selectedMinute, p);
  };

  const displayTime = lang === 'fa'
    ? `${toPersianDigits(selectedHour)}:${toPersianDigits(selectedMinute)} ${periodLabel(selectedPeriod)}`
    : `${selectedHour}:${selectedMinute} ${periodLabel(selectedPeriod)}`;

  return (
    <div className="relative w-full text-right font-sans" dir="rtl">
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        onClick={toggleOpen}
        className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 p-3 rounded-2xl text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center justify-between cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-all shadow-2xs"
      >
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-blue-500 dark:text-blue-400" />
          <span className="font-mono text-xs">{displayTime}</span>
        </div>
        <span className="text-[10px] font-black px-2 py-0.5 bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300 rounded-lg">
          انتخاب زمان
        </span>
      </button>

      {/* Floating 3D Wheel Picker Popover */}
      {isOpen &&
        createPortal(
          <div
            ref={popoverRef}
            style={{
              position: 'fixed',
              top: `${popoverPos.top}px`,
              left: `${popoverPos.left}px`,
              width: `${popoverPos.width}px`,
              zIndex: 99999
            }}
            className="bg-white dark:bg-slate-900/95 border border-slate-200/90 dark:border-slate-800 shadow-2xl rounded-2xl p-4 space-y-3 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 dir-rtl font-sans text-right"
            dir="rtl"
          >
            {/* Header Action Bar */}
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 dark:border-slate-800 text-xs font-extrabold text-slate-800 dark:text-slate-200">
              <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                <Clock size={15} />
                <span>تنظیم ساعت دقیق</span>
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-lg text-[10px] transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
              >
                <Check size={12} />
                <span>تایید</span>
              </button>
            </div>

            {/* THREE WHEEL COLUMNS IN RTL ORDER (RIGHT: Period, CENTER: Minutes, LEFT: Hours) */}
            <div className="relative flex flex-row justify-center items-center gap-1 h-44 overflow-hidden rounded-xl bg-slate-50/50 dark:bg-slate-950/40 border border-slate-200/40 dark:border-slate-800/40 p-1" dir="rtl">
              {/* Horizontal Center Active Row Highlight Line */}
              <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 h-10 bg-slate-200/60 dark:bg-slate-800/60 rounded-xl pointer-events-none z-0 border border-slate-300/40 dark:border-slate-700/40" />

              {/* RIGHT COLUMN (1st in RTL): Period */}
              <div className="relative z-10 flex-1">
                <WheelColumn
                  items={['AM', 'PM']}
                  value={selectedPeriod}
                  onChange={(p) => handlePeriodChange(p as 'AM' | 'PM')}
                  displayFormatter={(p) => periodLabel(p as 'AM' | 'PM')}
                  isInfinite={false}
                  isOpen={isOpen}
                />
              </div>

              {/* CENTER COLUMN (2nd in RTL): Minutes */}
              <div className="relative z-10 flex-1">
                <WheelColumn
                  items={minutes}
                  value={selectedMinute}
                  onChange={(m) => handleMinuteChange(m)}
                  displayFormatter={(m) => lang === 'fa' ? toPersianDigits(m) : m}
                  isInfinite={true}
                  isOpen={isOpen}
                />
              </div>

              {/* LEFT COLUMN (3rd in RTL): Hours */}
              <div className="relative z-10 flex-1">
                <WheelColumn
                  items={hours}
                  value={selectedHour}
                  onChange={(h) => handleHourChange(h)}
                  displayFormatter={(h) => lang === 'fa' ? toPersianDigits(h) : h}
                  isInfinite={true}
                  isOpen={isOpen}
                />
              </div>
            </div>

            {/* Bottom Summary Label */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-center text-[11px] text-slate-600 dark:text-slate-300 font-extrabold">
              زمان فعال: <span className="text-blue-600 dark:text-blue-400 font-mono text-xs">{displayTime}</span>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};


