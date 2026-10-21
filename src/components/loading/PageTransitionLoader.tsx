import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Strands } from '../ui/Strands';
import { cn } from '../../lib/utils';

export interface PageTransitionLoaderProps {
  isLoading: boolean;
  message?: string;
  className?: string;
  isRtl?: boolean;
}

export const PageTransitionLoader: React.FC<PageTransitionLoaderProps> = ({
  isLoading,
  message,
  className,
  isRtl = true
}) => {
  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          key="page-micro-transition"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2 }}
          className={cn(
            'fixed top-0 left-0 right-0 z-[9990] pointer-events-none flex flex-col items-center select-none',
            className
          )}
          role="progressbar"
          aria-busy="true"
        >
          {/* Top glowing bar with Strands ribbons */}
          <div className="relative w-full h-[3px] overflow-hidden bg-slate-900/50 backdrop-blur-md">
            <div className="absolute inset-0">
              <Strands
                colors={['#F97316', '#7C3AED', '#06B6D4']}
                count={3}
                speed={1.0}
                amplitude={0.75}
                waviness={1.0}
                thickness={0.8}
                glow={1.8}
                scale={1.2}
                intensity={0.75}
                saturation={1.8}
              />
            </div>
          </div>

          {/* Micro pill badge if message is provided */}
          {message && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="mt-3 px-3.5 py-1 rounded-full bg-slate-900/90 dark:bg-slate-950/90 border border-white/10 shadow-xl backdrop-blur-md flex items-center gap-2"
            >
              <div className="w-10 h-3 overflow-hidden">
                <Strands
                  colors={['#F97316', '#7C3AED', '#06B6D4']}
                  count={2}
                  speed={0.8}
                  amplitude={0.7}
                  waviness={1.0}
                  thickness={0.6}
                  glow={1.6}
                  scale={1.0}
                  intensity={0.65}
                  saturation={1.8}
                />
              </div>
              <span className={cn('text-[11px] font-medium text-white/90', isRtl ? 'font-sans' : '')}>
                {message}
              </span>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default PageTransitionLoader;
