import { LocalImage } from '../common/LocalImage';
import React, { useState } from 'react';
import { motion } from 'motion/react';

export interface AvatarProps {
  src?: string;
  fallback: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  status?: 'online' | 'offline' | 'away' | 'none';
  id?: string;
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  src,
  fallback,
  size = 'md',
  status = 'none',
  id,
  className = '',
}) => {
  const [hasError, setHasError] = useState(false);

  const sizes = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-lg',
  };

  const statusColors = {
    online: 'bg-brand-success',
    offline: 'bg-text-muted',
    away: 'bg-brand-warning',
    none: 'hidden',
  };

  const statusBadgeSizes = {
    xs: 'w-1.5 h-1.5 bottom-0 right-0',
    sm: 'w-2 h-2 bottom-0 right-0 border',
    md: 'w-2.5 h-2.5 bottom-0.5 right-0.5 border-2',
    lg: 'w-3 h-3 bottom-0.5 right-0.5 border-2',
    xl: 'w-4 h-4 bottom-1 right-1 border-2',
  };

  return (
    <div id={id} className={`relative inline-block select-none ${className}`}>
      <motion.div
        whileHover={{ scale: 1.05 }}
        className={`flex items-center justify-center font-sans font-bold text-text-primary rounded-full bg-surface-secondary border border-border-strong overflow-hidden shrink-0 ${sizes[size]}`}
      >
        {src && !hasError ? (
          <LocalImage
            src={src}
            alt={fallback}
            onError={() => setHasError(true)}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="uppercase tracking-wider text-text-secondary">{fallback.substring(0, 2)}</span>
        )}
      </motion.div>
      {status !== 'none' && (
        <span
          className={`absolute rounded-full border-surface-primary ${statusColors[status]} ${statusBadgeSizes[size]}`}
        />
      )}
    </div>
  );
};
