import { useMemo } from 'react';
import { useProject } from '../context/ProjectContext';
import { Project } from '../types';

export const useProjects = () => {
  const { projects = [], addProject, updateProject, deleteProject } = useProject();

  const activeProjects = useMemo(() => {
    return (projects || []).filter(p => p && (p.status === 'ACTIVE' || p.status === 'active'));
  }, [projects]);

  const completedProjects = useMemo(() => {
    return (projects || []).filter(p => p && (p.status === 'COMPLETED' || p.status === 'completed'));
  }, [projects]);

  return {
    projects,
    activeProjects,
    completedProjects,
    addProject,
    updateProject,
    deleteProject
  };
};
