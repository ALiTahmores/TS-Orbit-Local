import React, { useEffect, useState } from 'react';
import { downloadAsset, ManagedAsset, previewAsset, previewAudioAsset, canPreviewAsset } from '../../lib/assets';
export const MessageAttachment: React.FC<{
    asset: ManagedAsset;
    scope: string;
}> = ({ asset, scope }) => {
    const [url, setUrl] = useState(''), [error, setError] = useState(''), [preview, setPreview] = useState(false);
    const audio = asset.mimeType?.startsWith('audio/');
    useEffect(() => {
        const controller = new AbortController();
        let owned = '';
        setUrl('');
        setError('');
        if (preview)
            void (audio ? previewAudioAsset(asset, controller.signal) : previewAsset(asset, undefined, controller.signal, asset.versionId)).then(value => { owned = value; if (controller.signal.aborted)
                URL.revokeObjectURL(value);
            else
                setUrl(value); }).catch(error => { if (!controller.signal.aborted)
                setError(error.message); });
        return () => { controller.abort(); if (owned)
            URL.revokeObjectURL(owned); };
    }, [scope, asset.id, asset.versionId, audio, preview]);
    return <div className="my-2 border border-current/20 rounded-xl p-2 text-xs space-y-2">
    <button type="button" className="underline break-all" onClick={() => void downloadAsset(asset, asset.versionId).catch(error => setError(error.message))}>دانلود {asset.name}</button>
    {canPreviewAsset(asset) && <button type="button" className="mx-2 underline" onClick={() => setPreview(!preview)}>{preview ? 'بستن تصویر' : 'نمایش تصویر'}</button>}
    {audio && <button type="button" className="mx-2 underline" onClick={() => setPreview(!preview)}>{preview ? 'بستن پخش' : 'پخش پیام صوتی'}</button>}
    {audio && url && <audio aria-label={'پخش ' + asset.name} controls preload="metadata" src={url} className="max-w-full"/>}
    {!audio && url && <img src={url} alt={asset.name} className="max-h-64 rounded-lg"/>}
    {error && <p role="alert">{error}</p>}
    {asset.contentAvailable === false && <p>محتوای فایل قدیمی موجود نیست.</p>}
  </div>;
};
