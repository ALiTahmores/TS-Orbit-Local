import { useState, useEffect, useRef, useCallback } from 'react';

export interface UserActivityOptions {
  idleTimeoutMs?: number; // Time in ms after last interaction before user is considered idle (default 20000ms = 20s)
}

export interface UserActivityState {
  isUserActive: boolean;
  isFormFocused: boolean;
  lastActiveTime: number;
}

/**
 * useUserActivity - Tracks user interactions and active form focus
 * to avoid disruptive background updates or reloads while the user is actively working.
 */
export function useUserActivity(options?: UserActivityOptions): UserActivityState {
  const idleTimeoutMs = options?.idleTimeoutMs ?? 20000;
  
  const [isUserActive, setIsUserActive] = useState<boolean>(true);
  const [isFormFocused, setIsFormFocused] = useState<boolean>(false);
  const [lastActiveTime, setLastActiveTime] = useState<number>(() => Date.now());
  
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastEventTimeRef = useRef<number>(Date.now());

  // Check if any form input / editable element is currently focused
  const checkActiveElement = useCallback(() => {
    if (typeof document === 'undefined') return false;
    const activeEl = document.activeElement;
    if (!activeEl) return false;

    const tagName = activeEl.tagName.toUpperCase();
    const isInput = tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT';
    const isContentEditable = activeEl.getAttribute('contenteditable') === 'true' || 
                              activeEl.getAttribute('contenteditable') === '';
    const isInsideModal = !!activeEl.closest('[role="dialog"], .modal-container, form');

    const focused = isInput || isContentEditable || isInsideModal;
    setIsFormFocused(focused);
    return focused;
  }, []);

  const resetIdleTimer = useCallback(() => {
    const now = Date.now();
    lastEventTimeRef.current = now;
    setLastActiveTime(now);
    setIsUserActive(true);

    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }

    idleTimerRef.current = setTimeout(() => {
      // If form is still focused, user is still considered active
      const formStillFocused = checkActiveElement();
      if (!formStillFocused) {
        setIsUserActive(false);
      } else {
        // Re-arm timer while form is focused
        resetIdleTimer();
      }
    }, idleTimeoutMs);
  }, [idleTimeoutMs, checkActiveElement]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Events indicating user is actively interacting
    const activityEvents = [
      'mousedown',
      'mousemove',
      'keydown',
      'keyup',
      'touchstart',
      'touchmove',
      'scroll',
      'wheel',
      'input',
      'change',
      'paste',
      'drop'
    ];

    // Throttle event handling
    let lastHandled = 0;
    const handleActivity = (e: Event) => {
      const now = Date.now();
      checkActiveElement();

      // For typing/input events, immediately refresh activity without throttle
      if (e.type === 'keydown' || e.type === 'input' || e.type === 'change' || e.type === 'paste') {
        resetIdleTimer();
        lastHandled = now;
        return;
      }

      // Throttle passive events (mousemove/scroll) to every 1.5s
      if (now - lastHandled > 1500) {
        lastHandled = now;
        resetIdleTimer();
      }
    };

    const handleFocusIn = () => {
      checkActiveElement();
      resetIdleTimer();
    };

    const handleFocusOut = () => {
      setTimeout(checkActiveElement, 50);
    };

    // Initial check
    checkActiveElement();
    resetIdleTimer();

    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, handleActivity, { passive: true });
    });
    document.addEventListener('focusin', handleFocusIn, { passive: true });
    document.addEventListener('focusout', handleFocusOut, { passive: true });

    return () => {
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, handleActivity);
      });
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
    };
  }, [resetIdleTimer, checkActiveElement]);

  return {
    isUserActive: isUserActive || isFormFocused,
    isFormFocused,
    lastActiveTime
  };
}
