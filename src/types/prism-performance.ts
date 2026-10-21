export type PerformanceProfile = 'HIGH' | 'MEDIUM' | 'LOW' | 'VERY_LOW' | 'STATIC';

export interface DeviceCapabilities {
  hardwareConcurrency: number;
  deviceMemory: number;
  isTouch: boolean;
  dpr: number;
  screenWidth: number;
  screenHeight: number;
  prefersReducedMotion: boolean;
  hasWebGL: boolean;
  hasWebGL2: boolean;
  initialProfile: PerformanceProfile;
}

export interface PrismPerformanceSettings {
  profile: PerformanceProfile;
  animationType: 'rotate' | 'hover' | '3drotate';
  timeScale: number;
  height: number;
  baseWidth: number;
  scale: number;
  hueShift: number;
  colorFrequency: number;
  noise: number;
  glow: number;
  dprCap: number;
  maxSteps: number;
  targetFps: number;
  isPaused: boolean;
  cardBackdropBlurClass: string;
  isTypingActive: boolean;
}
