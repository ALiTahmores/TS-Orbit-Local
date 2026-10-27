// Readable names for activity-log action codes recorded by the server.
export type ActivityCategory = 'task' | 'project' | 'comment' | 'system';

const LABELS: Record<string, string> = {
  TASK_CREATED: 'ساخت وظیفه', TASK_UPDATED: 'ویرایش وظیفه', TASK_STATUS_CHANGED: 'تغییر وضعیت وظیفه', TASK_DELETED: 'حذف وظیفه',
  SUBTASK_CREATED: 'افزودن زیرکار', SUBTASK_UPDATED: 'ویرایش زیرکار', SUBTASK_DELETED: 'حذف زیرکار',
  TIME_ENTRY_CREATED: 'ثبت زمان کار', TIME_ENTRY_UPDATED: 'ویرایش زمان کار', TIME_ENTRY_DELETED: 'حذف زمان کار',
  MILESTONE_CREATED: 'افزودن نقطهٔ عطف', MILESTONE_UPDATED: 'ویرایش نقطهٔ عطف', MILESTONE_DELETED: 'حذف نقطهٔ عطف',
  PROJECT_CREATED: 'ساخت پروژه', PROJECT_UPDATED: 'ویرایش پروژه', PROJECT_ACTIVATED: 'فعال‌سازی پروژه', PROJECT_DELETED: 'حذف پروژه',
  COMMENT_CREATED: 'ثبت نظر', COMMENT_UPDATED: 'ویرایش نظر', COMMENT_DELETED: 'حذف نظر',
  'feedback.created': 'ثبت بازخورد کارفرما', 'feedback.updated': 'به‌روزرسانی بازخورد کارفرما', 'feedback.deleted': 'حذف بازخورد کارفرما',
  DEPARTMENT_CREATED: 'ساخت دپارتمان', DEPARTMENT_UPDATED: 'ویرایش دپارتمان', DEPARTMENT_DELETED: 'حذف دپارتمان', DEPARTMENT_MEMBERS_UPDATED: 'تغییر اعضای دپارتمان',
  TEAM_CREATED_WITH_CHANNELS: 'ساخت تیم', TEAM_UPDATED: 'ویرایش تیم', TEAM_DELETED: 'حذف تیم', TEAM_MEMBERS_UPDATED: 'تغییر اعضای تیم',
  MODULE_DEFINITION_CREATED: 'تعریف ماژول', MODULE_DEFINITION_UPDATED: 'ویرایش تعریف ماژول', MODULE_DEFINITION_DELETED: 'حذف تعریف ماژول',
  MODULE_INSTANCE_CREATED: 'افزودن ماژول به دپارتمان', MODULE_INSTANCE_UPDATED: 'ویرایش ماژول دپارتمان', MODULE_INSTANCE_DELETED: 'حذف ماژول دپارتمان',
  ORGANIZATION_CREATED: 'ساخت سازمان', ORGANIZATION_UPDATED: 'ویرایش سازمان', ORGANIZATION_DELETED: 'حذف سازمان',
  NAVIGATION_CREATED: 'افزودن مورد منو', NAVIGATION_UPDATED: 'ویرایش منو', PERMISSION_UPDATED: 'تغییر سطح دسترسی',
  REPORT_CREATED: 'صدور گزارش', REPORTS_DELETED: 'حذف گزارش‌ها', TEMPLATE_CREATED: 'ذخیرهٔ قالب سازمانی',
  CHECKLIST_CREATED: 'افزودن مورد چک‌لیست', CHECKLIST_UPDATED: 'به‌روزرسانی چک‌لیست',
  CONTENT_CREATED: 'افزودن محتوا', CONTENT_UPDATED: 'ویرایش محتوا', QA_BUG_CREATED: 'ثبت مورد کنترل کیفیت', QA_BUG_UPDATED: 'به‌روزرسانی مورد کنترل کیفیت',
};

export const activityLabel = (action: string | undefined) => (action && LABELS[action]) || 'تغییر در فضای کاری';

export function activityCategory(action: string | undefined): ActivityCategory {
  const code = String(action || '');
  if (/^(TASK|SUBTASK|TIME_ENTRY|MILESTONE)_/.test(code)) return 'task';
  if (/^PROJECT_/.test(code)) return 'project';
  if (/^COMMENT_|^feedback\.|message|chat/i.test(code)) return 'comment';
  return 'system';
}
