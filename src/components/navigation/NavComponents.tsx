import React from 'react';
import { motion } from 'motion/react';
import { ChevronRight, ChevronLeft, MoreHorizontal } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';

// 1. TABS NAVIGATION WITH SMOOTH ANIMATION
export interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  id?: string;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTab,
  onChange,
  id,
  className = '',
}) => {
  const { locale } = useProject();
  const isRtl = locale === 'fa';

  return (
    <div
      id={id}
      className={`flex items-center gap-1.5 p-1 bg-surface-secondary/60 border border-border-primary rounded-radius-16 w-fit font-sans overflow-x-auto select-none shrink-0 ${className}`}
      style={{ direction: isRtl ? 'rtl' : 'ltr' }}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`relative flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-radius-12 cursor-pointer transition-colors block shrink-0
              ${isActive ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary'}`}
          >
            {isActive && (
              <motion.div
                layoutId="active-tab-indicator"
                className="absolute inset-0 bg-surface-primary border border-border-primary/50 shadow-sm rounded-radius-12 z-0"
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              />
            )}
            <span className="relative z-10 flex items-center justify-center shrink-0">{tab.icon}</span>
            <span className="relative z-10 leading-none">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
};

// 2. BREADCRUMBS
export interface BreadcrumbLink {
  label: string;
  onClick?: () => void;
}

export interface BreadcrumbsProps {
  id?: string;
  items: BreadcrumbLink[];
  className?: string;
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ id, items, className = '' }) => {
  const { locale } = useProject();
  const isRtl = locale === 'fa';

  const Separator = isRtl ? (
    <ChevronLeft size={10} className="text-text-muted shrink-0" />
  ) : (
    <ChevronRight size={10} className="text-text-muted shrink-0" />
  );

  return (
    <nav
      id={id}
      className={`flex items-center gap-1.5 text-[10px] font-bold font-sans text-text-secondary select-none ${className}`}
      style={{ direction: isRtl ? 'rtl' : 'ltr' }}
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <React.Fragment key={index}>
            {item.onClick && !isLast ? (
              <button
                type="button"
                onClick={item.onClick}
                className="hover:text-brand-accent cursor-pointer transition-colors text-right"
              >
                {item.label}
              </button>
            ) : (
              <span className={isLast ? 'text-text-primary font-extrabold' : ''}>{item.label}</span>
            )}
            {!isLast && Separator}
          </React.Fragment>
        );
      })}
    </nav>
  );
};

// 3. PAGINATION
export interface PaginationProps {
  id?: string;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  id,
  currentPage,
  totalPages,
  onPageChange,
  className = '',
}) => {
  const { locale } = useProject();
  const isRtl = locale === 'fa';

  if (totalPages <= 1) return null;

  const handlePrev = () => {
    if (currentPage > 1) onPageChange(currentPage - 1);
  };

  const handleNext = () => {
    if (currentPage < totalPages) onPageChange(currentPage + 1);
  };

  const renderPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Logic for drawing truncated lists e.g. [1, 2, '...', 9, 10]
      if (currentPage <= 3) {
        pages.push(1, 2, 3, '...', totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1, '...', totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', currentPage, '...', totalPages);
      }
    }

    return pages.map((page, index) => {
      const isCurrent = page === currentPage;
      const isGap = page === '...';

      if (isGap) {
        return (
          <span
            key={`gap-${index}`}
            className="w-8 h-8 flex items-center justify-center text-text-muted shrink-0"
          >
            <MoreHorizontal size={12} />
          </span>
        );
      }

      return (
        <button
          key={`page-${page}`}
          type="button"
          onClick={() => onPageChange(page as number)}
          className={`w-8 h-8 rounded-radius-8 flex items-center justify-center text-xs font-bold font-mono transition-all cursor-pointer border shrink-0
            ${
              isCurrent
                ? 'bg-brand-accent text-white border-brand-accent shadow-sm'
                : 'bg-surface-primary hover:bg-hover-overlay text-text-secondary border-border-primary'
            }`}
        >
          {page}
        </button>
      );
    });
  };

  const PrevIcon = isRtl ? ChevronRight : ChevronLeft;
  const NextIcon = isRtl ? ChevronLeft : ChevronRight;

  return (
    <div
      id={id}
      className={`flex items-center justify-center gap-1.5 font-sans select-none ${className}`}
      style={{ direction: isRtl ? 'rtl' : 'ltr' }}
    >
      <button
        type="button"
        disabled={currentPage === 1}
        onClick={handlePrev}
        className="w-8 h-8 rounded-radius-8 border border-border-primary bg-surface-primary hover:bg-hover-overlay text-text-secondary disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer transition-all shrink-0"
      >
        <PrevIcon size={14} />
      </button>

      <div className="flex items-center gap-1.5 shrink-0">{renderPageNumbers()}</div>

      <button
        type="button"
        disabled={currentPage === totalPages}
        onClick={handleNext}
        className="w-8 h-8 rounded-radius-8 border border-border-primary bg-surface-primary hover:bg-hover-overlay text-text-secondary disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer transition-all shrink-0"
      >
        <NextIcon size={14} />
      </button>
    </div>
  );
};
