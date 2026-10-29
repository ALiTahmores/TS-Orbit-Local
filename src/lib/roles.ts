// One display name per workspace role, used wherever a role is shown. Roles come
// from the server as enum strings (OWNER, DEVELOPER, …), including older aliases.
const ROLE_LABELS: Record<string, { fa: string; en: string }> = {
  OWNER: { fa: 'مالک فضای کاری', en: 'Workspace owner' },
  ADMIN: { fa: 'مدیر فضای کاری', en: 'Workspace admin' },
  SUPER_ADMIN: { fa: 'مدیر سیستم', en: 'System admin' },
  PROJECT_MANAGER: { fa: 'مدیر پروژه', en: 'Project manager' },
  MANAGER: { fa: 'مدیر', en: 'Manager' },
  MANAGEMENT: { fa: 'مدیریت', en: 'Management' },
  DEVELOPER: { fa: 'توسعه‌دهنده', en: 'Developer' },
  WORDPRESS_DEVELOPER: { fa: 'توسعه‌دهنده', en: 'Developer' },
  WP_DEV: { fa: 'توسعه‌دهنده', en: 'Developer' },
  DESIGNER: { fa: 'طراح رابط و محصول', en: 'Designer' },
  QA_ENGINEER: { fa: 'مهندس تضمین کیفیت', en: 'QA engineer' },
  SPECIALIST: { fa: 'متخصص فنی', en: 'Specialist' },
  VIEWER: { fa: 'ناظر (فقط خواندنی)', en: 'Viewer' },
  CLIENT: { fa: 'کارفرما', en: 'Client' },
  MEMBER: { fa: 'عضو فضای کاری', en: 'Member' },
  USER: { fa: 'عضو فضای کاری', en: 'Member' },
};

/** Roles the server lets manage projects and teams (server/policy/scope.ts `manager`). */
export const isManagerRole = (role: string | undefined | null) => ['OWNER', 'ADMIN', 'MANAGER', 'PROJECT_MANAGER'].includes(String(role || '').toUpperCase());
/** Roles that can never change workspace data. */
export const isReadOnlyRole = (role: string | undefined | null) => ['VIEWER', 'CLIENT', 'READ_ONLY', 'GUEST'].includes(String(role || '').toUpperCase());

export function roleLabel(role: string | undefined | null, locale: 'fa' | 'en' = 'fa'): string {
  const known = ROLE_LABELS[String(role || '').trim().toUpperCase()];
  if (known) return known[locale];
  return role?.trim() || ROLE_LABELS.MEMBER[locale];
}
