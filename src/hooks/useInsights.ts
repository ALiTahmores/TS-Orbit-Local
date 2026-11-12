import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '../lib/api';
import { localISODate } from '../lib/dates';
import { useProject } from '../context/ProjectContext';

export type InsightKind = 'overview' | 'risks' | 'team';

/**
 * Workspace figures from /api/insights. They are reloaded whenever the
 * workspace's tasks or projects change (any edit, here or from a teammate), so a
 * figure never disagrees with the list beside it. The day is the viewer's own
 * calendar day, which decides what counts as overdue.
 */
export function useInsights<T = any>(kind: InsightKind, range = 7) {
  const { tasks, projects, activeWorkspaceId, isAuthenticated } = useProject();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const sequence = useRef(0);
  const load = useCallback(async () => {
    const id = ++sequence.current;
    try {
      const response = await apiFetch(`/api/insights/${kind}?range=${range}&today=${localISODate()}`);
      const value = await response.json();
      if (id === sequence.current) { setData(value); setError(''); }
    } catch (failure) {
      if (id === sequence.current) setError(failure instanceof Error ? failure.message : 'دریافت اطلاعات انجام نشد.');
    }
  }, [kind, range]);
  useEffect(() => { setData(null); }, [activeWorkspaceId, kind]);
  useEffect(() => {
    if (!isAuthenticated || !activeWorkspaceId) return;
    const timer = setTimeout(() => { void load(); }, 120);
    return () => clearTimeout(timer);
  }, [load, tasks, projects, activeWorkspaceId, isAuthenticated]);
  return { data, error, reload: load };
}
