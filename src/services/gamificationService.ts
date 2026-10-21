import { calculateUserLevel } from '../utils/helpers';

export interface GamificationBadge {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
}

export class GamificationService {
  static getUserBadges(completedCount: number, onTimeRate: number): GamificationBadge[] {
    return [
      {
        id: 'badge-deadline',
        title: 'قهرمان ددلاین',
        description: 'تحویل کارهای بدون تاخیر',
        icon: 'Trophy',
        unlocked: completedCount >= 3
      },
      {
        id: 'badge-blocker',
        title: 'حل‌کننده گلوگاه',
        description: 'رفع بلاکرهای حیاتی',
        icon: 'Zap',
        unlocked: true
      },
      {
        id: 'badge-accuracy',
        title: 'دقت ۱۰۰٪',
        description: 'کیفیت تایید شده بدون باگ',
        icon: 'ShieldCheck',
        unlocked: onTimeRate >= 90
      },
      {
        id: 'badge-collaboration',
        title: 'استاد همکاری',
        description: 'مشارکت بالای تیمی',
        icon: 'Sparkles',
        unlocked: true
      }
    ];
  }
}
