import { Router, type Request, type Response, type NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { randomBytes, randomUUID, createHash, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import type { DatabaseSchema } from '../../src/data/dbService.ts';
import { localAvatar } from '../../src/lib/localAssets.ts';

const issuer = 'ts-orbit';
const lifetimeSeconds = 8 * 60 * 60;
const identity = (value: string) => value.trim().toLowerCase();
const phoneIdentifier = (value: string) => {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : '';
};
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const password = z.string().min(12).refine(value => Buffer.byteLength(value, 'utf8') <= 72);
const email = z.string().trim().email().max(254).transform(identity);
const username = z.string().trim().transform(value => identity(value).replace(/^@/, '')).pipe(z.string().regex(/^[a-z0-9_]{3,30}$/));
const phone = z.string().trim().min(6).max(30).regex(/^[+\d() .-]+$/);
const registerInput = z.object({ email, password, name: z.string().trim().min(1).max(120), phone, username: username.optional() }).strict();
const loginInput = z.object({ identifier: z.string().trim().min(1).max(254).optional(), email: z.string().trim().min(1).max(254).optional(), username: z.string().trim().min(1).max(254).optional(), password: z.string().min(1).refine(value => Buffer.byteLength(value, 'utf8') <= 72) }).strict().refine(value => !!(value.identifier || value.email || value.username));
const avatar = z.string().max(700_000).refine(value => value === '' || value.startsWith('/avatars/') || /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(value) || /^data:image\/svg\+xml,/.test(value));
const profileInput = z.object({ name: z.string().trim().min(1).max(120).optional(), firstName: z.string().trim().max(60).optional(), lastName: z.string().trim().max(60).optional(), email: email.optional(), username: username.optional(), phone: phone.optional(), avatar: avatar.optional(), bio: z.string().max(2000).optional(), jobTitle: z.string().max(120).optional(), department: z.string().max(120).optional(), timezone: z.string().max(80).optional(), language: z.enum(['fa', 'en']).optional(), currentPassword: z.string().refine(value => Buffer.byteLength(value, 'utf8') <= 72).optional() }).strict();

export function isAccountActive(user: any): boolean {
  const denied = ['BLOCKED', 'REJECTED', 'SUSPENDED', 'INACTIVE', 'PENDING', 'PENDING_APPROVAL', 'INVITED', 'DISABLED', 'DEACTIVATED', 'DELETED'];
  return !!user && user.isActive !== false && user.active !== false && !user.deletedAt && !user.revokedAt && !denied.includes(String(user.accountStatus || '').toUpperCase()) && !denied.includes(String(user.status || '').toUpperCase()) && !denied.includes(String(user.approvalStatus || '').toUpperCase()) && !denied.includes(String(user.role || '').toUpperCase());
}

export interface AuthOptions {
  state: DatabaseSchema;
  jwtSecret: string;
  appOrigin: string;
  afterCommit?: (operation: () => void) => void;
  onSessionsRevoked?: (sessionIds: string[]) => void;
}

export function createAuth(options: AuthOptions) {
  const { state, jwtSecret, appOrigin } = options;
  const router = Router({ caseSensitive: true });
  const limits = new Map<string, { count: number; until: number }>();
  const fail = (res: Response, status: number, code: string, message: string) => res.status(status).json({ error: code, message });
  const publicUserProjection = (user: any) => {
    const fields = ['id', 'name', 'fullName', 'firstName', 'lastName', 'email', 'username', 'phone', 'avatar', 'picture', 'bio', 'jobTitle', 'department', 'timezone', 'language', 'role', 'status', 'accountStatus', 'approvalStatus', 'isActive', 'emailVerified', 'personalWorkspaceId', 'workspace', 'createdAt', 'updatedAt', 'lastLogin', 'loginCount'];
    const projected: any = Object.fromEntries(fields.filter(key => user[key] !== undefined).map(key => [key, user[key]]));
    projected.systemRole = user.systemRole === 'ADMIN' ? 'ADMIN' : 'USER';
    projected.memberships = state.workspaces.flatMap(workspace => {
      if (!isAccountActive(workspace)) return [];
      const member = (workspace.members || []).find((item: any) => item.userId === user.id);
      if (!member && workspace.ownerId !== user.id) return [];
      if (member && !isAccountActive(member)) return [];
      return [{ workspaceId: workspace.id, workspaceName: workspace.name, role: workspace.ownerId === user.id ? 'OWNER' : member.role, permissions: member?.permissions || [], joinedAt: member?.joinedAt }];
    });
    return projected;
  };
  const audit = (userId: string, action: string, details: string) => state.auditLogs.unshift({ id: 'audit_' + randomUUID(), userId, action, details, timestamp: new Date().toISOString() });
  const notifyRevoked = (ids: string[]) => {
    if (!ids.length || !options.onSessionsRevoked) return;
    const operation = () => options.onSessionsRevoked!(ids);
    options.afterCommit ? options.afterCommit(operation) : operation();
  };
  const revokeSession = (session: any, reason = 'revoked') => {
    if (!session || session.status !== 'active') return;
    const at = new Date().toISOString();
    session.status = 'revoked'; session.revokedAt = at; session.revokeReason = reason;
    for (const history of state.loginHistory.filter(item => item.sessionId === session.id)) {
      history.logoutTime = at;
      const startedAt = Date.parse(session.createdAt || session.loginTime);
      history.sessionDuration = Number.isFinite(startedAt) ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : null;
    }
    notifyRevoked([session.id]);
  };
  const revokeUserSessions = (userId: string, reason = 'account_changed') => {
    for (const session of state.userSessions.filter(item => item.userId === userId)) revokeSession(session, reason);
  };
  const verifyAccessToken = (token: string) => {
    const claims = jwt.verify(token, jwtSecret, { algorithms: ['HS256'], issuer, audience: appOrigin }) as jwt.JwtPayload;
    if (!claims || typeof claims !== 'object' || typeof claims.sub !== 'string' || typeof claims.sid !== 'string' || typeof claims.jti !== 'string' || !Number.isFinite(claims.exp)) throw new Error('INVALID_TOKEN');
    const user = state.users.find(item => item.id === claims.sub);
    const session = state.userSessions.find(item => item.id === claims.sid && item.userId === claims.sub);
    if (!session || session.status !== 'active' || !Number.isFinite(Date.parse(session.expiresAt)) || Date.parse(session.expiresAt) <= Date.now()) throw new Error('SESSION_REVOKED');
    const hashed = digest(claims.jti);
    if (typeof session.tokenIdHash !== 'string' || session.tokenIdHash.length !== hashed.length || !timingSafeEqual(Buffer.from(hashed), Buffer.from(session.tokenIdHash))) throw new Error('INVALID_TOKEN');
    if (!isAccountActive(user) || user.localPasswordRequired) throw new Error('ACCOUNT_UNAVAILABLE');
    return { user, session, claims };
  };
  const authenticateToken = (req: any, res: Response, next: NextFunction) => {
    // A global API guard and route-local guards can share a verified request.
    if (req.authVerified === true) return next();
    const match = /^Bearer ([^\s]+)$/.exec(req.headers.authorization || '');
    if (!match) return fail(res, 401, 'UNAUTHORIZED', 'ورود معتبر لازم است.');
    try {
      const access = verifyAccessToken(match[1]);
      req.user = access.user; req.authSession = access.session; req.authClaims = access.claims; req.authVerified = true;
      return next();
    } catch (error: any) {
      return fail(res, 401, ['SESSION_REVOKED', 'ACCOUNT_UNAVAILABLE'].includes(error.message) ? error.message : 'INVALID_TOKEN', 'نشست نامعتبر یا پایان‌یافته است؛ دوباره وارد شوید.');
    }
  };
  const requireSystemAdmin = (req: any, res: Response, next: NextFunction) => req.user?.systemRole === 'ADMIN' ? next() : fail(res, 403, 'FORBIDDEN', 'این عملیات به مجوز مدیریت سیستم نیاز دارد.');
  const limited = (group: string, maximum: number) => (req: Request, res: Response, next: NextFunction) => {
    // prepareCredentials and the route both apply the limit; count each request once.
    const counted: Set<string> = ((req as any).rateLimitGroups ??= new Set());
    if (counted.has(group)) return next();
    counted.add(group);
    const now = Date.now(), key = group + ':' + (req.ip || 'local');
    if (limits.size > 1000) for (const [storedKey, value] of limits) if (value.until <= now) limits.delete(storedKey);
    let entry = limits.get(key);
    if (!entry || entry.until <= now) { entry = { count: 0, until: now + 15 * 60_000 }; limits.set(key, entry); }
    if (++entry.count > maximum) { res.setHeader('Retry-After', Math.ceil((entry.until - now) / 1000)); return fail(res, 429, 'RATE_LIMITED', 'تعداد تلاش‌ها زیاد است؛ کمی بعد دوباره تلاش کنید.'); }
    next();
  };
  const findUser = (identifier: string) => {
    const normalized = identity(identifier), userName = normalized.replace(/^@/, '');
    const digits = identifier.replace(/\D/g, '');
    const exact = state.users.find(user => identity(user.email || '') === normalized || identity(user.username || '').replace(/^@/, '') === userName);
    if (exact) return exact;
    const phoneMatches = digits.length >= 10 ? state.users.filter(user => phoneIdentifier(user.phone) === digits.slice(-10)) : [];
    // Imported records may contain duplicate phones. Preserve those records,
    // require email/username instead of choosing an arbitrary phone identity.
    return phoneMatches.length === 1 ? phoneMatches[0] : undefined;
  };
  const issueSession = (req: Request, user: any) => {
    const now = new Date(), id = 'sess_' + randomUUID(), tokenId = randomBytes(32).toString('hex');
    const session = { id, userId: user.id, name: user.name, email: user.email, status: 'active', createdAt: now.toISOString(), loginTime: now.toISOString(), lastActivity: now.toISOString(), expiresAt: new Date(now.getTime() + lifetimeSeconds * 1000).toISOString(), tokenIdHash: digest(tokenId), ipAddress: req.ip || 'local', userAgent: String(req.headers['user-agent'] || '').slice(0, 512), browser: 'Browser', operatingSystem: 'Unknown', device: 'Unknown' };
    state.userSessions.push(session);
    state.loginHistory.push({ id: 'lh_' + randomUUID(), userId: user.id, email: user.email, sessionId: id, loginDate: now.toISOString(), loginTime: now.toISOString(), logoutTime: null, loginResult: 'Successful', ipAddress: session.ipAddress, browser: session.browser, operatingSystem: session.operatingSystem, device: session.device, authenticationMethod: 'Local password' });
    user.lastLogin = now.toISOString(); user.loginCount = (Number(user.loginCount) || 0) + 1;
    const token = jwt.sign({ userId: user.id, sid: id, jti: tokenId }, jwtSecret, { algorithm: 'HS256', subject: user.id, issuer, audience: appOrigin, expiresIn: lifetimeSeconds });
    return token;
  };
  // Compare unknown accounts against a real bcrypt hash too, reducing timing leakage.
  const dummyHash = bcrypt.hashSync(randomBytes(32).toString('hex'), 12);
  // bcrypt at cost 12 takes ~250 ms of CPU. Sign-in and registration do it here, before the
  // request joins the serialized storage queue and with the async implementation, so one
  // sign-in no longer stalls every other API request. The route reuses a result only for
  // the exact password and stored hash it was computed from, and otherwise checks again.
  // Hashes run one at a time: bcryptjs yields every ~100 ms, and parallel hashes would all
  // run within the same event-loop turn, stalling other requests for their combined time.
  let passwordQueue: Promise<unknown> = Promise.resolve(), queuedPasswords = 0;
  const serially = <T>(task: () => Promise<T>): Promise<T> => {
    queuedPasswords++;
    const run = passwordQueue.then(task, task).finally(() => { queuedPasswords--; });
    passwordQueue = run.catch(() => undefined);
    return run;
  };
  const prepareLogin = async (req: any) => {
    const parsed = loginInput.safeParse(req.body);
    if (!parsed.success) return;
    const user = findUser(parsed.data.identifier || parsed.data.email || parsed.data.username!);
    const hash = typeof user?.passwordHash === 'string' ? user.passwordHash : dummyHash;
    req.passwordCheck = { password: parsed.data.password, hash, correct: await serially(() => bcrypt.compare(parsed.data.password, hash)) };
  };
  const prepareRegistration = async (req: any) => {
    const parsed = registerInput.safeParse(req.body);
    if (!parsed.success || state.users.some(user => identity(user.email || '') === parsed.data.email)) return;
    req.preparedPassword = { password: parsed.data.password, hash: await serially(() => bcrypt.hash(parsed.data.password, 12)) };
  };
  const prepareCredentials = (req: any, res: Response, next: NextFunction) => {
    if (req.method !== 'POST' || (req.path !== '/login' && req.path !== '/register')) return next();
    const login = req.path === '/login';
    limited(login ? 'login' : 'register', login ? 20 : 10)(req, res, () => {
      // About 15 s of queued hashing; beyond that, ask the client to retry rather than queue.
      if (queuedPasswords >= 64) { res.setHeader('Retry-After', '5'); return fail(res, 503, 'AUTH_BUSY', 'سرور در حال پردازش ورودهای دیگر است؛ چند لحظه بعد دوباره تلاش کنید.'); }
      // A failure here only means the route computes the hash itself, as before.
      (login ? prepareLogin(req) : prepareRegistration(req)).catch(() => undefined).then(() => next());
    });
  };
  const passwordMatches = (req: any, candidate: string, hash: string) => {
    const check = req.passwordCheck;
    if (check && check.password === candidate && check.hash === hash) return check.correct === true;
    return bcrypt.compareSync(candidate, hash);
  };

  router.post('/check-username', limited('lookup', 60), (req, res) => {
    const parsed = z.object({ username }).strict().safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_FAILED', 'نام کاربری باید ۳ تا ۳۰ حرف انگلیسی، عدد یا زیرخط باشد.');
    res.json({ available: !state.users.some(user => identity(user.username || '') === parsed.data.username), username: parsed.data.username });
  });
  router.post(['/check-identifier', '/check-email'], limited('lookup', 60), (req, res) => {
    const parsed = z.object({ identifier: z.string().trim().min(1).max(254).optional(), email: z.string().trim().min(1).max(254).optional(), username: z.string().trim().min(1).max(254).optional(), phone: z.string().trim().min(1).max(30).optional() }).strict().safeParse(req.body);
    if (!parsed.success || !(parsed.data.identifier || parsed.data.email || parsed.data.username || parsed.data.phone)) return fail(res, 400, 'VALIDATION_FAILED', 'شناسه ورود را وارد کنید.');
    res.json({ exists: !!findUser(parsed.data.identifier || parsed.data.email || parsed.data.username || parsed.data.phone!) });
  });
  router.post('/register', limited('register', 10), (req, res) => {
    const parsed = registerInput.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_FAILED', 'اطلاعات ثبت‌نام نامعتبر است؛ رمز عبور حداقل ۱۲ نویسه و حداکثر ۷۲ بایت باشد.');
    const input = parsed.data;
    if (state.users.some(user => identity(user.email || '') === input.email)) return fail(res, 409, 'EMAIL_TAKEN', 'ایمیل قبلاً ثبت شده است.');
    if (phoneIdentifier(input.phone) && state.users.some(user => phoneIdentifier(user.phone) === phoneIdentifier(input.phone))) return fail(res, 409, 'PHONE_TAKEN', 'شماره همراه قبلاً ثبت شده است.');
    const chosenUsername = input.username || 'user_' + randomBytes(8).toString('hex');
    if (state.users.some(user => identity(user.username || '') === chosenUsername)) return fail(res, 409, 'USERNAME_TAKEN', 'نام کاربری قبلاً ثبت شده است.');
    const id = 'usr_' + randomUUID(), workspaceId = 'ws_' + randomUUID(), createdAt = new Date().toISOString();
    const membership = { workspaceId, workspaceName: `فضای کاری ${input.name}`, role: 'OWNER', permissions: ['*'], joinedAt: createdAt };
    const user = { id, email: input.email, name: input.name, fullName: input.name, firstName: input.name.split(/\s+/)[0], lastName: input.name.split(/\s+/).slice(1).join(' '), username: chosenUsername, phone: input.phone, passwordHash: (req as any).preparedPassword?.password === input.password ? (req as any).preparedPassword.hash : bcrypt.hashSync(input.password, 12), role: 'USER', systemRole: 'USER', status: 'ACTIVE', accountStatus: 'ACTIVE', approvalStatus: 'approved', approvedRole: 'USER', requestedRole: 'USER', isActive: true, localPasswordRequired: false, personalWorkspaceId: workspaceId, workspace: workspaceId, memberships: [membership], createdAt, updatedAt: createdAt, avatar: localAvatar(input.name), emailVerified: false, loginCount: 0 };
    const workspace = { id: workspaceId, name: membership.workspaceName, ownerId: id, inviteCode: randomBytes(16).toString('hex'), createdAt, members: [{ userId: id, name: user.name, email: user.email, username: user.username, phone: user.phone, avatar: user.avatar, role: 'OWNER', permissions: ['*'], joinedAt: createdAt }] };
    state.users.push(user); state.workspaces.push(workspace);
    state.userProfiles.push({ id: 'prof_' + randomUUID(), userId: id, fullName: input.name, emailAddress: input.email, phoneNumber: input.phone, assignedWorkspace: workspaceId, assignedRole: 'USER', currentStatus: 'ACTIVE', registrationDate: createdAt });
    state.userSettings.push({ id: 'set_' + randomUUID(), userId: id, theme: 'dark', language: 'fa', timezone: 'Asia/Tehran', notificationsEnabled: true });
    state.userPreferences.push({ id: 'pref_' + randomUUID(), userId: id, dashboardLayout: 'grid', itemsPerPage: 10 });
    audit(id, 'USER_REGISTERED', 'حساب محلی و فضای کاری شخصی ایجاد شد.');
    const token = issueSession(req, user);
    return res.status(201).json({ token, user: publicUserProjection(user), workspace });
  });
  router.post('/login', limited('login', 20), (req, res) => {
    const parsed = loginInput.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_FAILED', 'شناسه و رمز عبور معتبر را وارد کنید.');
    const input = parsed.data, user = findUser(input.identifier || input.email || input.username!);
    const correct = passwordMatches(req, input.password, typeof user?.passwordHash === 'string' ? user.passwordHash : dummyHash);
    if (!correct || !user || user.localPasswordRequired || !isAccountActive(user)) {
      if (user) {
        const history = { id: 'lh_' + randomUUID(), userId: user.id, email: user.email, sessionId: null, loginDate: new Date().toISOString(), loginTime: new Date().toISOString(), loginResult: 'Failed', ipAddress: req.ip || 'local' };
        const security = { id: 'se_' + randomUUID(), userId: user.id, eventType: 'FAILED_LOGIN_ATTEMPT', severity: 'warning', timestamp: new Date().toISOString(), details: 'ورود محلی ناموفق بود.' };
        state.loginHistory.push(history); state.securityEvents.push(security);
        (req as any).retainedSecurityAudit = { loginHistory: [structuredClone(history)], securityEvents: [structuredClone(security)] };
      }
      return fail(res, 401, 'INVALID_CREDENTIALS', 'شناسه یا رمز عبور نادرست است یا حساب امکان ورود ندارد.');
    }
    return res.json({ token: issueSession(req, user), user: publicUserProjection(user) });
  });
  router.get('/me', authenticateToken, (req: any, res) => res.json({ user: publicUserProjection(req.user) }));
  router.post('/logout', authenticateToken, (req: any, res) => { revokeSession(req.authSession, 'logout'); audit(req.user.id, 'LOGOUT', 'نشست جاری پایان یافت.'); res.json({ success: true }); });
  router.get('/sessions', authenticateToken, (req: any, res) => res.json(state.userSessions.filter(session => session.userId === req.user.id).map(({ tokenIdHash, ...session }) => ({ ...session, current: session.id === req.authSession.id }))));
  router.post('/sessions/:id/terminate', authenticateToken, (req: any, res) => {
    const session = state.userSessions.find(session => session.id === req.params.id && session.userId === req.user.id);
    if (!session) return fail(res, 404, 'SESSION_NOT_FOUND', 'نشست یافت نشد.');
    revokeSession(session, 'self_termination'); res.json({ success: true, requiresLogin: session.id === req.authSession.id });
  });
  router.post('/change-password', authenticateToken, (req: any, res) => {
    const parsed = z.object({ currentPassword: z.string().min(1).refine(value => Buffer.byteLength(value, 'utf8') <= 72), newPassword: password }).strict().safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_FAILED', 'رمز جدید حداقل ۱۲ نویسه و حداکثر ۷۲ بایت باشد.');
    if (!bcrypt.compareSync(parsed.data.currentPassword, req.user.passwordHash)) return fail(res, 400, 'INVALID_CURRENT_PASSWORD', 'رمز فعلی نادرست است.');
    req.user.passwordHash = bcrypt.hashSync(parsed.data.newPassword, 12); req.user.localPasswordRequired = false;
    revokeUserSessions(req.user.id, 'password_changed'); audit(req.user.id, 'PASSWORD_CHANGED', 'رمز تغییر کرد و همه نشست‌های کاربر لغو شدند.');
    res.json({ success: true, requiresLogin: true, message: 'رمز تغییر کرد؛ دوباره وارد شوید.' });
  });
  router.put('/profile/update', authenticateToken, (req: any, res) => {
    const parsed = profileInput.safeParse(req.body);
    if (!parsed.success) return fail(res, 400, 'VALIDATION_FAILED', 'فیلدهای پروفایل نامعتبرند یا تغییر آن‌ها مجاز نیست.');
    const input = parsed.data, user = req.user;
    const identityChanged = (input.email !== undefined && input.email !== user.email) || (input.username !== undefined && input.username !== user.username) || (input.phone !== undefined && phoneIdentifier(input.phone) !== phoneIdentifier(user.phone));
    if (identityChanged && (!input.currentPassword || !bcrypt.compareSync(input.currentPassword, user.passwordHash))) return fail(res, 400, 'CURRENT_PASSWORD_REQUIRED', 'برای تغییر شناسه ورود، رمز فعلی لازم است.');
    if (input.email && state.users.some(item => item.id !== user.id && identity(item.email || '') === input.email)) return fail(res, 409, 'EMAIL_TAKEN', 'ایمیل قبلاً ثبت شده است.');
    if (input.username && state.users.some(item => item.id !== user.id && identity(item.username || '') === input.username)) return fail(res, 409, 'USERNAME_TAKEN', 'نام کاربری قبلاً ثبت شده است.');
    if (input.phone && phoneIdentifier(input.phone) && state.users.some(item => item.id !== user.id && phoneIdentifier(item.phone) === phoneIdentifier(input.phone))) return fail(res, 409, 'PHONE_TAKEN', 'شماره همراه قبلاً ثبت شده است.');
    const { currentPassword, ...updates } = input;
    if (input.email && input.email !== user.email) user.emailVerified = false;
    Object.assign(user, updates, { updatedAt: new Date().toISOString() });
    if (input.name) user.fullName = input.name;
    for (const workspace of state.workspaces) for (const member of workspace.members || []) if (member.userId === user.id) Object.assign(member, { name: user.name, email: user.email, username: user.username, phone: user.phone, avatar: user.avatar });
    const profile = state.userProfiles.find(item => item.userId === user.id);
    if (profile) Object.assign(profile, { fullName: user.name, emailAddress: user.email, phoneNumber: user.phone, profilePhoto: user.avatar });
    if (identityChanged) revokeUserSessions(user.id, 'identity_changed');
    audit(user.id, 'PROFILE_UPDATED', 'اطلاعات پروفایل محلی بروزرسانی شد.');
    res.json({ success: true, user: publicUserProjection(user), requiresLogin: identityChanged });
  });
  router.post(['/forgot-password', '/reset-password', '/verify-email'], limited('recovery', 10), (_req, res) => fail(res, 409, 'LOCAL_RECOVERY_REQUIRED', 'بازیابی حساب فقط روی سیستم میزبان با دستور npm run local:account -- set-password --email EMAIL انجام می‌شود.'));
  return { router, prepareCredentials, authenticateToken, requireSystemAdmin, publicUserProjection, verifyAccessToken, revokeSession, revokeUserSessions, isAccountActive };
}
