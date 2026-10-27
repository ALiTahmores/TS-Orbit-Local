import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number; // delay in ms before showing
  className?: string;
  disabled?: boolean;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
  delay = 150,
  className = '',
  disabled = false
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const updateCoords = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setCoords({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
    }
  };

  const handleMouseEnter = () => {
    if (disabled || !content) return;
    updateCoords();
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      updateCoords();
      setIsMounted(true);
      setTimeout(() => setIsVisible(true), 10);
    }, delay);
  };

  const handleMouseLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsVisible(false);
    timerRef.current = setTimeout(() => {
      setIsMounted(false);
    }, 150);
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (disabled || !content) {
    return <>{children}</>;
  }

  let tooltipStyle: React.CSSProperties = {};
  if (coords) {
    const centerX = coords.left + coords.width / 2;
    const centerY = coords.top + coords.height / 2;

    if (position === 'top') {
      tooltipStyle = {
        position: 'fixed',
        left: `${centerX}px`,
        top: `${coords.top - 8}px`,
        transform: 'translate(-50%, -100%)',
      };
    } else if (position === 'bottom') {
      tooltipStyle = {
        position: 'fixed',
        left: `${centerX}px`,
        top: `${coords.top + coords.height + 8}px`,
        transform: 'translate(-50%, 0)',
      };
    } else if (position === 'left') {
      tooltipStyle = {
        position: 'fixed',
        left: `${coords.left - 8}px`,
        top: `${centerY}px`,
        transform: 'translate(-100%, -50%)',
      };
    } else if (position === 'right') {
      tooltipStyle = {
        position: 'fixed',
        left: `${coords.left + coords.width + 8}px`,
        top: `${centerY}px`,
        transform: 'translate(0, -50%)',
      };
    }
  }

  return (
    <div 
      ref={triggerRef}
      className={`inline-flex items-center justify-center ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleMouseEnter}
      onBlur={handleMouseLeave}
    >
      {children}
      {isMounted && coords && createPortal(
        <div
          role="tooltip"
          style={tooltipStyle}
          className={`z-[9999] pointer-events-none transition-all duration-150 ease-out font-sans ${
            isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
          }`}
          dir="rtl"
        >
          <div className="relative bg-slate-900 dark:bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded-xl shadow-2xl border border-slate-700/80 dark:border-blue-400/40 whitespace-nowrap tracking-wide leading-tight">
            {content}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Tooltip;
