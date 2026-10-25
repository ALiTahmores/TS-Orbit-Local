import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const compile=source=>ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const asUrl=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
class Storage{getItem(k){return this[k]??null;}setItem(k,v){this[k]=String(v);}removeItem(k){delete this[k];}}
globalThis.localStorage=new Storage();globalThis.window=new EventTarget();window.location={origin:'http://localhost:3000'};
const apiUrl=asUrl(compile(fs.readFileSync(new URL('../../src/lib/api.ts',import.meta.url),'utf8')));
const api=await import(apiUrl);
const blobStubUrl=asUrl('export const upload=(...args)=>globalThis.__testBlobUpload(...args);');
const assets=await import(asUrl(compile(fs.readFileSync(new URL('../../src/lib/assets.ts',import.meta.url),'utf8')).replace("'./api'",JSON.stringify(apiUrl)).replace("'@vercel/blob/client'",JSON.stringify(blobStubUrl))));
const portal=await import(asUrl(compile(fs.readFileSync(new URL('../../src/lib/portal.ts',import.meta.url),'utf8')).replace("'./api'",JSON.stringify(apiUrl))));
const overview=await import(asUrl(compile(fs.readFileSync(new URL('../../src/components/projects/overview/utils.ts',import.meta.url),'utf8'))));
const originalFetch=globalThis.fetch,originalDocument=globalThis.document,originalCreate=URL.createObjectURL,originalRevoke=URL.revokeObjectURL,originalTimeout=globalThis.setTimeout;
const fetchDescriptor=Object.getOwnPropertyDescriptor(globalThis,'fetch');
let mockedFetch=originalFetch,runtimeResponse=()=>Response.json({directUpload:false,cloud:false}),runtimeCalls=0;
Object.defineProperty(globalThis,'fetch',{configurable:true,get(){return (url,options)=>{if(url==='/api/runtime'){runtimeCalls++;return Promise.resolve(runtimeResponse(options));}return mockedFetch(url,options);};},set(value){mockedFetch=value;}});
test.after(()=>{Object.defineProperty(globalThis,'fetch',fetchDescriptor);delete globalThis.__testBlobUpload;globalThis.document=originalDocument;URL.createObjectURL=originalCreate;URL.revokeObjectURL=originalRevoke;globalThis.setTimeout=originalTimeout;delete globalThis.window;delete globalThis.localStorage;});
function authorize(){localStorage.setItem('token','real-session');api.setApiIdentity('user-1','workspace-1');}
test('raw upload keeps exact bytes and MIME while identity and metadata are authoritative',async()=>{
 authorize();const file=new File([Uint8Array.from([0,255,13,10,4])],'فایل.bin',{type:'application/x-orbit-test'});
 globalThis.fetch=async(path,options)=>{assert.equal(path,'/api/files');assert.equal(options.headers.get('Content-Type'),'application/x-orbit-test');assert.equal(options.headers.get('Authorization'),'Bearer real-session');assert.equal(options.headers.get('x-workspace-id'),'workspace-1');assert.deepEqual(JSON.parse(decodeURIComponent(options.headers.get('X-File-Metadata'))),{name:'نام واقعی.bin',projectId:'project-1',approved:false});assert.deepEqual(new Uint8Array(await options.body.arrayBuffer()),Uint8Array.from([0,255,13,10,4]));return Response.json({id:'server-file',sha256:'server-hash'});};
 const saved=await assets.uploadAsset(file,{name:'نام واقعی.bin',projectId:'project-1',approved:false,uploadedById:'spoofed',workspaceId:'other'});assert.equal(saved.id,'server-file');
});
test('public upload uses exact capability and never sends session or approval claims',async()=>{
 authorize();globalThis.fetch=async(path,options)=>{assert.equal(path,'/api/public/portal/exact%2Ftoken/files');assert.equal(options.headers.get('Authorization'),null);assert.equal(options.headers.get('x-workspace-id'),null);assert.deepEqual(JSON.parse(decodeURIComponent(options.headers.get('X-File-Metadata'))),{name:'client.txt'});return Response.json({id:'public-file',approved:false,clientVisible:false});};
 assert.equal((await assets.uploadAsset(new File(['client bytes'],'client.txt'),{approved:true,clientVisible:true,projectId:'forged'},undefined,'exact/token')).approved,false);
});
test('failed upload rejects without a fabricated asset or success invalidation',async()=>{
 authorize();let emitted=0;const listener=()=>emitted++;window.addEventListener('orbit:assets-updated',listener);globalThis.fetch=async()=>Response.json({code:'FORBIDDEN'},{status:403});await assert.rejects(assets.uploadAsset(new File(['x'],'x.txt')),error=>error.status===403);window.removeEventListener('orbit:assets-updated',listener);assert.equal(emitted,0);
});
test('version upload addresses actual file ID and returns the server version',async()=>{
 authorize();globalThis.fetch=async(path,options)=>{assert.equal(path,'/api/files/managed%2Ffile/versions');assert.equal(await options.body.text(),'new bytes');return Response.json({id:'managed/file',version:2,currentVersionId:'server-version'});};const saved=await assets.uploadAsset(new File(['new bytes'],'v2.txt'),{note:'revision'},'managed/file');assert.equal(saved.currentVersionId,'server-version');
});
test('download consumes authenticated bytes and revokes its temporary object URL',async()=>{
 authorize();let clicked=false,revoked='';URL.createObjectURL=blob=>{assert.equal(blob.size,5);return 'blob:temporary-only';};URL.revokeObjectURL=url=>revoked=url;globalThis.setTimeout=fn=>{fn();return 0;};globalThis.document={createElement:()=>({click(){clicked=true;assert.equal(this.download,'actual.txt');assert.equal(this.href,'blob:temporary-only');}})};
 globalThis.fetch=async(path,options)=>{assert.equal(path,'/api/files/file-1/versions/version-1/download');assert.equal(options.headers.get('Authorization'),'Bearer real-session');return new Response('bytes');};await assets.downloadAsset({id:'file-1',name:'actual.txt'},'version-1');assert.equal(clicked,true);assert.equal(revoked,'blob:temporary-only');
});
test('identity change during body download cannot create a URL or download another workspace file',async()=>{
 authorize();let release,created=0;URL.createObjectURL=()=>{created++;return 'blob:forbidden';};const stream=new ReadableStream({start(controller){release=()=>{controller.enqueue(new TextEncoder().encode('old private bytes'));controller.close();};}});globalThis.fetch=async()=>new Response(stream);const pending=assets.downloadAsset({id:'old-file',name:'old.txt'});await Promise.resolve();await Promise.resolve();api.setApiIdentity('user-2','workspace-2');release();await assert.rejects(pending,error=>error.code==='STALE_REQUEST');assert.equal(created,0);
});
test('missing legacy content cannot fake a download; explicit public helper rejects private routes',async()=>{
 let fetched=0;globalThis.fetch=async()=>{fetched++;return new Response('');};await assert.rejects(assets.downloadAsset({id:'legacy',name:'old.pdf',contentAvailable:false}),/در دسترس نیست/);assert.throws(()=>api.publicFetch('/api/files'),error=>error.code==='INVALID_PUBLIC_URL');assert.equal(fetched,0);
});
test('empty portal capabilities and missing version IDs fail before any private-route fallback',async()=>{
 authorize();let fetched=0;globalThis.fetch=async()=>{fetched++;return Response.json({id:'wrong-route'});};
 await assert.rejects(assets.uploadAsset(new File(['bytes'],'client.txt'),{},undefined,''),error=>error.code==='PORTAL_TOKEN_REQUIRED');
 await assert.rejects(assets.downloadAsset({id:'file',name:'client.txt'},undefined,''),error=>error.code==='PORTAL_TOKEN_REQUIRED');
 await assert.rejects(assets.uploadAsset(new File(['bytes'],'client.txt'),{},''),error=>error.code==='RESOURCE_ID_REQUIRED');
 await assert.rejects(assets.downloadAsset({id:'file',name:'client.txt'},''),error=>error.code==='RESOURCE_ID_REQUIRED');
 await assert.rejects(assets.downloadAsset({id:'',name:'client.txt'}),error=>error.code==='RESOURCE_ID_REQUIRED');
 assert.equal(fetched,0);
});
test('late upload response after an account change cannot report success or invalidate new-scope assets',async()=>{
 authorize();let respond,emitted=0;const listener=()=>emitted++;window.addEventListener('orbit:assets-updated',listener);
 let signalStarted;const started=new Promise(resolve=>signalStarted=resolve);
 globalThis.fetch=()=>new Promise(resolve=>{respond=resolve;signalStarted();});
 const pending=assets.uploadAsset(new File(['old draft'],'draft.txt'),{projectId:'old-project'});
 await started;api.setApiIdentity('other-account','same-workspace');respond(Response.json({id:'old-file'}));
 await assert.rejects(pending,error=>error.code==='STALE_REQUEST');
 window.removeEventListener('orbit:assets-updated',listener);assert.equal(emitted,0);
});
test('cancelling a portal-token scope while a download body arrives cannot create a download URL',async()=>{
 authorize();const controller=new AbortController();let release,created=0;
 const stream=new ReadableStream({start(body){release=()=>{body.enqueue(new TextEncoder().encode('former token bytes'));body.close();};}});
 URL.createObjectURL=()=>{created++;return 'blob:old-portal';};
 globalThis.fetch=async(path,options)=>{assert.equal(path,'/api/public/portal/former%2Ftoken/files/client-file/download');assert.equal(options.headers.get('Authorization'),null);assert.equal(options.headers.get('x-workspace-id'),null);return new Response(stream);};
 const pending=assets.downloadAsset({id:'client-file',name:'client.txt'},undefined,'former/token',controller.signal);
 await Promise.resolve();await Promise.resolve();controller.abort();release();
 await assert.rejects(pending,error=>error.code==='STALE_REQUEST');assert.equal(created,0);
});
test('public file downloads keep the exact capability and are independent of authenticated identity changes',async()=>{
 authorize();let release,clicked=0,revoked='';
 const stream=new ReadableStream({start(body){release=()=>{body.enqueue(new TextEncoder().encode('public version'));body.close();};}});
 URL.createObjectURL=blob=>{assert.equal(blob.size,14);return 'blob:public-version';};URL.revokeObjectURL=value=>revoked=value;
 globalThis.document={createElement:()=>({click(){clicked++;assert.equal(this.download,'historical.txt');}})};
 globalThis.fetch=async(path,options)=>{assert.equal(path,'/api/public/portal/exact%252Ftoken/files/file%2Fid/versions/version%2Fid/download');assert.equal(options.headers.get('Authorization'),null);assert.equal(options.headers.get('x-workspace-id'),null);return new Response(stream);};
 const pending=assets.downloadAsset({id:'file/id',name:'historical.txt'},'version/id','exact%2Ftoken');
 await Promise.resolve();await Promise.resolve();api.setApiIdentity('changed-user','changed-workspace');release();await pending;
 assert.equal(clicked,1);assert.equal(revoked,'blob:public-version');
});
test('denied public download never produces a local success artifact',async()=>{
 authorize();let created=0;URL.createObjectURL=()=>{created++;return 'blob:denied';};globalThis.fetch=async()=>Response.json({code:'FILE_NOT_FOUND'},{status:404});
 await assert.rejects(assets.downloadAsset({id:'unapproved',name:'unapproved.txt'},undefined,'exact-token'),error=>error.status===404);assert.equal(created,0);
});
test('temporary download URL is revoked even if browser click fails',async()=>{
 authorize();let revoked='';URL.createObjectURL=()=> 'blob:click-failed';URL.revokeObjectURL=value=>revoked=value;
 globalThis.document={createElement:()=>({click(){throw new Error('browser rejected click');}})};globalThis.fetch=async()=>new Response('bytes');
 await assert.rejects(assets.downloadAsset({id:'actual',name:'actual.txt'}),/browser rejected click/);assert.equal(revoked,'blob:click-failed');
});
test('portal addresses preserve the exact current capability and an explicit empty capability',()=>{
 assert.deepEqual(portal.portalAddress('http://localhost/?portalToken=exact%252Ftoken&projectId=p1'),{token:'exact%2Ftoken',projectId:'p1'});
 assert.deepEqual(portal.portalAddress('http://localhost/#/client?portalToken=hash%2Ftoken&projectId=p2'),{token:'hash/token',projectId:'p2'});
 assert.equal(portal.portalAddress('http://localhost/?portalToken=#?token=older-token').token,'');
 assert.deepEqual(portal.portalAddress('http://localhost/'),{token:'',projectId:''});
});
test('feedback histories show persisted status transitions and reply actions from the current DTO',()=>{
 assert.equal(portal.feedbackEventText({action:'status_changed',fromStatus:'pending',toStatus:'approved'},'en'),'pending ← approved');
 assert.equal(portal.feedbackEventText({action:'replied'},'en'),'Reply added');
 assert.equal(portal.feedbackEventText({action:'submitted',toStatus:'pending'}),'در انتظار بررسی');
});
test('overview storage totals use actual byte sizes without inventing legacy bytes or a quota',()=>{
 const totals=overview.calculateStorageFromAssets([{byteSize:2048},{byteSize:0},{size:'999 GB'},{byteSize:4096,contentAvailable:false}]);
 assert.equal(totals.byteSize,2048);assert.equal(totals.unknownCount,2);assert.equal(totals.percentage,null);
 assert.equal(overview.calculateStorageFromAssets([{byteSize:200*1024**3}]).usedGB,'200.0');
 assert.equal(overview.calculateStorageFromAssets([{byteSize:1024}],2048).percentage,50);
});
test('confirmed token rotation replaces the shared project before a failed projects refetch',async()=>{
 authorize();let project={id:'project-1',portalToken:'old-token'},applied=0;
 globalThis.fetch=async(path,options)=>{
  if(path==='/api/projects/project-1/portal-token'){assert.equal(options.method,'POST');return Response.json({token:'committed-new-token',project:{id:'project-1',workspaceId:'workspace-1',clientPortalEnabled:true}});}
  assert.equal(path,'/api/projects');assert.equal(applied,1);return Response.json({code:'REFRESH_UNAVAILABLE'},{status:503});
 };
 await portal.commitPortalChange('project-1','POST','/portal-token',{},saved=>{project={...project,...saved};applied++;});
 await assert.rejects(api.apiFetch('/api/projects'),error=>error.status===503);
 assert.equal(project.portalToken,'committed-new-token');assert.equal(project.clientPortalToken,'committed-new-token');
});
test('portal commits reject a wrong project and discard an old-account response before shared-state application',async()=>{
 authorize();let applied=0;
 globalThis.fetch=async()=>Response.json({project:{id:'wrong-project',workspaceId:'workspace-1'}});
 await assert.rejects(portal.commitPortalChange('project-1','PUT','/portal',{enabled:false},()=>applied++),error=>error.code==='INVALID_RESPONSE');
 let respond;globalThis.fetch=()=>new Promise(resolve=>respond=resolve);
 const pending=portal.commitPortalChange('project-1','DELETE','/portal-token',undefined,()=>applied++);
 api.setApiIdentity('other-user','other-workspace');respond(Response.json({project:{id:'project-1',workspaceId:'workspace-1'}}));
 await assert.rejects(pending,error=>error.code==='STALE_REQUEST');assert.equal(applied,0);
});
test('image preview consumes authenticated local image bytes and ignores external asset URLs',async()=>{
 authorize();let created=0;URL.createObjectURL=blob=>{created++;assert.equal(blob.type,'image/png');return 'blob:local-image';};
 globalThis.fetch=async(path,options)=>{assert.equal(path,'/api/files/image-1/download');assert.equal(options.headers.get('Authorization'),'Bearer real-session');return new Response(Uint8Array.from([137,80,78,71]),{headers:{'Content-Type':'image/png'}});};
 assert.equal(await assets.previewAsset({id:'image-1',name:'image.png',downloadPath:'https://external.invalid/image.png'}),'blob:local-image');assert.equal(created,1);
});
test('image preview refuses SVG, unexpected response MIME and cancelled portal scopes',async()=>{
 authorize();let created=0;URL.createObjectURL=()=>{created++;return 'blob:forbidden-image';};
 await assert.rejects(assets.previewAsset({id:'svg',name:'active.svg'}),error=>error.code==='PREVIEW_TYPE_DENIED');
 globalThis.fetch=async()=>new Response('<svg/>',{headers:{'Content-Type':'image/svg+xml'}});
 await assert.rejects(assets.previewAsset({id:'renamed',name:'renamed.png'}),error=>error.code==='PREVIEW_TYPE_DENIED');
 const controller=new AbortController();let respond;globalThis.fetch=()=>new Promise(resolve=>respond=resolve);
 const pending=assets.previewAsset({id:'image',name:'image.png'},'former-token',controller.signal);controller.abort();respond(new Response('old bytes',{headers:{'Content-Type':'image/png'}}));
 await assert.rejects(pending,error=>error.code==='STALE_REQUEST');assert.equal(created,0);
});

test('runtime negotiation failure prevents any upload or success event',async()=>{
 authorize();let writes=0;runtimeResponse=()=>Response.json({},{status:503});globalThis.fetch=async()=>{writes++;throw new Error('must not upload');};
 try{await assert.rejects(assets.uploadAsset(new File(['bytes'],'r.txt')),error=>error.code==='RUNTIME_UNAVAILABLE');assert.equal(writes,0);}finally{runtimeResponse=()=>Response.json({directUpload:false,cloud:false});}
});
test('cloud upload sends scoped intent, normalized MIME and private SDK capability before explicit finalize',async()=>{
 authorize();runtimeResponse=()=>Response.json({directUpload:true,cloud:true});const calls=[];
 globalThis.fetch=async(url,options)=>{calls.push(url);assert.equal(options.headers.get('Authorization'),'Bearer real-session');assert.equal(options.headers.get('x-workspace-id'),'workspace-1');if(url==='/api/files/direct-intents'){const input=JSON.parse(options.body);assert.equal(input.byteSize,5);assert.equal(input.versionOf,'managed');assert.equal(input.metadata.uploadedById,undefined);return Response.json({id:'intent-id',pathname:'orbit-assets/v1/owned-key',mimeType:'text/plain'});}assert.equal(url,'/api/files/direct-intents/intent-id/finalize');return Response.json({id:'managed',version:2});};
 globalThis.__testBlobUpload=async(pathname,file,options)=>{assert.equal(calls.length,1);assert.equal(pathname,'orbit-assets/v1/owned-key');assert.equal(await file.text(),'bytes');assert.equal(options.access,'private');assert.equal(options.handleUploadUrl,'/api/files/direct-token');assert.equal(options.headers.Authorization,'Bearer real-session');assert.equal(options.contentType,'text/plain');assert.deepEqual(JSON.parse(options.clientPayload),{uploadId:'intent-id'});};
 try{const saved=await assets.uploadAsset(new File(['bytes'],'r.txt',{type:'application/octet-stream'}),{uploadedById:'spoofed'},'managed');assert.equal(saved.version,2);assert.equal(calls.length,2);}finally{runtimeResponse=()=>Response.json({directUpload:false,cloud:false});}
});
test('cloud public upload never exposes the signed-in session to capability routes or SDK',async()=>{
 authorize();runtimeResponse=()=>Response.json({directUpload:true,cloud:true});let sdkCalled=false;
 globalThis.fetch=async(url,options)=>{assert.equal(options.headers.get('Authorization'),null);assert.equal(options.headers.get('x-workspace-id'),null);if(url.endsWith('/direct-intents'))return Response.json({id:'public-intent',pathname:'orbit-assets/v1/public-key',mimeType:'text/plain'});assert.equal(url,'/api/public/portal/exact%2Fcapability/files/direct-intents/public-intent/finalize');return Response.json({id:'public-file',approved:false});};
 globalThis.__testBlobUpload=async(_pathname,_file,options)=>{sdkCalled=true;assert.deepEqual(options.headers,{});assert.equal(options.handleUploadUrl,'/api/public/portal/exact%2Fcapability/files/direct-token');};
 try{await assets.uploadAsset(new File(['public'],'p.txt'),{},undefined,'exact/capability');assert.equal(sdkCalled,true);}finally{runtimeResponse=()=>Response.json({directUpload:false,cloud:false});}
});
