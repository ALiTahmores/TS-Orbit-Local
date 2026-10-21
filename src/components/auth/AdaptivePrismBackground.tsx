import React from 'react';
import { Prism } from '../ui/Prism';
import { useAdaptivePrismPerformance } from '../../hooks/useAdaptivePrismPerformance';
import { PerformanceProfile } from '../../types/prism-performance';

export interface AdaptivePrismBackgroundProps {
  forcedProfile?: PerformanceProfile;
  className?: string;
}

/**
 * AdaptivePrismBackground isolates the WebGL background rendering from the Auth Modal UI.
 * It provides continuous, uninterrupted shader animation across all devices (Desktop, Tablet, Mobile)
 * without re-mounting or resetting during form interactions.
 */
export const AdaptivePrismBackground: React.FC<AdaptivePrismBackgroundProps> = React.memo(({
  forcedProfile,
  className = ''
}) => {
  const { settings, reportFps } = useAdaptivePrismPerformance({
    forcedProfile
  });

  return (
    <>
      {/* ========================================================
          LAYER 0: ADAPTIVE PRISM 3D BACKGROUND (React Bits Component)
         ======================================================== */}
      <div
        className={`fixed inset-0 z-0 pointer-events-none overflow-hidden bg-[#090a0f] select-none ${className}`}
        aria-hidden="true"
      >
        <Prism
          animationType={settings.animationType}
          timeScale={settings.timeScale}
          height={settings.height}
          baseWidth={settings.baseWidth}
          scale={settings.scale}
          hueShift={settings.hueShift}
          colorFrequency={settings.colorFrequency}
          noise={settings.noise}
          glow={settings.glow}
          dprCap={settings.dprCap}
          maxSteps={settings.maxSteps}
          targetFps={settings.targetFps}
          isPaused={settings.isPaused}
          onFpsReport={reportFps}
          transparent={true}
          className="absolute inset-0 w-full h-full"
        />
      </div>

      {/* ========================================================
          LAYER 1: SUBTLE DARK VIGNETTE & READABILITY OVERLAY
         ======================================================== */}
      <div
        className="fixed inset-0 z-[1] pointer-events-none overflow-hidden select-none"
        aria-hidden="true"
      >
        {/* Deep dark atmospheric gradient with soft center transparency */}
        <div className="absolute inset-0 bg-[#090a0f]/40" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(9,10,15,0.2)_0%,rgba(9,10,15,0.75)_80%,rgba(9,10,15,0.95)_100%)]" />
      </div>
    </>
  );
});

AdaptivePrismBackground.displayName = 'AdaptivePrismBackground';

export default AdaptivePrismBackground;

