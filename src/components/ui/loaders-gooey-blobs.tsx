import * as React from 'react';
import { motion, type HTMLMotionProps } from 'motion/react';
import { cn } from '../../lib/utils';

export interface LoaderGooeyBlobsProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  size?: number;
  color?: string;
  duration?: number;
}

/**
 * Three blobs that drift and merge. The blur, the blobs' travel and the gaps scale
 * with `size`, so the same loader reads well at 20px and inside a 32px button.
 * Each instance has its own filter ID: several loaders can share a page.
 */
export function LoaderGooeyBlobs({
  className,
  size = 20,
  color = 'currentColor',
  duration = 1.5,
  ...props
}: LoaderGooeyBlobsProps) {
  const filterId = 'gooey-' + React.useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const travel = size * 0.75;
  return (
    <motion.div className={cn('flex items-center gap-2', className)} {...props}>
      <svg width="0" height="0" className="absolute" aria-hidden="true">
        <defs>
          <filter id={filterId}>
            <feGaussianBlur in="SourceGraphic" stdDeviation={Math.max(size * 0.15, 0.6)} result="blur" />
            <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" result="gooey" />
            <feBlend in="SourceGraphic" in2="gooey" />
          </filter>
        </defs>
      </svg>
      <div style={{ filter: `url(#${filterId})`, gap: Math.max(size * 0.2, 2) }} className="flex">
        {[0, 1, 2].map(index => (
          <motion.div
            key={index}
            className="rounded-full"
            style={{ width: size, height: size, backgroundColor: color }}
            animate={{ x: [0, travel, 0, -travel, 0], scale: [1, 1.2, 1, 1.2, 1] }}
            transition={{ duration, ease: 'easeInOut', repeat: Infinity, delay: index * 0.2 }}
          />
        ))}
      </div>
    </motion.div>
  );
}

export default LoaderGooeyBlobs;
