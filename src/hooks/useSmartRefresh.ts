import { apiFetch } from '../lib/api';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useUserActivity } from './useUserActivity';

export interface PendingUpdateInfo {
  id: string;
  title: { fa: string; en: string };
  description: { fa: string; en: string };
  type: 'data' | 'version' | 'assignment';
  timestamp: number;
}

export interface SmartRefreshOptions {
  onRefresh?: () => Promise<void> | void;
  checkIntervalMs?: number; // Check interval in ms (default 45000ms = 45s)
  enabled?: boolean;
}

export interface SmartRefreshResult {
  hasPendingUpdate: boolean;
  pendingUpdate: PendingUpdateInfo | null;
  isRefreshing: boolean;
  isUserActive: boolean;
  isFormFocused: boolean;
  triggerRefresh: () => Promise<void>;
  dismissUpdate: () => void;
  notifyUpdateAvailable: (info?: Partial<PendingUpdateInfo>) => void;
}

/**
 * useSmartRefresh - Manages non-disruptive updates and notifications.
 * If updates occur while the user is actively working/typing, it queues the update
 * as a subtle floating notification rather than triggering abrupt full-page reloads.
 */
export function useSmartRefresh(options?: SmartRefreshOptions): SmartRefreshResult {
  const { onRefresh, checkIntervalMs = 45000, enabled = true } = options || {};
  const { isUserActive, isFormFocused } = useUserActivity({ idleTimeoutMs: 20000 });

  const [hasPendingUpdate, setHasPendingUpdate] = useState<boolean>(false);
  const [pendingUpdate, setPendingUpdate] = useState<PendingUpdateInfo | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const lastServerCheckRef = useRef<number>(Date.now());
  const pendingUpdateRef = useRef<PendingUpdateInfo | null>(null);
  const isHealthCheckDisabledRef = useRef<boolean>(false);

  const notifyUpdateAvailable = useCallback((customInfo?: Partial<PendingUpdateInfo>) => {
    const info: PendingUpdateInfo = {
      id: customInfo?.id || `update_${Date.now()}`,
      title: customInfo?.title || {
        fa: 'بروزرسانی جدید در دسترس است',
        en: 'New updates available'
      },
      description: customInfo?.description || {
        fa: 'اطلاعات پروژه‌ها و وظایف تغییر یافته است.',
        en: 'Project and task data has been updated.'
      },
      type: customInfo?.type || 'data',
      timestamp: customInfo?.timestamp || Date.now()
    };

    pendingUpdateRef.current = info;
    setPendingUpdate(info);
    setHasPendingUpdate(true);
  }, []);

  const dismissUpdate = useCallback(() => {
    setHasPendingUpdate(false);
    setPendingUpdate(null);
    pendingUpdateRef.current = null;
  }, []);

  const triggerRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      if (onRefresh) {
        await onRefresh();
      }
      dismissUpdate();
    } catch (err) {
      console.error('Error executing smart data refresh:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [onRefresh, dismissUpdate]);

  // Periodic check for server updates / simulated sync checks
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const checkForUpdates = async () => {
      // Don't poll if update already flagged or health check is disabled
      if (hasPendingUpdate || isHealthCheckDisabledRef.current) return;

      try {
        const token = localStorage.getItem('token');
        const res = await apiFetch('/api/health', {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        if (res.status === 403) {
          // Disable periodic health check on 403 to eliminate console clutter
          isHealthCheckDisabledRef.current = true;
          return;
        }
        if (res.ok) {
          lastServerCheckRef.current = Date.now();
        }
      } catch {
        // network issue - do not disrupt user
      }
    };

    const intervalId = setInterval(checkForUpdates, checkIntervalMs);
    return () => clearInterval(intervalId);
  }, [enabled, checkIntervalMs, hasPendingUpdate]);

  return {
    hasPendingUpdate,
    pendingUpdate,
    isRefreshing,
    isUserActive,
    isFormFocused,
    triggerRefresh,
    dismissUpdate,
    notifyUpdateAvailable
  };
}
