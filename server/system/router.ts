import { Router, type Response } from 'express';
import { randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import type { DatabaseSchema } from '../../src/data/dbService.ts';
import type { createAuth } from '../auth/index.ts';
import { localAvatar } from '../../src/lib/localAssets.ts';

const displayRole = z.enum(['USER', 'CLIENT', 'DEVELOPER', 'PROJECT_MANAGER', 'SPECIALIST', 'SEO_SPECIALIST', 'CONTENT_CREATOR', 'DESIGNER', 'QA_ENGINEER', 'MEMBER', 'VIEWER']);
const lifecycle = z.enum(['ACTIVE', 'BLOCKED', 'REJECTED', 'SUSPENDED', 'INACTIVE', 'PENDING_APPROVAL']);
const strongPassword = z.string().min(12).refine(value => Buffer.byteLength(value, 'utf8') <= 72);
const normalizedEmail = (value: string) => value.trim().toLowerCase();
const phoneId = (value: string) => { const digits = value.replace(/\D/g, ''); return digits.length >= 10 ? digits.slice(-10) : ''; };

export function createSystemRouter(options: { state: DatabaseSchema; auth: ReturnType<typeof createAuth> }) {
  const { state, auth } = options;
  const router = Router({ caseSensitive: true });
  const guard = [auth.authenticateToken, auth.requireSystemAdmin];
  const fail = (res: Response, status: number, error: string, message: string) => res.status(status).json({ error, message });
  const userDTO = (user: any) => {
    const fields = ['id', 'name', 'email', 'phone', 'username', 'avatar', 'role', 'systemRole', 'status', 'accountStatus', 'approvalStatus', 'isActive', 'emailVerified', 'createdAt', 'updatedAt', 'lastLogin', 'loginCount', 'localPasswordRequired'];
    return Object.fromEntries(fields.filter(field => user[field] !== undefined).map(field => [field, user[field]]));
  };
  const sessionDTO = (session: any) => {
    const fields = ['id', 'userId', 'name', 'email', 'status', 'createdAt', 'loginTime', 'lastActivity', 'expiresAt', 'revokedAt', 'revokeReason', 'ipAddress', 'browser', 'operatingSystem', 'device'];
    return Object.fromEntries(fields.filter(field => session[field] !== undefined).map(field => [field, session[field]]));
  };
  const audit = (actorId: string, action: string, targetId: string) => state.auditLogs.unshift({ id: 'audit_' + randomUUID(), userId: actorId, action, targetUserId: targetId, details: 'مدیریت حساب محلی', timestamp: new Date().toISOString() });
  const target = (req: any) => state.users.find(user => user.id === req.params.id);
  const protectSelf = (req: any, user: any) => user.id === req.user.id;
  const updateLifecycle = (user: any, status: string) => {
    user.accountStatus = status; user.status = status; user.isActive = status === 'ACTIVE'; user.active = status === 'ACTIVE';
    user.approvalStatus = status === 'ACTIVE' ? 'approved' : status === 'PENDING_APPROVAL' ? 'pending' : status.toLowerCase();
    if (status === 'ACTIVE') {
      delete user.deletedAt; delete user.revokedAt;
      if (['BLOCKED', 'REJECTED', 'SUSPENDED', 'INACTIVE', 'PENDING', 'PENDING_APPROVAL', 'INVITED', 'DISABLED', 'DEACTIVATED', 'DELETED'].includes(String(user.role).toUpperCase())) {
        user.role = displayRole.safeParse(user.approvedRole).success ? user.approvedRole : 'USER';
      }
    }
    for (const profile of state.userProfiles.filter(profile => profile.userId === user.id)) { profile.currentStatus = status; profile.assignedRole = user.role; }
    user.updatedAt = new Date().toISOString(); auth.revokeUserSessions(user.id, 'account_lifecycle_changed');
  };

  router.get('/owner/approvals', ...guard, (_req, res) => res.json(state.approvalRequests.map(request => {
    const fields = ['id', 'userId', 'name', 'email', 'requestedRole', 'status', 'requestDate', 'createdAt', 'submittedAt', 'approvedAt', 'approvedBy', 'reason'];
    const projected: any = Object.fromEntries(fields.filter(field => request[field] !== undefined).map(field => [field, request[field]]));
    const account = state.users.find(user => user.id === request.userId), historical = request.details || {};
    projected.details = { fullName: account?.fullName || account?.name || historical.fullName || 'کاربر', email: account?.email || historical.email || '', phone: account?.phone || historical.phone || '', ipAddress: historical.ipAddress || '', browser: historical.browser || '', operatingSystem: historical.operatingSystem || '', country: historical.country || '' };
    projected.grantedRole = account?.role || 'USER';
    return projected;
  })));
  for (const action of ['approve', 'reject', 'block'] as const) {
    router.post('/owner/approvals/:id/' + action, ...guard, (req: any, res) => {
      const parsed = z.object({ role: displayRole.optional(), approvedRole: displayRole.optional(), reason: z.string().max(2000).optional() }).strict().safeParse(req.body || {});
      if (!parsed.success) return fail(res, 400, 'VALIDATION_FAILED', 'نقش یا توضیح درخواست نامعتبر است.');
      const request = state.approvalRequests.find(request => request.id === req.params.id);
      const user = request && state.users.find(user => user.id === request.userId);
      if (!request || !user) return fail(res, 404, 'APPROVAL_NOT_FOUND', 'درخواست یا حساب مقصد یافت نشد.');
      if (protectSelf(req, user)) return fail(res, 409, 'CANNOT_EDIT_SELF', 'تغییر وضعیت مدیریتی حساب جاری مجاز نیست.');
      const at = new Date().toISOString();
      if (action === 'approve') {
        const role = parsed.data.approvedRole || parsed.data.role || (displayRole.safeParse(request.requestedRole).success ? request.requestedRole : 'USER');
        if (user.systemRole !== 'ADMIN') user.role = role;
        user.approvedRole = user.role; user.approvedAt = at; user.approvedBy = req.user.id;
        updateLifecycle(user, 'ACTIVE');
      } else updateLifecycle(user, action === 'block' ? 'BLOCKED' : 'REJECTED');
      request.status = action === 'approve' ? 'APPROVED' : action === 'block' ? 'BLOCKED' : 'REJECTED';
      request.approvedAt = at; request.approvedBy = req.user.id; request.reason = parsed.data.reason || '';
      state.approvalHistory.push({ id: 'approval_history_' + randomUUID(), requestId: request.id, userId: user.id, actedBy: req.user.id, action: request.status, timestamp: at, reason: request.reason });
      audit(req.user.id, 'ACCOUNT_APPROVAL_' + request.status, user.id);
      res.json({ success: true, user: userDTO(user), message: 'وضعیت حساب ذخیره شد؛ این عملیات مجوز فضای کاری ایجاد نمی‌کند.' });
    });
  }

  router.get('/owner/users', ...guard, (_req, res) => res.json(state.users.map(userDTO)));
  router.get('/owner/sessions', ...guard, (_req, res) => res.json(state.userSessions.filter(session => session.status === 'active' && Date.parse(session.expiresAt) > Date.now()).map(sessionDTO)));
  router.post('/owner/sessions/:id/terminate', ...guard, (req: any, res) => {
    const session = state.userSessions.find(session => session.id === req.params.id);
    if (!session) return fail(res, 404, 'SESSION_NOT_FOUND', 'نشست یافت نشد.');
    auth.revokeSession(session, 'system_admin_termination'); audit(req.user.id, 'SESSION_TERMINATED', session.userId);
    res.json({ success: true, requiresLogin: session.id === req.authSession.id, message: 'نشست پایان یافت.' });
  });
  router.get('/owner/login-history', ...guard, (_req, res) => res.json(state.loginHistory.map(history => {
    const fields = ['id', 'userId', 'email', 'sessionId', 'loginDate', 'loginTime', 'logoutTime', 'sessionDuration', 'ipAddress', 'browser', 'operatingSystem', 'device', 'authenticationMethod', 'loginResult'];
    return Object.fromEntries(fields.filter(field => history[field] !== undefined).map(field => [field, history[field]]));
  })));
  // Account administrators receive audit metadata only; legacy details/payloads
  // may contain business records from workspaces they are not members of.
  router.get('/owner/audit-logs', ...guard, (_req, res) => res.json(state.auditLogs.map(log => ({ id: log.id, userId: log.userId, action: log.action, timestamp: log.timestamp }))));
  router.get('/owner/approval-stats', ...guard, (_req, res) => res.json({ pendingCount: state.approvalRequests.filter(request => request.status === 'PENDING').length, approvedCount: state.approvalRequests.filter(request => request.status === 'APPROVED').length, rejectedCount: state.approvalRequests.filter(request => request.status === 'REJECTED').length, blockedCount: state.approvalRequests.filter(request => request.status === 'BLOCKED').length, totalUsersCount: state.users.filter(user => !user.deletedAt).length, onlineUsersCount: new Set(state.userSessions.filter(session => session.status === 'active' && Date.parse(session.expiresAt) > Date.now()).map(session => session.userId)).size, averageApprovalTime: null, autoNotificationQueued: 0, autoEmailDispatched: 0 }));

  const createAccount = (req: any, res: Response) => {
    const parsed = z.object({ name: z.string().trim().min(1).max(120), email: z.string().trim().email().max(254).transform(normalizedEmail), phone: z.string().trim().min(6).max(30).regex(/^[+\d() .-]+$/), username: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,30}$/).optional(), role: displayRole.default('USER'), password: strongPassword.optional() }).strict().safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_FAILED', 'اطلاعات حساب نامعتبر است؛ نقش سیستمی از این مسیر قابل تغییر نیست.');
    const input = parsed.data;
    if (state.users.some(user => normalizedEmail(user.email || '') === input.email)) return fail(res, 409, 'EMAIL_TAKEN', 'ایمیل قبلاً ثبت شده است.');
    if (input.username && state.users.some(user => String(user.username || '').toLowerCase() === input.username)) return fail(res, 409, 'USERNAME_TAKEN', 'نام کاربری قبلاً ثبت شده است.');
    if (phoneId(input.phone) && state.users.some(user => phoneId(String(user.phone || '')) === phoneId(input.phone))) return fail(res, 409, 'PHONE_TAKEN', 'شماره همراه قبلاً ثبت شده است.');
    const id = 'usr_' + randomUUID(), workspaceId = 'ws_' + randomUUID(), at = new Date().toISOString();
    const user = { id, name: input.name, fullName: input.name, email: input.email, phone: input.phone, username: input.username || 'user_' + randomBytes(8).toString('hex'), role: input.role, systemRole: 'USER', status: 'ACTIVE', accountStatus: 'ACTIVE', approvalStatus: 'approved', isActive: true, active: true, localPasswordRequired: !input.password, passwordHash: bcrypt.hashSync(input.password || randomBytes(36).toString('hex'), 12), avatar: localAvatar(id), emailVerified: false, personalWorkspaceId: workspaceId, workspace: workspaceId, createdAt: at, updatedAt: at, memberships: [{ workspaceId, workspaceName: `فضای کاری ${input.name}`, role: 'OWNER', permissions: ['*'], joinedAt: at }] };
    state.users.push(user);
    state.workspaces.push({ id: workspaceId, name: `فضای کاری ${input.name}`, ownerId: id, inviteCode: randomBytes(32).toString('hex'), createdAt: at, members: [{ userId: id, name: user.name, email: user.email, username: user.username, phone: user.phone, avatar: user.avatar, role: 'OWNER', permissions: ['*'], joinedAt: at }] });
    state.userProfiles.push({ id: 'prof_' + randomUUID(), userId: id, fullName: user.name, emailAddress: user.email, phoneNumber: user.phone, assignedRole: user.role, assignedWorkspace: workspaceId, currentStatus: 'ACTIVE', registrationDate: at });
    state.userSettings.push({ id: 'set_' + randomUUID(), userId: id, theme: 'dark', language: 'fa', timezone: 'Asia/Tehran', notificationsEnabled: true });
    audit(req.user.id, 'ACCOUNT_CREATED', id);
    res.status(201).json({ ...userDTO(user), user: userDTO(user), success: true, message: input.password ? 'حساب محلی ایجاد شد.' : 'حساب ایجاد شد؛ برای تعیین رمز محلی از ابزار local:account استفاده کنید. ایمیلی ارسال نشده است.' });
  };
  router.post(['/users', '/users/invite'], ...guard, createAccount);
  router.put('/users/:id/role', ...guard, (req: any, res) => {
    const parsed = z.object({ role: displayRole }).strict().safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'INVALID_ROLE', 'این نقش قابل واگذاری نیست.');
    const user = target(req);
    if (!user) return fail(res, 404, 'USER_NOT_FOUND', 'حساب یافت نشد.');
    if (protectSelf(req, user)) return fail(res, 409, 'CANNOT_EDIT_SELF', 'تغییر نقش حساب جاری مجاز نیست.');
    if (user.systemRole === 'ADMIN') return fail(res, 409, 'ADMIN_ROLE_MANAGED_LOCALLY', 'نقش مدیر سیستم از این مسیر تغییر نمی‌کند.');
    user.role = parsed.data.role; user.updatedAt = new Date().toISOString(); auth.revokeUserSessions(user.id, 'display_role_changed'); audit(req.user.id, 'ACCOUNT_ROLE_UPDATED', user.id);
    user.approvedRole = user.role;
    for (const profile of state.userProfiles.filter(profile => profile.userId === user.id)) profile.assignedRole = user.role;
    res.json({ success: true, updatedRole: user.role, userId: user.id, user: userDTO(user) });
  });
  router.put('/users/:id/status', ...guard, (req: any, res) => {
    const parsed = z.object({ status: lifecycle }).strict().safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'INVALID_STATUS', 'وضعیت حساب نامعتبر است.');
    const user = target(req);
    if (!user) return fail(res, 404, 'USER_NOT_FOUND', 'حساب یافت نشد.');
    if (protectSelf(req, user)) return fail(res, 409, 'CANNOT_EDIT_SELF', 'تغییر وضعیت حساب جاری مجاز نیست.');
    updateLifecycle(user, parsed.data.status); audit(req.user.id, 'ACCOUNT_STATUS_UPDATED', user.id);
    res.json({ success: true, user: userDTO(user) });
  });
  router.put('/users/:id/governance', ...guard, (req: any, res) => {
    const parsed = z.object({ role: displayRole.optional(), status: lifecycle.optional(), isActive: z.boolean().optional(), department: z.string().max(120).optional(), permissions: z.array(z.string().max(100)).max(100).optional() }).strict().safeParse(req.body);
    if (!parsed.success || !Object.keys(parsed.data).length) return fail(res, 400, 'VALIDATION_FAILED', 'فیلدهای مدیریت حساب نامعتبرند.');
    const user = target(req);
    if (!user) return fail(res, 404, 'USER_NOT_FOUND', 'حساب یافت نشد.');
    if (protectSelf(req, user)) return fail(res, 409, 'CANNOT_EDIT_SELF', 'تغییر مدیریت حساب جاری مجاز نیست.');
    if (parsed.data.role && user.systemRole === 'ADMIN') return fail(res, 409, 'ADMIN_ROLE_MANAGED_LOCALLY', 'نقش مدیر سیستم از این مسیر تغییر نمی‌کند.');
    if (parsed.data.role) user.role = parsed.data.role;
    if (parsed.data.role) { user.approvedRole = user.role; for (const profile of state.userProfiles.filter(profile => profile.userId === user.id)) profile.assignedRole = user.role; }
    if (parsed.data.department !== undefined) user.department = parsed.data.department;
    if (parsed.data.status || parsed.data.isActive !== undefined) updateLifecycle(user, parsed.data.status || (parsed.data.isActive ? 'ACTIVE' : 'INACTIVE'));
    if (parsed.data.permissions) {
      let settings = state.userSettings.find(settings => settings.userId === user.id);
      if (!settings) { settings = { id: 'set_' + randomUUID(), userId: user.id }; state.userSettings.push(settings); }
      settings.requestedGovernancePermissions = parsed.data.permissions;
    }
    auth.revokeUserSessions(user.id, 'account_governance_changed'); audit(req.user.id, 'ACCOUNT_GOVERNANCE_UPDATED', user.id);
    res.json({ success: true, user: userDTO(user), message: 'تنظیمات حساب ذخیره شد؛ مجوزهای فضای کاری فقط از عضویت واقعی تعیین می‌شوند.' });
  });
  router.delete('/users/:id', ...guard, (req: any, res) => {
    const user = target(req);
    if (!user) return fail(res, 404, 'USER_NOT_FOUND', 'حساب یافت نشد.');
    if (protectSelf(req, user)) return fail(res, 409, 'CANNOT_EDIT_SELF', 'غیرفعال‌کردن حساب جاری مجاز نیست.');
    updateLifecycle(user, 'INACTIVE'); user.deletedAt = new Date().toISOString(); audit(req.user.id, 'ACCOUNT_SOFT_DEACTIVATED', user.id);
    res.json({ success: true, deactivated: true, userId: user.id, message: 'حساب غیرفعال شد؛ شناسه و اطلاعات وابسته برای حفظ سوابق نگهداری شدند.' });
  });
  return router;
}
