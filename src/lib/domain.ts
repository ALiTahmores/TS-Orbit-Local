/** Client request contracts. Actor, scope, identity and totals are assigned by the server. */
export const taskStatus = (value: string) => ({TODO:'pending',IN_PROGRESS:'inprogress',UNDER_REVIEW:'review',COMPLETED:'completed'}[value] || value);
export const taskPriority = (value: string) => ({Urgent:'critical',High:'high',Medium:'medium',Low:'low','متوسط':'medium'}[value] || value);
export const projectStatusUI = (value?:string) => ({draft:'pending',delayed:'suspended',on_hold:'suspended',cancelled:'canceled',terminated:'canceled',inprogress:'in_progress'}[String(value || 'active').toLowerCase()] || String(value || 'active').toLowerCase());
/** Missing historical report values are never filled from live workspace data. */
export function reportSnapshot(report:any) {
  const number=(value:any)=>typeof value==='number' && Number.isFinite(value) && value>=0 ? value : undefined;
  const metrics=report?.metrics || {},tasks=report?.taskSummary || {},projects=report?.projectSummary || {};
  return {
    totalProjects:number(projects.totalProjects ?? metrics.totalProjects),
    avgProgress:number(projects.avgProgress ?? metrics.avgProgress),
    totalTasks:number(tasks.total ?? metrics.totalTasks),
    completed:number(tasks.completed ?? metrics.completed),
    pending:number(tasks.pending ?? metrics.pending),
    cancelled:number(tasks.cancelled ?? metrics.cancelled),
    overdue:number(tasks.overdue ?? metrics.overdue),
    velocity:number(metrics.velocity),
    projects:Array.isArray(report?.clientProjectsMatrix)?report.clientProjectsMatrix.filter((row:any)=>row && typeof row==='object' && !Array.isArray(row)):[],
    bottlenecks:Array.isArray(report?.bottlenecks)?report.bottlenecks.filter((value:any)=>typeof value==='string'):[],
    takeaways:Array.isArray(report?.keyTakeaways)?report.keyTakeaways.filter((value:any)=>typeof value==='string'):[],
  };
}
export function taskTransport(input: Record<string, any>) {
  const fields = ['projectId','title','description','department','departmentId','teamId','status','priority','startDate','deadline','dueDate','tags','dependencies','estimatedHours','subtasks','notes','category','clientVisible','links','initialComments'];
  const result = Object.fromEntries(Object.entries(input).filter(([key,value]) => fields.includes(key) && value !== undefined));
  if (input.status !== undefined) result.status = taskStatus(input.status);
  if (input.priority !== undefined) result.priority = taskPriority(input.priority);
  if (input.assignedMemberIds !== undefined || input.assignees !== undefined || input.assigneeId !== undefined) {
    result.assignedMemberIds = [...new Set(input.assignedMemberIds ?? input.assignees?.map((member:any) => member.userId || member.id) ?? (input.assigneeId ? [input.assigneeId] : []))];
  }
  if (input.attachments !== undefined) result.attachments = input.attachments.map((file:any) => typeof file === 'string' ? file : file.id);
  if (input.subtasks !== undefined) result.subtasks = input.subtasks.map((subtask:any) => Object.fromEntries(Object.entries(subtask).filter(([key,value])=>['id','title','note','completed'].includes(key) && value!==undefined)));
  return result;
}
export const assignedIds = (task: any): string[] => task?.assignedMemberIds ?? task?.assignees?.map((member:any) => member.userId || member.id) ?? (task?.assigneeId ? [task.assigneeId] : []);
export function englishDigits(value: string) {
  return value.replace(/[۰-۹]/g, d => String(d.charCodeAt(0)-1776)).replace(/[٠-٩]/g,d => String(d.charCodeAt(0)-1632));
}
const persian = new Intl.DateTimeFormat('en-US-u-ca-persian', {year:'numeric',month:'numeric',day:'numeric',timeZone:'UTC'});
export function persianDateParts(date: Date) {
  return Object.fromEntries(persian.formatToParts(date).filter(part => ['year','month','day'].includes(part.type)).map(part => [part.type, Number(part.value)]));
}
export function jalaliToISO(year: number, month: number, day: number): string {
  const cursor = new Date(Date.UTC(year + 621, 2, 1));
  for(let index=0;index<400;index++,cursor.setUTCDate(cursor.getUTCDate()+1)) {
    const parts = persianDateParts(cursor);
    if(parts.year===year && parts.month===month && parts.day===day) return cursor.toISOString().slice(0,10);
  }
  throw new Error('تاریخ انتخاب‌شده معتبر نیست.');
}
