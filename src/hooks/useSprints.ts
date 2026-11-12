import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '../lib/api';
import { localISODate } from '../lib/dates';
import { useProject } from '../context/ProjectContext';

export type SprintState = 'future' | 'active' | 'closed';
export interface SprintPerson { id: string; name: string; avatar?: string }
export interface SprintTask {
  id: string; key?: string; title: string; status: string; priority: string; storyPoints: number | null;
  sprintId: string | null; dueDate: string; assignees: SprintPerson[];
}
export interface SprintStats { tasks: number; estimated: number; points: number; todoPoints: number; progressPoints: number; donePoints: number; doneTasks: number }
export interface Sprint {
  id: string; number: number; name: string; goal: string; state: SprintState; startDate: string; endDate: string;
  createdAt: string; startedAt: string | null; completedAt: string | null;
  report: { committedPoints: number; completedPoints: number; completedTasks: number; incompleteTasks: number } | null;
  stats?: SprintStats;
}
export interface SprintOverview {
  projectId: string; canManage: boolean; sprints: Sprint[]; closed: Sprint[]; tasks: SprintTask[];
  velocity: { sprints: { id: string; name: string; committed: number; completed: number }[]; average: number };
}
export interface ReportItem { id: string; key?: string; title: string; status: string; storyPoints: number | null; added: boolean }
export interface BurndownDay { day: string; remaining: number | null; scope: number | null; ideal: number }
export interface SprintReport {
  sprint: Sprint;
  summary: { committedPoints: number; committedTasks: number; addedPoints: number; addedTasks: number; removedTasks: number; completedPoints: number; completedTasks: number;
    remainingPoints: number; remainingTasks: number; completed: ReportItem[]; incomplete: ReportItem[] };
  burndown: { unit: 'points' | 'tasks'; committed: number; days: BurndownDay[] } | null;
}

/** The viewer's calendar, so "today" on a burndown is their day. */
export const clockQuery = () => `today=${localISODate()}&offset=${new Date().getTimezoneOffset()}`;

export async function sprintCall<T = any>(path: string, method: string, body?: unknown): Promise<T> {
  const response = await apiFetch(path, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return response.json();
}

/**
 * A project's sprints and planned work. Reloaded whenever tasks or projects change
 * (here or from a teammate), so the plan never disagrees with the boards.
 */
export function useSprints(projectId: string) {
  const { tasks, projects, activeWorkspaceId, isAuthenticated } = useProject();
  const [data, setData] = useState<SprintOverview | null>(null);
  const [error, setError] = useState('');
  const sequence = useRef(0);
  const load = useCallback(async () => {
    if (!projectId) return;
    const id = ++sequence.current;
    try {
      const value = await sprintCall<SprintOverview>(`/api/sprints?projectId=${encodeURIComponent(projectId)}&${clockQuery()}`, 'GET');
      if (id === sequence.current) { setData(value); setError(''); }
    } catch (failure) {
      if (id === sequence.current) setError(failure instanceof Error ? failure.message : 'دریافت اسپرینت‌ها انجام نشد.');
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

/** A sprint's report (burndown and summary); reloaded with the plan. */
export function useSprintReport(sprintId: string | null) {
  const { tasks, projects } = useProject();
  const [report, setReport] = useState<SprintReport | null>(null);
  const [error, setError] = useState('');
  const sequence = useRef(0);
  useEffect(() => { setReport(null); setError(''); }, [sprintId]);
  useEffect(() => {
    if (!sprintId) return;
    const id = ++sequence.current;
    const timer = setTimeout(() => {
      sprintCall<SprintReport>(`/api/sprints/${encodeURIComponent(sprintId)}/report?${clockQuery()}`, 'GET')
        .then(value => { if (id === sequence.current) { setReport(value); setError(''); } })
        .catch(failure => { if (id === sequence.current) setError(failure instanceof Error ? failure.message : 'دریافت گزارش انجام نشد.'); });
    }, 150);
    return () => clearTimeout(timer);
  }, [sprintId, tasks, projects]);
  return { report, error };
}

export const STATUS_GROUP: Record<string, 'todo' | 'progress' | 'done'> = { pending: 'todo', blocked: 'todo', inprogress: 'progress', review: 'progress', completed: 'done', cancelled: 'done' };
export const STATUS_LABEL: Record<string, string> = { pending: 'در انتظار', inprogress: 'در حال انجام', blocked: 'مسدود', review: 'در حال بررسی', completed: 'تکمیل‌شده', cancelled: 'لغوشده' };
export const isClosedStatus = (status: string) => STATUS_GROUP[status] === 'done';
