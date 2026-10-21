import { useProject } from '../context/ProjectContext';
import { TeamMember } from '../types';

export const useAuth = () => {
  const { currentUser, teamMembers = [], setCurrentUser } = useProject();

  const isOwnerOrAdmin = currentUser?.workspaceRole === 'OWNER' || currentUser?.workspaceRole === 'ADMIN';

  const switchUser = (memberId: string) => {
    // Selecting a colleague is not authentication and cannot replace the session identity.
  };

  return {
    currentUser,
    isOwnerOrAdmin,
    teamMembers,
    switchUser
  };
};
