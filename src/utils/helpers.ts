import { toPersianDigits } from './formatters';

export interface LevelInfo {
  levelNumber: number;
  levelTitle: string;
  minXP: number;
  maxXP: number;
  progressPercent: number;
  xpToNextLevel: number;
}

export const calculateUserLevel = (xp: number): LevelInfo => {
  let levelNumber = 1;
  let levelTitle = 'تازه‌کار';
  let minXP = 0;
  let maxXP = 500;

  if (xp >= 2000) {
    levelNumber = 5;
    levelTitle = 'استاد پروژه';
    minXP = 2000;
    maxXP = 3000;
  } else if (xp >= 1500) {
    levelNumber = 4;
    levelTitle = 'متخصص پیشرو';
    minXP = 1500;
    maxXP = 2000;
  } else if (xp >= 1000) {
    levelNumber = 3;
    levelTitle = 'ارشد متخصص';
    minXP = 1000;
    maxXP = 1500;
  } else if (xp >= 500) {
    levelNumber = 2;
    levelTitle = 'توسعه‌دهنده فعال';
    minXP = 500;
    maxXP = 1000;
  }

  const xpInCurrentLevel = xp - minXP;
  const levelRange = maxXP - minXP;
  const progressPercent = Math.min(100, Math.max(5, Math.round((xpInCurrentLevel / levelRange) * 100)));
  const xpToNextLevel = Math.max(0, maxXP - xp);

  return {
    levelNumber,
    levelTitle,
    minXP,
    maxXP,
    progressPercent,
    xpToNextLevel
  };
};

export const getJalaliToday = (): string => '1405/05/15';

export const isTaskOverdue = (deadline?: string, status?: string): boolean => {
  if (status === 'completed') return false;
  if (!deadline) return false;
  return deadline < getJalaliToday();
};

export const canUserAccessProject = (user: any, project: any): boolean => {
  if (!project) return false;
  if (!user) return true;

  const role = String(user.role || '').toUpperCase();
  if (role === 'OWNER' || role === 'ADMIN') {
    return true;
  }

  const userId = user.id ? String(user.id) : '';
  const userEmail = user.email ? String(user.email).trim() : '';
  const userName = user.name ? String(user.name).trim() : '';

  if (project.createdById && (String(project.createdById) === userId || String(project.createdById) === userEmail)) {
    return true;
  }
  if (project.creatorId && (String(project.creatorId) === userId || String(project.creatorId) === userEmail)) {
    return true;
  }

  if (project.leadId && (String(project.leadId) === userId || String(project.leadId) === userEmail)) {
    return true;
  }
  if (project.teamLeadId && (String(project.teamLeadId) === userId || String(project.teamLeadId) === userEmail)) {
    return true;
  }
  if (project.teamLead) {
    const leadStr = String(project.teamLead).trim();
    if (leadStr === userId || leadStr === userEmail || leadStr === userName || (userName && leadStr.includes(userName))) {
      return true;
    }
  }

  // Check assignedMemberIds
  const assignedMemberIds: any[] = Array.isArray(project.assignedMemberIds) ? project.assignedMemberIds : [];
  if (assignedMemberIds.some(m => {
    const mStr = typeof m === 'object' && m !== null ? String(m.id || m.name || '') : String(m).trim();
    return mStr === userId || mStr === userEmail || mStr === userName || (userName && mStr.includes(userName));
  })) {
    return true;
  }

  // Check assignedMembers
  const assignedMembers: any[] = Array.isArray(project.assignedMembers) ? project.assignedMembers : [];
  if (assignedMembers.some(m => {
    const mId = typeof m === 'object' && m !== null ? String(m.id || '') : String(m).trim();
    const mName = typeof m === 'object' && m !== null ? String(m.name || '') : String(m).trim();
    return mId === userId || mId === userEmail || mName === userName || (userName && mName.includes(userName));
  })) {
    return true;
  }

  // Check members
  const members: any[] = Array.isArray(project.members) ? project.members : [];
  if (members.some(m => {
    const mId = typeof m === 'object' && m !== null ? String(m.id || '') : String(m).trim();
    const mName = typeof m === 'object' && m !== null ? String(m.name || '') : String(m).trim();
    return mId === userId || mId === userEmail || mName === userName || (userName && mName.includes(userName));
  })) {
    return true;
  }

  const assignedTeams: string[] = Array.isArray(project.assignedTeamIds) ? project.assignedTeamIds : [];
  const userTeams: string[] = Array.isArray(user.teamIds) 
    ? user.teamIds 
    : [user.department, user.team, user.role].filter(Boolean);

  if (assignedTeams.length > 0 && userTeams.length > 0) {
    if (assignedTeams.some(t => userTeams.includes(t) || userTeams.some(ut => ut && t && (ut.includes(t) || t.includes(ut))))) {
      return true;
    }
  }

  return false;
};

export const canUserAccessNotification = (user: any, notification: any): boolean => {
  if (!notification) return false;
  if (!user) return true;

  const role = String(user.role || '').toUpperCase();
  if (role === 'OWNER' || role === 'ADMIN') return true;

  if (notification.recipientUserId) {
    const recId = String(notification.recipientUserId);
    const userId = user.id ? String(user.id) : '';
    const userEmail = user.email ? String(user.email) : '';
    return recId === userId || recId === userEmail;
  }

  if (notification.recipientRole) {
    return String(notification.recipientRole).toUpperCase() === role;
  }

  return true;
};
