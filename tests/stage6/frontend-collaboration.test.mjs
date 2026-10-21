import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const compile=source=>ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const url=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
class Storage{getItem(key){return this[key]??null;}setItem(key,value){this[key]=String(value);}removeItem(key){delete this[key];}}
globalThis.localStorage=new Storage();globalThis.window=new EventTarget();window.location={origin:'http://localhost:3000'};
const apiUrl=url(compile(fs.readFileSync(new URL('../../src/lib/api.ts',import.meta.url),'utf8')));
const api=await import(apiUrl);
const chat=await import(url(compile(fs.readFileSync(new URL('../../src/lib/chat.ts',import.meta.url),'utf8')).replace("'./api'",JSON.stringify(apiUrl))));
const assets=await import(url(compile(fs.readFileSync(new URL('../../src/lib/assets.ts',import.meta.url),'utf8')).replace("'./api'",JSON.stringify(apiUrl))));
const originalFetch=globalThis.fetch,originalCreate=URL.createObjectURL,originalRevoke=URL.revokeObjectURL;
test.after(()=>{globalThis.fetch=originalFetch;URL.createObjectURL=originalCreate;URL.revokeObjectURL=originalRevoke;delete globalThis.window;delete globalThis.localStorage;});
const authorize=()=>{localStorage.setItem('token','server-session');api.setApiIdentity('user-a','workspace-a');};

test('late thread-A fetch cannot replace a newly selected thread-B view',()=>{
 const requests=new chat.CollaborationRequests(()=> 'scope-a');
 const threadA=requests.begin('messages');requests.invalidate('messages');const threadB=requests.begin('messages');
 assert.equal(requests.accepts(threadA),false);assert.equal(requests.accepts(threadB),true);
});
test('a committed message invalidates a pre-write GET while independent notifications still resolve',()=>{
 const requests=new chat.CollaborationRequests(()=> 'scope-a');const messages=requests.begin('messages'),notifications=requests.begin('notifications');
 requests.invalidate('messages');assert.equal(requests.accepts(messages),false);assert.equal(requests.accepts(notifications),true);
});
test('account/workspace change and logout both discard pending collaboration reads',()=>{
 let identity='user-a:workspace-a';const requests=new chat.CollaborationRequests(()=>identity),old=requests.begin('conversations');
 identity='user-a:workspace-b';assert.equal(requests.accepts(old),false);
 const next=requests.begin('conversations');requests.clear();assert.equal(requests.accepts(next),false);
});
test('the newest reconnect refresh wins even when the first request arrives last',()=>{
 const requests=new chat.CollaborationRequests(()=> 'same-scope');const before=requests.begin('conversations'),after=requests.begin('conversations');
 assert.equal(requests.accepts(after),true);assert.equal(requests.accepts(before),false);
});
test('conversation labels and receipts use actual members and readers without invented delivery',()=>{
 const conversation={participants:['a','b','c'],members:[{id:'a',name:'Me'},{id:'b',name:'Bob'},{id:'c',name:'Carol'}]};
 assert.equal(chat.conversationTitle(conversation,'a'),'Bob، Carol');
 assert.equal(chat.receiptLabel({readBy:['a']},conversation,'a'),'ذخیره شده');
 assert.equal(chat.receiptLabel({readBy:['a','b']},conversation,'a'),'خوانده شده توسط 1 نفر');
 assert.equal(chat.receiptLabel({readBy:['a','b','c']},conversation,'a'),'خوانده شده');
});
test('reaction ownership and managed attachment IDs are retained without raw browser URLs',()=>{
 assert.deepEqual(chat.reactionGroups({reactions:[{emoji:'👍',users:['b'],count:1}]}),[{emoji:'👍',users:['b'],count:1}]);
 assert.deepEqual(chat.messageAttachmentIds([{id:'managed-1',url:'blob:discard'},{name:'missing'},{id:'managed-2'}]),['managed-1','managed-2']);
});
test('chat mutations carry authoritative session and workspace and return the committed DTO',async()=>{
 authorize();globalThis.fetch=async(path,options)=>{assert.equal(path,'/api/chat/conversations/c%2F1/messages');assert.equal(options.headers.get('Authorization'),'Bearer server-session');assert.equal(options.headers.get('x-workspace-id'),'workspace-a');assert.deepEqual(JSON.parse(options.body),{content:'Real persisted message',attachmentIds:['file-1']});return Response.json({id:'message-server',conversationId:'c/1',senderId:'user-a'});};
 const saved=await chat.collaborationRequest(chat.chatPath('c/1')+'/messages','POST',{content:'Real persisted message',attachmentIds:['file-1']});assert.equal(saved.id,'message-server');
});
test('a denied message never becomes a fabricated local success',async()=>{
 authorize();globalThis.fetch=async()=>Response.json({code:'CHAT_FORBIDDEN',message:'Denied'},{status:403});
 await assert.rejects(chat.collaborationRequest('/api/chat/conversations/private/messages','POST',{content:'denied'}),error=>error.status===403&&error.code==='CHAT_FORBIDDEN');
});
test('identity changes during a server write discard its old-account response',async()=>{
 authorize();let complete;globalThis.fetch=()=>new Promise(resolve=>complete=resolve);
 const pending=chat.collaborationRequest('/api/chat/conversations/a/messages','POST',{content:'old identity'});
 api.setApiIdentity('other-user','workspace-b');complete(Response.json({id:'old-message'}));
 await assert.rejects(pending,error=>error.code==='STALE_REQUEST');
});
test('recorded audio playback requests the exact retained version and checks the response MIME',async()=>{
 authorize();let created=0;URL.createObjectURL=blob=>{created++;assert.equal(blob.type,'audio/webm');return 'blob:actual-audio';};
 globalThis.fetch=async(path,options)=>{assert.equal(path,'/api/files/voice-1/versions/version-1/download');assert.equal(options.headers.get('Authorization'),'Bearer server-session');return new Response(Uint8Array.from([0x1a,0x45,0xdf,0xa3]),{headers:{'Content-Type':'audio/webm'}});};
 assert.equal(await assets.previewAudioAsset({id:'voice-1',name:'voice.webm',versionId:'version-1'}),'blob:actual-audio');assert.equal(created,1);
 globalThis.fetch=async()=>new Response('<svg/>',{headers:{'Content-Type':'image/svg+xml'}});
 await assert.rejects(assets.previewAudioAsset({id:'spoofed',name:'voice.webm'}),error=>error.code==='AUDIO_TYPE_DENIED');assert.equal(created,1);
});
test('audio preview aborted on thread change cannot create an object URL after bytes arrive',async()=>{
 authorize();let release,created=0;const controller=new AbortController();URL.createObjectURL=()=>{created++;return 'blob:wrong-thread';};
 const body=new ReadableStream({start(stream){release=()=>{stream.enqueue(new Uint8Array([1,2,3]));stream.close();};}});
 globalThis.fetch=async()=>new Response(body,{headers:{'Content-Type':'audio/ogg'}});
 const pending=assets.previewAudioAsset({id:'old-voice',name:'voice.ogg'},controller.signal);await Promise.resolve();await Promise.resolve();controller.abort();release();
 await assert.rejects(pending,error=>error.code==='STALE_REQUEST');assert.equal(created,0);
});
test('image attachment previews retain the sent version rather than showing a newer replacement',async()=>{
 authorize();URL.createObjectURL=()=> 'blob:retained-image';
 globalThis.fetch=async(path)=>{assert.equal(path,'/api/files/picture/versions/sent-version/download');return new Response('image bytes',{headers:{'Content-Type':'image/png'}});};
 assert.equal(await assets.previewAsset({id:'picture',name:'picture.png'},undefined,undefined,'sent-version'),'blob:retained-image');
});


test('older-message pagination preserves chronological order and refetches the retained window',async()=>{
 authorize();const newest=Array.from({length:500},(_,index)=>({id:'new-'+index})),older=[{id:'old-1'},{id:'old-2'}];
 const paths=[];globalThis.fetch=async path=>{paths.push(path);return Response.json(path.includes('before=')?older:newest);};
 const result=await chat.conversationWindow('actual-thread',3);
 assert.equal(result.hasMore,false);assert.equal(result.messages.length,502);assert.equal(result.messages[0].id,'old-1');assert.equal(result.messages.at(-1).id,'new-499');
 assert.deepEqual(paths,['/api/chat/conversations/actual-thread/messages?limit=500','/api/chat/conversations/actual-thread/messages?limit=500&before=new-0']);
});
