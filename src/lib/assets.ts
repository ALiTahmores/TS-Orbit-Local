import { apiFetch, publicFetch, ApiError, getApiIdentity, getAuthHeaders } from './api';

export interface ManagedAsset {
  id:string;name:string;byteSize?:number;size?:string;formattedSize?:string;mimeType?:string;sha256?:string;
  projectId?:string;taskId?:string;conversationId?:string;category?:string;tag?:string;clientVisible?:boolean;approved?:boolean;
  uploadedBy?:{id?:string;name?:string;avatar?:string};uploadedById?:string;createdAt?:string;uploadDate?:string;
  version?:number;versionId?:string;currentVersionId?:string;versionHistory?:any[];downloadPath?:string|null;contentAvailable?:boolean;
}
const operations=new Set<AbortController>();
if(typeof window!=='undefined')window.addEventListener('orbit:identity-change',()=>{for(const controller of operations)controller.abort();operations.clear();});
const identityKey=()=>JSON.stringify(getApiIdentity());
function resourceId(value:unknown,label:string):string {
  if(typeof value!=='string'||!value.trim())throw new ApiError(422,'RESOURCE_ID_REQUIRED',label+' معتبر لازم است.');
  return encodeURIComponent(value);
}
function publicBase(token:string):string {
  if(!token.trim())throw new ApiError(422,'PORTAL_TOKEN_REQUIRED','لینک معتبر پورتال لازم است.');
  return '/api/public/portal/'+encodeURIComponent(token)+'/files';
}
export function assetMetadata(input:Record<string,any>){
  const allowed=['name','projectId','taskId','conversationId','category','tag','clientVisible','approved','note'];
  return Object.fromEntries(Object.entries(input).filter(([key,value])=>allowed.includes(key)&&value!==undefined&&value!==''));
}
export async function uploadAsset(file:File,metadata:Record<string,any>={},versionOf?:string,portalToken?:string,signal?:AbortSignal):Promise<ManagedAsset>{
  if(!(file instanceof Blob))throw new Error('یک فایل انتخاب کنید.');
  const isPublic=portalToken!==undefined;
  const path=isPublic?publicBase(portalToken):versionOf!==undefined?'/api/files/'+resourceId(versionOf,'شناسه فایل')+'/versions':'/api/files';
  if(isPublic&&versionOf!==undefined)throw new ApiError(422,'PUBLIC_VERSION_DENIED','نسخه جدید فایل از مدیریت پروژه ثبت می‌شود.');
  const controller=new AbortController(),identity=identityKey();if(!isPublic)operations.add(controller);
  try {
    const input=isPublic?{name:metadata.name || file.name,category:metadata.category,tag:metadata.tag}:assetMetadata({name:file.name,...metadata});
    const runtime=await fetch('/api/runtime',{signal:controller.signal}).then(response=>{if(!response.ok)throw new ApiError(response.status,'RUNTIME_UNAVAILABLE','پیکربندی سرور در دسترس نیست.');return response.json();});
    let response:Response;
    if(runtime.directUpload){
      const base=isPublic?publicBase(portalToken):'/api/files';
      const request=isPublic?publicFetch:apiFetch;
      const init=await request(base+'/direct-intents',{method:'POST',body:JSON.stringify({metadata:input,byteSize:file.size,mimeType:file.type||'application/octet-stream',...(versionOf?{versionOf}:{})}),signal:signal?AbortSignal.any([signal,controller.signal]):controller.signal}).then(response=>response.json());
      const {upload}=await import('@vercel/blob/client');
      await upload(init.pathname,file,{access:'private',handleUploadUrl:base+'/direct-token',clientPayload:JSON.stringify({uploadId:init.id}),headers:isPublic?{}:getAuthHeaders(),contentType:init.mimeType,abortSignal:signal?AbortSignal.any([signal,controller.signal]):controller.signal});
      response=await request(base+'/direct-intents/'+encodeURIComponent(init.id)+'/finalize',{method:'POST',body:'{}',signal:signal?AbortSignal.any([signal,controller.signal]):controller.signal});
    }else response=await (isPublic?publicFetch:apiFetch)(path,{method:'POST',headers:{'Content-Type':file.type || 'application/octet-stream','X-File-Metadata':encodeURIComponent(JSON.stringify(input))},body:file,signal:signal?AbortSignal.any([signal,controller.signal]):controller.signal});
    const saved=await response.json();if(controller.signal.aborted||signal?.aborted||!isPublic && identity!==identityKey())throw new ApiError(0,'STALE_REQUEST','فضای کاری یا لینک پورتال تغییر کرده است.');
    if(!saved?.id)throw new Error('فایل ذخیره‌شده دریافت نشد.');
    if(!isPublic)window.dispatchEvent(new Event('orbit:assets-updated'));return saved;
  } finally {operations.delete(controller);}
}
async function consumeAssetBytes<T>(asset:ManagedAsset,versionId:string|undefined,portalToken:string|undefined,signal:AbortSignal|undefined,consume:(blob:Blob)=>T):Promise<T>{
  if(asset.contentAvailable===false)throw new Error('محتوای این فایل در دسترس نیست؛ نسخهٔ جدیدی بارگذاری کنید.');
  const isPublic=portalToken!==undefined;
  const base=isPublic?publicBase(portalToken)+'/':'/api/files/';
  const path=base+resourceId(asset.id,'شناسه فایل')+(versionId!==undefined?'/versions/'+resourceId(versionId,'شناسه نسخه'):'')+'/download';
  const controller=new AbortController(),identity=identityKey();if(!isPublic)operations.add(controller);
  try {
    const response=await (isPublic?publicFetch:apiFetch)(path,{signal:signal?AbortSignal.any([signal,controller.signal]):controller.signal});const blob=await response.blob();
    if(controller.signal.aborted||signal?.aborted||!isPublic && identity!==identityKey())throw new ApiError(0,'STALE_REQUEST','فضای کاری یا لینک پورتال تغییر کرده است.');
    return consume(blob);
  } finally {operations.delete(controller);}
}
export async function downloadAsset(asset:ManagedAsset,versionId?:string,portalToken?:string,signal?:AbortSignal){
  return consumeAssetBytes(asset,versionId,portalToken,signal,blob=>{
    const url=URL.createObjectURL(blob);
    try {const link=document.createElement('a');link.href=url;link.download=asset.name;link.click();}
    finally {setTimeout(()=>URL.revokeObjectURL(url),1000);}
  });
}
const imageTypes=new Set(['image/png','image/jpeg','image/gif','image/webp','image/bmp','image/x-icon','image/vnd.microsoft.icon']);
export const canPreviewAsset=(asset:ManagedAsset)=>asset.contentAvailable!==false&&/\.(png|jpe?g|gif|webp|bmp|ico)$/i.test(asset.name);
/** The mounted preview owns this URL and must revoke it on close or scope change. */
export async function previewAsset(asset:ManagedAsset,portalToken?:string,signal?:AbortSignal,versionId?:string):Promise<string>{
  if(!canPreviewAsset(asset))throw new ApiError(415,'PREVIEW_TYPE_DENIED','پیش‌نمایش فقط برای تصاویر پشتیبانی‌شده موجود است.');
  return consumeAssetBytes(asset,versionId,portalToken,signal,blob=>{
    if(!imageTypes.has(blob.type.split(';')[0].toLowerCase()))throw new ApiError(415,'PREVIEW_TYPE_DENIED','نوع تصویر دریافت‌شده معتبر نیست.');
    return URL.createObjectURL(blob);
  });
}
/** Audio controls consume verified protected bytes, never a persisted browser object URL. */
export async function previewAudioAsset(asset:ManagedAsset,signal?:AbortSignal):Promise<string>{
  return consumeAssetBytes(asset,asset.versionId,undefined,signal,blob=>{
    if(!['audio/webm','audio/ogg','audio/mpeg','audio/mp4','audio/wav','audio/x-wav'].includes(blob.type.split(';')[0].toLowerCase()))throw new ApiError(415,'AUDIO_TYPE_DENIED','نوع فایل صوتی پشتیبانی نمی‌شود.');
    return URL.createObjectURL(blob);
  });
}
