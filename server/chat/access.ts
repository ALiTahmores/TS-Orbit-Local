import { activeMember, departmentAction, manager, membership, type ScopedState } from '../policy/scope.ts';

/** These predicates also guard socket delivery. They do not depend on an HTTP
 * request or call ScopedState.participant, so revocation takes effect at once. */
export function chatUser(scoped: ScopedState, userId: string, workspaceId: string): any | undefined {
  const user = scoped.raw.users.find((row: any) => row.id === userId);
  return user && activeMember(user) && membership(scoped.raw, user, workspaceId) ? user : undefined;
}
export function chatTeams(scoped: ScopedState, userId: string, workspaceId: string): any[] {
  return scoped.raw.teams.filter((team: any) => activeMember(team) && scoped.scopeOf('teams', team) === workspaceId
    && (team.leaderId === userId || scoped.raw.teamMembers.some((row: any) => row.teamId === team.id && row.userId === userId && activeMember(row) && scoped.scopeOf('teamMembers', row) === workspaceId)));
}
export function chatTeamLeader(scoped: ScopedState, userId: string, teamId: string, workspaceId: string): boolean {
  const team = scoped.raw.teams.find((row: any) => row.id === teamId && activeMember(row) && scoped.scopeOf('teams', row) === workspaceId);
  return !!team && (team.leaderId === userId || scoped.raw.teamMembers.some((row: any) => row.teamId === teamId && row.userId === userId && row.isLeader === true && activeMember(row) && scoped.scopeOf('teamMembers', row) === workspaceId));
}
export function chatTeamGrant(scoped: ScopedState, userId: string, teamId: string, workspaceId: string): boolean {
  return scoped.raw.conversationPermissions.some((row: any) => row.userId === userId && row.teamId === teamId
    && activeMember(row) && scoped.scopeOf('conversationPermissions', row) === workspaceId);
}
export function chatCanConnect(scoped: ScopedState, firstId: string, secondId: string, workspaceId: string): boolean {
  const first = chatUser(scoped, firstId, workspaceId), second = chatUser(scoped, secondId, workspaceId);
  if (!first || !second || firstId === secondId) return false;
  if (manager(membership(scoped.raw, first, workspaceId)) || manager(membership(scoped.raw, second, workspaceId))) return true;
  const firstTeams = chatTeams(scoped, firstId, workspaceId), secondTeams = chatTeams(scoped, secondId, workspaceId);
  return firstTeams.some(team => secondTeams.some(other => team.id === other.id))
    || secondTeams.some(team => chatTeamGrant(scoped, firstId, team.id, workspaceId))
    || firstTeams.some(team => chatTeamGrant(scoped, secondId, team.id, workspaceId));
}
export function chatExplicitGroup(scoped: ScopedState, conversation: any, workspaceId: string): boolean {
  if (conversation.accessMode === 'workspace_managed') return true;
  if (conversation.accessMode === 'connection_scoped') return false;
  // Historical groups have no durable source of invitation authority. Only a
  // currently active workspace manager can supply that missing grant.
  const creator = chatUser(scoped, conversation.creatorId, workspaceId);
  return !!creator && manager(membership(scoped.raw, creator, workspaceId));
}
export function chatCompatibleGroup(scoped: ScopedState, ids: string[], workspaceId: string): boolean {
  return ids.every((id, index) => ids.slice(index + 1).every(other => chatCanConnect(scoped, id, other, workspaceId)));
}
export function chatParticipant(scoped: ScopedState, userId: string, conversationId: string, workspaceId: string): boolean {
  const user = chatUser(scoped, userId, workspaceId);
  const conversation = scoped.raw.conversations.find((row: any) => row.id === conversationId && !row.deletedAt);
  if (!user || !conversation || scoped.scopeOf('conversations', conversation) !== workspaceId
    || !scoped.raw.conversationMembers.some((row: any) => row.userId === userId && row.conversationId === conversationId && activeMember(row) && scoped.scopeOf('conversationMembers', row) === workspaceId)) return false;
  if (scoped.departmentIdsOf('conversations', conversation).some(id => !departmentAction(scoped, user, workspaceId, id, 'read'))) return false;
  if (conversation.teamId) {
    const team = scoped.raw.teams.find((row: any) => row.id === conversation.teamId && activeMember(row));
    return !!team && (manager(membership(scoped.raw, user, workspaceId)) || chatTeams(scoped, userId, workspaceId).some(row => row.id === team.id)
      || chatTeamGrant(scoped, userId, team.id, workspaceId));
  }
  if (!conversation.isGroup && conversation.type !== 'group' && conversation.type !== 'team') {
    const ids = [...new Set<string>(scoped.raw.conversationMembers.filter((row: any) => row.conversationId === conversationId && activeMember(row) && scoped.scopeOf('conversationMembers', row) === workspaceId).map((row: any) => row.userId))];
    return ids.length === 2 && ids.includes(userId) && chatCanConnect(scoped, ids[0], ids[1], workspaceId);
  }
  if (chatExplicitGroup(scoped, conversation, workspaceId)) return true;
  const ids = [...new Set<string>(scoped.raw.conversationMembers.filter((row: any) => row.conversationId === conversationId && activeMember(row)
    && scoped.scopeOf('conversationMembers', row) === workspaceId && chatUser(scoped, row.userId, workspaceId)).map((row: any) => row.userId))];
  return chatCompatibleGroup(scoped, ids, workspaceId);
}
