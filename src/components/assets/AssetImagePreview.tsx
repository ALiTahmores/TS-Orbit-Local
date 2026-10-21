import React,{useEffect,useState} from 'react';
import {previewAsset,type ManagedAsset} from '../../lib/assets';

export const AssetImagePreview:React.FC<{asset:ManagedAsset;portalToken?:string;onClose:()=>void}>=({asset,portalToken,onClose})=>{
  const [url,setUrl]=useState(''),[error,setError]=useState('');
  useEffect(()=>{
    let active=true,temporaryURL='';const controller=new AbortController();
    setUrl('');setError('');
    const cleanup=()=>{active=false;controller.abort();if(temporaryURL){URL.revokeObjectURL(temporaryURL);temporaryURL='';}};
    const identityChanged=()=>{cleanup();setUrl('');};
    if(portalToken===undefined)window.addEventListener('orbit:identity-change',identityChanged);
    void previewAsset(asset,portalToken,controller.signal).then(created=>{if(!active){URL.revokeObjectURL(created);return;}temporaryURL=created;setUrl(created);}).catch(error=>{if(active)setError(error.message);});
    return()=>{cleanup();window.removeEventListener('orbit:identity-change',identityChanged);};
  },[asset.id,asset.currentVersionId,asset.version,portalToken]);
  return <div role="dialog" aria-modal="true" aria-label="پیش‌نمایش تصویر" className="fixed inset-0 z-[100000] bg-slate-950/80 flex items-center justify-center p-6" onClick={onClose}><div className="max-w-5xl max-h-full overflow-auto p-4 rounded-xl bg-white dark:bg-slate-900 space-y-3" onClick={event=>event.stopPropagation()}><button type="button" onClick={onClose} className="text-sm">بستن پیش‌نمایش تصویر</button><h3 className="text-sm font-bold">{asset.name}</h3>{error?<p role="alert" className="text-red-600">{error}</p>:url?<img src={url} alt={asset.name} className="max-w-full max-h-[75vh] object-contain"/>:<p role="status">در حال دریافت تصویر...</p>}</div></div>;
};
