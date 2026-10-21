import React from 'react';
import { motion } from 'motion/react';
import { TrendingUp, TrendingDown, ArrowLeftRight, Clock, ShieldAlert, CheckCircle2, DollarSign, Calendar } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { ProgressBar } from '../ui/Progress';

// 1. STATISTIC CARD
export interface StatisticCardProps {
  id: string;
  title: string;
  value: string | number;
  change?: number; // percentage positive/negative
  trend?: 'up' | 'down' | 'neutral';
  icon?: React.ReactNode;
  footerText?: string;
  className?: string;
}

export const StatisticCard: React.FC<StatisticCardProps> = ({
  id,
  title,
  value,
  change,
  trend = 'neutral',
  icon,
  footerText,
  className = '',
}) => {
  const { locale } = useProject();
  const isRtl = locale === 'fa';

  const trendColors = {
    up: 'text-brand-success bg-brand-success/10',
    down: 'text-brand-danger bg-brand-danger/10',
    neutral: 'text-text-secondary bg-surface-secondary',
  };

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : ArrowLeftRight;

  return (
    <motion.div
      id={id}
      whileHover={{ y: -3, boxShadow: 'var(--shadow-lg)' }}
      className={`bg-surface-primary border border-border-primary rounded-radius-16 p-5 flex flex-col justify-between font-sans shadow-sm hover:shadow-glow transition-all ${className}`}
      style={{ direction: isRtl ? 'rtl' : 'ltr' }}
    >
      <div className="flex items-start justify-between">
        <div className="flex flex-col space-y-1">
          <span className="text-[10px] font-bold text-text-secondary select-none tracking-tight">{title}</span>
          <span className="text-lg font-extrabold text-text-primary tracking-tight font-mono">{value}</span>
        </div>
        {icon && (
          <div className="p-2.5 bg-surface-secondary text-text-secondary rounded-radius-12 border border-border-primary/40 shrink-0">
            {icon}
          </div>
        )}
      </div>

      {(change !== undefined || footerText) && (
        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border-primary/50 text-[10px]">
          {change !== undefined && (
            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full font-bold font-mono select-none ${trendColors[trend]}`}>
              <TrendIcon size={10} />
              {change > 0 ? `+${change}%` : `${change}%`}
            </span>
          )}
          {footerText && <span className="text-text-muted font-medium select-none truncate">{footerText}</span>}
        </div>
      )}
    </motion.div>
  );
};

// 2. INFO CARD
export interface InfoCardProps {
  id: string;
  title: string;
  description: string;
  icon?: React.ReactNode;
  actionText?: string;
  onAction?: () => void;
  className?: string;
}

export const InfoCard: React.FC<InfoCardProps> = ({
  id,
  title,
  description,
  icon,
  actionText,
  onAction,
  className = '',
}) => {
  const { locale } = useProject();
  const isRtl = locale === 'fa';

  return (
    <motion.div
      id={id}
      className={`bg-surface-primary border border-border-primary rounded-radius-16 p-5 flex items-start gap-4 font-sans shadow-sm ${className}`}
      style={{ direction: isRtl ? 'rtl' : 'ltr' }}
    >
      {icon && (
        <div className="p-3 bg-brand-accent/5 text-brand-accent rounded-radius-12 border border-brand-accent/10 shrink-0">
          {icon}
        </div>
      )}
      <div className="flex-1 flex flex-col space-y-1.5 text-right">
        <h4 className="text-xs font-extrabold text-text-primary select-none">{title}</h4>
        <p className="text-[10px] text-text-secondary leading-relaxed select-none">{description}</p>
        {actionText && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="text-[10px] font-bold text-brand-accent hover:text-brand-accent-hover mt-2 text-right w-fit cursor-pointer hover:underline"
          >
            {actionText}
          </button>
        )}
      </div>
    </motion.div>
  );
};

// 3. PROFILE CARD
export interface ProfileCardProps {
  id: string;
  name: string;
  role: string;
  department: string;
  avatar: string;
  avatarSrc?: string;
  status?: 'online' | 'offline' | 'away';
  tasksCount?: number;
  email?: string;
  className?: string;
}

export const ProfileCard: React.FC<ProfileCardProps> = ({
  id,
  name,
  role,
  department,
  avatar,
  avatarSrc,
  status = 'offline',
  tasksCount = 0,
  email,
  className = '',
}) => {
  const { t, locale } = useProject();
  const isRtl = locale === 'fa';

  return (
    <motion.div
      id={id}
      whileHover={{ y: -2, boxShadow: 'var(--shadow-md)' }}
      className={`bg-surface-primary border border-border-primary rounded-radius-16 p-5 flex flex-col items-center text-center font-sans shadow-sm transition-all ${className}`}
      style={{ direction: isRtl ? 'rtl' : 'ltr' }}
    >
      <Avatar src={avatarSrc} fallback={avatar} size="lg" status={status} className="mb-3" />
      
      <h4 className="text-xs font-bold text-text-primary mb-1 select-none">{name}</h4>
      <span className="text-[10px] text-text-secondary select-none mb-3 font-medium">{role}</span>
      
      <div className="flex gap-1.5 mb-4 select-none">
        <Badge variant="secondary" size="sm">{department}</Badge>
        {tasksCount > 0 && (
          <Badge variant="primary" size="sm">
            {tasksCount} {isRtl ? 'وظیفه' : 'Tasks'}
          </Badge>
        )}
      </div>

      {email && (
        <span className="text-[10px] text-text-muted font-mono select-none break-all border-t border-border-primary/50 pt-3 w-full block">
          {email}
        </span>
      )}
    </motion.div>
  );
};

// 4. PROJECT CARD
export interface ProjectCardProps {
  id: string;
  title: string;
  clientName: string;
  progress: number;
  budget: string;
  deadline: string;
  health: 'healthy' | 'warning' | 'critical';
  onSelect?: () => void;
  className?: string;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({
  id,
  title,
  clientName,
  progress,
  budget,
  deadline,
  health,
  onSelect,
  className = '',
}) => {
  const { t, locale } = useProject();
  const isRtl = locale === 'fa';

  const healthLabels = {
    healthy: isRtl ? 'سالم' : 'Healthy',
    warning: isRtl ? 'ریسک ددلاین' : 'Warning',
    critical: isRtl ? 'بحرانی' : 'Critical',
  };

  const healthVariants = {
    healthy: 'success' as const,
    warning: 'warning' as const,
    critical: 'danger' as const,
  };

  return (
    <motion.div
      id={id}
      whileHover={{ y: -3, boxShadow: 'var(--shadow-md)' }}
      className={`bg-surface-primary border border-border-primary rounded-radius-16 p-5 flex flex-col gap-4 font-sans shadow-sm hover:border-brand-accent/30 transition-all ${className}`}
      style={{ direction: isRtl ? 'rtl' : 'ltr' }}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex flex-col space-y-0.5">
          <h4 className="text-xs font-extrabold text-text-primary select-none truncate max-w-[150px]">
            {title}
          </h4>
          <span className="text-[10px] text-text-secondary select-none">
            {clientName}
          </span>
        </div>
        <Badge variant={healthVariants[health]} size="sm" showDot>
          {healthLabels[health]}
        </Badge>
      </div>

      {/* Progress */}
      <div className="flex flex-col space-y-1.5">
        <div className="flex justify-between items-center text-[10px] text-text-secondary font-medium">
          <span>{isRtl ? 'پیشرفت کلی' : 'Progress'}</span>
          <span className="font-mono font-bold text-text-primary">{progress}%</span>
        </div>
        <ProgressBar value={progress} variant={progress === 100 ? 'success' : 'primary'} size="sm" />
      </div>

      {/* Footer Info */}
      <div className="flex items-center justify-between mt-1 pt-3 border-t border-border-primary/50 text-[10px] text-text-secondary select-none font-medium">
        <div className="flex items-center gap-1.5">
          <DollarSign size={12} className="text-brand-success" />
          <span className="font-mono text-text-primary">{budget}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Calendar size={12} className="text-brand-accent" />
          <span className="font-mono text-text-primary">{deadline}</span>
        </div>
      </div>

      {onSelect && (
        <button
          type="button"
          onClick={onSelect}
          className="w-full bg-surface-secondary hover:bg-hover-overlay text-text-secondary hover:text-text-primary border border-border-primary/60 rounded-radius-8 py-2 text-[10px] font-bold cursor-pointer transition-colors mt-2 text-center"
        >
          {isRtl ? 'ورود به کارگاه' : 'Enter Workspace'}
        </button>
      )}
    </motion.div>
  );
};

// 5. ACTIVITY CARD (TIMELINE FEED)
export interface ActivityItem {
  id: string;
  title: string;
  timestamp: string;
  type: 'info' | 'success' | 'warning' | 'error';
  description?: string;
}

export interface ActivityCardProps {
  id: string;
  title: string;
  items: ActivityItem[];
  className?: string;
}

export const ActivityCard: React.FC<ActivityCardProps> = ({
  id,
  title,
  items,
  className = '',
}) => {
  const { locale } = useProject();
  const isRtl = locale === 'fa';

  const bulletColors = {
    info: 'bg-brand-accent ring-brand-accent/20',
    success: 'bg-brand-success ring-brand-success/20',
    warning: 'bg-brand-warning ring-brand-warning/20',
    error: 'bg-brand-danger ring-brand-danger/20',
  };

  return (
    <div
      id={id}
      className={`bg-surface-primary border border-border-primary rounded-radius-16 p-5 flex flex-col font-sans shadow-sm ${className}`}
      style={{ direction: isRtl ? 'rtl' : 'ltr' }}
    >
      <h4 className="text-xs font-extrabold text-text-primary select-none mb-5">{title}</h4>

      <div className="relative border-r border-border-primary/60 pr-4 space-y-5 flex-1 rtl:border-r ltr:border-l rtl:pr-4 ltr:pl-4 ltr:border-r-0 rtl:border-l-0">
        {items.length === 0 ? (
          <div className="text-[10px] text-text-muted select-none text-center py-4">
            {isRtl ? 'فعالیتی ثبت نشده است' : 'No activities recorded'}
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="relative flex flex-col space-y-1 text-right">
              {/* Bullet node */}
              <span
                className={`absolute ${
                  isRtl ? '-right-[21px]' : '-left-[21px]'
                } top-1 w-2.5 h-2.5 rounded-full ring-4 ${bulletColors[item.type]}`}
              />
              <div className="flex justify-between items-center gap-4">
                <span className="text-[10px] font-bold text-text-primary select-none">{item.title}</span>
                <span className="text-[9px] text-text-muted font-mono select-none">{item.timestamp}</span>
              </div>
              {item.description && (
                <p className="text-[9px] text-text-secondary leading-relaxed select-none">{item.description}</p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// 6. WARNING CARD (SLA ALERT BOX)
export interface WarningCardProps {
  id: string;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  className?: string;
}

export const WarningCard: React.FC<WarningCardProps> = ({
  id,
  title,
  description,
  actionText,
  onAction,
  className = '',
}) => {
  const { locale } = useProject();
  const isRtl = locale === 'fa';

  return (
    <motion.div
      id={id}
      whileHover={{ scale: 1.01 }}
      className={`bg-brand-danger/5 border border-brand-danger/20 rounded-radius-16 p-5 flex items-start gap-4 font-sans shadow-sm ${className}`}
      style={{ direction: isRtl ? 'rtl' : 'ltr' }}
    >
      <div className="p-3 bg-brand-danger/10 text-brand-danger rounded-radius-12 border border-brand-danger/15 shrink-0">
        <ShieldAlert size={18} />
      </div>
      <div className="flex-1 flex flex-col space-y-1.5 text-right">
        <h4 className="text-xs font-extrabold text-brand-danger select-none">{title}</h4>
        <p className="text-[10px] text-text-secondary leading-relaxed select-none">{description}</p>
        {actionText && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="text-[10px] font-bold text-brand-danger hover:text-brand-danger-hover mt-2 text-right w-fit cursor-pointer hover:underline"
          >
            {actionText}
          </button>
        )}
      </div>
    </motion.div>
  );
};
