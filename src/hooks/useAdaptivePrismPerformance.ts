import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { PerformanceProfile, DeviceCapabilities, PrismPerformanceSettings } from '../types/prism-performance';

/**
 * Detect initial device capability profile using a multi-factor score.
 * Tailored for Desktop (HIGH), Tablet (MEDIUM), Mobile (LOW), and Reduced-Motion (STATIC).
 */
export function detectDeviceCapabilities(): DeviceCapabilities {
  if (typeof window === 'undefined') {
    return {
      hardwareConcurrency: 4,
      deviceMemory: 4,
      isTouch: false,
      dpr: 1,
      screenWidth: 1024,
      screenHeight: 768,
      prefersReducedMotion: false,
      hasWebGL: true,
      hasWebGL2: true,
      initialProfile: 'HIGH'
    };
  }

  const hardwareConcurrency = navigator.hardwareConcurrency || 4;
  const deviceMemory = (navigator as unknown as { deviceMemory?: number }).deviceMemory || 4;
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const dpr = window.devicePixelRatio || 1;
  const screenWidth = window.innerWidth || 1024;
  const screenHeight = window.innerHeight || 768;
  const prefersReducedMotion = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

  // Test WebGL support
  let hasWebGL = false;
  let hasWebGL2 = false;
  try {
    const canvas = document.createElement('canvas');
    hasWebGL2 = !!(window.WebGL2RenderingContext && canvas.getContext('webgl2'));
    hasWebGL = hasWebGL2 || !!(window.WebGLRenderingContext && (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
  } catch {
    hasWebGL = false;
    hasWebGL2 = false;
  }

  // Capability scoring algorithm
  let profile: PerformanceProfile = 'HIGH';

  if (prefersReducedMotion || !hasWebGL) {
    profile = 'STATIC';
  } else {
    // Screen dimension & form factor classification
    const isMobileSize = screenWidth < 640;
    const isTabletSize = (screenWidth >= 640 && screenWidth < 1024) || (isTouch && screenWidth < 1024);

    if (isMobileSize) {
      profile = 'LOW';
    } else if (isTabletSize) {
      profile = 'MEDIUM';
    } else {
      // Desktop / Laptop
      profile = 'HIGH';
    }
  }

  return {
    hardwareConcurrency,
    deviceMemory,
    isTouch,
    dpr,
    screenWidth,
    screenHeight,
    prefersReducedMotion,
    hasWebGL,
    hasWebGL2,
    initialProfile: profile
  };
}

/**
 * Maps performance profiles to exact Prism parameters & render bounds.
 * Maintains the exact approved visual appearance across all devices while scaling GPU cost appropriately.
 */
export function getProfileSettings(profile: PerformanceProfile, dpr: number): Omit<PrismPerformanceSettings, 'profile' | 'isTypingActive'> {
  switch (profile) {
    case 'HIGH':
      return {
        animationType: 'rotate',
        timeScale: 0.18,
        height: 3.5,
        baseWidth: 5.5,
        scale: 3.6,
        hueShift: 0,
        colorFrequency: 0.65,
        noise: 0.03,
        glow: 0.65,
        dprCap: Math.min(dpr, 2.0),
        maxSteps: 100,
        targetFps: 60,
        isPaused: false,
        cardBackdropBlurClass: 'backdrop-blur-2xl md:backdrop-blur-3xl'
      };

    case 'MEDIUM':
      // Tablet profile: light GPU cost, visually identical color saturation
      return {
        animationType: 'rotate',
        timeScale: 0.18,
        height: 3.5,
        baseWidth: 5.5,
        scale: 3.6,
        hueShift: 0,
        colorFrequency: 0.65,
        noise: 0.02,
        glow: 0.65,
        dprCap: Math.min(dpr, 1.5),
        maxSteps: 75,
        targetFps: 60,
        isPaused: false,
        cardBackdropBlurClass: 'backdrop-blur-xl md:backdrop-blur-2xl'
      };

    case 'LOW':
    case 'VERY_LOW':
      // Mobile profile: capped DPR to prevent fillrate bottlenecks on retina mobile screens
      return {
        animationType: 'rotate',
        timeScale: 0.18,
        height: 3.5,
        baseWidth: 5.5,
        scale: 3.6,
        hueShift: 0,
        colorFrequency: 0.65,
        noise: 0.01,
        glow: 0.65,
        dprCap: Math.min(dpr, 1.25),
        maxSteps: 55,
        targetFps: 60,
        isPaused: false,
        cardBackdropBlurClass: 'backdrop-blur-lg md:backdrop-blur-xl'
      };

    case 'STATIC':
    default:
      return {
        animationType: 'rotate',
        timeScale: 0,
        height: 3.5,
        baseWidth: 5.5,
        scale: 3.6,
        hueShift: 0,
        colorFrequency: 0.65,
        noise: 0.0,
        glow: 0.65,
        dprCap: 1.0,
        maxSteps: 50,
        targetFps: 1,
        isPaused: false,
        cardBackdropBlurClass: 'backdrop-blur-md md:backdrop-blur-lg'
      };
  }
}

export interface UseAdaptivePrismPerformanceOptions {
  enabled?: boolean;
  forcedProfile?: PerformanceProfile;
}

export function useAdaptivePrismPerformance(options: UseAdaptivePrismPerformanceOptions = {}) {
  const { enabled = true, forcedProfile } = options;

  const [capabilities] = useState<DeviceCapabilities>(() => detectDeviceCapabilities());
  const [profile, setProfile] = useState<PerformanceProfile>(() => forcedProfile || capabilities.initialProfile);

  // References for runtime performance monitoring with hysteresis
  const lastProfileChangeRef = useRef<number>(Date.now());
  const sustainedSlowCountRef = useRef<number>(0);

  // Listen to prefers-reduced-motion dynamically
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

    const handleChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setProfile('STATIC');
      } else {
        setProfile(capabilities.initialProfile);
      }
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [capabilities.initialProfile]);

  /**
   * Runtime FPS reporting callback from Prism WebGL loop.
   * Only steps down DPR if severe sustained drops happen on low-tier hardware.
   */
  const reportFps = useCallback((avgFps: number, frameTimeMs: number) => {
    if (!enabled || forcedProfile) return;

    const now = Date.now();
    const timeSinceLastChange = now - lastProfileChangeRef.current;

    // Check for severe sustained frame rate degradation (FPS < 18 or frame time > 55ms)
    if (avgFps < 18 || frameTimeMs > 55) {
      sustainedSlowCountRef.current += 1;
    } else {
      sustainedSlowCountRef.current = Math.max(0, sustainedSlowCountRef.current - 1);
    }

    // Downgrade after ~4 seconds of sustained poor performance (cooldown 6s)
    if (sustainedSlowCountRef.current >= 5 && timeSinceLastChange > 6000) {
      setProfile((current) => {
        let next: PerformanceProfile = current;
        if (current === 'HIGH') next = 'MEDIUM';
        else if (current === 'MEDIUM') next = 'LOW';

        if (next !== current) {
          lastProfileChangeRef.current = now;
          sustainedSlowCountRef.current = 0;
        }
        return next;
      });
    }
  }, [enabled, forcedProfile]);

  const activeProfile = forcedProfile || profile;
  const baseSettings = useMemo(
    () => getProfileSettings(activeProfile, capabilities.dpr),
    [activeProfile, capabilities.dpr]
  );

  const computedSettings: PrismPerformanceSettings = useMemo(() => {
    return {
      ...baseSettings,
      profile: activeProfile,
      isTypingActive: false
    };
  }, [baseSettings, activeProfile]);

  return {
    profile: activeProfile,
    capabilities,
    settings: computedSettings,
    reportFps,
    setProfile,
    isTypingActive: false
  };
}

export default useAdaptivePrismPerformance;
