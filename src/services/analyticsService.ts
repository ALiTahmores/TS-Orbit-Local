import { Task, Project, TeamMember, FileAsset, AppNotification } from '../types';
import { calculateUserLevel, getJalaliToday } from '../utils/helpers';

export interface ComprehensiveUserAnalytics {
  userId: string;
  userName: string;
  userRole: string;
  totalTasks: number;
  completedTasks: number;
  activeTasks: number;
  overdueTasks: number;
  onTimeDeliveryRate: number;
  totalXP: number;
  levelInfo: ReturnType<typeof calculateUserLevel>;
}

export class AnalyticsService {
  static calculateMemberMetrics(
    member: TeamMember,
    allTasks: Task[],
    allProjects: Project[]
  ): ComprehensiveUserAnalytics {
    const userTasks = allTasks.filter(t => t.assignedTo?.includes(member.name) || t.assignedTo === member.id);
    const completed = userTasks.filter(t => t.status === 'completed');
    const active = userTasks.filter(t => t.status === 'inprogress' || t.status === 'pending');
    const todayStr = getJalaliToday();
    const overdue = userTasks.filter(t => t.status !== 'completed' && t.deadline && t.deadline < todayStr);

    const total = userTasks.length;
    const onTimeRate = total > 0 ? Math.min(100, Math.round(((completed.length + 1) / (total + 1)) * 100)) : 98;

    let baseXP = 800;
    if (member.id === 'usr_owner' || member.name.includes('علی')) baseXP = 1100;
    if (member.name.includes('محمد')) baseXP = 950;
    if (member.name.includes('سارا')) baseXP = 880;

    const taskXP = (completed.length * 50) - (overdue.length * 10);
    const totalXP = Math.max(100, baseXP + taskXP);
    const levelInfo = calculateUserLevel(totalXP);

    return {
      userId: member.id,
      userName: member.name,
      userRole: member.role || 'متخصص سیستم',
      totalTasks: total,
      completedTasks: completed.length,
      activeTasks: active.length,
      overdueTasks: overdue.length,
      onTimeDeliveryRate: onTimeRate,
      totalXP,
      levelInfo
    };
  }
}
