import { useCallback, useEffect, useRef, useState } from 'react';
import { getSocket } from '../lib/socket';
import { getApiIdentity } from '../lib/api';
import { chatPath, collaborationRequest, CollaborationRequests, messageAttachmentIds, staleCollaborationError, conversationWindow } from '../lib/chat';
export function useCollaboration(userId: string, workspaceId: string, authenticated: boolean) {
    const [chatConversations, setChatConversations] = useState<any[]>([]);
    const [chatMessages, setChatMessages] = useState<any[]>([]);
    const [hasEarlierMessages,setHasEarlierMessages]=useState(false);
    const messagePages=useRef(1);
    const [chatUsers, setChatUsers] = useState<any[]>([]);
    const [chatRequests, setChatRequests] = useState<any[]>([]);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [activityLogs, setActivityLogs] = useState<any[]>([]);
    const [activeConversation, storeActive] = useState<any>(null);
    const [chatTypingUsers, setTyping] = useState<Record<string, string[]>>({});
    const [collaborationError, setError] = useState('');
    const [realtimeStatus, setRealtimeStatus] = useState<'connected' | 'reconnecting' | 'offline'>('offline');
    const selected = useRef<any>(null), requests = useRef(new CollaborationRequests()), typingTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>()), readErrors = useRef(new Map<string, string>());
    const currentScope = () => { const identity = getApiIdentity(); return authenticated && userId === identity.userId && workspaceId === identity.workspaceId; };
    const failure = (error: unknown) => { if (!staleCollaborationError(error))
        setError(error instanceof Error ? error.message : 'دریافت اطلاعات انجام نشد.'); };
    const clearCollaboration = useCallback(() => {
        requests.current.clear();
        selected.current = null;
        storeActive(null);
        setChatConversations([]);
        setChatMessages([]);messagePages.current=1;setHasEarlierMessages(false);
        setChatUsers([]);
        setChatRequests([]);
        setNotifications([]);
        setActivityLogs([]);
        setTyping({});
        readErrors.current.clear();
        setError('');
        setRealtimeStatus('offline');
        for (const timer of typingTimers.current.values())
            clearTimeout(timer);
        typingTimers.current.clear();
    }, []);
    const setActiveConversation = useCallback((conversation: any) => {
        const previous = selected.current;
        const socket = getSocket();
        if (previous?.id !== conversation?.id) {
            if (previous?.id) {
                socket?.emit('typing', { conversationId: previous.id, isTyping: false });
                socket?.emit('leave', { conversationId: previous.id });
            }
            requests.current.invalidate('messages');
            setChatMessages([]);messagePages.current=1;setHasEarlierMessages(false);
            setTyping({});
        }
        selected.current = conversation;
        storeActive(conversation);
        if (conversation?.id)
            socket?.emit('join', { conversationId: conversation.id });
    }, []);
    const read = async (key: string, path: string | (()=>Promise<any>), commit: (value: any) => void) => {
        if (!currentScope())
            return;
        const ticket = requests.current.begin(key);
        try {
            const value = typeof path==='function'?await path():await collaborationRequest(path);
            if (requests.current.accepts(ticket)) {
                commit(value);
                readErrors.current.delete(key);
                setError([...readErrors.current.values()].join(' · '));
            }
        }
        catch (error) {
            if (requests.current.accepts(ticket) && !staleCollaborationError(error)) {
                readErrors.current.set(key, error instanceof Error ? error.message : 'دریافت اطلاعات انجام نشد.');
                setError([...readErrors.current.values()].join(' · '));
            }
        }
    };
    const fetchConversations = () => read('conversations', '/api/chat/conversations', value => {
        if (!Array.isArray(value))
            throw new Error('فهرست گفتگوها معتبر نیست.');
        setChatConversations(value);
        if (selected.current) {
            const next = value.find((row: any) => row.id === selected.current.id);
            if (next) {
                selected.current = next;
                storeActive(next);
            }
            else
                setActiveConversation(null);
        }
    });
    const fetchMessages = (id: string) => read('messages',()=>conversationWindow(id,messagePages.current),value=>{
        if(selected.current?.id!==id)return;
        setChatMessages(value.messages);setHasEarlierMessages(value.hasMore);
    });
    const loadEarlierMessages=async()=>{if(!selected.current?.id)return;messagePages.current++;await fetchMessages(selected.current.id);};
    const fetchChatUsers = () => read('users', '/api/chat/users', value => setChatUsers(Array.isArray(value) ? value : []));
    const fetchChatRequests = () => read('requests', '/api/chat/requests', value => setChatRequests(Array.isArray(value) ? value : []));
    const fetchNotifications = () => read('notifications', '/api/notifications', value => setNotifications(Array.isArray(value) ? value : []));
    const fetchActivity = () => read('activity', '/api/activity-logs', value => setActivityLogs(Array.isArray(value) ? value : []));
    const refreshAll = () => Promise.all([fetchConversations(), fetchChatUsers(), fetchChatRequests(), fetchNotifications(), fetchActivity(), ...(selected.current?.id ? [fetchMessages(selected.current.id)] : [])]);
    const mutate = async (path: string, method: string, body?: unknown, conversationId?: string) => {
        const value = await collaborationRequest(path, method, body);
        requests.current.invalidate('conversations');
        if (conversationId && selected.current?.id === conversationId)
            requests.current.invalidate('messages');
        requests.current.invalidate('requests');
        // A committed response is applied immediately; a later refresh can fail independently.
        if (value?.id && value.conversationId && selected.current?.id === value.conversationId)
            setChatMessages(rows => { const index = rows.findIndex(row => row.id === value.id); return index < 0 ? [...rows, value] : rows.map(row => row.id === value.id ? value : row); });
        if (value?.id && Array.isArray(value.participants)) {
            setChatConversations(rows => [value, ...rows.filter(row => row.id !== value.id)]);
            if (selected.current?.id === value.id) {
                selected.current = value;
                storeActive(value);
            }
        }
        void fetchConversations();
        void fetchChatRequests();
        void fetchNotifications();
        void fetchActivity();
        if (conversationId && selected.current?.id === conversationId)
            void fetchMessages(conversationId);
        return value;
    };
    const sendChatMessage = async (id: string, content: string, attachments: any[] = [], replyToId?: string, extra?: Record<string, unknown>) => mutate(chatPath(id) + '/messages', 'POST', { content, attachmentIds: messageAttachmentIds(attachments), ...(replyToId ? { replyToMessageId: replyToId } : {}), ...extra }, id);
    const createConversation = (recipientId?: string, title?: string, isGroup?: boolean, teamId?: string, memberIds?: string[]) => mutate('/api/chat/conversations', 'POST', { recipientId, title, isGroup, teamId, memberIds });
    const sendChatRequest = (targetTeamId: string, text: string) => mutate('/api/chat/requests', 'POST', { targetTeamId, requestText: text });
    const respondToChatRequest = (id: string, status: string) => mutate('/api/chat/requests/' + encodeURIComponent(id) + '/respond', 'PUT', { status });
    const deleteChatMessage = (id: string) => mutate('/api/chat/messages/' + encodeURIComponent(id), 'DELETE', undefined, selected.current?.id);
    const editChatMessage = (id: string, content: string, codeSnippet?: any) => mutate('/api/chat/messages/' + encodeURIComponent(id), 'PUT', { content, ...(codeSnippet !== undefined ? { codeSnippet } : {}) }, selected.current?.id);
    const reactToChatMessage = (id: string, emoji: string) => mutate('/api/chat/messages/' + encodeURIComponent(id) + '/react', 'POST', { emoji }, selected.current?.id);
    const pinChatMessage = (id: string, messageId: string, pin: boolean) => mutate(chatPath(id) + '/pin', 'POST', { messageId, pin }, id);
    const closeConversation = (id: string, closed = true) => mutate(chatPath(id) + '/close', 'POST', { closed }, id);
    const updateConversation = (id: string, updates: any) => mutate(chatPath(id), 'PUT', updates, id);
    const updateConversationMembers = (id: string, userIds: string[]) => mutate(chatPath(id) + '/members', 'POST', { userIds }, id);
    const removeConversationMember = (id: string, memberId: string) => mutate(chatPath(id) + '/members/' + encodeURIComponent(memberId), 'DELETE', undefined, id);
    const muteConversation = (id: string, muted: boolean) => mutate(chatPath(id) + '/preferences', 'PUT', { muted }, id);
    const markConversationRead = async (id: string) => { const value = await collaborationRequest(chatPath(id) + '/read', 'POST', {}); requests.current.invalidate('conversations'); setChatConversations(rows => rows.map(row => row.id === id ? { ...row, unreadCount: 0 } : row)); void fetchConversations(); return value; };
    const typingInConversation = (id: string, isTyping: boolean) => getSocket()?.emit('typing', { conversationId: id, isTyping });
    const markNotificationAsRead = async (id: string) => { const value = await collaborationRequest('/api/notifications/' + encodeURIComponent(id) + '/read', 'PUT'); requests.current.invalidate('notifications'); if (value?.id === id)
        setNotifications(rows => rows.map(row => row.id === id ? value : row));
    else
        throw new Error('پاسخ ثبت خواندن اعلان معتبر نیست.'); void fetchNotifications(); };
    const markAllNotificationsAsRead = async () => { await collaborationRequest('/api/notifications/read-all', 'PUT'); requests.current.invalidate('notifications'); setNotifications(rows => rows.map(row => ({ ...row, read: true }))); void fetchNotifications(); };
    const clearNotifications = async () => { await collaborationRequest('/api/notifications/clear', 'POST'); requests.current.invalidate('notifications'); setNotifications([]); void fetchNotifications(); };
    const live = useRef<any>({});
    live.current = { refreshAll, fetchConversations, fetchMessages, fetchChatRequests, fetchChatUsers,fetchNotifications, fetchActivity };
    useEffect(() => {
        clearCollaboration();
        if (!authenticated || !userId || !workspaceId)
            return;
        const socket = getSocket();
        if (!socket)
            return;
        const onConnect = () => { setRealtimeStatus('connected'); setTyping({}); if (selected.current?.id)
            socket.emit('join', { conversationId: selected.current.id }); void live.current.refreshAll(); };
        const onDisconnect = () => { setRealtimeStatus('reconnecting'); setTyping({}); };
        const onError = () => setRealtimeStatus('offline');
        const onChat = (event: any) => { void live.current.fetchConversations(); if (selected.current?.id && (!event?.conversationId || event.conversationId === selected.current.id))
            void live.current.fetchMessages(selected.current.id); };
        const onPresence=()=>{void live.current.fetchChatUsers();void live.current.fetchConversations();};
        const onRequests = () => { void live.current.fetchChatRequests(); void live.current.fetchConversations(); };
        const onNotifications = () => void live.current.fetchNotifications();
        const onActivity = () => void live.current.fetchActivity();
        const onTyping = (event: any) => {
            if (!event?.conversationId || event.userId === userId || !event.userId)
                return;
            const key = event.conversationId + ':' + event.userId;
            const name = event.username || event.name || 'عضو گفتگو';
            const remove = () => { setTyping(rows => ({ ...rows, [event.conversationId]: (rows[event.conversationId] || []).filter(item => item !== name) })); typingTimers.current.delete(key); };
            clearTimeout(typingTimers.current.get(key));
            if (!event.isTyping) {
                remove();
                return;
            }
            setTyping(rows => ({ ...rows, [event.conversationId]: [...new Set([...(rows[event.conversationId] || []), name])] }));
            typingTimers.current.set(key, setTimeout(remove, 7000));
        };
        const events: any = { 'connect': onConnect, 'disconnect': onDisconnect, 'connect_error': onError, 'app_chat_updated': onChat, 'app_chat_requests_updated': onRequests, 'message_seen': onChat, 'app_notifications_updated': onNotifications, 'app_activity_updated': onActivity, 'typing_status': onTyping,'online_status':onPresence };
        for (const [event, handler] of Object.entries(events))
            socket.on(event, handler as any);
        if (socket.connected)
            onConnect();
        else {
            setRealtimeStatus('reconnecting');
            void live.current.refreshAll();
        }
        const timer = setInterval(() => { if (!socket.connected)
            void live.current.refreshAll(); }, 15000);
        return () => { clearInterval(timer); for (const [event, handler] of Object.entries(events))
            socket.off(event, handler as any); requests.current.clear(); for (const timer of typingTimers.current.values())
            clearTimeout(timer); typingTimers.current.clear(); };
    }, [authenticated, userId, workspaceId, clearCollaboration]);
    return { hasEarlierMessages,loadEarlierMessages,chatConversations, chatMessages, chatUsers, chatRequests, notifications, activityLogs, activeConversation, setActiveConversation, chatTypingUsers, collaborationError, realtimeStatus, clearCollaboration, fetchConversations, fetchMessages, fetchChatUsers, fetchChatRequests, fetchNotifications, fetchActivity, refreshCollaboration: refreshAll, sendChatMessage, createConversation, sendChatRequest, respondToChatRequest, deleteChatMessage, editChatMessage, reactToChatMessage, pinChatMessage, closeConversation, updateConversation, updateConversationMembers, removeConversationMember, muteConversation, markConversationRead, typingInConversation, markNotificationAsRead, markAllNotificationsAsRead, clearNotifications };
}
