import React from 'react';
import { Code, Globe, Palette, PenTool, Search, Share2, type LucideIcon } from 'lucide-react';

const TEMPLATE_ICONS: Record<string, LucideIcon> = { wordpress: Globe, custom: Code, seo: Search, uiux: PenTool, brand: Palette, social: Share2 };

/** A team's colour tile: the icon of its default template, or the first letter of its name after the word «تیم». */
export const TeamAvatar: React.FC<{ team: { name?: string; color?: string; customFields?: any }; className?: string; iconSize?: number }> = ({ team, className = 'w-10 h-10 rounded-xl text-sm', iconSize = 18 }) => {
  const Icon = TEMPLATE_ICONS[team.customFields?.templateKey];
  const letter = (String(team.name || '').trim().replace(/^تیم\s+/, '') || '?')[0];
  return (
    <span className={`shrink-0 flex items-center justify-center text-white font-black ${className}`} style={{ background: team.color || '#2563EB' }}>
      {Icon ? <Icon size={iconSize} /> : letter}
    </span>
  );
};
