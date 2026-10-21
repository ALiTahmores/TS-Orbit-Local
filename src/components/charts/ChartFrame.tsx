import React from 'react';
import { ResponsiveContainer } from 'recharts';
import { useProject } from '../../context/ProjectContext';
import StrandsLoader from '../loading/StrandsLoader';

export interface ChartFrameProps {
  id: string;
  title?: string;
  subtitle?: string;
  height?: number;
  isLoading?: boolean;
  isEmpty?: boolean;
  emptyMessage?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export const ChartFrame: React.FC<ChartFrameProps> = ({
  id,
  title,
  subtitle,
  height = 240,
  isLoading = false,
  isEmpty = false,
  emptyMessage,
  children,
  actions,
  className = '',
}) => {
  const { t, locale } = useProject();
  const isRtl = locale === 'fa';

  return (
    <div
      id={id}
      className={`bg-surface-primary border border-border-primary rounded-radius-20 p-6 shadow-sm flex flex-col font-sans ${className}`}
      style={{ direction: isRtl ? 'rtl' : 'ltr' }}
    >
      {/* Chart Header */}
      {(title || subtitle || actions) && (
        <div className="flex items-center justify-between mb-6 shrink-0">
          <div className="flex flex-col space-y-0.5">
            {title && (
              <h4 className="text-xs font-extrabold text-text-primary tracking-tight select-none">
                {title}
              </h4>
            )}
            {subtitle && (
              <span className="text-[10px] text-text-muted select-none">
                {subtitle}
              </span>
            )}
          </div>
          {actions && <div className="flex items-center gap-1.5 shrink-0">{actions}</div>}
        </div>
      )}

      {/* Chart Canvas Area */}
      <div className="relative flex-1" style={{ height }}>
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-surface-primary/70 backdrop-blur-xs rounded-radius-16 z-10">
            <StrandsLoader variant="section" message={t('loading') || 'در حال بارگذاری داده‌ها...'} />
          </div>
        ) : isEmpty ? (
          <div className="absolute inset-0 flex items-center justify-center text-text-muted text-xs font-medium border border-dashed border-border-primary rounded-radius-16 bg-surface-primary/30">
            {emptyMessage || t('no_data') || 'داده‌ای برای نمایش یافت نشد'}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            {children as React.ReactElement}
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

// DESIGN SYSTEM CUSTOM CHART TOOLTIP
export interface ChartTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  valueFormatter?: (value: any) => string;
}

export const ChartTooltip: React.FC<ChartTooltipProps> = ({
  active,
  payload,
  label,
  valueFormatter,
}) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-surface-primary border border-border-strong rounded-radius-8 p-3 shadow-floating text-right font-sans text-[10px] min-w-[120px] select-none">
        {label && <p className="font-extrabold text-text-primary mb-1.5">{label}</p>}
        <div className="space-y-1">
          {payload.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                <span className="text-text-secondary">{item.name}</span>
              </div>
              <span className="font-mono font-bold text-text-primary">
                {valueFormatter ? valueFormatter(item.value) : item.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};
