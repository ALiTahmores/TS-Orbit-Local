import { Task, Project, TeamMember, AppNotification, FileAsset } from '../types';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  timestamp: string;
}

export interface TaskApiPayload {
  title: string;
  description: string;
  assignedTo: string;
  projectId: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  department: string;
  deadline?: string;
}

export interface ProjectApiPayload {
  title: string;
  description: string;
  clientName: string;
  budget: string;
  deadline: string;
}

/**
 * Endpoint Definitions & Service Handlers for TS Orbit Backend/API
 */
export const API_ENDPOINTS = {
  TASKS: '/api/v1/tasks',
  PROJECTS: '/api/v1/projects',
  MEMBERS: '/api/v1/members',
  WORDPRESS_SYNC: '/api/v1/wordpress/sync',
  ANALYTICS: '/api/v1/analytics',
  NOTIFICATIONS: '/api/v1/notifications',
  FILES: '/api/v1/files'
} as const;

export class ApiClient {
  static async fetchTasks(): Promise<ApiResponse<Task[]>> {
    return {
      success: true,
      data: [],
      timestamp: new Date().toISOString()
    };
  }

  static async fetchProjects(): Promise<ApiResponse<Project[]>> {
    return {
      success: true,
      data: [],
      timestamp: new Date().toISOString()
    };
  }
}
