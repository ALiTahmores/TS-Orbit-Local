import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Paperclip, Mic, Send, Reply, Pencil, Trash2, Pin, X, Code2, Copy, Users, Plus, RefreshCw, VolumeX, CheckCheck, Pause, Play, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { useProjectContext } from '../../context/ProjectContext';
import { conversationTitle, reactionGroups, receiptLabel } from '../../lib/chat';
import { uploadAsset, ManagedAsset } from '../../lib/assets';
import { MessageAttachment } from './MessageAttachment';
import { LocalImage } from '../common/LocalImage';
const button = 'inline-flex items-center justify-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs hover:bg-blue-50 dark:hover:bg-slate-800 disabled:opacity-40';
const field = 'w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-transparent p-2 text-sm';
export const MessagesView: React.FC<{
    teamId?: string;
}> = ({ teamId }) => {
    const c = useProjectContext();
    const { hasEarlierMessages,loadEarlierMessages,currentUser, activeWorkspaceId, chatConversations, chatMessages, chatUsers, chatRequests, activeConversation, setActiveConversation, fetchMessages, markConversationRead, typingInConversation, sendChatMessage, createConversation, editChatMessage, deleteChatMessage, reactToChatMessage, pinChatMessage, closeConversation, updateConversation, updateConversationMembers, removeConversationMember, muteConversation, sendChatRequest, respondToChatRequest, refreshCollaboration, realtimeStatus, collaborationError, chatTypingUsers, teams } = c;
    const [tab, setTab] = useState<'chats' | 'members' | 'requests'>('chats'), [search, setSearch] = useState(''), [messageSearch, setMessageSearch] = useState('');
    const [draft, setDraft] = useState(''), [reply, setReply] = useState<any>(null), [editing, setEditing] = useState<any>(null), [code, setCode] = useState(false);
    const [failedUpload, setFailedUpload] = useState<{
        file: File;
        voiceDuration?: number;
    } | null>(null);
    const [pendingVoice, setPendingVoice] = useState<{
        fileId: string;
        durationSeconds: number;
    } | null>(null);
    const [attachments, setAttachments] = useState<ManagedAsset[]>([]), [error, setError] = useState(''), [busy, setBusy] = useState(false), [showCreate, setShowCreate] = useState(false), [showManage, setShowManage] = useState(false);
    const [title, setTitle] = useState(''), [selectedMembers, setSelectedMembers] = useState<string[]>([]), [selectedTeam, setSelectedTeam] = useState(teamId || ''), [newMember, setNewMember] = useState('');
    const [requestTeam, setRequestTeam] = useState(''), [requestText, setRequestText] = useState(''), [collapsed, setCollapsed] = useState(false), [sidebarWidth, setSidebarWidth] = useState(300);
    const [recording, setRecording] = useState(false), [paused, setPaused] = useState(false), [seconds, setSeconds] = useState(0);
    const recorder = useRef<MediaRecorder | null>(null), stream = useRef<MediaStream | null>(null), chunks = useRef<Blob[]>([]), recordTime = useRef(0), timer = useRef<ReturnType<typeof setInterval> | null>(null);
    const scope = currentUser?.id + ':' + activeWorkspaceId + ':' + (activeConversation?.id || '');
    const currentScope = useRef(scope);
    currentScope.current = scope;
    const operation = useRef<AbortController | null>(null), typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null), end = useRef<HTMLDivElement>(null), sidebar = useRef<HTMLElement>(null);
    const activeId = activeConversation?.id;
    const run = async (action: () => Promise<any>) => { setError(''); setBusy(true); try {
        return await action();
    }
    catch (error) {
        if (currentScope.current === scope)
            setError(error instanceof Error ? error.message : 'عملیات انجام نشد.');
        return undefined;
    }
    finally {
        if (currentScope.current === scope)
            setBusy(false);
    } };
    const stopRecording = () => {
        if (timer.current)
            clearInterval(timer.current);
        timer.current = null;
        const active = recorder.current;
        if (active) {
            active.onstop = null;
            if (active.state !== 'inactive')
                active.stop();
        }
        stream.current?.getTracks().forEach(track => track.stop());
        stream.current = null;
        recorder.current = null;
        chunks.current = [];
        setRecording(false);
        setPaused(false);
        setSeconds(0);
        recordTime.current = 0;
    };
    useEffect(() => {
        setDraft('');
        setReply(null);
        setEditing(null);
        setCode(false);
        setAttachments([]);
        setPendingVoice(null);
        setFailedUpload(null);
        setError('');
        setBusy(false);
        setMessageSearch('');
        setShowManage(false);
        stopRecording();
        operation.current?.abort();
        operation.current = null;
        if (activeId) {
            void fetchMessages(activeId);
            void markConversationRead(activeId).catch(() => { });
        }
        return () => { operation.current?.abort(); if (typingTimer.current)
            clearTimeout(typingTimer.current); if (activeId)
            typingInConversation(activeId, false); stopRecording(); };
    }, [scope]);
    useEffect(() => { if (activeId && chatMessages.some(message => message.conversationId === activeId && message.senderId !== currentUser?.id && !(message.readBy || []).includes(currentUser?.id)))
        void markConversationRead(activeId).catch(() => { }); }, [activeId, chatMessages]);
    useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [activeId, chatMessages.at(-1)?.id]);
    useEffect(() => { if (teamId && activeConversation?.teamId !== teamId)
        setActiveConversation(null); }, [teamId]);
    const conversations = chatConversations.filter(row => (!teamId || row.teamId === teamId) && conversationTitle(row, currentUser?.id).toLowerCase().includes(search.toLowerCase()));
    const members = chatUsers.filter(user => user.id !== currentUser?.id && user.name?.toLowerCase().includes(search.toLowerCase()));
    const messages = useMemo(() => chatMessages.filter(message => message.conversationId === activeId && (!messageSearch || [message.content, message.codeSnippet?.code, ...(message.attachments || []).map((file: any) => file.name)].join(' ').toLowerCase().includes(messageSearch.toLowerCase()))), [chatMessages, activeId, messageSearch]);
    const canSend = !!activeConversation?.permissions?.send && activeConversation.status !== 'closed';
    const manage = !!activeConversation?.permissions?.manage;
    const submit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!activeId || !canSend || busy || !draft.trim() && !attachments.length)
            return;
        const value = await run(async () => editing ? editChatMessage(editing.id, draft, code ? { language: 'text', code: draft } : null) : sendChatMessage(activeId, code ? 'کد به اشتراک گذاشته شد' : draft, attachments, reply?.id, pendingVoice ? { voiceNote: pendingVoice } : code ? { codeSnippet: { language: 'text', code: draft } } : undefined));
        if (value && currentScope.current === scope) {
            setDraft('');
            setAttachments([]);
            setPendingVoice(null);
            setReply(null);
            setEditing(null);
            setCode(false);
            typingInConversation(activeId, false);
        }
    };
    const upload = async (file: File, voiceDuration?: number) => {
        if (!activeId || !canSend)
            return;
        setFailedUpload({ file, voiceDuration });
        const controller = new AbortController();
        operation.current?.abort();
        operation.current = controller;
        const asset = await run(() => uploadAsset(file, { name: file.name, conversationId: activeId }, undefined, undefined, controller.signal));
        if (asset && currentScope.current === scope) {
            setFailedUpload(null);
            setAttachments(rows => [...rows, asset]);
            if (voiceDuration)
                setPendingVoice({ fileId: asset.id, durationSeconds: voiceDuration });
        }
    };
    const startRecording = async () => {
        if (!activeId || !canSend)
            return;
        try {
            if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined')
                throw new Error('ضبط صدا در این مرورگر پشتیبانی نمی‌شود.');
            const audio = await navigator.mediaDevices.getUserMedia({ audio: true });
            if (currentScope.current !== scope) {
                audio.getTracks().forEach(track => track.stop());
                return;
            }
            stream.current = audio;
            const mime = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4'].find(value => MediaRecorder.isTypeSupported(value));
            const capture = new MediaRecorder(audio, mime ? { mimeType: mime } : undefined);
            recorder.current = capture;
            chunks.current = [];
            capture.ondataavailable = event => { if (event.data.size)
                chunks.current.push(event.data); };
            capture.onerror = () => { stopRecording(); setError('ضبط صدا متوقف شد؛ دوباره ضبط کنید.'); };
            capture.start(200);
            recordTime.current = 0;
            setSeconds(0);
            setRecording(true);
            setPaused(false);
            setError('');
            timer.current = setInterval(() => { recordTime.current++; setSeconds(recordTime.current); }, 1000);
        }
        catch (error) {
            stopRecording();
            setError(error instanceof Error ? error.message : 'دسترسی به میکروفن انجام نشد.');
        }
    };
    const pauseRecording = () => { const capture = recorder.current; if (!capture)
        return; if (capture.state === 'recording') {
        capture.pause();
        if (timer.current)
            clearInterval(timer.current);
        setPaused(true);
    }
    else if (capture.state === 'paused') {
        capture.resume();
        timer.current = setInterval(() => { recordTime.current++; setSeconds(recordTime.current); }, 1000);
        setPaused(false);
    } };
    const sendVoice = () => {
        const capture = recorder.current;
        if (!capture || capture.state === 'inactive' || !activeId)
            return;
        const duration = recordTime.current;
        if (timer.current)
            clearInterval(timer.current);
        timer.current = null;
        capture.onstop = () => {
            const blob = new Blob(chunks.current, { type: capture.mimeType || 'audio/webm' });
            stream.current?.getTracks().forEach(track => track.stop());
            stream.current = null;
            recorder.current = null;
            setRecording(false);
            setPaused(false);
            setSeconds(0);
            if (currentScope.current !== scope)
                return;
            if (!blob.size || duration < 1) {
                setError('ضبط صدا خالی است؛ دوباره ضبط کنید.');
                return;
            }
            const extension = blob.type.includes('ogg') ? 'ogg' : blob.type.includes('mp4') ? 'm4a' : 'webm';
            const file = new File([blob], 'voice-' + Date.now() + '.' + extension, { type: blob.type.split(';')[0] });
            setFailedUpload({ file, voiceDuration: duration });
            const controller = new AbortController();
            operation.current = controller;
            void run(async () => { const asset = await uploadAsset(file, { conversationId: activeId }, undefined, undefined, controller.signal); if (currentScope.current !== scope)
                return; setFailedUpload(null); const voice = { fileId: asset.id, durationSeconds: duration }; setAttachments(rows => [...rows, asset]); setPendingVoice(voice); await sendChatMessage(activeId, draft || 'پیام صوتی', [...attachments, asset], reply?.id, { voiceNote: voice }); if (currentScope.current === scope) {
                setReply(null);
                setAttachments([]);
                setPendingVoice(null);
                setDraft('');
            } });
        };
        capture.stop();
    };
    const select = (conversation: any) => { setActiveConversation(conversation); setCollapsed(false); };
    const create = async (event: React.FormEvent) => { event.preventDefault(); const row = await run(() => createConversation(undefined, title, true, selectedTeam || undefined, selectedTeam ? undefined : selectedMembers)); if (row) {
        setShowCreate(false);
        setTitle('');
        setSelectedMembers([]);
        select(row);
    } };
    const beginDM = async (user: any) => { const row = await run(() => createConversation(user.id)); if (row) {
        setTab('chats');
        select(row);
    } };
    const resize = (event: React.PointerEvent) => { event.preventDefault(); const move = (e: PointerEvent) => { if (sidebar.current)
        setSidebarWidth(Math.max(220, Math.min(460, sidebar.current.getBoundingClientRect().right - e.clientX))); }; const done = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', done); }; window.addEventListener('pointermove', move); window.addEventListener('pointerup', done, { once: true }); };
    return <div dir="rtl" className="flex flex-col h-[min(78vh,900px)] min-h-[520px] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100">
  <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2">
   <h2 className="font-bold text-sm">{teamId ? 'گفتگوهای تیم' : 'پیام‌ها و گفتگوها'}</h2>
   <span role="status" className="text-xs">{realtimeStatus === 'connected' ? 'متصل' : realtimeStatus === 'reconnecting' ? 'در حال اتصال مجدد' : 'ارتباط زنده قطع است؛ اطلاعات را تازه کنید'}</span>
   <button className={button} title="تازه‌سازی گفتگوها" onClick={() => void refreshCollaboration()}><RefreshCw size={14}/><span>تازه‌سازی</span></button>
  </div>
  {(error || collaborationError) && <div role="alert" className="bg-rose-50 text-rose-800 px-4 py-2 text-xs">{error || collaborationError}</div>}
  <div className="flex flex-1 min-h-0">
   <aside ref={sidebar} style={{ width: collapsed ? 48 : sidebarWidth }} className="shrink-0 max-w-[65vw] border-l border-slate-200 dark:border-slate-700 flex flex-col relative">
    <button className={button + ' m-2'} title={collapsed ? 'نمایش گفتگوها' : 'بستن فهرست'} onClick={() => setCollapsed(!collapsed)}>{collapsed ? <PanelRightOpen size={16}/> : <PanelRightClose size={16}/>}</button>
    {!collapsed && <>
     <div className="px-3 pb-3 space-y-2"><input aria-label="جستجوی گفتگو و اعضا" placeholder="جستجو..." className={field} value={search} onChange={event => setSearch(event.target.value)}/><div className="flex gap-1">{(['chats', 'members', 'requests'] as const).map(value => <button key={value} className={button + (tab === value ? ' bg-blue-100 dark:bg-blue-950' : '')} onClick={() => setTab(value)}>{value === 'chats' ? 'گفتگوها' : value === 'members' ? 'اعضا' : 'درخواست‌ها'}</button>)}</div><button className={button + ' w-full'} onClick={() => { setShowCreate(!showCreate); setSelectedTeam(teamId || ''); }}><Plus size={14}/>گروه یا کانال جدید</button></div>
     <div className="flex-1 overflow-auto p-2 space-y-2">
      {tab === 'chats' && conversations.length === 0 && <p className="text-xs p-3 text-slate-500">هنوز گفتگویی ندارید. از اعضا یک مخاطب انتخاب کنید.</p>}
      {tab === 'chats' && conversations.map(row => <button type="button" key={row.id} data-testid={'conversation-' + row.id} onClick={() => select(row)} className={'w-full text-right rounded-xl p-3 border ' + (activeId === row.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800')}><span className="font-bold text-sm">{conversationTitle(row, currentUser?.id)}</span>{row.muted && <VolumeX size={12} className="inline mx-1"/>}<div className="flex justify-between gap-2 text-xs mt-1"><span className="truncate opacity-60">{row.lastMessage?.content || 'بدون پیام'}{row.status === 'closed' ? ' · بسته' : ''}</span>{row.unreadCount > 0 && <span className="bg-blue-600 text-white rounded-full px-2">{row.unreadCount}</span>}</div></button>)}
      {tab === 'members' && members.map(user => <button key={user.id} disabled={busy || user.canDirectChat === false} className={button + ' w-full justify-start'} onClick={() => void beginDM(user)}><LocalImage src={user.avatar} className="w-8 h-8 rounded-full" alt=""/><span>{user.name}</span><small className={user.status==='online'?'text-emerald-600':'text-slate-400'}>{user.status==='online'?'آنلاین':'آفلاین'}</small>{user.canDirectChat === false && <small>نیازمند درخواست</small>}</button>)}
      {tab === 'members' && members.length === 0 && <p className="p-3 text-xs">عضو دیگری در این فضای کاری پیدا نشد.</p>}
      {tab === 'requests' && <><form onSubmit={event => { event.preventDefault(); void run(() => sendChatRequest(requestTeam, requestText)).then(value => { if (value)
            setRequestText(''); }); }} className="space-y-2 p-2"><label className="text-xs">درخواست گفتگو با تیم<select aria-label="تیم مقصد درخواست" className={field} value={requestTeam} onChange={event => setRequestTeam(event.target.value)}><option value="">انتخاب تیم</option>{teams.map((team: any) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label><textarea aria-label="متن درخواست گفتگو" className={field} value={requestText} onChange={event => setRequestText(event.target.value)} placeholder="متن درخواست"/><button className={button} disabled={busy || !requestTeam || !requestText.trim()}>ارسال درخواست</button></form>{chatRequests.map(request => <div className="border rounded-xl p-3 text-xs space-y-2" key={request.id}><b>{request.senderName || request.requesterName || 'درخواست گفتگو'}</b><p>{request.requestText}</p><p>{request.status}</p>{request.canRespond && request.status === 'pending' && <div className="flex gap-1">{(['approved', 'rejected', 'blocked'] as const).map(status => <button className={button} disabled={busy} key={status} onClick={() => void run(() => respondToChatRequest(request.id, status))}>{status === 'approved' ? 'تأیید' : status === 'rejected' ? 'رد' : 'مسدود'}</button>)}</div>}</div>)}</>}
     </div><div onPointerDown={resize} className="absolute top-0 bottom-0 -left-1 w-2 cursor-col-resize touch-none" role="separator" aria-label="تغییر عرض گفتگوها"/>
    </>}
   </aside>
   <main className="flex-1 min-w-0 flex flex-col">
    {showCreate && <form onSubmit={create} className="p-4 space-y-2 border-b bg-slate-50 dark:bg-slate-800"><div className="flex justify-between"><b className="text-sm">ایجاد گروه یا کانال تیم</b><button type="button" onClick={() => setShowCreate(false)} aria-label="بستن ایجاد گفتگو"><X size={16}/></button></div><input aria-label="عنوان گفتگو" required value={title} onChange={event => setTitle(event.target.value)} className={field} placeholder="عنوان گفتگو"/><select aria-label="تیم کانال" className={field} value={selectedTeam} onChange={event => setSelectedTeam(event.target.value)}><option value="">گروه با اعضای انتخابی</option>{teams.map((team: any) => <option key={team.id} value={team.id}>{team.name}</option>)}</select>{!selectedTeam && <div className="flex flex-wrap gap-2 max-h-28 overflow-auto">{chatUsers.filter(user => user.id !== currentUser?.id).map(user => <label className="text-xs" key={user.id}><input type="checkbox" checked={selectedMembers.includes(user.id)} onChange={event => setSelectedMembers(rows => event.target.checked ? [...rows, user.id] : rows.filter(id => id !== user.id))}/> {user.name}</label>)}</div>}<button className={button} disabled={busy || !title.trim() || !selectedTeam && !selectedMembers.length}>ایجاد گفتگو</button></form>}
    {!activeConversation ? <div className="m-auto p-6 text-center text-sm text-slate-500"><Users className="mx-auto mb-3"/>برای آغاز، یک گفتگوی واقعی را انتخاب یا ایجاد کنید.</div> : <>
     <header className="p-3 border-b border-slate-200 dark:border-slate-700 flex flex-wrap justify-between items-center gap-2"><div><h3 className="font-bold">{conversationTitle(activeConversation, currentUser?.id)}</h3><p className="text-xs text-slate-500">{activeConversation.members?.map((member: any) => member.name+(member.status==='online'?' (آنلاین)':' (آفلاین)')).join('، ')}{activeConversation.status === 'closed' ? ' · گفتگو بسته است' : ''}</p></div><div className="flex gap-1"><button className={button} onClick={() => void run(() => muteConversation(activeId, !activeConversation.muted))}>{activeConversation.muted ? 'فعال کردن اعلان' : 'بی‌صدا'}</button>{manage && <button className={button} onClick={() => setShowManage(!showManage)}>مدیریت گفتگو</button>}</div></header>
     {showManage && <div className="p-3 border-b text-xs space-y-2"><form onSubmit={event => { event.preventDefault(); if (title.trim())
            void run(() => updateConversation(activeId, { title })); }} className="flex gap-2"><input className={field} aria-label="نام جدید گفتگو" value={title} onChange={event => setTitle(event.target.value)} placeholder="نام جدید گفتگو"/><button className={button} disabled={busy || !title.trim()}>ذخیره نام</button></form><button className={button} disabled={busy} onClick={() => void run(() => closeConversation(activeId, activeConversation.status !== 'closed'))}>{activeConversation.status === 'closed' ? 'بازگشایی گفتگو' : 'بستن گفتگو'}</button>{activeConversation.type === 'group' && <><div className="flex gap-2"><select aria-label="افزودن عضو گفتگو" className={field} value={newMember} onChange={event => setNewMember(event.target.value)}><option value="">انتخاب عضو</option>{chatUsers.filter(user => !activeConversation.participants?.includes(user.id)).map(user => <option key={user.id} value={user.id}>{user.name}</option>)}</select><button className={button} disabled={busy || !newMember} onClick={() => void run(() => updateConversationMembers(activeId, [newMember]))}>افزودن عضو</button></div>{activeConversation.members?.filter((member: any) => member.id !== currentUser?.id).map((member: any) => <button key={member.id} className={button + ' m-1'} disabled={busy} onClick={() => void run(() => removeConversationMember(activeId, member.id))}>حذف {member.name}</button>)}</>}</div>}
     <div className="p-2 border-b"><label className="flex gap-2 items-center text-xs"><Search size={14}/><input className="w-full bg-transparent p-1 outline-none" aria-label="جستجو در پیام‌ها" placeholder="جستجو در همین گفتگو" value={messageSearch} onChange={event => setMessageSearch(event.target.value)}/></label></div>
     {(activeConversation.pinnedMessages || []).length > 0 && <div className="bg-amber-50 dark:bg-amber-950 text-xs p-2 flex gap-2 flex-wrap"><Pin size={14}/>{activeConversation.pinnedMessages.map((message: any) => <button key={typeof message === 'string' ? message : message.messageId || message.id} onClick={() => document.getElementById('message-' + (typeof message === 'string' ? message : message.messageId || message.id))?.scrollIntoView({ block: 'center' })}>{typeof message === 'string' ? 'پیام سنجاق شده' : message.content || 'پیوست'}</button>)}</div>}
     <div className="flex-1 min-h-0 overflow-auto px-3 md:px-5 py-4 space-y-4" aria-label="پیام‌های گفتگو">
      {hasEarlierMessages&&<button className={button} disabled={busy} onClick={()=>void run(loadEarlierMessages)}>پیام‌های قدیمی‌تر</button>}
      {messages.length === 0 && <p className="text-center text-xs text-slate-500 p-6">{messageSearch ? 'پیامی با این عبارت پیدا نشد.' : 'هنوز پیامی در این گفتگو ثبت نشده است.'}</p>}
      {messages.map(message => { const own = message.senderId === currentUser?.id; return <article data-testid={'message-' + message.id} id={'message-' + message.id} key={message.id} className={'rounded-2xl p-3 max-w-[92%] md:max-w-[78%] ' + (own ? 'mr-auto bg-blue-50 dark:bg-blue-950' : 'ml-auto bg-slate-100 dark:bg-slate-800')}><div className="text-[10px] flex gap-2 justify-between mb-1"><b>{message.senderName || 'عضو گفتگو'}</b><time dateTime={message.createdAt || message.timestamp}>{new Date(message.createdAt || message.timestamp).toLocaleString('fa-IR', { dateStyle: 'short', timeStyle: 'short' })}</time></div>{message.deletedAt ? <p className="text-xs italic opacity-50">پیام حذف شده است.</p> : <>{message.replyTo && <div className="border-r-2 border-blue-400 text-xs opacity-70 pr-2 mb-2"><b>{message.replyTo.senderName}</b><p>{message.replyTo.content || 'پیام پیوست'}</p></div>}<p className="whitespace-pre-wrap break-words text-sm leading-7">{message.content}</p>{message.codeSnippet && <div className="my-2"><pre dir="ltr" className="overflow-auto text-left rounded-lg p-3 bg-slate-950 text-slate-100 text-xs"><code>{message.codeSnippet.code}</code></pre><button className={button + ' mt-1'} onClick={() => void navigator.clipboard.writeText(message.codeSnippet.code).catch(() => setError('کپی در این مرورگر مجاز نیست.'))}><Copy size={12}/>کپی کد</button></div>}{(message.attachments || []).map((file: any) => <MessageAttachment key={file.id + ':' + file.versionId} asset={file} scope={scope}/>)}{message.voiceNote && <p className="text-[10px] opacity-60">مدت ضبط: {message.voiceNote.durationSeconds} ثانیه</p>}<div className="text-[10px] flex justify-between mt-2 opacity-60"><span>{message.editedAt ? 'ویرایش شده' : ''}{message.pinned || message.isPinned ? ' · سنجاق شده' : ''}</span>{own && <span><CheckCheck size={12} className="inline"/> {receiptLabel(message, activeConversation, currentUser?.id)}</span>}</div><div className="flex gap-1 flex-wrap my-1">{reactionGroups(message).map(reaction => <button key={reaction.emoji} className={button + (reaction.users.includes(currentUser?.id) ? ' border-blue-500' : '')} disabled={busy} onClick={() => void run(() => reactToChatMessage(message.id, reaction.emoji))}>{reaction.emoji} {reaction.count}</button>)}</div><div className="flex flex-wrap items-center gap-1 text-slate-500"><button title="پاسخ به پیام" className={button} disabled={!canSend} onClick={() => { setReply(message); setEditing(null); }}><Reply size={12}/></button>{own && canSend && <><button title="ویرایش پیام" className={button} onClick={() => { setEditing(message); setReply(null); setCode(!!message.codeSnippet); setDraft(message.codeSnippet?.code || message.content); }}><Pencil size={12}/></button><button title="حذف پیام" className={button} disabled={busy} onClick={() => void run(() => deleteChatMessage(message.id))}><Trash2 size={12}/></button></>}{manage && <button title={message.pinned ? 'برداشتن سنجاق' : 'سنجاق پیام'} className={button} disabled={busy} onClick={() => void run(() => pinChatMessage(activeId, message.id, !message.pinned))}><Pin size={12}/></button>}{['👍', '❤️', '🎉'].map(emoji => <button key={emoji} className="px-1" title={'واکنش ' + emoji} disabled={busy || !canSend} onClick={() => void run(() => reactToChatMessage(message.id, emoji))}>{emoji}</button>)}</div></>}</article>; })}<div ref={end}/>
     </div>
     <div className="p-3 border-t border-slate-200 dark:border-slate-700 space-y-2">
      {(chatTypingUsers[activeId] || []).length > 0 && <p className="text-xs text-blue-500" role="status">{chatTypingUsers[activeId].join('، ')} در حال نوشتن…</p>}
      {(reply || editing) && <div className="text-xs flex justify-between bg-slate-100 dark:bg-slate-800 p-2 rounded-lg"><span>{editing ? 'ویرایش پیام' : 'پاسخ به ' + reply.senderName}: {(editing || reply).content?.slice(0, 100)}</span><button title="لغو پاسخ یا ویرایش" onClick={() => { setReply(null); setEditing(null); setDraft(''); setCode(false); }}><X size={14}/></button></div>}
      {failedUpload && !busy && <div className="text-xs flex gap-2 items-center"><span>فایل انتخاب‌شده: {failedUpload.file.name}</span><button className={button} onClick={() => void upload(failedUpload.file, failedUpload.voiceDuration)}>تلاش مجدد بارگذاری</button><button title="لغو فایل انتخاب‌شده" onClick={() => setFailedUpload(null)}><X size={12}/></button></div>}
      {attachments.length > 0 && <div className="flex gap-2 flex-wrap">{attachments.map(file => <span className="text-xs border rounded-lg p-2" key={file.id}>{file.name}<button title={'برداشتن ' + file.name} onClick={() => { setAttachments(rows => rows.filter(row => row.id !== file.id)); if (pendingVoice?.fileId === file.id)
            setPendingVoice(null); }}><X size={12}/></button></span>)}</div>}
      {recording ? <div className="flex gap-3 items-center text-sm"><span role="status">ضبط {seconds} ثانیه{paused ? ' · متوقف' : ''}</span><button className={button} title="توقف یا ادامه ضبط" onClick={pauseRecording}>{paused ? <Play size={14}/> : <Pause size={14}/>}</button><button className={button} title="لغو ضبط" onClick={stopRecording}><Trash2 size={14}/></button><button className={button} onClick={sendVoice} disabled={busy}>ارسال صدا</button></div> : <form onSubmit={submit} className="flex gap-2 items-end"><div className="flex-1"><textarea rows={2} aria-label="متن پیام" disabled={!canSend || busy} value={draft} onChange={event => { setDraft(event.target.value); typingInConversation(activeId, true); if (typingTimer.current)
            clearTimeout(typingTimer.current); typingTimer.current = setTimeout(() => typingInConversation(activeId, false), 2000); }} className={field + (code ? ' font-mono' : '')} dir={code ? 'ltr' : 'rtl'} placeholder={canSend ? 'پیام خود را بنویسید…' : 'امکان ارسال در این گفتگو ندارید.'}/></div><div className="flex flex-col gap-1"><button type="submit" className={button + ' bg-blue-600 text-white'} disabled={busy || !canSend || !draft.trim() && !attachments.length} title="ارسال پیام"><Send size={16}/></button><div className="flex gap-1"><label className={button + ' cursor-pointer'} title="پیوست فایل"><Paperclip size={14}/><input aria-label="فایل پیوست پیام" type="file" className="hidden" disabled={!canSend || busy || !!editing} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file)
            void upload(file); }}/></label><button type="button" className={button + (code ? ' bg-blue-100' : '')} title="حالت کد" disabled={!canSend || busy} onClick={() => setCode(!code)}><Code2 size={14}/></button><button type="button" className={button} title="ضبط پیام صوتی" disabled={!canSend || busy || !!editing} onClick={() => void startRecording()}><Mic size={14}/></button></div></div></form>}
      {busy && <p role="status" className="text-xs text-slate-500">در حال ثبت در سرور…</p>}
     </div>
    </>}
   </main>
  </div>
 </div>;
};
