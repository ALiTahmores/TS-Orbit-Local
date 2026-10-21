import React, { useEffect, useRef } from 'react';
import { Renderer, Triangle, Program, Mesh } from 'ogl';

export interface PrismProps {
  height?: number;
  baseWidth?: number;
  animationType?: 'rotate' | 'hover' | '3drotate';
  glow?: number;
  offset?: { x: number; y: number };
  noise?: number;
  transparent?: boolean;
  scale?: number;
  hueShift?: number;
  colorFrequency?: number;
  hoverStrength?: number;
  inertia?: number;
  bloom?: number;
  suspendWhenOffscreen?: boolean;
  timeScale?: number;
  className?: string;
  // Adaptive Performance Extensions
  dprCap?: number;
  maxSteps?: number;
  targetFps?: number;
  isPaused?: boolean;
  onFpsReport?: (avgFps: number, frameTimeMs: number) => void;
}

export const Prism: React.FC<PrismProps> = React.memo(({
  height = 3.5,
  baseWidth = 5.5,
  animationType = 'rotate',
  glow = 1,
  offset = { x: 0, y: 0 },
  noise = 0.5,
  transparent = true,
  scale = 3.6,
  hueShift = 0,
  colorFrequency = 1,
  hoverStrength = 2,
  inertia = 0.05,
  bloom = 1,
  suspendWhenOffscreen = false,
  timeScale = 0.5,
  className = 'w-full h-full relative',
  dprCap = 2.0,
  maxSteps = 100,
  targetFps = 60,
  isPaused = false,
  onFpsReport
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Keep latest mutable props in refs to avoid tearing down & recreating WebGL context!
  const propsRef = useRef({
    height,
    baseWidth,
    animationType,
    glow,
    offset,
    noise,
    transparent,
    scale,
    hueShift,
    colorFrequency,
    hoverStrength,
    inertia,
    bloom,
    timeScale,
    dprCap,
    maxSteps,
    targetFps,
    isPaused,
    onFpsReport
  });

  useEffect(() => {
    propsRef.current = {
      height,
      baseWidth,
      animationType,
      glow,
      offset,
      noise,
      transparent,
      scale,
      hueShift,
      colorFrequency,
      hoverStrength,
      inertia,
      bloom,
      timeScale,
      dprCap,
      maxSteps,
      targetFps,
      isPaused,
      onFpsReport
    };
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Detect prefers-reduced-motion
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Initialize DPR with cap
    const initialDpr = Math.min(
      window.devicePixelRatio || 1,
      propsRef.current.dprCap || 2.0
    );

    let renderer: Renderer;
    try {
      renderer = new Renderer({
        dpr: initialDpr,
        alpha: transparent,
        antialias: false,
        powerPreference: 'high-performance'
      });
    } catch (e) {
      console.warn('WebGL initialization failed for Prism:', e);
      return;
    }

    const gl = renderer.gl;
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.BLEND);

    if (gl.canvas && 'style' in gl.canvas) {
      Object.assign(gl.canvas.style, {
        position: 'absolute',
        inset: '0',
        width: '100%',
        height: '100%',
        display: 'block',
        pointerEvents: 'none'
      });
    }
    container.appendChild(gl.canvas);

    const vertex = /* glsl */ `
      attribute vec2 position;
      void main() {
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `;

    const fragment = /* glsl */ `
      precision highp float;

      uniform vec2  iResolution;
      uniform float iTime;

      uniform float uHeight;
      uniform float uBaseHalf;
      uniform mat3  uRot;
      uniform int   uUseBaseWobble;
      uniform float uGlow;
      uniform vec2  uOffsetPx;
      uniform float uNoise;
      uniform float uSaturation;
      uniform float uScale;
      uniform float uHueShift;
      uniform float uColorFreq;
      uniform float uBloom;
      uniform float uCenterShift;
      uniform float uInvBaseHalf;
      uniform float uInvHeight;
      uniform float uMinAxis;
      uniform float uPxScale;
      uniform float uTimeScale;
      uniform int   uSteps;

      vec4 tanh4(vec4 x){
        vec4 e2x = exp(2.0*x);
        return (e2x - 1.0) / (e2x + 1.0);
      }

      float rand(vec2 co){
        return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453123);
      }

      float sdOctaAnisoInv(vec3 p){
        vec3 q = vec3(abs(p.x) * uInvBaseHalf, abs(p.y) * uInvHeight, abs(p.z) * uInvBaseHalf);
        float m = q.x + q.y + q.z - 1.0;
        return m * uMinAxis * 0.5773502691896258;
      }

      float sdPyramidUpInv(vec3 p){
        float oct = sdOctaAnisoInv(p);
        float halfSpace = -p.y;
        return max(oct, halfSpace);
      }

      mat3 hueRotation(float a){
        float c = cos(a), s = sin(a);
        mat3 W = mat3(
          0.299, 0.587, 0.114,
          0.299, 0.587, 0.114,
          0.299, 0.587, 0.114
        );
        mat3 U = mat3(
           0.701, -0.587, -0.114,
          -0.299,  0.413, -0.114,
          -0.300, -0.588,  0.886
        );
        mat3 V = mat3(
           0.168, -0.331,  0.500,
           0.328,  0.035, -0.500,
          -0.497,  0.296,  0.201
        );
        return W + U * c + V * s;
      }

      void main(){
        vec2 f = (gl_FragCoord.xy - 0.5 * iResolution.xy - uOffsetPx) * uPxScale;

        float z = 5.0;
        float d = 0.0;

        vec3 p;
        vec4 o = vec4(0.0);

        float centerShift = uCenterShift;
        float cf = uColorFreq;

        mat2 wob = mat2(1.0);
        if (uUseBaseWobble == 1) {
          float t = iTime * uTimeScale;
          float c0 = cos(t + 0.0);
          float c1 = cos(t + 33.0);
          float c2 = cos(t + 11.0);
          wob = mat2(c0, c1, c2, c0);
        }

        const int MAX_STEPS = 100;
        for (int i = 0; i < MAX_STEPS; i++) {
          if (i >= uSteps) break;
          p = vec3(f, z);
          p.xz = p.xz * wob;
          p = uRot * p;
          vec3 q = p;
          q.y += centerShift;
          d = 0.1 + 0.2 * abs(sdPyramidUpInv(q));
          z -= d;
          o += (sin((p.y + z) * cf + vec4(0.0, 1.0, 2.0, 3.0)) + 1.0) / d;
        }

        o = tanh4(o * o * (uGlow * uBloom) / 1e5);

        vec3 col = o.rgb;
        if (uNoise > 0.0001) {
          float n = rand(gl_FragCoord.xy + vec2(iTime));
          col += (n - 0.5) * uNoise;
          col = clamp(col, 0.0, 1.0);
        }

        float L = dot(col, vec3(0.2126, 0.7152, 0.0722));
        col = clamp(mix(vec3(L), col, uSaturation), 0.0, 1.0);

        if(abs(uHueShift) > 0.0001){
          col = clamp(hueRotation(uHueShift) * col, 0.0, 1.0);
        }

        gl_FragColor = vec4(col, o.a);
      }
    `;

    const geometry = new Triangle(gl);
    const iResBuf = new Float32Array(2);
    const offsetPxBuf = new Float32Array(2);
    const rotBuf = new Float32Array(9);

    const initialP = propsRef.current;
    const initH = Math.max(0.001, initialP.height);
    const initBW = Math.max(0.001, initialP.baseWidth);
    const initBaseHalf = initBW * 0.5;
    const initScale = Math.max(0.001, initialP.scale);

    const program = new Program(gl, {
      vertex,
      fragment,
      uniforms: {
        iResolution: { value: iResBuf },
        iTime: { value: 0 },
        uHeight: { value: initH },
        uBaseHalf: { value: initBaseHalf },
        uUseBaseWobble: { value: 1 },
        uRot: { value: new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]) },
        uGlow: { value: Math.max(0, initialP.glow) },
        uOffsetPx: { value: offsetPxBuf },
        uNoise: { value: Math.max(0, initialP.noise) },
        uSaturation: { value: initialP.transparent ? 1.5 : 1 },
        uScale: { value: initScale },
        uHueShift: { value: initialP.hueShift || 0 },
        uColorFreq: { value: Math.max(0, initialP.colorFrequency || 1) },
        uBloom: { value: Math.max(0, initialP.bloom || 1) },
        uCenterShift: { value: initH * 0.25 },
        uInvBaseHalf: { value: 1 / initBaseHalf },
        uInvHeight: { value: 1 / initH },
        uMinAxis: { value: Math.min(initBaseHalf, initH) },
        uPxScale: {
          value: 1 / ((gl.drawingBufferHeight || 1) * 0.1 * initScale)
        },
        uTimeScale: { value: prefersReducedMotion ? 0 : initialP.timeScale },
        uSteps: { value: initialP.maxSteps || 100 }
      }
    });

    const mesh = new Mesh(gl, { geometry, program });

    let currentDpr = initialDpr;
    let lastWidth = 0;
    let lastHeight = 0;

    const resize = () => {
      const w = container.clientWidth || 1;
      const h = container.clientHeight || 1;

      // Avoid unnecessary reallocations if dimensions have not changed
      const targetDpr = Math.min(
        window.devicePixelRatio || 1,
        propsRef.current.dprCap || 2.0
      );

      if (w === lastWidth && h === lastHeight && Math.abs(currentDpr - targetDpr) < 0.01) {
        return;
      }

      lastWidth = w;
      lastHeight = h;
      currentDpr = targetDpr;

      renderer.dpr = targetDpr;
      renderer.setSize(w, h);

      iResBuf[0] = gl.drawingBufferWidth;
      iResBuf[1] = gl.drawingBufferHeight;

      const offX = propsRef.current.offset?.x ?? 0;
      const offY = propsRef.current.offset?.y ?? 0;
      offsetPxBuf[0] = offX * targetDpr;
      offsetPxBuf[1] = offY * targetDpr;

      const sc = Math.max(0.001, propsRef.current.scale);
      program.uniforms.uPxScale.value = 1 / ((gl.drawingBufferHeight || 1) * 0.1 * sc);
    };

    let resizeTimer: NodeJS.Timeout | null = null;
    const debouncedResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resize, 40);
    };

    const ro = new ResizeObserver(debouncedResize);
    ro.observe(container);
    resize();

    const setMat3FromEuler = (yawY: number, pitchX: number, rollZ: number, out: Float32Array) => {
      const cy = Math.cos(yawY), sy = Math.sin(yawY);
      const cx = Math.cos(pitchX), sx = Math.sin(pitchX);
      const cz = Math.cos(rollZ), sz = Math.sin(rollZ);

      out[0] = cy * cz + sy * sx * sz;
      out[1] = cx * sz;
      out[2] = -sy * cz + cy * sx * sz;
      out[3] = -cy * sz + sy * sx * cz;
      out[4] = cx * cz;
      out[5] = sy * sz + cy * sx * cz;
      out[6] = sy * cx;
      out[7] = -sx;
      out[8] = cy * cx;
      return out;
    };

    let raf = 0;
    let isVisible = true;
    let isIntersecting = true;
    const t0 = performance.now();
    let lastRenderTime = performance.now();

    // FPS performance tracking window (rolling 40 frames)
    let frameCount = 0;
    let frameTimeSum = 0;
    let lastFpsReportTime = performance.now();

    const startRAF = () => {
      if (raf || !isVisible || !isIntersecting) return;
      raf = requestAnimationFrame(render);
    };

    const stopRAF = () => {
      if (!raf) return;
      cancelAnimationFrame(raf);
      raf = 0;
    };

    // Page Visibility API - pause completely when tab is hidden
    const handleVisibilityChange = () => {
      isVisible = document.visibilityState === 'visible';
      if (isVisible) {
        lastRenderTime = performance.now();
        startRAF();
      } else {
        stopRAF();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const rnd = () => Math.random();
    const wX = 0.3 + rnd() * 0.6;
    const wY = 0.2 + rnd() * 0.7;
    const wZ = 0.1 + rnd() * 0.5;
    const phX = rnd() * Math.PI * 2;
    const phZ = rnd() * Math.PI * 2;

    let yaw = 0, pitch = 0, roll = 0;
    let targetYaw = 0, targetPitch = 0;
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    const pointer = { x: 0, y: 0, inside: true };
    const onMove = (e: PointerEvent) => {
      const ww = Math.max(1, window.innerWidth);
      const wh = Math.max(1, window.innerHeight);
      const cx = ww * 0.5;
      const cy = wh * 0.5;
      pointer.x = Math.max(-1, Math.min(1, (e.clientX - cx) / cx));
      pointer.y = Math.max(-1, Math.min(1, (e.clientY - cy) / cy));
      pointer.inside = true;
    };
    const onLeave = () => { pointer.inside = false; };
    const onBlur = () => { pointer.inside = false; };

    let onPointerMove: ((e: PointerEvent) => void) | null = null;
    if (animationType === 'hover') {
      onPointerMove = (e: PointerEvent) => {
        onMove(e);
        startRAF();
      };
      window.addEventListener('pointermove', onPointerMove, { passive: true });
      window.addEventListener('mouseleave', onLeave);
      window.addEventListener('blur', onBlur);
      program.uniforms.uUseBaseWobble.value = 0;
    } else if (animationType === '3drotate') {
      program.uniforms.uUseBaseWobble.value = 0;
    } else {
      program.uniforms.uUseBaseWobble.value = 1;
    }

    const render = (now: number) => {
      const p = propsRef.current;
      const targetInterval = 1000 / (p.targetFps || 60);
      const delta = now - lastRenderTime;

      // Frame rate throttling for battery / low-tier devices
      if (delta < targetInterval - 1.5 && p.targetFps < 60) {
        raf = requestAnimationFrame(render);
        return;
      }

      const frameDuration = delta;
      lastRenderTime = now;

      // Track FPS statistics
      frameCount++;
      frameTimeSum += frameDuration;
      if (now - lastFpsReportTime >= 1500) {
        if (p.onFpsReport && frameCount > 0) {
          const avgFrameTime = frameTimeSum / frameCount;
          const avgFps = Math.min(60, 1000 / Math.max(1, avgFrameTime));
          p.onFpsReport(avgFps, avgFrameTime);
        }
        frameCount = 0;
        frameTimeSum = 0;
        lastFpsReportTime = now;
      }

      // Sync uniforms on the fly from current mutable props
      const H = Math.max(0.001, p.height);
      const BW = Math.max(0.001, p.baseWidth);
      const baseHalf = BW * 0.5;
      const sc = Math.max(0.001, p.scale);
      const effectiveTS = prefersReducedMotion || p.isPaused ? 0 : p.timeScale;

      program.uniforms.uHeight.value = H;
      program.uniforms.uBaseHalf.value = baseHalf;
      program.uniforms.uGlow.value = Math.max(0, p.glow);
      program.uniforms.uNoise.value = Math.max(0, p.noise);
      program.uniforms.uSaturation.value = p.transparent ? 1.5 : 1;
      program.uniforms.uScale.value = sc;
      program.uniforms.uHueShift.value = p.hueShift || 0;
      program.uniforms.uColorFreq.value = Math.max(0, p.colorFrequency || 1);
      program.uniforms.uBloom.value = Math.max(0, p.bloom || 1);
      program.uniforms.uCenterShift.value = H * 0.25;
      program.uniforms.uInvBaseHalf.value = 1 / baseHalf;
      program.uniforms.uInvHeight.value = 1 / H;
      program.uniforms.uMinAxis.value = Math.min(baseHalf, H);
      program.uniforms.uTimeScale.value = effectiveTS;
      program.uniforms.uSteps.value = p.maxSteps || 100;

      const time = (now - t0) * 0.001;
      program.uniforms.iTime.value = time;

      let continueRAF = true;

      if (p.animationType === 'hover') {
        const hovStr = Math.max(0, p.hoverStrength || 1);
        const inert = Math.max(0, Math.min(1, p.inertia || 0.12));
        targetYaw = (pointer.inside ? -pointer.x : 0) * (0.6 * hovStr);
        targetPitch = (pointer.inside ? pointer.y : 0) * (0.6 * hovStr);
        yaw = lerp(yaw, targetYaw, inert);
        pitch = lerp(pitch, targetPitch, inert);
        roll = lerp(roll, 0, 0.1);
        program.uniforms.uRot.value = setMat3FromEuler(yaw, pitch, roll, rotBuf);

        if (p.noise < 1e-6) {
          const settled =
            Math.abs(yaw - targetYaw) < 1e-4 &&
            Math.abs(pitch - targetPitch) < 1e-4 &&
            Math.abs(roll) < 1e-4;
          if (settled) continueRAF = false;
        }
      } else if (p.animationType === '3drotate') {
        const tScaled = time * effectiveTS;
        yaw = tScaled * wY;
        pitch = Math.sin(tScaled * wX + phX) * 0.6;
        roll = Math.sin(tScaled * wZ + phZ) * 0.5;
        program.uniforms.uRot.value = setMat3FromEuler(yaw, pitch, roll, rotBuf);
        if (effectiveTS < 1e-6 || p.isPaused) continueRAF = false;
      } else {
        rotBuf[0] = 1; rotBuf[1] = 0; rotBuf[2] = 0;
        rotBuf[3] = 0; rotBuf[4] = 1; rotBuf[5] = 0;
        rotBuf[6] = 0; rotBuf[7] = 0; rotBuf[8] = 1;
        program.uniforms.uRot.value = rotBuf;
        if (effectiveTS < 1e-6 || p.isPaused) continueRAF = false;
      }

      renderer.render({ scene: mesh });

      if (continueRAF && !p.isPaused) {
        raf = requestAnimationFrame(render);
      } else {
        raf = 0;
      }
    };

    if (suspendWhenOffscreen) {
      const io = new IntersectionObserver((entries) => {
        isIntersecting = entries.some((e) => e.isIntersecting);
        if (isIntersecting) startRAF();
        else stopRAF();
      });
      io.observe(container);
      startRAF();
      (container as unknown as { __prismIO?: IntersectionObserver }).__prismIO = io;
    } else {
      startRAF();
    }

    return () => {
      stopRAF();
      if (resizeTimer) clearTimeout(resizeTimer);
      ro.disconnect();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (animationType === 'hover') {
        if (onPointerMove) window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('mouseleave', onLeave);
        window.removeEventListener('blur', onBlur);
      }
      if (suspendWhenOffscreen) {
        const io = (container as unknown as { __prismIO?: IntersectionObserver }).__prismIO;
        if (io) io.disconnect();
        delete (container as unknown as { __prismIO?: IntersectionObserver }).__prismIO;
      }
      if (gl.canvas.parentElement === container) {
        container.removeChild(gl.canvas);
      }
    };
  }, [animationType, suspendWhenOffscreen, transparent]);

  return <div className={className} ref={containerRef} />;
});

Prism.displayName = 'Prism';

export default Prism;
