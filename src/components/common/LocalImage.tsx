import React from 'react';
import { localImageSource } from '../../lib/localAssets';

/** Keep legacy generated avatars local while preserving uploaded and custom images. */
export const LocalImage: React.FC<React.ImgHTMLAttributes<HTMLImageElement>> = ({ src, ...props }) => (
  <img {...props} src={localImageSource(src)} />
);
