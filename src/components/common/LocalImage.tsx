import React from 'react';
import { localAvatar, localImageSource } from '../../lib/localAssets';

/** Keep legacy generated avatars local while preserving uploaded and custom images.
 * A source that fails to load falls back to a generated initials avatar (from alt),
 * so a missing or invalid image never shows the browser's broken-image icon. */
export const LocalImage: React.FC<React.ImgHTMLAttributes<HTMLImageElement>> = ({ src, alt, onError, ...props }) => {
  const [failedSource, setFailedSource] = React.useState<string | undefined>();
  const resolved = localImageSource(src);
  const fallback = localAvatar(alt?.trim() || 'TS Orbit');
  return (
    <img
      {...props}
      alt={alt}
      src={!resolved || failedSource === resolved ? fallback : resolved}
      onError={event => { if (resolved && failedSource !== resolved) setFailedSource(resolved); onError?.(event); }}
    />
  );
};
