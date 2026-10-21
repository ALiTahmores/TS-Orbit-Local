import { apiFetch, ApiError, getApiIdentity } from './api';
/** Every view has an independent revision; committed writes invalidate older reads. */
export class CollaborationRequests {
    private revisions = new Map<string, number>();
    private epoch = 0;
    constructor(private identity = () => JSON.stringify(getApiIdentity())) { }
    begin(key: string) {
        const revision = (this.revisions.get(key) || 0) + 1;
        this.revisions.set(key, revision);
        return { key, revision, epoch: this.epoch, identity: this.identity() };
    }
    accepts(ticket: ReturnType<CollaborationRequests['begin']>) {
        return ticket.epoch === this.epoch && ticket.identity === this.identity() && ticket.revision === this.revisions.get(ticket.key);
    }
    invalidate(key: string) { this.revisions.set(key, (this.revisions.get(key) || 0) + 1); }
    clear() { this.epoch++; this.revisions.clear(); }
}
export const chatPath = (id: string) => '/api/chat/conversations/' + encodeURIComponent(id);
export async function conversationWindow(id:string,pages=1) {
    let messages:any[]=[],hasMore=false;
    for(let page=0;page<pages;page++) {
        const before=messages[0]?.id;
        const rows=await collaborationRequest(chatPath(id)+'/messages?limit=500'+(before?'&before='+encodeURIComponent(before):''));
        if(!Array.isArray(rows))throw new Error('فهرست پیام‌ها معتبر نیست.');
        messages=[...rows,...messages];hasMore=rows.length===500;
        if(!hasMore)break;
    }
    return {messages,hasMore};
}
export async function collaborationRequest(path: string, method = 'GET', body?: unknown) {
    const response = await apiFetch(path, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return response.json();
}
export function conversationTitle(conversation: any, userId: string): string {
    return conversation.title || conversation.members?.filter((member: any) => member.id !== userId).map((member: any) => member.name).join('، ') || 'گفتگو';
}
export function reactionGroups(message: any): Array<{
    emoji: string;
    users: string[];
    count: number;
}> {
    return (message.reactions || []).map((reaction: any) => ({ emoji: reaction.emoji, users: reaction.users || reaction.userIds || [], count: reaction.count ?? (reaction.users || reaction.userIds || []).length }));
}
export function receiptLabel(message: any, conversation: any, userId: string) {
    const readers = (message.readBy || []).filter((id: string) => id !== userId);
    const otherMembers = (conversation.participants || []).filter((id: string) => id !== userId);
    return readers.length ? otherMembers.length > 0 && otherMembers.every((id: string) => readers.includes(id)) ? 'خوانده شده' : `خوانده شده توسط ${readers.length} نفر` : 'ذخیره شده';
}
export function messageAttachmentIds(attachments: any[] = []): string[] {
    return attachments.map(file => typeof file === 'string' ? file : file?.id).filter((id): id is string => typeof id === 'string' && !!id);
}
export function staleCollaborationError(error: unknown) { return error instanceof ApiError && error.code === 'STALE_REQUEST'; }
