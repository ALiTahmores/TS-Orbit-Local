import { useMemo } from 'react';
import { useProject } from '../context/ProjectContext';
import { Task, TaskStatus } from '../types';

export const useTasks = (assignedToFilter?: string) => {
  const { tasks = [], addTask, updateTaskStatus, deleteTask, currentUser } = useProject();

  const userTasks = useMemo(() => {
    const safeTasks = tasks || [];
    if (!assignedToFilter) return safeTasks;
    return safeTasks.filter(t => t && t.assignedTo?.toLowerCase().includes(assignedToFilter.toLowerCase()));
  }, [tasks, assignedToFilter]);

  const activeTasks = useMemo(() => {
    return (userTasks || []).filter(t => t && (t.status === 'inprogress' || t.status === 'pending'));
  }, [userTasks]);

  const completedTasks = useMemo(() => {
    return (userTasks || []).filter(t => t && t.status === 'completed');
  }, [userTasks]);

  const changeStatus = (taskId: string, newStatus: TaskStatus) => {
    if (updateTaskStatus) {
      updateTaskStatus(taskId, newStatus);
    }
  };

  return {
    allTasks: tasks,
    userTasks,
    activeTasks,
    completedTasks,
    addTask,
    changeStatus,
    deleteTask
  };
};
