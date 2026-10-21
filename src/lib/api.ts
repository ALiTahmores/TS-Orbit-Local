/** The server is the authority for authentication, permissions and writes. */
export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) {
    super(message); this.name = 'ApiError';
  }
}
let identity = { userId: '', workspaceId: '' };
let generation = 0;
const pending = new Set<AbortController>();
const snapshots = new Map<string, unknown>();
const credentialKeys = ['token','currentUser','TS_ORBIT_USER_PROFILE','userRole','isAuthenticated','session_last_active','activeWorkspaceId','orbit_active_ws','TS_ORBIT_ACTIVE_WS'];
const businessKey = (key: string) => /^(orbit_|TS_ORBIT_|agency_|orgSettings_)/.test(key) || ['users','workspaces','activeModules','today_personal_notes'].includes(key);
export const clearBusinessCaches = () => {
  snapshots.clear();
  if (typeof window === 'undefined') return;
  for (const key of Object.keys(localStorage)) if (businessKey(key) && !credentialKeys.includes(key)) localStorage.removeItem(key);
};
export const setApiIdentity = (userId: string, workspaceId: string, persistWorkspace = true) => {
  if (identity.userId === userId && identity.workspaceId === workspaceId) return;
  generation++; for (const controller of pending) controller.abort(); pending.clear();
  clearBusinessCaches(); identity = { userId, workspaceId };
  if (typeof window !== 'undefined') {
    if(persistWorkspace) { if (workspaceId) localStorage.setItem('activeWorkspaceId',workspaceId); else localStorage.removeItem('activeWorkspaceId'); }
    window.dispatchEvent(new CustomEvent('orbit:identity-change',{detail:identity}));
  }
};
export const getApiIdentity = () => ({...identity});
export const clearCredential = () => {
  if (typeof window !== 'undefined') credentialKeys.forEach(key => localStorage.removeItem(key));
  setApiIdentity('',''); clearBusinessCaches();
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('orbit:session-ended'));
};
if (typeof window !== 'undefined') clearBusinessCaches();
export const getAuthHeaders = (): Record<string,string> => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return {'Content-Type':'application/json',...(token ? {Authorization:`Bearer ${token}`} : {}),...(identity.workspaceId ? {'x-workspace-id':identity.workspaceId} : {})};
};
export const reportApiError = (error: unknown) => {
  if (typeof window !== 'undefined' && error instanceof ApiError && error.code !== 'STALE_REQUEST') window.dispatchEvent(new CustomEvent('orbit:api-error',{detail:error}));
};
export const apiFetch = async (input: RequestInfo | URL, options: RequestInit = {}): Promise<Response> => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if(typeof window !== 'undefined' && window.location){
    const target=new URL(url,window.location.origin);
    if(target.origin!==window.location.origin || !target.pathname.startsWith('/api/'))throw new ApiError(422,'INVALID_API_URL','تنها API همین سامانه مجاز است.');
  }
  const publicPortal = /\/api\/public\//.test(url);
  const publicRequest = /\/api\/auth\/(login|register|check-identifier|check-username|forgot-password|reset-password|verify-code)(?:\?|$)/.test(url) || /\/api\/public\//.test(url);
  const requestGeneration = generation;
  const requestToken = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const controller = new AbortController(); if(!publicPortal)pending.add(controller);
  const externalAbort=()=>controller.abort();
  if(options.signal?.aborted)controller.abort();
  options.signal?.addEventListener('abort',externalAbort,{once:true});
  const headers = new Headers(options.headers);
  headers.delete('Authorization'); headers.delete('x-workspace-id');
  if (!publicRequest) Object.entries(getAuthHeaders()).forEach(([key,value])=>{if(key.toLowerCase()!=='content-type' || !headers.has('Content-Type'))headers.set(key,value);});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) headers.set('Content-Type','application/json');
  const stale = () => controller.signal.aborted || (!publicPortal && (requestGeneration !== generation || (!publicRequest && requestToken !== localStorage.getItem('token'))));
  try {
    const response = await fetch(input,{...options,headers,signal:controller.signal});
    if (stale()) throw new ApiError(0,'STALE_REQUEST','پاسخ مربوط به نشست یا فضای کاری قبلی است.');
    if (!response.ok) {
      const data = await response.clone().json().catch(()=>({}));
      if(stale())throw new ApiError(0,'STALE_REQUEST','خطای نشست قبلی کنار گذاشته شد.');
      const code = typeof data.code === 'string' ? data.code : typeof data.error?.code === 'string' ? data.error.code : typeof data.error === 'string' ? data.error : `HTTP_${response.status}`;
      const fallback = response.status === 401 ? 'نشست معتبر نیست؛ دوباره وارد شوید.' : response.status === 403 ? 'مجوز انجام این عملیات را ندارید.' : response.status === 422 ? 'اطلاعات ورودی معتبر نیست.' : 'عملیات در سرور انجام نشد؛ دوباره تلاش کنید.';
      const error = new ApiError(response.status,code,data.message || data.error?.message || fallback,data.details || data.error?.details);
      if (response.status === 401 && !publicRequest) clearCredential();
      reportApiError(error); throw error;
    }
    const parseJson = response.json.bind(response);
    response.json = async () => {
      let value:unknown;
      try { value=await parseJson(); } catch {
        if(stale())throw new ApiError(0,'STALE_REQUEST','پاسخ نشست قبلی کنار گذاشته شد.');
        const error=new ApiError(502,'INVALID_RESPONSE','پاسخ سرور معتبر نیست؛ عملیات در رابط تایید نشد.');
        reportApiError(error);throw error;
      }
      if(stale())throw new ApiError(0,'STALE_REQUEST','پاسخ مربوط به نشست یا فضای کاری قبلی است.');
      return value;
    };
    const parseBlob=response.blob.bind(response);
    response.blob=async()=>{if(stale())throw new ApiError(0,'STALE_REQUEST','نشست یا فضای کاری تغییر کرد.');const blob=await parseBlob();if(stale())throw new ApiError(0,'STALE_REQUEST','نشست یا فضای کاری تغییر کرد.');return blob;};
    return response;
  } catch(error) {
    if(error instanceof ApiError) throw error;
    if(stale() || controller.signal.aborted) throw new ApiError(0,'STALE_REQUEST','درخواست نشست قبلی لغو شد.');
    const failure = new ApiError(0,'NETWORK_ERROR','پاسخ سرور دریافت نشد؛ وضعیت ذخیره‌سازی مشخص نیست. پیش از تکرار عملیات، اتصال را برقرار و اطلاعات را دوباره بارگذاری کنید.');
    reportApiError(failure); throw failure;
  } finally { pending.delete(controller); }
};
/** Compatibility wrappers propagate failure; failed writes never return fallback data. */
export const safeFetch = apiFetch;
export const publicFetch=(url:string,options:RequestInit={})=>{
  if(!url.startsWith('/api/public/'))throw new ApiError(422,'INVALID_PUBLIC_URL','مسیر عمومی معتبر نیست.');
  return apiFetch(url,options);
};
export const safeApiRequest = async <T>(url:string,options?:RequestInit,_legacyKey?:string,_fallback?:T):Promise<T> => {
  const response=await apiFetch(url,options); const value=await response.json() as T;
  if ((!options?.method || options.method.toUpperCase()==='GET') && identity.userId && identity.workspaceId) snapshots.set(`${identity.userId}:${identity.workspaceId}:${url}`,value);
  return value;
};
export const notifyStandaloneMode = () => reportApiError(new ApiError(0,'NETWORK_ERROR','سرور در دسترس نیست؛ حالت ذخیره‌سازی جایگزین فعال نمی‌شود.'));
export const STORAGE_KEYS={PROJECTS:'orbit_projects_db',LEGACY_PROJECTS:'agency_projects',TASKS:'orbit_tasks_db',LEGACY_TASKS:'agency_tasks',USERS:'orbit_users_db',TEAM:'agency_team',NOTIFICATIONS:'agency_notifications',CHATS:'orbit_chat_messages',CONVERSATIONS:'orbit_chat_conversations',ORG_DATA:'orbit_org_data'} as const;
export const getLocalData=<T>(_key:string,fallback:T):T=>fallback;
export const setLocalData=<T>(_key:string,_data:T):void=>{};
export const redactClientLog = (value: any): any => {
  if(Array.isArray(value))return value.map(redactClientLog);
  if(value && typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,/password|passwd|token|secret|authorization|cookie|recovery.?code|verification.?code|api.?key/i.test(key)?'[REDACTED]':redactClientLog(item)]));
  return value;
};

