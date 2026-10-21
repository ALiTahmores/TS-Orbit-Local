import React from 'react';
import { StrandsLoader, StrandsLoaderVariant } from './StrandsLoader';
import { useProject } from '../../context/ProjectContext';
import { cn } from '../../lib/utils';

export interface SectionLoaderProps {
  message?: string;
  variant?: StrandsLoaderVariant;
  className?: string;
  minHeight?: string | number;
}

/**
 * SectionLoader is a standalone scoped loader component for rendering inside
 * empty/loading states of widgets, cards, panels, or modal areas.
 */
export const SectionLoader: React.FC<SectionLoaderProps> = ({
  message,
  variant = 'section',
  className = '',
  minHeight = 'min-h-[160px]'
}) => {
  const { locale, t } = useProject();
  const isRtl = locale === 'fa';
  const displayMessage = message || (isRtl ? 'در حال بارگذاری اطلاعات...' : 'Loading section data...');

  return (
    <div
      className={cn(
        'relative w-full flex items-center justify-center p-4 rounded-[inherit]',
        typeof minHeight === 'string' ? minHeight : '',
        className
      )}
      style={typeof minHeight === 'number' ? { minHeight: `${minHeight}px` } : undefined}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <StrandsLoader variant={variant} message={displayMessage} />
    </div>
  );
};

export default SectionLoader;
