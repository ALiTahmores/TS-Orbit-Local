import React, { useEffect, useState } from 'react';
import Strands, { StrandsProps } from '../ui/Strands';
import { cn } from '../../lib/utils';

export type LoaderVariant = 'button' | 'button-wide' | 'workspace' | 'section' | 'page' | 'modal' | 'inline' | 'card';
export type StrandsLoaderVariant = LoaderVariant;

export interface StrandsLoaderProps {
  active?: boolean;
  variant?: LoaderVariant;
  message?: string;
  text?: string;
  className?: string;
  textClassName?: string;
  colors?: string[];
  count?: number;
  speed?: number;
  glow?: number;
  scale?: number;
  thickness?: number;
  strandsProps?: Partial<StrandsProps>;
}

// Tight, focused volumetric ribbon config (Orange, Violet, Cyan) with 1.0 fluid speed
export const OFFICIAL_STRANDS_CONFIG = {
  colors: ['#F97316', '#7C3AED', '#06B6D4'],
  count: 3,
  speed: 1.0,
  amplitude: 0.75,
  waviness: 1.0,
  thickness: 0.6,
  glow: 1.7,
  taper: 3.2,
  spread: 0.9,
  intensity: 0.65,
  saturation: 1.8,
  opacity: 1,
  scale: 1.2,
  glass: false,
  refraction: 1,
  dispersion: 1,
  glassSize: 1,
};

export const StrandsLoader: React.FC<StrandsLoaderProps> = ({
  active = true,
  variant = 'workspace',
  message,
  text,
  className = '',
  textClassName = '',
  colors,
  count,
  speed,
  glow,
  scale,
  thickness,
  strandsProps = {}
}) => {
  if (!active) return null;

  const displayMessage = message || text;
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const listener = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, []);

  const motionSpeedModifier = prefersReducedMotion ? 0.1 : 1;

  // 1. Workspace Transition: Tight, focused halo, zero vertical clipping
  if (variant === 'workspace' || variant === 'page') {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        className={cn(
          'w-full min-h-[400px] py-4 flex flex-col items-center justify-center gap-3 animate-in fade-in duration-300 pointer-events-none select-none overflow-hidden rounded-[inherit]',
          className
        )}
      >
        {/* Focused Canvas: Glow stays concentrated in the center without bleeding to edges */}
        <div className="w-[520px] max-w-[90vw] h-[240px] relative flex items-center justify-center pointer-events-none">
          <Strands
            colors={colors || OFFICIAL_STRANDS_CONFIG.colors}
            count={count ?? OFFICIAL_STRANDS_CONFIG.count}
            speed={(speed ?? OFFICIAL_STRANDS_CONFIG.speed) * motionSpeedModifier}
            amplitude={OFFICIAL_STRANDS_CONFIG.amplitude}
            waviness={OFFICIAL_STRANDS_CONFIG.waviness}
            thickness={thickness ?? OFFICIAL_STRANDS_CONFIG.thickness}
            glow={glow ?? OFFICIAL_STRANDS_CONFIG.glow}
            taper={OFFICIAL_STRANDS_CONFIG.taper}
            spread={OFFICIAL_STRANDS_CONFIG.spread}
            intensity={OFFICIAL_STRANDS_CONFIG.intensity}
            saturation={OFFICIAL_STRANDS_CONFIG.saturation}
            opacity={OFFICIAL_STRANDS_CONFIG.opacity}
            scale={scale ?? OFFICIAL_STRANDS_CONFIG.scale}
            glass={OFFICIAL_STRANDS_CONFIG.glass}
            refraction={OFFICIAL_STRANDS_CONFIG.refraction}
            dispersion={OFFICIAL_STRANDS_CONFIG.dispersion}
            glassSize={OFFICIAL_STRANDS_CONFIG.glassSize}
            className="w-full h-full"
            {...strandsProps}
          />
        </div>
        {displayMessage && (
          <span
            className={cn(
              'text-xs font-semibold text-slate-400 dark:text-slate-500 tracking-wider font-mono animate-pulse text-center',
              textClassName
            )}
          >
            {displayMessage}
          </span>
        )}
        <span className="sr-only">{displayMessage || 'Loading workspace...'}</span>
      </div>
    );
  }

  // 2. Button Variant
  if (variant === 'button-wide' || variant === 'button') {
    return (
      <div
        role="status"
        aria-busy="true"
        className={cn(
          'absolute inset-0 w-full h-full flex items-center justify-center pointer-events-none overflow-hidden rounded-[inherit] select-none z-10',
          className
        )}
      >
        <div className="w-[120px] h-[48px] relative flex items-center justify-center">
          <Strands
            colors={colors || OFFICIAL_STRANDS_CONFIG.colors}
            count={count ?? OFFICIAL_STRANDS_CONFIG.count}
            speed={(speed ?? 1.0) * motionSpeedModifier}
            amplitude={0.65}
            waviness={1.0}
            thickness={thickness ?? 0.5}
            glow={glow ?? 1.6}
            taper={2.6}
            spread={0.8}
            intensity={0.6}
            saturation={1.8}
            opacity={1}
            scale={scale ?? 1.0}
            glass={false}
            refraction={1}
            dispersion={1}
            glassSize={1}
            className="w-full h-full"
            {...strandsProps}
          />
        </div>
        {displayMessage && (
          <span
            className={cn(
              'absolute inset-0 flex items-center justify-center text-xs font-semibold text-white tracking-wide truncate leading-none drop-shadow-md z-20 pointer-events-none',
              textClassName
            )}
          >
            {displayMessage}
          </span>
        )}
        <span className="sr-only">{displayMessage || 'Loading...'}</span>
      </div>
    );
  }

  // 3. Modal Content Loader
  if (variant === 'modal') {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        className={cn('relative w-full flex flex-col items-center justify-center p-4 text-center select-none gap-2 overflow-hidden rounded-[inherit]', className)}
      >
        <div className="w-[380px] max-w-[95%] h-[180px] relative pointer-events-none flex items-center justify-center">
          <Strands
            colors={colors || OFFICIAL_STRANDS_CONFIG.colors}
            count={count ?? OFFICIAL_STRANDS_CONFIG.count}
            speed={(speed ?? OFFICIAL_STRANDS_CONFIG.speed) * motionSpeedModifier}
            amplitude={OFFICIAL_STRANDS_CONFIG.amplitude}
            waviness={OFFICIAL_STRANDS_CONFIG.waviness}
            thickness={thickness ?? OFFICIAL_STRANDS_CONFIG.thickness}
            glow={glow ?? OFFICIAL_STRANDS_CONFIG.glow}
            taper={OFFICIAL_STRANDS_CONFIG.taper}
            spread={OFFICIAL_STRANDS_CONFIG.spread}
            intensity={OFFICIAL_STRANDS_CONFIG.intensity}
            saturation={OFFICIAL_STRANDS_CONFIG.saturation}
            opacity={OFFICIAL_STRANDS_CONFIG.opacity}
            scale={scale ?? OFFICIAL_STRANDS_CONFIG.scale}
            glass={OFFICIAL_STRANDS_CONFIG.glass}
            refraction={OFFICIAL_STRANDS_CONFIG.refraction}
            dispersion={OFFICIAL_STRANDS_CONFIG.dispersion}
            glassSize={OFFICIAL_STRANDS_CONFIG.glassSize}
            className="w-full h-full"
            {...strandsProps}
          />
        </div>
        {displayMessage && (
          <p className={cn('text-xs font-medium text-slate-600 dark:text-slate-300 font-sans', textClassName)}>
            {displayMessage}
          </p>
        )}
        <span className="sr-only">{displayMessage || 'Loading modal content...'}</span>
      </div>
    );
  }

  // 4. Inline Loader
  if (variant === 'inline') {
    return (
      <div
        role="status"
        aria-busy="true"
        className={cn('inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 select-none overflow-hidden rounded-[inherit]', className)}
      >
        <div className="relative w-[60px] h-[28px] shrink-0 pointer-events-none flex items-center justify-center">
          <Strands
            colors={colors || OFFICIAL_STRANDS_CONFIG.colors}
            count={count ?? OFFICIAL_STRANDS_CONFIG.count}
            speed={(speed ?? OFFICIAL_STRANDS_CONFIG.speed) * motionSpeedModifier}
            amplitude={OFFICIAL_STRANDS_CONFIG.amplitude}
            waviness={OFFICIAL_STRANDS_CONFIG.waviness}
            thickness={thickness ?? OFFICIAL_STRANDS_CONFIG.thickness}
            glow={glow ?? OFFICIAL_STRANDS_CONFIG.glow}
            taper={OFFICIAL_STRANDS_CONFIG.taper}
            spread={OFFICIAL_STRANDS_CONFIG.spread}
            intensity={OFFICIAL_STRANDS_CONFIG.intensity}
            saturation={OFFICIAL_STRANDS_CONFIG.saturation}
            opacity={OFFICIAL_STRANDS_CONFIG.opacity}
            scale={scale ?? OFFICIAL_STRANDS_CONFIG.scale}
            glass={OFFICIAL_STRANDS_CONFIG.glass}
            refraction={OFFICIAL_STRANDS_CONFIG.refraction}
            dispersion={OFFICIAL_STRANDS_CONFIG.dispersion}
            glassSize={OFFICIAL_STRANDS_CONFIG.glassSize}
            className="w-full h-full"
            {...strandsProps}
          />
        </div>
        {displayMessage && <span className={cn('text-[11px] font-medium leading-none', textClassName)}>{displayMessage}</span>}
        <span className="sr-only">{displayMessage || 'Loading...'}</span>
      </div>
    );
  }

  // 5. Generic Section / Card Loader
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn('relative w-full h-full min-h-[200px] flex flex-col items-center justify-center p-3 select-none overflow-hidden rounded-[inherit]', className)}
    >
      <div className="w-[440px] max-w-[95%] h-[200px] relative pointer-events-none flex items-center justify-center">
        <Strands
          colors={colors || OFFICIAL_STRANDS_CONFIG.colors}
          count={count ?? OFFICIAL_STRANDS_CONFIG.count}
          speed={(speed ?? OFFICIAL_STRANDS_CONFIG.speed) * motionSpeedModifier}
          amplitude={OFFICIAL_STRANDS_CONFIG.amplitude}
          waviness={OFFICIAL_STRANDS_CONFIG.waviness}
          thickness={thickness ?? OFFICIAL_STRANDS_CONFIG.thickness}
          glow={glow ?? OFFICIAL_STRANDS_CONFIG.glow}
          taper={OFFICIAL_STRANDS_CONFIG.taper}
          spread={OFFICIAL_STRANDS_CONFIG.spread}
          intensity={OFFICIAL_STRANDS_CONFIG.intensity}
          saturation={OFFICIAL_STRANDS_CONFIG.saturation}
          opacity={OFFICIAL_STRANDS_CONFIG.opacity}
          scale={scale ?? OFFICIAL_STRANDS_CONFIG.scale}
          glass={OFFICIAL_STRANDS_CONFIG.glass}
          refraction={OFFICIAL_STRANDS_CONFIG.refraction}
          dispersion={OFFICIAL_STRANDS_CONFIG.dispersion}
          glassSize={OFFICIAL_STRANDS_CONFIG.glassSize}
          className="w-full h-full"
          {...strandsProps}
        />
      </div>
      {displayMessage && (
        <span className={cn('text-xs text-slate-400 dark:text-slate-400 mt-2 font-sans text-center', textClassName)}>
          {displayMessage}
        </span>
      )}
      <span className="sr-only">{displayMessage || 'Loading section...'}</span>
    </div>
  );
};

export interface ScopedStrandsLoaderProps extends StrandsLoaderProps {
  active?: boolean;
}

export const ScopedStrandsLoader: React.FC<ScopedStrandsLoaderProps> = ({
  active = true,
  ...props
}) => {
  if (!active) return null;
  return <StrandsLoader {...props} />;
};

export default StrandsLoader;
