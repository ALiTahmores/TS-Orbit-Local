import { boolean, dto, strings, text } from '../domain/models.ts';
import { DomainError, identifier, now } from '../domain/repository.ts';
import { activeMember, manager, membership, writer, type ScopedState } from '../policy/scope.ts';
import { chatCanConnect, chatCompatibleGroup, chatExplicitGroup, chatParticipant, chatTeamGrant, chatTeamLeader, chatTeams, chatUser } from './access.ts';
import { localAvatar } from '../../src/lib/localAssets.ts';

export interface ChatOptions {
  scoped: ScopedState;
  files?: { get(id: string): any };
  broadcast: (event: string, payload: any) => void;
  broadcastRoom?: (room: string, event: string, payload: any) => void;
  notify?: (input: any) => any;
  recordActivity?: (input: any) => any;
  presence?: (userId:string,workspaceId:string)=>boolean;
}
const fail = (status: number, code: string, message: string): never => { throw new DomainError(status, code, message); };
// Stable sorting retains persisted insertion order when two messages share a
// millisecond. Random UUID ordering must never move a read cursor backwards.
const order = (a: any, b: any) => String(a.createdAt || a.timestamp || '').localeCompare(String(b.createdAt || b.timestamp || ''));
const publicAvatar = (user: any) => typeof user.avatar === 'string' && user.avatar.length <= 700_000
  && (/^\/avatars\/[\w.-]+\.svg$/.test(user.avatar) || /^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(user.avatar)) ? user.avatar : localAvatar(user.name || user.id || 'TS Orbit');
const grouped = (conversation: any) => conversation.isGroup === true || conversation.type === 'group' || conversation.type === 'team' || !!conversation.teamId;

export class ChatService {
  constructor(readonly options: ChatOptions) {}
  private get scoped() { return this.options.scoped; }
  private get raw(): any { return this.scoped.raw; }
  private sameScope(collection: string, row: any): boolean { return this.scoped.scopeOf(collection, row) === this.scope().workspaceId; }
  private scope() { const scope = this.scoped.current(); if (!scope || scope.kind !== 'workspace' || !chatUser(this.scoped, scope.user.id, scope.workspaceId)) return fail(403, 'WORKSPACE_REQUIRED', 'فضای کاری معتبر لازم است.'); return scope; }
  private actor(write = false) { const scope = this.scope(); if (write && !writer(membership(this.raw, scope.user, scope.workspaceId))) fail(403, 'CHAT_WRITE_FORBIDDEN', 'اجازهٔ نوشتن در گفتگو را ندارید.'); return scope.user; }
  private conversation(id: string, write = false): any {
    const scope = this.scope(); this.actor(write);
    const row = this.raw.conversations.find((row: any) => row.id === id);
    if (!row || !chatParticipant(this.scoped, scope.user.id, id, scope.workspaceId)) return fail(404, 'CONVERSATION_NOT_FOUND', 'گفتگو در دسترس نیست.');
    return row;
  }
  private mutable(id: string): any { const row = this.conversation(id, true); if (row.status === 'closed') fail(409, 'CONVERSATION_CLOSED', 'گفتگو بایگانی شده است.'); return row; }
  private message(id: string, write = false): any { const row = this.raw.messages.find((row: any) => row.id === id); if (!row) return fail(404, 'MESSAGE_NOT_FOUND', 'پیام یافت نشد.'); this.conversation(row.conversationId, write); return row; }
  private members(conversation: any): string[] {
    const workspaceId = this.scoped.scopeOf('conversations', conversation)!;
    return [...new Set<string>(this.raw.conversationMembers.filter((row: any) => row.conversationId === conversation.id && activeMember(row) && this.scoped.scopeOf('conversationMembers', row) === workspaceId).map((row: any) => row.userId))]
      .filter(id => chatParticipant(this.scoped, id, conversation.id, workspaceId));
  }
  private manage(conversation: any): boolean {
    const scope = this.scope();
    return writer(membership(this.raw, scope.user, scope.workspaceId)) && (manager(membership(this.raw, scope.user, scope.workspaceId))
      || conversation.creatorId === scope.user.id || !!conversation.teamId && chatTeamLeader(this.scoped, scope.user.id, conversation.teamId, scope.workspaceId));
  }
  private requireManage(conversation: any): void { if (!this.manage(conversation)) fail(403, 'CHAT_MANAGER_REQUIRED', 'مدیر گفتگو لازم است.'); }
  private event(conversationId?: string): void { this.options.broadcast('app_chat_updated', { type: 'data_changed', ...(conversationId ? { conversationId } : {}) }); }
  private requestEvent(): void { this.options.broadcast('app_chat_requests_updated', { type: 'data_changed' }); }
  private audit(action: string, targetId: string, conversationId?: string, messageId?: string): void {
    const scope = this.scope();
    const input = { workspaceId: scope.workspaceId, actorId: scope.user.id, action, targetId, ...(conversationId ? { conversationId } : {}), ...(messageId ? { messageId } : {}) };
    if (this.options.recordActivity) this.options.recordActivity(input);
    else this.scoped.state.auditLogs.unshift({ ...input, id: identifier('audit'), userId: scope.user.id, timestamp: now() });
  }
  private notify(recipientIds: string[], type: string, title: string, description: string, extra: any = {}): void {
    const scope = this.scope();
    this.options.notify?.({ workspaceId: scope.workspaceId, actorId: scope.user.id, recipientIds: [...new Set(recipientIds)].filter(id => id !== scope.user.id), type, title, description, link: 'chat', ...extra });
  }
  private userDTO(userId: string): any {
    const scope = this.scope(), user = chatUser(this.scoped, userId, scope.workspaceId);
    if (!user) return null;
    const teams = chatTeams(this.scoped, userId, scope.workspaceId).filter(team => this.scoped.visible('teams', team)).map(team => ({ id: team.id, name: team.name }));
    return { id: user.id, name: user.name || user.username || 'عضو', avatar: publicAvatar(user), role: membership(this.raw, user, scope.workspaceId)?.role || 'MEMBER', displayRole:user.role || 'USER', status: this.options.presence?.(user.id,scope.workspaceId) ? 'online' : 'offline', team: teams[0] || null, teams,
      canDirectChat: userId !== scope.user.id && chatCanConnect(this.scoped, scope.user.id, userId, scope.workspaceId) };
  }
  users(): any[] { const scope = this.scope(); return this.raw.users.filter((user: any) => user.id !== scope.user.id && chatUser(this.scoped, user.id, scope.workspaceId)).map((user: any) => this.userDTO(user.id)); }
  private rows(conversationId: string): any[] { return this.raw.messages.filter((row: any) => row.conversationId === conversationId && this.scoped.scopeOf('messages', row) === this.scope().workspaceId).sort(order); }
  private readIndex(receipt: any, messages: any[]): number {
    if (!receipt) return -1;
    if (receipt.lastReadMessageId) return messages.findIndex(row => row.id === receipt.lastReadMessageId);
    const stamp = Date.parse(receipt.lastReadAt || '');
    return messages.reduce((index, row, n) => Date.parse(row.createdAt || row.timestamp || '') <= stamp ? n : index, -1);
  }
  private attachmentDTO(attachment: any, conversationId: string): any {
    const id = typeof attachment === 'string' ? attachment : attachment?.id || attachment?.fileId;
    const missing = { id: id || null, name: typeof attachment?.name === 'string' ? attachment.name : 'فایل قدیمی', contentAvailable: false, downloadPath: null };
    if (!id || !this.options.files || !this.raw.files.some((file: any) => file.id === id && file.conversationId === conversationId)) return missing;
    try {
      const current = this.options.files.get(id), versionId = attachment?.versionId || attachment?.currentVersionId;
      const version = versionId ? current.versionHistory?.find((row: any) => row.id === versionId) : null;
      if (versionId && !version) return missing;
      const source = version || current;
      return { id, name: attachment?.name || source.name, mimeType: source.mimeType, byteSize: source.byteSize, size: source.size, sha256: source.sha256,
        versionId: version?.id || current.currentVersionId, currentVersionId: version?.id || current.currentVersionId, contentAvailable: source.contentAvailable === true, downloadPath: source.downloadPath || null };
    } catch { return missing; }
  }
  private messageDTO(row: any, rows = this.rows(row.conversationId)): any {
    const conversation = this.raw.conversations.find((item: any) => item.id === row.conversationId), participants = this.members(conversation);
    const index = rows.findIndex(message => message.id === row.id);
    const readBy = participants.filter(userId => this.raw.readReceipts.some((receipt: any) => receipt.conversationId === row.conversationId && receipt.userId === userId && this.sameScope('readReceipts', receipt) && this.readIndex(receipt, rows) >= index));
    const reactions: any[] = [];
    if (!row.deletedAt) for (const reaction of this.raw.messageReactions.filter((reaction: any) => reaction.messageId === row.id && !reaction.deletedAt && participants.includes(reaction.userId) && this.sameScope('messageReactions', reaction))) {
      let group = reactions.find(group => group.emoji === reaction.emoji); if (!group) { group = { emoji: reaction.emoji, users: [], userIds: [], count: 0 }; reactions.push(group); }
      if (!group.users.includes(reaction.userId)) { group.users.push(reaction.userId); group.userIds.push(reaction.userId); group.count++; }
    }
    const sender = this.raw.users.find((user: any) => user.id === row.senderId);
    const pinned = !row.deletedAt && this.raw.pinnedMessages.some((pin: any) => pin.conversationId === row.conversationId && pin.messageId === row.id && !pin.deletedAt && this.sameScope('pinnedMessages', pin));
    const result: any = { id: row.id, conversationId: row.conversationId, senderId: row.senderId, senderName: row.senderName || sender?.name || 'عضو', senderAvatar: publicAvatar({ id: row.senderId, name: row.senderName, avatar: row.senderAvatar || sender?.avatar }),
      content: row.deletedAt ? '' : typeof row.content === 'string' ? row.content : '', createdAt: row.createdAt || row.timestamp || null, timestamp: row.createdAt || row.timestamp || null,
      editedAt: row.editedAt || null, edited: !!(row.edited || row.editedAt), isEdited: !!(row.edited || row.editedAt), deletedAt: row.deletedAt || null,
      attachments: row.deletedAt ? [] : (Array.isArray(row.attachments) ? row.attachments : []).map((attachment: any) => this.attachmentDTO(attachment, row.conversationId)),
      replyToMessageId: row.replyToMessageId || null, reactions, readBy, pinned, isPinned: pinned, mentions: [] };
    if (!row.deletedAt && row.replyToMessageId) {
      const reply = rows.find(message => message.id === row.replyToMessageId);
      if (reply) result.replyTo = { id: reply.id, senderName: reply.senderName || 'عضو', content: reply.deletedAt ? 'پیام حذف شده' : String(reply.content || '').slice(0, 500), deletedAt: reply.deletedAt || null };
    }
    if (!row.deletedAt && row.codeSnippet && typeof row.codeSnippet.code === 'string') result.codeSnippet = { language: row.codeSnippet.language || '', code: row.codeSnippet.code };
    if (!row.deletedAt && row.voiceNote?.fileId) result.voiceNote = { fileId: row.voiceNote.fileId, durationSeconds: row.voiceNote.durationSeconds };
    if (!row.deletedAt && Array.isArray(row.mentions)) result.mentions = row.mentions.filter((mention: any) => mention.type === 'user' && participants.includes(mention.targetId)).map((mention: any) => ({ type: 'user', targetId: mention.targetId, name: this.raw.users.find((user: any) => user.id === mention.targetId)?.name || '' }));
    return result;
  }
  private conversationDTO(row: any): any {
    const scope = this.scope(), participants = this.members(row), members = participants.map(id => this.userDTO(id)).filter(Boolean), rows = this.rows(row.id);
    const receipt = this.raw.readReceipts.find((receipt: any) => receipt.conversationId === row.id && receipt.userId === scope.user.id && this.sameScope('readReceipts', receipt)), lastRead = this.readIndex(receipt, rows);
    const participant = this.raw.conversationMembers.find((member: any) => member.conversationId === row.id && member.userId === scope.user.id && activeMember(member) && this.sameScope('conversationMembers', member));
    const pinnedMessages = this.raw.pinnedMessages.filter((pin: any) => pin.conversationId === row.id && !pin.deletedAt && this.sameScope('pinnedMessages', pin) && rows.some(message => message.id === pin.messageId && !message.deletedAt)).map((pin: any) => ({ messageId: pin.messageId, pinnedAt: pin.pinnedAt, pinnedBy: pin.pinnedBy }));
    const type = row.teamId ? 'team' : row.isGroup || row.type === 'group' ? 'group' : 'dm';
    return { id: row.id, type, isGroup: type !== 'dm', title: type === 'dm' ? members.find(member => member.id !== scope.user.id)?.name || row.title : row.title,
      teamId: row.teamId || null, creatorId: row.creatorId || null, members, participantDTOs: members, participants, status: row.status === 'closed' ? 'closed' : 'active', createdAt: row.createdAt || null,
      lastMessageAt: rows.at(-1)?.createdAt || rows.at(-1)?.timestamp || row.createdAt || null, lastMessage: rows.length ? this.messageDTO(rows.at(-1), rows) : null,
      unreadCount: rows.filter((message, index) => index > lastRead && message.senderId !== scope.user.id && !message.deletedAt).length,
      pinnedMessages, pinnedMessageId: pinnedMessages.at(-1)?.messageId || null, muted: participant?.muted === true,
      permissions: { send: writer(membership(this.raw, scope.user, scope.workspaceId)) && row.status !== 'closed', manage: this.manage(row) } };
  }
  conversations(): any[] { const scope = this.scope(); return this.raw.conversations.filter((row: any) => chatParticipant(this.scoped, scope.user.id, row.id, scope.workspaceId)).map((row: any) => this.conversationDTO(row)).sort((a: any, b: any) => String(b.lastMessageAt).localeCompare(String(a.lastMessageAt)) || a.id.localeCompare(b.id)); }
  private eligible(userId: string, teamId?: string): void {
    const scope = this.scope();
    if (!chatUser(this.scoped, userId, scope.workspaceId)) fail(422, 'CHAT_MEMBER_INVALID', 'عضو فعال در این فضای کاری لازم است.');
    if (userId !== scope.user.id && !chatCanConnect(this.scoped, scope.user.id, userId, scope.workspaceId)) fail(403, 'CHAT_APPROVAL_REQUIRED', 'ابتدا مجوز ارتباط بین تیمی لازم است.');
    if (teamId && !chatTeams(this.scoped, userId, scope.workspaceId).some(team => team.id === teamId) && !chatTeamGrant(this.scoped, userId, teamId, scope.workspaceId)
      && !manager(membership(this.raw, this.raw.users.find((user: any) => user.id === userId), scope.workspaceId))) fail(403, 'CHAT_TEAM_FORBIDDEN', 'عضو تیم یا مجوز ارتباط لازم است.');
  }
  create(value: any): { created: boolean; conversation: any } {
    const user = this.actor(true), scope = this.scope(), input = dto(value, ['recipientId', 'title', 'isGroup', 'teamId', 'memberIds']);
    const isGroup = input.isGroup === undefined ? false : boolean(input.isGroup);
    let memberIds: string[], team: any;
    if (!isGroup) {
      if (input.teamId !== undefined || input.memberIds !== undefined || input.title !== undefined) fail(422, 'INVALID_CHAT_INPUT', 'گفتگوی مستقیم فقط گیرنده می‌پذیرد.');
      const recipientId = text(input.recipientId, 'گیرنده', true, 200); if (recipientId === user.id) fail(422, 'CHAT_SELF_FORBIDDEN', 'گیرنده باید عضو دیگری باشد.'); this.eligible(recipientId);
      memberIds = [user.id, recipientId];
      const existing = this.raw.conversations.find((row: any) => !row.deletedAt && !grouped(row) && this.scoped.scopeOf('conversations', row) === scope.workspaceId
        && (() => { const ids = [...new Set(this.raw.conversationMembers.filter((member: any) => member.conversationId === row.id && activeMember(member) && this.sameScope('conversationMembers', member)).map((member: any) => member.userId))]; return ids.length === 2 && memberIds.every(id => ids.includes(id)); })());
      if (existing) return { created: false, conversation: this.conversationDTO(this.conversation(existing.id)) };
    } else {
      if (input.recipientId !== undefined) fail(422, 'INVALID_CHAT_INPUT', 'گیرندهٔ مستقیم برای گروه مجاز نیست.');
      if (input.teamId !== undefined) {
        const teamId = text(input.teamId, 'تیم', true, 200); team = this.scoped.rows('teams').find((row: any) => row.id === teamId && activeMember(row));
        if (!team) fail(404, 'TEAM_NOT_FOUND', 'تیم یافت نشد.');
        if (!manager(membership(this.raw, user, scope.workspaceId)) && !chatTeamLeader(this.scoped, user.id, teamId, scope.workspaceId)) fail(403, 'CHAT_TEAM_LEADER_REQUIRED', 'مدیر تیم لازم است.');
      }
      memberIds = [...new Set([user.id, ...(input.memberIds === undefined ? team ? chatTeamsMembers(this.scoped, team.id, scope.workspaceId) : [] : strings(input.memberIds, 'اعضا', 100))])];
      if (memberIds.length > 100) fail(422, 'CHAT_MEMBER_LIMIT', 'حداکثر صد عضو مجاز است.');
      memberIds.forEach(id => this.eligible(id, team?.id));
      if (memberIds.length < 2) fail(422, 'CHAT_MEMBERS_REQUIRED', 'حداقل دو عضو لازم است.');
      if (!team && !manager(membership(this.raw, user, scope.workspaceId)) && !chatCompatibleGroup(this.scoped, memberIds, scope.workspaceId)) fail(403, 'CHAT_GROUP_APPROVAL_REQUIRED', 'همهٔ اعضای گروه باید مجوز ارتباط با یکدیگر داشته باشند.');
    }
    const createdAt = now(), conversation = { id: identifier('conv'), workspaceId: scope.workspaceId, title: isGroup ? text(input.title ?? team?.name ?? 'گفتگوی گروهی', 'عنوان', true, 200) : '',
      type: team ? 'team' : isGroup ? 'group' : 'dm', isGroup, ...(isGroup && !team ? { accessMode: manager(membership(this.raw, user, scope.workspaceId)) ? 'workspace_managed' : 'connection_scoped' } : {}), ...(team ? { teamId: team.id } : {}), creatorId: user.id, status: 'active', createdAt, lastMessageAt: createdAt };
    this.scoped.state.conversations.push(conversation);
    for (const userId of memberIds) this.scoped.state.conversationMembers.push({ id: identifier('member'), workspaceId: scope.workspaceId, conversationId: conversation.id, userId, joinedAt: createdAt, muted: false });
    this.audit('chat.conversation.created', conversation.id, conversation.id); this.event(conversation.id);
    return { created: true, conversation: this.conversationDTO(conversation) };
  }
  update(id: string, value: any): any {
    const conversation = this.conversation(id, true), input = dto(value, ['title', 'closed']); this.requireManage(conversation);
    if (!Object.keys(input).length) fail(422, 'INVALID_CHAT_INPUT', 'تغییر لازم است.');
    const title = input.title === undefined ? undefined : text(input.title, 'عنوان', true, 200), closed = input.closed === undefined ? undefined : boolean(input.closed);
    if (title !== undefined && !grouped(conversation)) fail(422, 'CHAT_DM_TITLE', 'عنوان گفتگوی مستقیم از نام اعضا ساخته می‌شود.');
    if (title !== undefined) conversation.title = title;
    if (closed !== undefined) { conversation.status = closed ? 'closed' : 'active'; conversation.closedAt = closed ? now() : null; conversation.closedBy = closed ? this.scope().user.id : null; }
    conversation.updatedAt = now(); this.audit('chat.conversation.updated', id, id); this.event(id); return this.conversationDTO(conversation);
  }
  close(id: string, value: any = {}): any { const input = dto(value || {}, ['closed']); return this.update(id, { closed: input.closed === undefined ? true : boolean(input.closed) }); }
  addMembers(id: string, value: any): any {
    const conversation = this.mutable(id); this.requireManage(conversation); if (!grouped(conversation)) fail(422, 'CHAT_GROUP_REQUIRED', 'اعضای گفتگوی مستقیم قابل تغییر نیستند.');
    const input = dto(value, ['userIds']), ids = strings(input.userIds, 'اعضا', 100); if (!ids.length) fail(422, 'CHAT_MEMBERS_REQUIRED', 'عضو لازم است.');
    ids.forEach(userId => this.eligible(userId, conversation.teamId));
    const active = this.members(conversation); if (new Set([...active, ...ids]).size > 100) fail(422, 'CHAT_MEMBER_LIMIT', 'حداکثر صد عضو مجاز است.');
    const workspaceId = this.scope().workspaceId, workspaceManager = manager(membership(this.raw, this.scope().user, workspaceId));
    if (!conversation.teamId && !workspaceManager && !chatExplicitGroup(this.scoped, conversation, workspaceId)
      && !chatCompatibleGroup(this.scoped, [...new Set([...active, ...ids])], workspaceId)) fail(403, 'CHAT_GROUP_APPROVAL_REQUIRED', 'همهٔ اعضای گروه باید مجوز ارتباط با یکدیگر داشته باشند.');
    if (!conversation.teamId && workspaceManager) conversation.accessMode = 'workspace_managed';
    for (const userId of ids) {
      const rows = this.raw.conversationMembers.filter((row: any) => row.conversationId === id && row.userId === userId && this.sameScope('conversationMembers', row));
      const existing = rows.find((row: any) => activeMember(row));
      if (existing) continue;
      this.scoped.state.conversationMembers.push({ id: identifier('member'), workspaceId: this.scope().workspaceId, conversationId: id, userId, joinedAt: now(), muted: false });
    }
    this.audit('chat.members.added', id, id); this.event(id); return this.conversationDTO(conversation);
  }
  removeMember(id: string, userId: string): any {
    const conversation = this.mutable(id); this.requireManage(conversation); if (!grouped(conversation)) fail(422, 'CHAT_GROUP_REQUIRED', 'اعضای گفتگوی مستقیم قابل تغییر نیستند.');
    const rows = this.raw.conversationMembers.filter((row: any) => row.conversationId === id && row.userId === userId && activeMember(row) && this.sameScope('conversationMembers', row));
    if (!rows.length) fail(404, 'CHAT_MEMBER_NOT_FOUND', 'عضو یافت نشد.');
    if (userId === conversation.creatorId) fail(409, 'CHAT_CREATOR_REQUIRED', 'سازندهٔ گفتگو قابل حذف نیست.');
    for (const row of rows) { row.revokedAt = now(); row.revokedBy = this.scope().user.id; }
    this.audit('chat.member.removed', id, id); this.event(id); return this.conversationDTO(conversation);
  }
  preferences(id: string, value: any): any {
    const conversation = this.conversation(id), input = dto(value, ['muted']), muted = boolean(input.muted);
    for (const row of this.raw.conversationMembers.filter((row: any) => row.conversationId === id && row.userId === this.scope().user.id && activeMember(row) && this.sameScope('conversationMembers', row))) row.muted = muted;
    this.event(id); return this.conversationDTO(conversation);
  }
  messages(id: string, query: any = {}): any[] {
    this.conversation(id); dto(query, ['before', 'limit']); let rows = this.rows(id);
    const limit = query.limit === undefined ? 500 : typeof query.limit === 'string' && /^\d+$/.test(query.limit) ? Number(query.limit) : NaN;
    if (!Number.isInteger(limit) || limit < 1 || limit > 500) fail(422, 'INVALID_CHAT_PAGE', 'اندازهٔ صفحه باید بین ۱ و ۵۰۰ باشد.');
    if (query.before !== undefined) { const before = text(query.before, 'پیام', true, 200), index = rows.findIndex(row => row.id === before); if (index < 0) fail(422, 'INVALID_CHAT_PAGE', 'نقطهٔ شروع متعلق به گفتگو نیست.'); rows = rows.slice(0, index); }
    return rows.slice(-limit).map(row => this.messageDTO(row));
  }
  private code(value: any): any { if (value === null) return null; const input = dto(value, ['language', 'code']); text(input.code, 'کد', true, 50000); return { language: text(input.language ?? '', 'زبان', false, 50), code: input.code }; }
  private attachment(id: string, conversationId: string): any {
    const file = this.raw.files.find((row: any) => row.id === id), scope = this.scope();
    if (!file || file.conversationId !== conversationId || file.uploadedById !== scope.user.id || !file.managed || file.deletedAt || this.scoped.scopeOf('files', file) !== scope.workspaceId || !this.options.files) return fail(422, 'CHAT_ATTACHMENT_INVALID', 'فایل باید در همین گفتگو توسط شما بارگذاری شده باشد.');
    const projected = this.options.files.get(id); if (!projected.contentAvailable || !projected.currentVersionId) fail(422, 'CHAT_ATTACHMENT_UNAVAILABLE', 'محتوای واقعی فایل در دسترس نیست.');
    return { id, name: projected.name, versionId: projected.currentVersionId, mimeType: projected.mimeType, byteSize: projected.byteSize };
  }
  send(id: string, value: any): any {
    const conversation = this.mutable(id), user = this.actor(true), input = dto(value, ['content', 'attachmentIds', 'attachments', 'replyToMessageId', 'codeSnippet', 'voiceNote']);
    if (input.attachmentIds !== undefined && input.attachments !== undefined) fail(422, 'INVALID_CHAT_INPUT', 'فقط یک فهرست پیوست مجاز است.');
    const content = input.content === undefined ? '' : text(input.content, 'پیام', false, 10000), codeSnippet = input.codeSnippet === undefined ? null : this.code(input.codeSnippet);
    const attachmentIds = input.attachmentIds ?? input.attachments ?? [], ids = strings(attachmentIds, 'پیوست‌ها', 10);
    let voiceNote: any = null;
    if (input.voiceNote !== undefined) {
      const voice = dto(input.voiceNote, ['fileId', 'durationSeconds']), fileId = text(voice.fileId, 'فایل صوتی', true, 200);
      if (typeof voice.durationSeconds !== 'number' || !Number.isFinite(voice.durationSeconds) || voice.durationSeconds <= 0 || voice.durationSeconds > 3600) fail(422, 'CHAT_VOICE_INVALID', 'مدت صوت معتبر نیست.');
      voiceNote = { fileId, durationSeconds: voice.durationSeconds }; if (!ids.includes(fileId)) ids.push(fileId);
    }
    if (ids.length > 10 || !content && !codeSnippet && !ids.length) fail(422, 'CHAT_MESSAGE_EMPTY', 'پیام یا پیوست لازم است.');
    const attachments = ids.map(fileId => this.attachment(fileId, id));
    if (voiceNote && !/^audio\//.test(attachments.find(attachment => attachment.id === voiceNote.fileId)?.mimeType || '') && attachments.find(attachment => attachment.id === voiceNote.fileId)?.mimeType !== 'video/webm') fail(422, 'CHAT_VOICE_INVALID', 'فایل صوتی معتبر لازم است.');
    const replyToMessageId = input.replyToMessageId == null ? null : text(input.replyToMessageId, 'پاسخ', true, 200);
    if (replyToMessageId && !this.rows(id).some(row => row.id === replyToMessageId && !row.deletedAt)) fail(422, 'CHAT_REPLY_INVALID', 'پاسخ باید به پیام موجود همین گفتگو باشد.');
    const members = this.members(conversation), mentions = members.filter(userId => content.includes('@' + userId)).map(userId => ({ type: 'user', targetId: userId }));
    const createdAt = now(), row: any = { id: identifier('msg'), workspaceId: this.scope().workspaceId, conversationId: id, senderId: user.id, senderName: user.name || user.username || 'عضو', senderAvatar: publicAvatar(user), content,
      createdAt, timestamp: createdAt, attachments, replyToMessageId, codeSnippet, voiceNote, mentions, edited: false, history: [] };
    this.scoped.state.messages.push(row); conversation.lastMessageAt = createdAt;
    const recipients = members.filter(userId => !this.raw.conversationMembers.some((member: any) => member.conversationId === id && member.userId === userId && activeMember(member) && member.muted === true && this.sameScope('conversationMembers', member)));
    this.notify(recipients, 'chat.message', 'پیام جدید', `${row.senderName}: ${content.slice(0, 200) || (voiceNote ? 'پیام صوتی' : codeSnippet ? 'قطعه کد' : 'پیوست جدید')}`, { conversationId: id, messageId: row.id, eventKey: row.id });
    this.audit('chat.message.created', row.id, id, row.id); this.event(id); return this.messageDTO(row);
  }
  edit(id: string, value: any): any {
    const row = this.message(id, true); this.mutable(row.conversationId); if (row.senderId !== this.scope().user.id || row.deletedAt) fail(403, 'CHAT_AUTHOR_REQUIRED', 'فقط نویسنده می‌تواند پیام خود را ویرایش کند.');
    const input = dto(value, ['content', 'codeSnippet']); if (!Object.keys(input).length) fail(422, 'INVALID_CHAT_INPUT', 'تغییر لازم است.');
    const content = input.content === undefined ? row.content : text(input.content, 'پیام', false, 10000), codeSnippet = input.codeSnippet === undefined ? row.codeSnippet : this.code(input.codeSnippet);
    if (!content && !codeSnippet && !row.attachments?.length) fail(422, 'CHAT_MESSAGE_EMPTY', 'پیام خالی مجاز نیست.');
    row.history = [...(Array.isArray(row.history) ? row.history : []), { action: 'edited', actorId: this.scope().user.id, content: row.content || '', codeSnippet: row.codeSnippet || null, at: now() }];
    row.content = content; row.codeSnippet = codeSnippet || null; row.editedAt = now(); row.edited = true; this.audit('chat.message.edited', id, row.conversationId, id); this.event(row.conversationId); return this.messageDTO(row);
  }
  remove(id: string): any {
    const row = this.message(id, true); this.mutable(row.conversationId);
    if (row.senderId !== this.scope().user.id && !this.manage(this.conversation(row.conversationId))) fail(403, 'CHAT_AUTHOR_REQUIRED', 'اجازهٔ حذف پیام را ندارید.');
    if (!row.deletedAt) { row.history = [...(Array.isArray(row.history) ? row.history : []), { action: 'deleted', actorId: this.scope().user.id, at: now() }]; row.deletedAt = now(); row.deletedBy = this.scope().user.id; }
    for (const pin of this.raw.pinnedMessages.filter((pin: any) => pin.messageId === id && !pin.deletedAt && this.sameScope('pinnedMessages', pin))) pin.deletedAt = now();
    this.audit('chat.message.deleted', id, row.conversationId, id); this.event(row.conversationId); return { success: true, messageId: id, conversationId: row.conversationId, message: this.messageDTO(row) };
  }
  react(id: string, value: any): any {
    const row = this.message(id, true); this.mutable(row.conversationId); if (row.deletedAt) fail(409, 'MESSAGE_DELETED', 'پیام حذف شده است.');
    const input = dto(value, ['emoji']), emoji = text(input.emoji, 'واکنش', true, 16);
    if (!/\p{Extended_Pictographic}|\p{Regional_Indicator}|[0-9#*]\ufe0f?\u20e3/u.test(emoji) || /[\x00-\x1f<>]/.test(emoji)
      || [...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(emoji)].length !== 1) fail(422, 'CHAT_REACTION_INVALID', 'واکنش باید یک ایموجی باشد.');
    const existing = this.raw.messageReactions.filter((reaction: any) => reaction.messageId === id && reaction.userId === this.scope().user.id && reaction.emoji === emoji && !reaction.deletedAt && this.sameScope('messageReactions', reaction));
    if (existing.length) existing.forEach((reaction: any) => { reaction.deletedAt = now(); });
    else this.scoped.state.messageReactions.push({ id: identifier('reaction'), workspaceId: this.scope().workspaceId, conversationId: row.conversationId, messageId: id, userId: this.scope().user.id, emoji, createdAt: now() });
    this.event(row.conversationId); return { success: true, messageId: id, reactions: this.messageDTO(row).reactions };
  }
  pin(id: string, value: any): any {
    this.mutable(id); const input = dto(value, ['messageId', 'pin']), messageId = text(input.messageId, 'پیام', true, 200), pinned = boolean(input.pin);
    const message = this.raw.messages.find((row: any) => row.id === messageId && row.conversationId === id && !row.deletedAt); if (!message) fail(422, 'CHAT_PIN_INVALID', 'پیام همین گفتگو لازم است.');
    const existing = this.raw.pinnedMessages.filter((row: any) => row.conversationId === id && row.messageId === messageId && !row.deletedAt && this.sameScope('pinnedMessages', row));
    if (pinned && !existing.length) this.scoped.state.pinnedMessages.push({ id: identifier('pin'), workspaceId: this.scope().workspaceId, conversationId: id, messageId, pinnedBy: this.scope().user.id, pinnedAt: now() });
    if (!pinned) existing.forEach((row: any) => { row.deletedAt = now(); });
    this.audit(pinned ? 'chat.message.pinned' : 'chat.message.unpinned', messageId, id, messageId); this.event(id); return { success: true, pinned: this.conversationDTO(this.conversation(id)).pinnedMessages };
  }
  read(id: string, value: any = {}): any {
    this.conversation(id); const input = dto(value || {}, ['messageId']), rows = this.rows(id), messageId = input.messageId == null ? rows.at(-1)?.id : text(input.messageId, 'پیام', true, 200);
    if (messageId && !rows.some(row => row.id === messageId)) fail(422, 'CHAT_READ_INVALID', 'پیام همین گفتگو لازم است.');
    let receipt = this.raw.readReceipts.find((row: any) => row.conversationId === id && row.userId === this.scope().user.id && this.sameScope('readReceipts', row));
    const next = rows.findIndex(row => row.id === messageId), previous = this.readIndex(receipt, rows);
    let changed = false;
    if (!receipt) { receipt = { id: identifier('receipt'), workspaceId: this.scope().workspaceId, conversationId: id, userId: this.scope().user.id, lastReadAt: null, lastReadMessageId: null }; this.scoped.state.readReceipts.push(receipt); changed = true; }
    if (next > previous && messageId) { const row = rows[next]; receipt.lastReadMessageId = messageId; receipt.lastReadAt = row.createdAt || row.timestamp || now(); receipt.updatedAt = now(); changed = true; }
    if (changed) this.event(id); return { success: true, receipt: { id: receipt.id, conversationId: id, userId: receipt.userId, lastReadAt: receipt.lastReadAt, lastReadMessageId: receipt.lastReadMessageId } };
  }
  requests(): any[] { this.scope(); return this.scoped.rows('conversationRequests').filter((row: any) => !row.deletedAt).map((row: any) => this.requestDTO(row)); }
  private requestDTO(row: any): any { const scope = this.scope(); return { id: row.id, senderId: row.senderId, senderName: this.raw.users.find((user: any) => user.id === row.senderId)?.name || row.senderName || 'عضو', targetTeamId: row.targetTeamId,
    targetTeamName: this.raw.teams.find((team: any) => team.id === row.targetTeamId)?.name || '', requestText: row.requestText || '', status: row.status, createdAt: row.createdAt || null, respondedAt: row.respondedAt || null,
    canRespond: manager(membership(this.raw, scope.user, scope.workspaceId)) || chatTeamLeader(this.scoped, scope.user.id, row.targetTeamId, scope.workspaceId) }; }
  private team(id: string): any { const team = this.scoped.rows('teams').find((row: any) => row.id === id && activeMember(row)); if (!team) return fail(404, 'TEAM_NOT_FOUND', 'تیم یافت نشد.'); return team; }
  private requireTeamManager(teamId: string): void { const scope = this.scope(); this.actor(true); this.team(teamId); if (!manager(membership(this.raw, scope.user, scope.workspaceId)) && !chatTeamLeader(this.scoped, scope.user.id, teamId, scope.workspaceId)) fail(403, 'CHAT_TEAM_LEADER_REQUIRED', 'مدیر تیم لازم است.'); }
  request(value: any): any {
    const user = this.actor(true), input = dto(value, ['targetTeamId', 'requestText']), targetTeamId = text(input.targetTeamId, 'تیم', true, 200), requestText = text(input.requestText, 'درخواست', true, 3000), team = this.team(targetTeamId), scope = this.scope();
    if (chatTeams(this.scoped, user.id, scope.workspaceId).some(row => row.id === targetTeamId) || chatTeamGrant(this.scoped, user.id, targetTeamId, scope.workspaceId)) fail(409, 'CHAT_PERMISSION_EXISTS', 'دسترسی این تیم را دارید.');
    const previous = this.raw.conversationRequests.filter((row: any) => row.senderId === user.id && row.targetTeamId === targetTeamId && !row.deletedAt && this.scoped.scopeOf('conversationRequests', row) === scope.workspaceId);
    if (previous.some((row: any) => row.status === 'blocked')) fail(403, 'CHAT_REQUEST_BLOCKED', 'درخواست ارتباط مسدود شده است.');
    if (previous.some((row: any) => row.status === 'pending')) fail(409, 'CHAT_REQUEST_PENDING', 'درخواست در حال بررسی دارید.');
    const row = { id: identifier('request'), workspaceId: scope.workspaceId, senderId: user.id, targetTeamId, requestText, status: 'pending', createdAt: now(), history: [] };
    this.scoped.state.conversationRequests.push(row);
    const leaders = this.raw.users.filter((candidate: any) => chatUser(this.scoped, candidate.id, scope.workspaceId) && (chatTeamLeader(this.scoped, candidate.id, team.id, scope.workspaceId) || manager(membership(this.raw, candidate, scope.workspaceId)))).map((candidate: any) => candidate.id);
    this.notify(leaders, 'chat.request', 'درخواست ارتباط بین تیمی', `${user.name || 'عضو'} درخواست ارتباط با ${team.name || 'تیم'} دارد.`, { eventKey: row.id,...(team.departmentId?{departmentId:team.departmentId}:{}) });
    this.audit('chat.request.created', row.id); this.requestEvent(); return this.requestDTO(row);
  }
  respond(id: string, value: any): any {
    this.actor(true); const row = this.scoped.rows('conversationRequests').find((row: any) => row.id === id && !row.deletedAt); if (!row) fail(404, 'CHAT_REQUEST_NOT_FOUND', 'درخواست یافت نشد.'); this.requireTeamManager(row.targetTeamId);
    const input = dto(value, ['status']), status = text(input.status, 'وضعیت', true, 20); if (!['approved', 'rejected', 'blocked'].includes(status)) fail(422, 'CHAT_REQUEST_STATUS', 'وضعیت معتبر لازم است.');
    if (row.status !== 'pending') fail(409, 'CHAT_REQUEST_HANDLED', 'این درخواست قبلاً بررسی شده است.');
    if (!chatUser(this.scoped, row.senderId, this.scope().workspaceId)) fail(409, 'CHAT_MEMBER_INVALID', 'درخواست‌کننده عضو فعال نیست.');
    row.status = status; row.respondedAt = now(); row.respondedBy = this.scope().user.id; row.history = [...(row.history || []), { status, actorId: this.scope().user.id, at: now() }];
    if (status === 'approved' && !chatTeamGrant(this.scoped, row.senderId, row.targetTeamId, this.scope().workspaceId)) this.scoped.state.conversationPermissions.push({ id: identifier('permission'), workspaceId: this.scope().workspaceId, userId: row.senderId, teamId: row.targetTeamId, grantedBy: this.scope().user.id, grantedAt: now() });
    const team=this.team(row.targetTeamId);
    this.notify([row.senderId], 'chat.request_response', status === 'approved' ? 'درخواست ارتباط تأیید شد' : 'نتیجهٔ درخواست ارتباط', `وضعیت درخواست: ${status === 'approved' ? 'تأیید' : status === 'blocked' ? 'مسدود' : 'رد'}`, { eventKey: `${id}:${status}`,...(team.departmentId?{departmentId:team.departmentId}:{}) });
    this.audit('chat.request.responded', id); this.requestEvent(); this.event(); return { success: true, request: this.requestDTO(row) };
  }
  revoke(teamId: string, userId: string): any {
    this.requireTeamManager(teamId); const scope = this.scope();
    const permissions = this.raw.conversationPermissions.filter((row: any) => row.teamId === teamId && row.userId === userId && activeMember(row) && this.scoped.scopeOf('conversationPermissions', row) === scope.workspaceId);
    const requests = this.raw.conversationRequests.filter((row: any) => row.targetTeamId === teamId && row.senderId === userId && !row.deletedAt && this.scoped.scopeOf('conversationRequests', row) === scope.workspaceId);
    for (const row of permissions) { row.revokedAt = now(); row.revokedBy = scope.user.id; }
    for (const row of requests) { row.deletedAt = now(); row.history = [...(row.history || []), { status: 'revoked', actorId: scope.user.id, at: now() }]; }
    this.audit('chat.permission.revoked', teamId); this.requestEvent(); this.event(); return { success: true };
  }
}

function chatTeamsMembers(scoped: ScopedState, teamId: string, workspaceId: string): string[] {
  const team = scoped.raw.teams.find((row: any) => row.id === teamId);
  return [...new Set<string>([team?.leaderId, ...scoped.raw.teamMembers.filter((row: any) => row.teamId === teamId && activeMember(row) && scoped.scopeOf('teamMembers', row) === workspaceId).map((row: any) => row.userId)].filter(Boolean))].filter(id => !!chatUser(scoped, id, workspaceId));
}
