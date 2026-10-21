import { LocalImage } from './common/LocalImage';
import React from 'react';
import { useProject } from '../context/ProjectContext';
import * as LucideIcons from 'lucide-react';
import { LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SidebarScrollContainer } from './SidebarScrollContainer';
import { SubmenuScrollContainer } from './SubmenuScrollContainer';
import { LogoutConfirmModal } from './auth/LogoutConfirmModal';
import { cn } from '../lib/utils';

export interface SidebarNavTab {
  id: string;
  name: { fa: string; en: string };
  icon: string;
  isModule?: boolean;
  isTeam?: boolean;
  isReport?: boolean;
  deptId?: string;
  teamId?: string;
  instanceId?: string;
}

export interface SidebarNavGroup {
  id: string;
  label: { fa: string; en: string };
  icon: string;
  tabs: SidebarNavTab[];
}

export const Sidebar: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    activeSubTab,
    setActiveSubTab,
    locale,
    tasks,
    notifications,
    departments,
    departmentModules,
    moduleInstances,
    moduleDefinitions,
    teams,
    userRole,
    currentUser,
    logout
  } = useProject();

  const setActiveMode = (mode: 'business' | 'personal') => {
    setSidebarMode(mode);
  };

  const setActiveView = (view: string) => {
    if (view === 'profile') {
      setActiveTab('personal_tasks');
      setActiveSubTab('profile');
    } else {
      setActiveTab(view);
    }
  };

  const activeView = (activeTab === 'personal_tasks' && (activeSubTab === 'profile' || activeSubTab === 'resume-profile')) || activeTab === 'profile'
    ? 'profile'
    : activeTab;

  const [isLogoutModalOpen, setIsLogoutModalOpen] = React.useState(false);

  const handleLogout = () => {
    setIsLogoutModalOpen(true);
  };

  const isRtl = locale === 'fa';
  const [isMenuCollapsed, setIsMenuCollapsed] = React.useState<boolean>(() => {
    return localStorage.getItem('layout_menu_collapsed') === 'true';
  });
  const [sidebarMode, setSidebarMode] = React.useState<'business' | 'personal'>('business');
  const [expandedSection, setExpandedSection] = React.useState<string | null>(activeTab);
  const [hoveredGroupId, setHoveredGroupId] = React.useState<string | null>(null);

  const unreadNotifsCount = (notifications || []).filter(n => n && !n.read).length;

  const renderIcon = (name: string, size = 16, className = '') => {
    const IconComp = (LucideIcons as any)[name] || LucideIcons.Sparkles;
    return <IconComp size={size} className={className} />;
  };

  const computedNavigationGroups = React.useMemo<SidebarNavGroup[]>(() => {
    const list: SidebarNavGroup[] = [
      {
        id: 'dashboard',
        label: { fa: 'داشبورد', en: 'Dashboard' },
        icon: 'LayoutGrid',
        tabs: [
          { id: 'overview', name: { fa: 'میز کار مدیریتی', en: 'Executive Desk' }, icon: 'LayoutGrid' }
        ]
      },
      {
        id: 'dept_tech',
        label: { fa: 'گزارش‌دهی هوشمند', en: 'Smart Reporting & Analytics' },
        icon: 'Sparkles',
        tabs: [
          { id: 'analytics', name: { fa: 'ماتریس و تحلیل عملکرد', en: 'Executive Analytics & KPI Matrix' }, icon: 'BarChart3' },
          { id: 'roadmap', name: { fa: 'رودمپ و جریان اجرای پروژه', en: 'Interactive Roadmap & Dependency Graph' }, icon: 'Network' },
          { id: 'bottlenecks', name: { fa: 'پایش گلوگاه‌ها و موانع', en: 'Bottleneck Radar & Critical Path' }, icon: 'AlertTriangle' },
          { id: 'timeline', name: { fa: 'تایملاین و فازبندی اجرایی', en: 'Phase Timeline & Milestones' }, icon: 'Calendar' }
        ]
      }
    ];

    if (departments && Array.isArray(departments)) {
      departments.forEach((dept) => {
        const deptTabs: SidebarNavTab[] = [];
        const connectedModuleMappings = (departmentModules || []).filter((dm: any) => dm.departmentId === dept.id);
        connectedModuleMappings.forEach((mapping: any) => {
          const inst = (moduleInstances || []).find((mi: any) => mi.id === mapping.moduleId);
          if (inst) {
            const def = (moduleDefinitions || []).find((md: any) => md.id === inst.definitionId);
            deptTabs.push({
              id: `mod_inst_${inst.id}`,
              name: { fa: inst.name, en: inst.name },
              icon: def?.icon || 'Box',
              isModule: true,
              instanceId: inst.id,
              deptId: dept.id
            });
          }
        });

        const deptTeams = (teams || []).filter((t: any) => t.departmentId === dept.id);
        deptTeams.forEach((team: any) => {
          deptTabs.push({
            id: `team_tab_${team.id}`,
            name: { fa: team.name, en: team.name },
            icon: 'Users',
            isTeam: true,
            teamId: team.id,
            deptId: dept.id
          });
        });

        deptTabs.push({
          id: `dept_reports_${dept.id}`,
          name: { fa: `گزارش راندمان ${dept.name}`, en: `Performance Reports` },
          icon: 'BarChart3',
          isReport: true,
          deptId: dept.id
        });

        list.push({
          id: `dept_${dept.id}`,
          label: { fa: dept.name, en: dept.name },
          icon: dept.icon || 'Building2',
          tabs: deptTabs
        });
      });
    }

    list.push(
      {
        id: 'projects',
        label: { fa: 'مدیریت طرح‌ها و پروژه‌ها', en: 'Projects Management' },
        icon: 'FolderGit',
        tabs: [
          { id: 'overview', name: { fa: 'همه پروژه‌ها', en: 'All Projects' }, icon: 'Folder' },
          { id: 'tasks', name: { fa: 'تسک‌ها و زمان‌بندی', en: 'Tasks & Scheduling' }, icon: 'CheckSquare' },
          { id: 'files', name: { fa: 'فایل‌ها و مدارک', en: 'Project Files' }, icon: 'FolderOpen' },
          { id: 'clients', name: { fa: 'فیدبک کارفرمایان', en: 'Client Approval' }, icon: 'UserCheck' }
        ]
      },
      {
        id: 'tasks',
        label: { fa: 'مدیریت وظایف و تسک‌ها', en: 'Tasks & Team Workflow' },
        icon: 'CheckSquare',
        tabs: [
          { id: 'kanban_board', name: { fa: 'برد کانبان وظایف', en: 'Kanban Board' }, icon: 'Trello' },
          { id: 'team_matrix', name: { fa: 'دسته‌بندی و لیست تیم‌ها', en: 'Team Task Matrix' }, icon: 'LayoutGrid' },
          { id: 'timeline', name: { fa: 'تقویم و گانت سررسیدها', en: 'Deadlines & Timeline' }, icon: 'Calendar' }
        ]
      },
      {
        id: 'personal_tasks',
        label: { fa: 'وظایف پروفایل شما', en: 'My Profile Tasks' },
        icon: 'UserCheck',
        tabs: [
          { id: 'my_tasks', name: { fa: 'صندوق کار شخصی', en: 'Personal Taskbox' }, icon: 'User' }
        ]
      },
      {
        id: 'teams',
        label: { fa: 'لیست متخصصین', en: 'Teams & Staff' },
        icon: 'Users',
        tabs: [
          { id: 'team', name: { fa: 'پرسنل و متخصصین سازمانی', en: 'Specialists' }, icon: 'Users' },
          { id: 'team_reports', name: { fa: 'راندمان تیمی', en: 'Performance logs' }, icon: 'BarChart' }
        ]
      },
      {
        id: 'chat',
        label: { fa: 'گفتگوی تیمی', en: 'Team Chat' },
        icon: 'MessageSquare',
        tabs: [
          { id: 'messenger', name: { fa: 'گفتگوی تیمی', en: 'Team Chat' }, icon: 'MessageSquare' }
        ]
      },
      {
        id: 'org_builder',
        label: { fa: 'ساختار سازمانی', en: 'Organization Structure' },
        icon: 'Cpu',
        tabs: [
          { id: 'org_builder_main', name: { fa: 'سازنده دپارتمان و ماژول', en: 'Department & Modules' }, icon: 'Settings2' },
          { id: 'org_permissions', name: { fa: 'سطوح دسترسی دپارتمان‌ها', en: 'Access Control' }, icon: 'ShieldCheck' }
        ]
      }
    );

    if (currentUser?.systemRole === 'ADMIN') {
      list.push({
        id: 'approvals',
        label: { fa: 'مدیریت و تایید اعضا', en: 'Identity & Approvals' },
        icon: 'UserCheck',
        tabs: [
          { id: 'approval_queue', name: { fa: 'صف درخواست‌های عضویت', en: 'Approval Queue' }, icon: 'UserCheck' },
          { id: 'active_sessions', name: { fa: 'نشست‌های فعال پرسنل', en: 'Active Sessions' }, icon: 'Activity' },
          { id: 'security_audit', name: { fa: 'لاگ امنیت و ممیزی', en: 'Security Audit Logs' }, icon: 'Lock' }
        ]
      });
    }

    list.push(
      {
        id: 'notifications',
        label: { fa: 'اعلان‌های سیستم', en: 'System Notifications' },
        icon: 'Bell',
        tabs: [
          { id: 'all_notifications', name: { fa: 'اعلان‌های سیستم', en: 'System Notifications' }, icon: 'Bell' }
        ]
      },
      {
        id: 'settings',
        label: { fa: 'تنظیمات سیستم', en: 'Settings' },
        icon: 'Settings',
        tabs: [
          { id: 'appearance', name: { fa: 'ظاهر و تم پوسته', en: 'Appearance Mode' }, icon: 'Palette' },
          { id: 'profile', name: { fa: 'پروفایل پرسنلی', en: 'My profile' }, icon: 'User' },
          { id: 'organization', name: { fa: 'هویت سازمانی', en: 'Enterprise Profile' }, icon: 'Building2' },
          { id: 'security', name: { fa: 'امنیت و گذرواژه', en: 'Security Guard' }, icon: 'Lock' }
        ]
      }
    );

    return list;
  }, [departments, departmentModules, moduleInstances, moduleDefinitions, teams, userRole]);

  const handleSubTabClick = (sectionId: string, tabId: string) => {
    if (sectionId === 'teams') {
      if (tabId === 'team') {
        setActiveTab('projects');
        setActiveSubTab('team');
      } else {
        setActiveTab('reports');
        setActiveSubTab('team_reports');
      }
    } else if (sectionId === 'chat') {
      setActiveTab('chat');
      setActiveSubTab(tabId);
    } else {
      setActiveTab(sectionId);
      setActiveSubTab(tabId);
    }
  };

  const sections = [
    {
      key: 'workspace',
      label: { fa: 'بخش ۱: فضای کاری', en: 'Workspace' },
      groups: computedNavigationGroups.filter(g => g.id.startsWith('dept_') || ['dashboard', 'dept_tech'].includes(g.id))
    },
    {
      key: 'projects_mgmt',
      label: { fa: 'بخش ۲: مدیریت طرح‌ها و پروژه‌ها', en: 'Projects Management' },
      groups: computedNavigationGroups.filter(g => ['projects', 'tasks'].includes(g.id))
    },
    {
      key: 'collaboration',
      label: { fa: 'بخش ۳: همکاری تیمی', en: 'Team Collaboration' },
      groups: computedNavigationGroups.filter(g => ['teams', 'chat'].includes(g.id))
    },
    {
      key: 'administration',
      label: { fa: 'مدیریت سیستم', en: 'Administration' },
      groups: computedNavigationGroups.filter(g => ['org_builder', 'approvals', 'notifications', 'settings'].includes(g.id))
    }
  ].filter(sec => sec.groups.length > 0);

  return (
    <aside
      dir={isRtl ? 'rtl' : 'ltr'}
      className={`hidden lg:flex flex-col shrink-0 transition-all duration-300 ease-in-out ${
        isMenuCollapsed ? 'w-20' : 'w-72'
      } sticky top-6 h-[calc(100vh-48px)] min-h-[500px] my-6 ms-6 me-3 bg-white dark:bg-[#111322] border border-gray-200/70 dark:border-[#1E2235] rounded-[24px] shadow-2xl backdrop-blur-xl overflow-hidden z-20`}
    >
      {/* Brand Header */}
      <div className="pt-5 px-5 shrink-0 flex flex-col gap-2.5 text-start">
        {!isMenuCollapsed ? (
          <div className="flex items-center gap-2.5 flex-row text-start">
            <div className="w-8 h-8 bg-gradient-to-tr from-[#155DFC] to-[#3B82F6] rounded-xl flex items-center justify-center text-white font-black text-xs shrink-0 shadow-[0_4px_12px_rgba(21,93,252,0.25)]">
              TS
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-black text-slate-800 dark:text-white leading-tight truncate">TS Orbit</span>
              <span className="text-[8.5px] text-slate-400 dark:text-slate-500 font-bold block mt-0.5 truncate">Enterprise Operations Platform</span>
            </div>
          </div>
        ) : (
          <div className="flex justify-center py-1">
            <div className="w-8 h-8 bg-gradient-to-tr from-[#155DFC] to-[#3B82F6] rounded-xl flex items-center justify-center text-white font-black text-xs shrink-0 shadow-[0_4px_12px_rgba(21,93,252,0.25)] hover:scale-105 transition-transform">
              TS
            </div>
          </div>
        )}
      </div>

      {/* Mode Switcher */}
      {!isMenuCollapsed && (
        <div className="px-5 py-2.5 shrink-0">
          <div className="bg-gray-100 dark:bg-[#121420] p-1 rounded-2xl border border-gray-200/50 dark:border-[#1A1D2B] flex items-center gap-1">
            <button
              onClick={() => {
                setSidebarMode('personal');
                setActiveTab('personal_tasks');
                setActiveSubTab('my_dashboard');
              }}
              className={`flex-1 text-center py-1.5 text-[9px] font-bold tracking-wider transition-all cursor-pointer ${
                sidebarMode === 'personal'
                  ? 'bg-white dark:bg-[#1C1F2E] text-gray-900 dark:text-white font-bold shadow-md rounded-xl'
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
              }`}
            >
              {isRtl ? 'شخصی' : 'PERSONAL'}
            </button>
            <button
              onClick={() => {
                setSidebarMode('business');
                setActiveTab('dashboard');
                setActiveSubTab('overview');
              }}
              className={`flex-1 text-center py-1.5 text-[9px] font-bold tracking-wider transition-all cursor-pointer ${
                sidebarMode === 'business'
                  ? 'bg-white dark:bg-[#1C1F2E] text-gray-900 dark:text-white font-bold shadow-md rounded-xl'
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
              }`}
            >
              {isRtl ? 'سازمانی' : 'ENTERPRISE'}
            </button>
          </div>
        </div>
      )}

      {/* Navigation List */}
      <SidebarScrollContainer>
        {sidebarMode === 'personal' ? (
          <div className="space-y-2">
            {!isMenuCollapsed && (
              <div className="px-3.5 flex items-center gap-1.5 text-[9px] font-black tracking-wider uppercase text-slate-400 dark:text-slate-500 flex-row justify-start text-right">
                <span>{isRtl ? 'فضای شخصی شما' : 'Personal Space'}</span>
              </div>
            )}
            <div className="space-y-1">
              {[
                {
                  id: 'my_dashboard',
                  label: isRtl ? 'داشبورد من' : 'My Dashboard',
                  icon: LucideIcons.LayoutDashboard,
                  badge: null
                },
                {
                  id: 'my_projects',
                  label: isRtl ? 'پروژه‌های من' : 'My Projects',
                  icon: LucideIcons.FolderGit2,
                  badge: null
                },
                {
                  id: 'my_tasks',
                  label: isRtl ? 'تسک‌های من' : 'My Tasks',
                  icon: LucideIcons.CheckSquare,
                  badge: (tasks || []).filter(t => t && t.status !== 'completed' && t.status !== 'done').length || null
                },
                {id:'activity-feed',label:isRtl?'فعالیت‌های من':'My Activity',icon:LucideIcons.Activity,badge:null},
                {
                  id: 'my_files',
                  label: isRtl ? 'فایل‌های من' : 'My Files',
                  icon: LucideIcons.FolderOpen,
                  badge: null
                },
                {
                  id: 'messages',
                  label: isRtl ? 'پیام‌ها' : 'Messages',
                  icon: LucideIcons.MessageSquare,
                  badge: null
                },
                {
                  id: 'performance',
                  label: isRtl ? 'عملکرد و امتیاز' : 'Performance & XP',
                  icon: LucideIcons.Award,
                  badge: null
                },
                {
                  id: 'profile',
                  label: isRtl ? 'رزومه و پروفایل' : 'Resume & Profile',
                  icon: LucideIcons.UserCheck,
                  badge: null
                }
              ].map((item) => {
                const IconComponent = item.icon;
                const isItemActive = activeTab === 'personal_tasks' && (
                  activeSubTab === item.id ||
                  (item.id === 'my_dashboard' && (!activeSubTab || activeSubTab === 'overview' || activeSubTab === 'my-dashboard')) ||
                  (item.id === 'my_projects' && activeSubTab === 'my-projects') ||
                  (item.id === 'my_tasks' && activeSubTab === 'my-tasks') ||
                  (item.id === 'my_files' && activeSubTab === 'my-files') ||
                  (item.id === 'messages' && activeSubTab === 'pv-messages') ||
                  (item.id === 'performance' && activeSubTab === 'performance-score') ||
                  (item.id === 'profile' && activeSubTab === 'resume-profile')
                );

                return (
                  <div key={item.id} className="relative">
                    <button
                      onClick={() => {
                        setActiveTab('personal_tasks');
                        setActiveSubTab(item.id);
                      }}
                      className={`w-full group/l1 flex items-center transition-all duration-300 ease-in-out cursor-pointer text-right ${
                        isMenuCollapsed ? 'justify-center p-1.5' : 'justify-between px-3 py-2.5'
                      } rounded-[18px] ${
                        isItemActive
                          ? 'bg-blue-50/80 dark:bg-[#161926] text-blue-600 dark:text-white font-bold rounded-2xl border border-blue-100 dark:border-[#222638] shadow-sm'
                          : 'text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-[#121522] hover:text-gray-900 dark:hover:text-slate-200 rounded-2xl transition-all border border-transparent'
                      } flex-row`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-row">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300 ${
                          isItemActive
                            ? 'bg-blue-100/60 dark:bg-[#1C2030] text-blue-600 dark:text-slate-200'
                            : 'bg-gray-100 dark:bg-[#131522] text-gray-500 dark:text-slate-400'
                        }`}>
                          <IconComponent size={16} />
                        </div>
                        {!isMenuCollapsed && (
                          <span className="text-[12px] font-semibold tracking-tight truncate">
                            {item.label}
                          </span>
                        )}
                      </div>

                      {!isMenuCollapsed && item.badge !== null && (
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300 text-[9px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                            {item.badge}
                          </span>
                        </div>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          sections.map(sec => (
          <div key={sec.key} className="space-y-2">
            {!isMenuCollapsed && (
              <div className="px-3.5 flex items-center gap-1.5 text-[9px] font-black tracking-wider uppercase text-slate-400 dark:text-slate-500 flex-row justify-start text-right">
                <span>{isRtl ? sec.label.fa : sec.label.en}</span>
              </div>
            )}
            <div className="space-y-1">
              {sec.groups.map(group => {
                const isGroupActive = group.id === 'chat'
                  ? (activeTab === 'chat' || activeTab === 'messages')
                  : activeTab === group.id;
                const isExpanded = expandedSection === group.id;
                const hasChildren = group.tabs.length > 1;

                return (
                  <div key={group.id} className="relative">
                    <button
                      onClick={() => {
                        if (hasChildren) {
                          setExpandedSection(isExpanded ? null : group.id);
                        } else {
                          handleSubTabClick(group.id, group.tabs[0].id);
                        }
                      }}
                      className={`w-full group/l1 flex items-center transition-all duration-300 ease-in-out cursor-pointer text-right ${
                        isMenuCollapsed ? 'justify-center p-1.5' : 'justify-between px-3 py-2.5'
                      } rounded-[18px] ${
                        isGroupActive
                          ? 'bg-blue-50/80 dark:bg-[#161926] text-blue-600 dark:text-white font-bold rounded-2xl border border-blue-100 dark:border-[#222638] shadow-sm'
                          : 'text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-[#121522] hover:text-gray-900 dark:hover:text-slate-200 rounded-2xl transition-all border border-transparent'
                      } flex-row`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-row">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300 ${
                          isGroupActive
                            ? 'bg-blue-100/60 dark:bg-[#1C2030] text-blue-600 dark:text-slate-200'
                            : 'bg-gray-100 dark:bg-[#131522] text-gray-500 dark:text-slate-400'
                        }`}>
                          {renderIcon(group.icon, 16)}
                        </div>
                        {!isMenuCollapsed && (
                          <span className="text-[12px] font-semibold tracking-tight truncate">
                            {isRtl ? group.label.fa : group.label.en}
                          </span>
                        )}
                      </div>

                      {!isMenuCollapsed && (
                        <div className="flex items-center gap-2 shrink-0">
                          {group.id === 'tasks' && (
                            <span className="bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300 text-[9px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                              {(tasks || []).filter(t => t && t.status !== 'completed' && t.status !== 'done').length}
                            </span>
                          )}
                          {group.id === 'notifications' && unreadNotifsCount > 0 && (
                            <span className="bg-red-500/10 text-red-500 dark:bg-red-500/20 dark:text-red-400 text-[9px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center animate-pulse">
                              {unreadNotifsCount}
                            </span>
                          )}
                          {hasChildren && (
                            <LucideIcons.ChevronDown size={12} className={`text-slate-400 dark:text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          )}
                        </div>
                      )}
                    </button>

                    {!isMenuCollapsed && hasChildren && isExpanded && (
                      <div className="bg-slate-50/50 dark:bg-[#0B0D17]/80 border border-slate-200/30 dark:border-[#1A1D2B] rounded-[16px] shadow-inner my-1 mx-1 p-1 space-y-1">
                        {group.tabs.map(tab => (
                          <button
                            key={tab.id}
                            onClick={() => handleSubTabClick(group.id, tab.id)}
                            className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer text-right ${
                              (activeSubTab === tab.id || (group.id === 'dept_tech' && tab.id === 'analytics' && (!activeSubTab || activeSubTab === 'overview')))
                                ? 'bg-slate-100/90 dark:bg-[#161926] text-[#155DFC] dark:text-white font-semibold'
                                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {renderIcon(tab.icon, 12)}
                              <span className="text-[11px] font-medium leading-none truncate">
                                {isRtl ? tab.name.fa : tab.name.en}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
      </SidebarScrollContainer>

      {/* User Profile Footer Card */}
      {!isMenuCollapsed ? (
        <div className="p-3 mt-auto shrink-0 border-t border-slate-100 dark:border-[#1A1D2B]">
          <div 
            onClick={() => {
              setActiveMode('personal');
              setActiveView('profile');
            }}
            className={cn(
              "p-3 rounded-2xl border transition-all duration-200 flex items-center justify-between group cursor-pointer select-none",
              activeView === 'profile'
                ? "bg-blue-50/60 dark:bg-blue-950/30 border-blue-500/50 dark:border-blue-500/40 shadow-sm"
                : "bg-white dark:bg-[#0d121f] border-slate-200/90 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-[#131b2e] hover:border-slate-300 dark:hover:border-slate-700"
            )}
            dir="rtl"
          >
            {/* Right: User Avatar & Info */}
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <LocalImage
                  src={currentUser?.avatar || "/avatars/avatar-4.svg"}
                  alt={currentUser?.name || "User"}
                  className="w-10 h-10 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 group-hover:scale-105 transition-transform"
                />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 absolute -bottom-0.5 -right-0.5 border-2 border-white dark:border-[#0d121f]" />
              </div>

              <div className="text-right">
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {currentUser?.name || 'علی طهمورث'}
                </h4>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium block">
                  {currentUser?.role === 'OWNER' ? 'مدیر سیستم' : currentUser?.role || 'کاربر سیستم'}
                </span>
              </div>
            </div>

            {/* Left: Logout Action (Isolated with stopPropagation) */}
            <button
              type="button"
              title="خروج از حساب"
              onClick={(e) => {
                e.stopPropagation();
                handleLogout();
              }}
              className="p-1.5 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4 rtl:rotate-180"/>
            </button>
          </div>
        </div>
      ) : (
        <div className="p-3 mt-auto shrink-0 flex flex-col items-center gap-2 border-t border-slate-100 dark:border-[#1A1D2B]">
          <div
            onClick={() => {
              setActiveMode('personal');
              setActiveView('profile');
            }}
            className={cn(
              "relative cursor-pointer group p-1 rounded-xl transition-all",
              activeView === 'profile' ? "ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950/40" : "hover:bg-slate-100 dark:hover:bg-slate-800"
            )}
            title={currentUser?.name || 'User'}
          >
            <LocalImage
              src={currentUser?.avatar || "/avatars/avatar-4.svg"}
              alt={currentUser?.name || "User"}
              className="w-10 h-10 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 group-hover:scale-105 transition-transform"
            />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 absolute -bottom-0.5 -right-0.5 border-2 border-white dark:border-[#0d121f]" />
          </div>
          <button
            type="button"
            title="خروج از حساب"
            onClick={(e) => {
              e.stopPropagation();
              handleLogout();
            }}
            className="p-1.5 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4 rtl:rotate-180" />
          </button>
        </div>
      )}

      {/* Logout Confirmation Modal */}
      <LogoutConfirmModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        onConfirm={() => {
          setIsLogoutModalOpen(false);
          void logout().catch(() => {});
        }}
      />
    </aside>
  );
};
export default Sidebar;
