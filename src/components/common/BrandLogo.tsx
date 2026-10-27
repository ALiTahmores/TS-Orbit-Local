import React from 'react';

/** The TS Orbit mark: the black emblem on a white disc. A hairline ring keeps the
 * disc's edge visible on white surfaces. Decorative: the product name is always
 * written next to it. */
export const BrandLogo: React.FC<{ className?: string }> = ({ className = 'w-8 h-8' }) => (
  <img
    src="/brand/logo-192.png"
    alt=""
    aria-hidden="true"
    draggable={false}
    className={`shrink-0 rounded-full ring-1 ring-slate-200 dark:ring-white/15 select-none ${className}`}
  />
);
