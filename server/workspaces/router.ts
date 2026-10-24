import { Router, type RequestHandler, type Response } from 'express';
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import type { DatabaseSchema } from '../../src/data/dbService.ts';
import { isAccountActive } from '../auth/index.ts';

const workspaceRole = z.enum(['ADMIN', 'PROJECT_MANAGER', 'DEVELOPER', 'SPECIALIST', 'SEO_SPECIALIST', 'CONTENT_CREATOR', 'DESIGNER', 'QA_ENGINEER', 'CLIENT', 'USER', 'MEMBER', 'VIEWER']);
const normalizeEmail = (value: string) => value.trim().toLowerCase();
const sameCode = (left: unknown, right: string) => typeof left === 'string' && Buffer.byteLength(left) === Buffer.byteLength(right) && timingSafeEqual(Buffer.from(left), Buffer.from(right));
const permissionsFor = (role: string) => ['OWNER', 'ADMIN'].includes(role) ? ['*'] : ['VIEWER', 'CLIENT'].includes(role) ? ['read'] : ['read', 'write'];

export function createWorkspaceRouter(options: { state: DatabaseSchema; authenticateToken: RequestHandler }) {
  const { state } = options;
  const router = Router({ caseSensitive: true });
  router.use(options.authenticateToken);
  const fail = (res: Response, status: number, error: string, message: string) => res.status(status).json({ error, message });
  const memberOf = (workspace: any, userId: string) => (workspace.members || []).find((member: any) => member.userId === userId);
  const canAccess = (workspace: any, user: any) => {
    if (!workspace || !isAccountActive(user) || !isAccountActive(workspace)) return false;
    const member = memberOf(workspace, user.id);
    if (member && !isAccountActive(member)) return false;
    return workspace.ownerId === user.id || !!member;
  };
  const canManage = (workspace: any, user: any) => canAccess(workspace, user) && (workspace.ownerId === user.id || memberOf(workspace, user.id)?.role === 'ADMIN');
  const canAssign = (workspace: any, user: any, role: string) => canManage(workspace, user) && (role !== 'ADMIN' || workspace.ownerId === user.id);
  const projection = (workspace: any, user: any) => {
    const manage = canManage(workspace, user);
    const result: any = { id: workspace.id, name: workspace.name, description: workspace.description || '', ownerId: workspace.ownerId, createdAt: workspace.createdAt, members: (workspace.members || []).filter((member: any) => state.users.some(account => account.id === member.userId)).map((member: any) => {
      const account = state.users.find(account => account.id === member.userId);
      const projected: any = { userId: member.userId, name: account.name, username: account.username, avatar: account.avatar, role: workspace.ownerId === member.userId ? 'OWNER' : member.role, permissions: member.permissions || [], joinedAt: member.joinedAt, status: member.status, isActive: member.isActive };
      if (manage || member.userId === user.id) { projected.email = account.email; projected.phone = account.phone; }
      return projected;
    }) };
    if (manage) {
      result.inviteCode = workspace.inviteCode;
      result.pendingInvites = (workspace.pendingInvites || []).map((invite: any) => ({ id: invite.id, email: invite.email, role: invite.role, inviteCode: invite.inviteCode, createdAt: invite.createdAt, expiresAt: invite.expiresAt, usedAt: invite.usedAt, revokedAt: invite.revokedAt }));
    }
    return result;
  };
  const audit = (actorId: string, action: string, workspaceId: string) => state.auditLogs.unshift({ id: 'audit_' + randomUUID(), userId: actorId, workspaceId, action, details: 'عملیات فضای کاری محلی', timestamp: new Date().toISOString() });
  const getWorkspace = (req: any, suppliedId?: string) => {
    const id = suppliedId || req.headers['x-workspace-id'];
    return typeof id === 'string' ? state.workspaces.find(workspace => workspace.id === id) : undefined;
  };
  const addMember = (workspace: any, account: any, role: string, department?: string) => {
    const existing = memberOf(workspace, account.id), joinedAt = existing?.joinedAt || new Date().toISOString();
    const record = { userId: account.id, name: account.name, email: account.email, username: account.username, phone: account.phone, avatar: account.avatar, role, permissions: permissionsFor(role), joinedAt, status: 'ACTIVE', accountStatus: 'ACTIVE', approvalStatus: 'approved', active: true, isActive: true, ...(department ? { department } : {}) };
    workspace.members ||= [];
    if (existing) {
      Object.assign(existing, record);
      for (const flag of ['deletedAt', 'revokedAt', 'suspendedAt', 'blockedAt', 'rejectedAt']) delete existing[flag];
    }
    else workspace.members.push(record);
    account.memberships ||= [];
    const mirrored = account.memberships.find((membership: any) => membership.workspaceId === workspace.id);
    const membership = { workspaceId: workspace.id, workspaceName: workspace.name, role, permissions: record.permissions, joinedAt, status: 'ACTIVE', accountStatus: 'ACTIVE', approvalStatus: 'approved', active: true, isActive: true };
    if (mirrored) {
      Object.assign(mirrored, membership);
      for (const flag of ['deletedAt', 'revokedAt', 'suspendedAt', 'blockedAt', 'rejectedAt']) delete mirrored[flag];
    } else account.memberships.push(membership);
    return record;
  };

  router.get('/', (req: any, res) => res.json({ workspaces: state.workspaces.filter(workspace => canAccess(workspace, req.user)).map(workspace => projection(workspace, req.user)) }));
  router.post('/', (req: any, res) => {
    const parsed = z.object({ name: z.string().trim().min(1).max(120), description: z.string().max(2000).optional() }).strict().safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_FAILED', 'نام و توضیحات فضای کاری نامعتبرند.');
    const workspace = { id: 'ws_' + randomUUID(), name: parsed.data.name, description: parsed.data.description || '', ownerId: req.user.id, inviteCode: randomBytes(32).toString('hex'), createdAt: new Date().toISOString(), members: [] };
    state.workspaces.push(workspace); addMember(workspace, req.user, 'OWNER');
    audit(req.user.id, 'WORKSPACE_CREATED', workspace.id);
    res.status(201).json(projection(workspace, req.user));
  });

  router.post('/members', (req: any, res) => {
    const parsed = z.object({ workspaceId: z.string().min(1).max(120).optional(), targetUserId: z.string().min(1).max(120).optional(), userId: z.string().min(1).max(120).optional(), role: workspaceRole.default('MEMBER'), department: z.string().max(120).optional(), departmentId: z.string().max(120).optional() }).strict().safeParse(req.body);
    if (!parsed.success || !(parsed.data.targetUserId || parsed.data.userId)) return fail(res, 400, 'VALIDATION_FAILED', 'شناسه کاربر و نقش معتبر لازم است.');
    const input = parsed.data, workspace = getWorkspace(req, input.workspaceId);
    if (!workspace || !canAccess(workspace, req.user)) return fail(res, 404, 'WORKSPACE_NOT_FOUND', 'فضای کاری یافت نشد.');
    if (!canAssign(workspace, req.user, input.role)) return fail(res, 403, 'FORBIDDEN', 'مدیریت اعضا یا نقش انتخاب‌شده مجاز نیست.');
    const account = state.users.find(user => user.id === (input.targetUserId || input.userId));
    if (!account || !isAccountActive(account)) return fail(res, 404, 'USER_NOT_FOUND', 'کاربر فعال یافت نشد.');
    if (account.id === workspace.ownerId) return fail(res, 403, 'CANNOT_EDIT_OWNER', 'مالکیت فضای کاری از مسیر افزودن عضو تغییر نمی‌کند.');
    const member = addMember(workspace, account, input.role, input.department || input.departmentId);
    audit(req.user.id, 'WORKSPACE_MEMBER_UPDATED', workspace.id);
    res.json({ success: true, member, workspace: projection(workspace, req.user) });
  });

  // Removal revokes the membership (and its mirror on the account); tasks and history stay intact.
  router.delete('/members/:userId', (req: any, res) => {
    const workspace = getWorkspace(req, typeof req.query.workspaceId === 'string' ? req.query.workspaceId : undefined);
    if (!workspace || !canAccess(workspace, req.user)) return fail(res, 404, 'WORKSPACE_NOT_FOUND', 'فضای کاری یافت نشد.');
    const member = memberOf(workspace, req.params.userId);
    if (!member || !isAccountActive(member)) return fail(res, 404, 'MEMBER_NOT_FOUND', 'این کاربر عضو فعال فضای کاری نیست.');
    if (req.params.userId === workspace.ownerId) return fail(res, 403, 'CANNOT_REMOVE_OWNER', 'مالک فضای کاری قابل حذف نیست.');
    if (req.params.userId === req.user.id || !canAssign(workspace, req.user, member.role)) return fail(res, 403, 'FORBIDDEN', 'حذف این عضو مجاز نیست.');
    const revokedAt = new Date().toISOString();
    Object.assign(member, { status: 'DEACTIVATED', active: false, isActive: false, revokedAt });
    const account = state.users.find(user => user.id === member.userId);
    const mirrored = account?.memberships?.find((membership: any) => membership.workspaceId === workspace.id);
    if (mirrored) Object.assign(mirrored, { status: 'DEACTIVATED', active: false, isActive: false, revokedAt });
    audit(req.user.id, 'WORKSPACE_MEMBER_REMOVED', workspace.id);
    res.json({ success: true, workspace: projection(workspace, req.user) });
  });

  router.post('/invite', (req: any, res) => {
    const parsed = z.object({ workspaceId: z.string().min(1).max(120).optional(), email: z.string().trim().email().max(254).transform(normalizeEmail), role: workspaceRole.default('MEMBER') }).strict().safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_FAILED', 'ایمیل و نقش معتبر لازم است.');
    const input = parsed.data, workspace = getWorkspace(req, input.workspaceId);
    if (!workspace || !canAccess(workspace, req.user)) return fail(res, 404, 'WORKSPACE_NOT_FOUND', 'فضای کاری یافت نشد.');
    if (!canAssign(workspace, req.user, input.role)) return fail(res, 403, 'FORBIDDEN', 'صدور این دعوت مجاز نیست.');
    const account = state.users.find(user => normalizeEmail(user.email || '') === input.email);
    if (account) {
      if (!isAccountActive(account)) return fail(res, 409, 'ACCOUNT_UNAVAILABLE', 'حساب مقصد فعال نیست.');
      if (account.id === workspace.ownerId) return fail(res, 409, 'ALREADY_OWNER', 'کاربر مقصد مالک فضای کاری است.');
      const member = addMember(workspace, account, input.role);
      audit(req.user.id, 'WORKSPACE_MEMBER_INVITED', workspace.id);
      return res.json({ success: true, member, workspace: projection(workspace, req.user), message: 'کاربر موجود به فضای کاری افزوده شد.' });
    }
    workspace.pendingInvites ||= [];
    for (const previous of workspace.pendingInvites) if (previous.email === input.email && !previous.usedAt) previous.revokedAt = new Date().toISOString();
    const invite = { id: 'invite_' + randomUUID(), email: input.email, role: input.role, inviteCode: randomBytes(32).toString('hex'), createdBy: req.user.id, createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60_000).toISOString() };
    workspace.pendingInvites.push(invite);
    audit(req.user.id, 'WORKSPACE_PENDING_INVITE_CREATED', workspace.id);
    res.status(201).json({ success: true, invite, inviteCode: invite.inviteCode, workspace: projection(workspace, req.user), message: 'کد دعوت ایجاد شد؛ آن را به صاحب ایمیل تحویل دهید. ایمیلی ارسال نشده است.' });
  });

  router.post('/join', (req: any, res) => {
    const parsed = z.object({ inviteCode: z.string().trim().min(8).max(128) }).strict().safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_FAILED', 'کد دعوت معتبر لازم است.');
    const code = parsed.data.inviteCode;
    let pending: any;
    const workspace = state.workspaces.find(workspace => {
      if (!isAccountActive(workspace)) return false;
      if (sameCode(workspace.inviteCode, code)) return true;
      const found = (workspace.pendingInvites || []).find((invite: any) => sameCode(invite.inviteCode, code) && !invite.usedAt && !invite.revokedAt && Date.parse(invite.expiresAt) > Date.now() && normalizeEmail(invite.email) === normalizeEmail(req.user.email || ''));
      if (found) { pending = found; return true; }
      return false;
    });
    if (!workspace) return fail(res, 404, 'INVALID_INVITE_CODE', 'کد دعوت نامعتبر، پایان‌یافته یا متعلق به حساب دیگری است.');
    const existing = memberOf(workspace, req.user.id);
    if (existing && !isAccountActive(existing)) return fail(res, 403, 'MEMBERSHIP_UNAVAILABLE', 'عضویت این حساب غیرفعال است؛ با مالک فضای کاری تماس بگیرید.');
    if (workspace.ownerId === req.user.id || (existing && !pending)) return res.json({ success: true, workspace: projection(workspace, req.user), message: 'شما عضو این فضای کاری هستید.' });
    if (pending && !workspaceRole.safeParse(pending.role).success) return fail(res, 409, 'INVALID_INVITE_ROLE', 'نقش دعوت‌نامه معتبر نیست.');
    addMember(workspace, req.user, pending?.role || 'MEMBER');
    if (pending) { pending.usedAt = new Date().toISOString(); pending.usedBy = req.user.id; }
    audit(req.user.id, 'WORKSPACE_JOINED', workspace.id);
    res.json({ success: true, workspace: projection(workspace, req.user) });
  });

  router.post('/regenerate-invite', (req: any, res) => {
    const parsed = z.object({ workspaceId: z.string().min(1).max(120).optional() }).strict().safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_FAILED', 'شناسه فضای کاری نامعتبر است.');
    const workspace = getWorkspace(req, parsed.data.workspaceId);
    if (!workspace || !canAccess(workspace, req.user)) return fail(res, 404, 'WORKSPACE_NOT_FOUND', 'فضای کاری یافت نشد.');
    if (!canManage(workspace, req.user)) return fail(res, 403, 'FORBIDDEN', 'تولید کد دعوت به مجوز مدیریت فضای کاری نیاز دارد.');
    workspace.inviteCode = randomBytes(32).toString('hex');
    audit(req.user.id, 'WORKSPACE_INVITE_ROTATED', workspace.id);
    res.json({ success: true, inviteCode: workspace.inviteCode, workspace: projection(workspace, req.user) });
  });

  router.put('/:id', (req: any, res) => {
    const parsed = z.object({ name: z.string().trim().min(1).max(120).optional(), description: z.string().max(2000).optional() }).strict().safeParse(req.body);
    if (!parsed.success || !Object.keys(parsed.data).length) return fail(res, 400, 'VALIDATION_FAILED', 'نام یا توضیحات معتبر لازم است.');
    const workspace = getWorkspace(req, req.params.id);
    if (!workspace || !canAccess(workspace, req.user)) return fail(res, 404, 'WORKSPACE_NOT_FOUND', 'فضای کاری یافت نشد.');
    if (!canManage(workspace, req.user)) return fail(res, 403, 'FORBIDDEN', 'ویرایش فضای کاری مجاز نیست.');
    Object.assign(workspace, parsed.data);
    if (parsed.data.name) for (const user of state.users) for (const membership of user.memberships || []) if (membership.workspaceId === workspace.id) membership.workspaceName = workspace.name;
    audit(req.user.id, 'WORKSPACE_UPDATED', workspace.id);
    res.json({ success: true, workspace: projection(workspace, req.user) });
  });
  return router;
}
