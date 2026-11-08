import * as React from 'react';
import { cn } from '../../lib/utils';

export interface LoaderSkeletonProps {
  className?: string;
  style?: Record<string, unknown>;
  [attribute: string]: unknown;
  width?: string | number;
  height?: string | number;
  borderRadius?: number;
  baseColor?: string;
  highlightColor?: string;
  duration?: number;
}

/**
 * A placeholder block with a light sweeping across it. The sweep is a CSS
 * transform animation (styles: .orbit-skeleton-shimmer): a page skeleton has
 * dozens of these, and the compositor runs them without a JavaScript frame loop.
 */
export function LoaderSkeleton({
  className,
  width = '100%',
  height = 20,
  borderRadius = 4,
  baseColor,
  highlightColor,
  duration = 1.5,
  style,
  ...props
}: LoaderSkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn('relative overflow-hidden bg-slate-200/80 dark:bg-slate-800/70', className)}
      style={{ width, height, borderRadius, ...(baseColor && { backgroundColor: baseColor }), ...style }}
      {...props}
    >
      <div
        className="orbit-skeleton-shimmer absolute inset-0"
        style={{ animationDuration: `${duration}s`, ...(highlightColor && { '--skeleton-highlight': highlightColor }) } as React.CSSProperties}
      />
    </div>
  );
}

export default LoaderSkeleton;
