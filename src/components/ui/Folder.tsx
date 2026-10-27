import React, { useState } from 'react';

const darkenColor = (hex: string, percent: number) => {
  let color = hex.startsWith('#') ? hex.slice(1) : hex;
  if (color.length === 3) {
    color = color.split('').map(c => c + c).join('');
  }
  const num = parseInt(color.slice(0, 6), 16);
  let r = (num >> 16) & 0xff;
  let g = (num >> 8) & 0xff;
  let b = num & 0xff;
  r = Math.max(0, Math.min(255, Math.floor(r * (1 - percent))));
  g = Math.max(0, Math.min(255, Math.floor(g * (1 - percent))));
  b = Math.max(0, Math.min(255, Math.floor(b * (1 - percent))));
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
};

interface FolderProps {
  color?: string;
  size?: number;
  items?: React.ReactNode[];
  className?: string;
  onClick?: () => void;
  isActive?: boolean;
}

const Folder: React.FC<FolderProps> = ({
  color = '#2563eb',
  size = 1,
  items = [],
  className = '',
  onClick,
  isActive = false
}) => {
  const maxItems = 3;
  const safeItems = items || [];
  const papers: (React.ReactNode | null)[] = safeItems.slice(0, maxItems);
  while (papers.length < maxItems) {
    papers.push(null);
  }

  const [open, setOpen] = useState(false);
  const [paperOffsets, setPaperOffsets] = useState<Array<{ x: number; y: number }>>(
    Array.from({ length: maxItems }, () => ({ x: 0, y: 0 }))
  );

  const folderBackColor = darkenColor(color, 0.12);
  const paper1 = darkenColor('#ffffff', 0.1);
  const paper2 = darkenColor('#ffffff', 0.05);
  const paper3 = '#ffffff';

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onClick) onClick();
  };

  const handleMouseEnter = () => setOpen(true);
  const handleMouseLeave = () => {
    setOpen(false);
    setPaperOffsets(Array.from({ length: maxItems }, () => ({ x: 0, y: 0 })));
  };

  const handlePaperMouseMove = (e: React.MouseEvent<HTMLDivElement>, index: number) => {
    if (!open) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const offsetX = (e.clientX - centerX) * 0.15;
    const offsetY = (e.clientY - centerY) * 0.15;
    setPaperOffsets(prev => {
      const newOffsets = [...prev];
      newOffsets[index] = { x: offsetX, y: offsetY };
      return newOffsets;
    });
  };

  const folderStyle = {
    '--folder-color': color,
    '--folder-back-color': folderBackColor,
  } as React.CSSProperties;

  const getOpenTransform = (index: number) => {
    if (index === 0) return 'translate(-120%, -70%) rotate(-15deg)';
    if (index === 1) return 'translate(10%, -70%) rotate(15deg)';
    if (index === 2) return 'translate(-50%, -100%) rotate(5deg)';
    return '';
  };

  return (
    <div
      className={`relative inline-block ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      <div
        className={`group relative transition-all duration-200 ease-in cursor-pointer focus:outline-none ${
          isActive ? 'scale-105' : ''
        }`}
        style={{
          ...folderStyle,
          transform: open ? 'scale(1.05) translateY(-4px)' : `scale(${size})`,
        }}
        tabIndex={0}
        role="button"
      >
        <div
          className="relative w-[110px] h-[85px] rounded-tl-0 rounded-tr-[10px] rounded-br-[10px] rounded-bl-[10px] shadow-lg"
          style={{ backgroundColor: folderBackColor }}
        >
          <span
            className="absolute z-0 bottom-[98%] left-0 w-[35px] h-[12px] rounded-tl-[6px] rounded-tr-[6px]"
            style={{ backgroundColor: folderBackColor }}
          />

          {papers.map((item, i) => {
            const sizeClasses = i === 0 ? 'w-[75%] h-[80%]' : i === 1 ? 'w-[82%] h-[80%]' : 'w-[90%] h-[80%]';
            const transformStyle = open
              ? `${getOpenTransform(i)} translate(${paperOffsets[i].x}px, ${paperOffsets[i].y}px)`
              : undefined;

            return (
              <div
                key={i}
                onMouseMove={e => handlePaperMouseMove(e, i)}
                className={`absolute z-20 bottom-[10%] left-1/2 transition-all duration-300 ease-in-out border border-gray-200 dark:border-gray-700 overflow-hidden shadow-md flex items-center justify-center ${
                  !open ? 'transform -translate-x-1/2 translate-y-[10%] group-hover:translate-y-0' : 'hover:scale-110'
                } ${sizeClasses}`}
                style={{
                  ...(!open ? {} : { transform: transformStyle }),
                  backgroundColor: i === 0 ? paper1 : i === 1 ? paper2 : paper3,
                  borderRadius: '8px'
                }}
              >
                {item || <div className="text-[10px] text-gray-400 font-medium">پروژه</div>}
              </div>
            );
          })}

          <div
            className={`absolute z-30 w-full h-full origin-bottom transition-all duration-300 ease-in-out ${
              !open ? 'group-hover:[transform:skew(12deg)_scaleY(0.75)]' : ''
            }`}
            style={{
              backgroundColor: color,
              borderRadius: '5px 10px 10px 10px',
              ...(open && { transform: 'skew(12deg) scaleY(0.75)' })
            }}
          />
          <div
            className={`absolute z-30 w-full h-full origin-bottom transition-all duration-300 ease-in-out opacity-90 ${
              !open ? 'group-hover:[transform:skew(-12deg)_scaleY(0.75)]' : ''
            }`}
            style={{
              backgroundColor: color,
              borderRadius: '5px 10px 10px 10px',
              ...(open && { transform: 'skew(-12deg) scaleY(0.75)' })
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default Folder;
