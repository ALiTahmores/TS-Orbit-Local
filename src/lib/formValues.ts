/** Values used by editors must keep identity and stored instants separate from labels. */
export function calendarDay(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value)) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

/** Omission preserves a timestamp or a legacy value when another field is edited. */
export function deadlineEditPatch(value: string, changed: boolean): Record<string, string> {
  return changed ? { deadline: value, dueDate: value } : {};
}

interface LeadMember { id: string; userId?: string; name: string; role?: string }
export function projectLeadSelection(
  project: { teamLeadId?: string; leadId?: string; teamLead?: string },
  members: LeadMember[],
  label: (name: string, role?: string) => string,
): { id: string; label: string } {
  const storedId = project.teamLeadId || project.leadId || '';
  const memberId = (member: LeadMember) => member.userId || member.id;
  if (storedId) {
    const member = members.find(candidate => memberId(candidate) === storedId);
    return { id: storedId, label: member ? label(member.name, member.role) : project.teamLead || '' };
  }
  const candidates = members.filter(member => project.teamLead && [member.name, `${member.name} (${member.role || 'LEAD'})`, label(member.name, member.role)].includes(project.teamLead));
  const member = candidates.length === 1 ? candidates[0] : undefined;
  return { id: member ? memberId(member) : '', label: member ? label(member.name, member.role) : project.teamLead || '' };
}

/** A server-generated avatar need not satisfy the upload contract again on every edit. */
export const changedAvatar = (current: string | undefined, selected: string): string | undefined =>
  selected === (current || '') ? undefined : selected;
