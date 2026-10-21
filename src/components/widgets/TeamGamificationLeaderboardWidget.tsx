import React, { useState, useMemo } from 'react';
import { 
  Trophy, 
  Sparkles, 
  Gift, 
  ArrowUpRight, 
  CheckCircle2, 
  X, 
  Coins 
} from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { useUserAnalytics, UserAnalyticsResult } from '../../hooks/useUserAnalytics';

const toPersianDigits = (n: string | number): string => {
  if (n === undefined || n === null) return '';
  return n.toString().replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[parseInt(d, 10)] || '۰');
};

interface EvaluatedLeaderboardMember {
  rank: number;
  id: string;
  name: string;
  level: string;
  xp: number;
  onTimeRate: number;
  badge?: string;
  avatarColor: string;
  role: string;
}

const MemberAnalyticsEvaluator: React.FC<{
  memberId: string;
  defaultName: string;
  defaultRole: string;
  avatarColor: string;
  defaultBadge?: string;
  onCollect: (data: EvaluatedLeaderboardMember) => void;
}> = ({ memberId, defaultName, defaultRole, avatarColor, defaultBadge, onCollect }) => {
  const analytics = useUserAnalytics(memberId);

  React.useEffect(() => {
    const badgeText = analytics.badges && analytics.badges.length > 0 
      ? (analytics.badges[0] === 'Top Performer' ? 'برترین عملکرد' : 
         analytics.badges[0] === 'Fast Delivery' ? 'تحویل سریع' : 
         analytics.badges[0] === 'Bug Hunter' ? 'بدون تاخیر' : 'استاد وظایف')
      : defaultBadge;

    onCollect({
      rank: 0, // Assigned after sorting
      id: memberId,
      name: analytics.userName || defaultName,
      level: `سطح ${toPersianDigits(analytics.levelNumber)}`,
      xp: analytics.calculatedXP,
      onTimeRate: analytics.onTimeDeliveryRate,
      badge: badgeText,
      avatarColor,
      role: analytics.userRole || defaultRole
    });
  }, [analytics.calculatedXP, analytics.onTimeDeliveryRate, analytics.levelNumber, analytics.userName, analytics.userRole, analytics.badges, memberId, defaultName, defaultRole, avatarColor, defaultBadge, onCollect]);

  return null;
};

export const TeamGamificationLeaderboardWidget: React.FC<{ borderless?: boolean }> = ({ borderless }) => {
  const { locale, teamMembers: contextTeamMembers = [] } = useProject();
  const isRtl = locale === 'fa';

  const [rewardModalMember, setRewardModalMember] = useState<EvaluatedLeaderboardMember | null>(null);
  const [rewardAmount, setRewardAmount] = useState<string>('۵,۰۰۰,۰۰۰ تومان');
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  // Default team member definitions if context teamMembers is short
  const defaultList = [
    { id: 'usr_owner', name: 'علی طهمورث', role: 'راهبر ارشد توسعه', avatarColor: 'bg-gradient-to-tr from-amber-500 to-amber-300 text-slate-950', badge: 'برترین عملکرد ماه' },
    { id: 'mem-2', name: 'محمد رضایی', role: 'متخصص پایگاه‌داده', avatarColor: 'bg-gradient-to-tr from-blue-500 to-indigo-400 text-white', badge: 'قهرمان حل سئو' },
    { id: 'mem-3', name: 'سارا احمدی', role: 'طراح ارشد UI/UX', avatarColor: 'bg-gradient-to-tr from-purple-500 to-pink-400 text-white', badge: 'دقت ۱۰۰٪' },
    { id: 'mem-4', name: 'رضا معتمدی', role: 'کارشناس کنترل کیفی', avatarColor: 'bg-gradient-to-tr from-emerald-500 to-teal-400 text-white' }
  ];

  const targetMembers = contextTeamMembers.length > 0 
    ? contextTeamMembers.map((m, idx) => ({
        id: m.id || `mem-${idx + 1}`,
        name: m.name,
        role: m.role || 'متخصص سیستم',
        avatarColor: defaultList[idx % defaultList.length].avatarColor,
        badge: defaultList[idx % defaultList.length]?.badge
      }))
    : defaultList;

  const [collectedData, setCollectedData] = useState<Record<string, EvaluatedLeaderboardMember>>({});

  const handleCollect = React.useCallback((data: EvaluatedLeaderboardMember) => {
    setCollectedData(prev => {
      if (prev[data.id]?.xp === data.xp && prev[data.id]?.onTimeRate === data.onTimeRate) {
        return prev;
      }
      return { ...prev, [data.id]: data };
    });
  }, []);

  // Compute sorted leaderboard list ranked descending by XP
  const leaderboardData: EvaluatedLeaderboardMember[] = useMemo(() => {
    const list: EvaluatedLeaderboardMember[] = Object.values(collectedData);
    if (list.length === 0) {
      // Fallback initial view
      return defaultList.map((m, i) => ({
        rank: i + 1,
        id: m.id,
        name: m.name,
        level: i === 0 ? 'سطح ۴' : 'سطح ۳',
        xp: i === 0 ? 1450 : 1200 - (i * 150),
        onTimeRate: i === 0 ? 98 : 92 - (i * 4),
        badge: m.badge,
        avatarColor: m.avatarColor,
        role: m.role
      }));
    }

    const sorted = [...list].sort((a, b) => b.xp - a.xp);
    return sorted.map((item, index) => ({
      ...item,
      rank: index + 1
    }));
  }, [collectedData]);

  const handleGrantReward = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rewardModalMember) return;
    setActionSuccessMessage(`پاداش مالی به مبلغ ${rewardAmount} برای ${rewardModalMember.name} ثبت شد و به فیش حقوقی اضافه گردید.`);
    setRewardModalMember(null);
    setTimeout(() => setActionSuccessMessage(null), 4000);
  };

  const handlePromoteToKeyProjects = (member: EvaluatedLeaderboardMember) => {
    setActionSuccessMessage(`کاربر ${member.name} با موفقیت به عنوان مسئول فنی پروژه کلیدی انتخاب گردید.`);
    setTimeout(() => setActionSuccessMessage(null), 4000);
  };

  return (
    <div className={`space-y-4 font-sans ${borderless ? '' : 'bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 shadow-sm'}`} dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Invisible analytics collectors */}
      {targetMembers.map(m => (
        <MemberAnalyticsEvaluator
          key={m.id}
          memberId={m.id}
          defaultName={m.name}
          defaultRole={m.role}
          avatarColor={m.avatarColor}
          defaultBadge={m.badge}
          onCollect={handleCollect}
        />
      ))}

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2.5 bg-amber-50 dark:bg-amber-950/50 text-amber-500 rounded-2xl border border-amber-500/20">
            <Trophy className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <span>جدول امتیازات و نخبگان سازمان</span>
              <span className="px-2 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold rounded-full border border-amber-500/20">
                گیمیفیکیشن تیم
              </span>
            </h3>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">
              رتبه‌بندی پویا بر اساس امتیاز XP، ددلاین‌ها و نرخ آنتایم تحویل
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setRewardModalMember(leaderboardData[0])}
          className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-amber-500/20 flex items-center gap-1.5 cursor-pointer shrink-0 self-end sm:self-auto"
        >
          <Gift size={14} />
          <span>اعطای پاداش / تخصیص پروژه</span>
        </button>
      </div>

      {/* SUCCESS TOAST ALERT */}
      {actionSuccessMessage && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 rounded-2xl text-xs font-bold flex items-center gap-2.5 animate-fadeIn">
          <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
          <span>{actionSuccessMessage}</span>
        </div>
      )}

      {/* LEADERBOARD TABLE / CARDS */}
      <div className="space-y-2.5">
        {leaderboardData.map((member) => (
          <div 
            key={member.id}
            className={`p-3.5 rounded-2xl border transition-all duration-200 flex flex-col md:flex-row md:items-center justify-between gap-3 ${
              member.rank === 1 
                ? 'bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-amber-500/30 dark:border-amber-500/40' 
                : 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            {/* Rank & User Info */}
            <div className="flex items-center gap-3.5 min-w-0">
              <div className={`w-8 h-8 rounded-xl font-black text-xs flex items-center justify-center shrink-0 ${
                member.rank === 1 ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30' :
                member.rank === 2 ? 'bg-slate-300 dark:bg-slate-700 text-slate-900 dark:text-white' :
                member.rank === 3 ? 'bg-amber-800 text-amber-100' :
                'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}>
                {member.rank === 1 ? '🥇' : member.rank === 2 ? '🥈' : member.rank === 3 ? '🥉' : toPersianDigits(member.rank)}
              </div>

              <div className={`w-9 h-9 rounded-2xl font-black text-xs flex items-center justify-center shrink-0 shadow-sm ${member.avatarColor}`}>
                {member.name.split(' ').map(n => n[0]).join('')}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 truncate">{member.name}</h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200/60 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    {member.level}
                  </span>
                  {member.badge && (
                    <span className="hidden sm:inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                      <Sparkles size={10} />
                      <span>{member.badge}</span>
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 font-medium block mt-0.5">{member.role}</span>
              </div>
            </div>

            {/* Metrics & Actions */}
            <div className="flex items-center justify-between md:justify-end gap-4 shrink-0 border-t md:border-t-0 pt-2 md:pt-0 border-slate-200/60 dark:border-slate-800">
              <div className="flex items-center gap-3 text-right">
                <div>
                  <span className="text-[9px] text-slate-400 font-bold block">امتیاز (XP)</span>
                  <span className="text-xs font-black text-amber-600 dark:text-amber-400 font-mono">
                    {toPersianDigits(member.xp)} XP
                  </span>
                </div>
                <div className="w-px h-6 bg-slate-200 dark:bg-slate-800" />
                <div>
                  <span className="text-[9px] text-slate-400 font-bold block">تحویل آنتایم</span>
                  <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 font-mono">
                    {toPersianDigits(member.onTimeRate)}٪
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setRewardModalMember(member)}
                  className="px-2.5 py-1.5 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-300 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer border border-amber-200/60 dark:border-amber-800/60"
                  title="ثبت پاداش مالی"
                >
                  <Coins size={12} />
                  <span className="hidden sm:inline">پاداش مالی</span>
                </button>

                <button
                  type="button"
                  onClick={() => handlePromoteToKeyProjects(member)}
                  className="px-2.5 py-1.5 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer border border-blue-200/60 dark:border-blue-800/60"
                  title="ارتقا به پروژه‌های کلیدی"
                >
                  <ArrowUpRight size={12} />
                  <span className="hidden sm:inline">تخصیص پروژه</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* REWARD MODAL */}
      {rewardModalMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 text-right font-sans">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-amber-500/15 text-amber-500 rounded-2xl">
                  <Gift size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-800 dark:text-slate-100">
                    اعطای پاداش مالی و قدردانی
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium">
                    برای کاربر: {rewardModalMember.name} ({rewardModalMember.level})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRewardModalMember(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleGrantReward} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">مبلغ پاداش تشویقی</label>
                <input
                  type="text"
                  value={rewardAmount}
                  onChange={(e) => setRewardAmount(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                  placeholder="مبلغ به تومان..."
                />
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/60 dark:border-slate-700 text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
                <span className="font-bold block text-slate-700 dark:text-slate-300">اطلاعات تاییدیه:</span>
                <p>این پاداش بر اساس رتبه اول کاربر در جدول امتیازات صادر شده و مستقیماً به فیش حقوقی افزوده می‌گردد.</p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setRewardModalMember(null)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-black transition-all shadow-md shadow-amber-500/20 cursor-pointer"
                >
                  ثبت رسمی پاداش
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
