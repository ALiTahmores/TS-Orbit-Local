import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Strands } from '../ui/Strands';

export interface SplashScreenProps {
  durationMs?: number;
  onComplete?: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  durationMs = 1500,
  onComplete
}) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      onComplete?.();
    }, durationMs);

    return () => clearTimeout(timer);
  }, [durationMs, onComplete]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          key="app-bootstrap-splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.02 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-[#060914] text-white select-none overflow-hidden"
          role="status"
          aria-live="polite"
        >
          {/* Ambient Glow Orbs */}
          <div className="absolute w-[450px] h-[450px] rounded-full bg-blue-600/15 blur-[120px] pointer-events-none -top-24 -left-24" />
          <div className="absolute w-[400px] h-[400px] rounded-full bg-violet-600/15 blur-[120px] pointer-events-none -bottom-24 -right-24" />
          <div className="absolute w-[300px] h-[300px] rounded-full bg-cyan-500/10 blur-[100px] pointer-events-none" />

          {/* Center Brand Identity */}
          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="relative z-10 flex flex-col items-center max-w-sm w-full px-6 text-center"
          >
            {/* Logo Badge */}
            <div className="relative mb-6">
              <div className="absolute -inset-2 rounded-3xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 opacity-60 blur-md animate-pulse" />
              <div className="relative h-18 w-18 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-blue-500 flex items-center justify-center shadow-2xl ring-1 ring-white/30 border border-white/20">
                <span className="text-2xl font-black tracking-wider text-white font-sans">TS</span>
              </div>
            </div>

            {/* Application Title */}
            <h1 className="text-2xl font-bold tracking-tight text-white/95 font-sans mb-1">
              TS ORBIT
            </h1>
            <p className="text-xs text-blue-200/70 font-medium tracking-wide mb-6">
              سامانه پایش هوشمند و اتوماسیون پروژه‌ها
            </p>

            {/* React Bits Strands Ribbon Loader */}
            <div className="relative w-64 sm:w-80 h-20 overflow-hidden rounded-2xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-md flex items-center justify-center shadow-inner">
              <Strands
                colors={['#F97316', '#7C3AED', '#06B6D4']}
                count={3}
                speed={1.0}
                amplitude={0.75}
                waviness={1.0}
                thickness={0.6}
                glow={1.7}
                scale={1.2}
                intensity={0.65}
                saturation={1.8}
              />
            </div>

            {/* Loading Status Progress Bar */}
            <div className="w-48 h-1 bg-white/10 rounded-full mt-6 overflow-hidden">
              <motion.div
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ duration: durationMs / 1000, ease: 'easeInOut' }}
                className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-cyan-400 rounded-full"
              />
            </div>
            <span className="text-[11px] font-mono text-white/40 mt-2.5">
              بارگذاری منابع کارگاه دیجیتال...
            </span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default SplashScreen;
