import React from 'react';
import {AssetManager} from '../../assets/AssetManager';
interface Props {isOpen:boolean;asset:any|null;onClose:()=>void;onDeleteAsset:(id:string)=>void;onDownloadAsset?:(asset:any)=>void;}
export const AssetDetailDrawer:React.FC<Props>=({isOpen,asset,onClose})=>!isOpen||!asset?null:<div className="fixed inset-0 z-50 bg-slate-900/40" onClick={onClose}><aside role="dialog" aria-label="مشخصات فایل" dir="rtl" onClick={event=>event.stopPropagation()} className="absolute left-0 inset-y-0 w-full max-w-xl bg-white dark:bg-slate-950 p-5 overflow-auto"><button onClick={onClose} className="mb-4 text-sm">بستن</button><AssetManager key={asset.id} assetId={asset.id}/></aside></div>;
