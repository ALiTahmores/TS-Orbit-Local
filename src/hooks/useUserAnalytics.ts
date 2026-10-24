import { useMemo } from 'react';
import { useProject } from '../context/ProjectContext';
import { Task, Project } from '../types';
import { deliveredOnTime, isDueToday, isOverdue, tasksAssignedTo, todayISO } from '../lib/taskAnalytics';
import { priorityKey, statusKey } from '../lib/taskLabels';

export interface UserAnalyticsResult {
  userId: string;
  userName: string;
  userRole: string;
  userAvatar: string;

  totalMyTasks: number;
  activeTasksCount: number;
  completedTasksCount: number;
  overdueTasksCount: number;
  todayTasksCount: number;
  highPriorityTasksCount: number;
  pendingReviewsCount: number;
  blockedTasksCount: number;
  myProjectsCount: number;
  myFilesCount: number;
  unreadMessagesCount: number;

  myTasks: Task[];
  myProjects: Project[];

  /** Completed tasks that had a due date and were finished by it. */
  onTimeCompletedCount: number;
  /** Share of dated completed tasks finished on time; null until one exists. */
  onTimeDeliveryRate: number | null;
}

/** Metrics for one workspace member (default: the signed-in user), from real tasks only. */
export const useUserAnalytics = (targetUserId?: string): UserAnalyticsResult => {
  const { tasks = [], projects = [], files = [], notifications = [], teamMembers = [], currentUser } = useProject();

  const userId = targetUserId || currentUser?.id || '';
  const member = teamMembers.find(m => m.id === userId || (m as any).userId === userId);
  const userName = member?.name || (userId === currentUser?.id ? currentUser?.name : '') || '';
  const userRole = member?.role || (userId === currentUser?.id ? currentUser?.role : '') || '';
  const userAvatar = member?.avatar || (userId === currentUser?.id ? currentUser?.avatar : '') || '';

  return useMemo(() => {
    const today = todayISO();
    const myTasks = tasksAssignedTo(tasks, userId) as Task[];
    const byStatus = (key: ReturnType<typeof statusKey>) => myTasks.filter(task => statusKey(task.status) === key);
    const completed = byStatus('completed');
    const judged = completed.map(deliveredOnTime).filter((value): value is boolean => value !== undefined);
    const onTimeCompletedCount = judged.filter(Boolean).length;
    const myProjects = projects.filter(project => project && (
      project.teamLeadId === userId || (project as any).leadId === userId ||
      (project.assignedMemberIds || []).includes(userId) || myTasks.some(task => task.projectId === project.id)));

    return {
      userId, userName, userRole, userAvatar,
      totalMyTasks: myTasks.length,
      activeTasksCount: byStatus('pending').length + byStatus('inprogress').length,
      completedTasksCount: completed.length,
      overdueTasksCount: myTasks.filter(task => isOverdue(task, today)).length,
      todayTasksCount: myTasks.filter(task => isDueToday(task, today)).length,
      highPriorityTasksCount: myTasks.filter(task => ['critical', 'high'].includes(priorityKey(task.priority)) && !['completed', 'cancelled'].includes(statusKey(task.status))).length,
      pendingReviewsCount: byStatus('review').length,
      blockedTasksCount: byStatus('blocked').length,
      myProjectsCount: myProjects.length,
      myFilesCount: files.filter((file: any) => file && (file.uploadedById === userId || file.ownerId === userId)).length,
      unreadMessagesCount: notifications.filter(n => n && !n.read).length,
      myTasks, myProjects,
      onTimeCompletedCount,
      onTimeDeliveryRate: judged.length ? Math.round(onTimeCompletedCount / judged.length * 100) : null,
    };
  }, [tasks, projects, files, notifications, userId, userName, userRole, userAvatar]);
};
