import { useCallback, useEffect, useRef, useState } from 'react';
import { useProject } from '../context/ProjectContext';
import { sprintCall, type SprintTask } from './useSprints';

export interface EpicProgress { tasks: number; done: number; inProgress: number; todo: number; blocked: number; points: number; donePoints: number; estimated: number; percent: number }
export interface Epic {
  id: string; key?: string; title: string; description: string; status: string; color: string; projectId: string; projectTitle: string;
  startDate: string; dueDate: string; owner: { id: string; name: string; avatar?: string } | null;
  progress: EpicProgress; types: { story: number; task: number; bug: number }; children: SprintTask[];
}
export interface EpicOverview { projectId: string | null; canWrite: boolean; epics: Epic[]; unassigned: { tasks: number; points: number }; candidates: SprintTask[] }

/** A project's epics with their progress; reloaded whenever tasks or projects change. */
export function useEpics(projectId: string) {
  const { tasks, projects, activeWorkspaceId, isAuthenticated } = useProject();
  const [data, setData] = useState<EpicOverview | null>(null);
  const [error, setError] = useState('');
  const sequence = useRef(0);
  const load = useCallback(async () => {
    if (!projectId) return;
    const id = ++sequence.current;
    try {
      const value = await sprintCall<EpicOverview>(`/api/epics?projectId=${encodeURIComponent(projectId)}`, 'GET');
      if (id === sequence.current) { setData(value); setError(''); }
    } catch (failure) {
      if (id === sequence.current) setError(failure instanceof Error ? failure.message : 'دریافت اپیک‌ها انجام نشد.');
    }
  }, [projectId]);
  useEffect(() => { setData(null); setError(''); }, [projectId, activeWorkspaceId]);
  useEffect(() => {
    if (!isAuthenticated || !activeWorkspaceId || !projectId) return;
    const timer = setTimeout(() => { void load(); }, 120);
    return () => clearTimeout(timer);
  }, [load, tasks, projects, activeWorkspaceId, isAuthenticated, projectId]);
  return { data, error, reload: load, setData };
}
