import { LocalImage } from './common/LocalImage';
import React, { useState, useMemo, useEffect, useRef, useCallback, Suspense } from 'react';
import { useProject } from '../context/ProjectContext';
import { lazyNamed, preloadWhenIdle } from '../lib/lazy';
import { StrandsLoader } from './loading/StrandsLoader';
import { SubmenuScrollContainer } from './SubmenuScrollContainer';
import { SidebarScrollContainer } from './SidebarScrollContainer';
import { cn } from '../lib/utils';
import { 
  Project, 
  Task, 
  FileAsset, 
  TeamMember,
  AppNotification
} from '../types';
import { ArrowLeft, Bell, Briefcase, ChevronDown, LogOut, Menu, MessageSquare, Moon, Search, Settings, Sparkles, Sun, User, UserPlus, X } from 'lucide-react';
import { iconByName } from '../lib/icons';
import { motion, AnimatePresence } from 'motion/react';

import { LogoutConfirmModal } from './auth/LogoutConfirmModal';
import { PageLoadingBoundary } from './loading/PageLoadingBoundary';
import { useLoading } from '../context/LoadingContext';
import { WorkspaceSwitcher } from './workspace/WorkspaceSwitcher';
import { GlobalSyncAndToast } from './common/GlobalSyncAndToast';

// Each view is its own chunk: the shell renders first, a view downloads when it
// is opened, and the rest are warmed in idle time after the shell has mounted.
const ProjectsView = lazyNamed(() => import('./ProjectsView'), 'ProjectsView');
const TasksGlobalView = lazyNamed(() => import('./TasksGlobalView'), 'TasksGlobalView');
const ReportsGlobalView = lazyNamed(() => import('./ReportsGlobalView'), 'ReportsGlobalView');
const SystemSettingsView = lazyNamed(() => import('./SystemSettingsView'), 'SystemSettingsView');
const MessagesView = lazyNamed(() => import('./chat/MessagesView'), 'MessagesView');
const OrgBuilder = lazyNamed(() => import('./OrgBuilder'), 'OrgBuilder');
const OrgPermissions = lazyNamed(() => import('./OrgPermissions'), 'OrgPermissions');
const DynamicModuleView = lazyNamed(() => import('./DynamicModuleView'), 'DynamicModuleView');
const TeamDashboardView = lazyNamed(() => import('./TeamDashboardView'), 'TeamDashboardView');
const DepartmentReportsView = lazyNamed(() => import('./DepartmentReportsView'), 'DepartmentReportsView');
const DepartmentTechnicalView = lazyNamed(() => import('./DepartmentTechnicalView'), 'DepartmentTechnicalView');
const ApprovalCenter = lazyNamed(() => import('./ApprovalCenter'), 'ApprovalCenter');
const PersonalTasksView = lazyNamed(() => import('./PersonalTasksView'), 'PersonalTasksView');
const ProfileView = lazyNamed(() => import('./ProfileView'), 'ProfileView');
const NotificationsView = lazyNamed(() => import('./NotificationsView'), 'NotificationsView');
const CreateProjectModal = lazyNamed(() => import('./projects/CreateProjectModal'), 'CreateProjectModal');
const idleViews = [ProjectsView, TasksGlobalView, MessagesView, PersonalTasksView, NotificationsView, ReportsGlobalView,
  DepartmentTechnicalView, ProfileView, CreateProjectModal, ApprovalCenter, SystemSettingsView, OrgBuilder, OrgPermissions,
  TeamDashboardView, DepartmentReportsView, DynamicModuleView];

interface LayoutProps {
  children: React.ReactNode;
}

const navigationGroups = [
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
    label: { fa: 'گزارش‌ها', en: 'Reports' },
    icon: 'Sparkles',
    tabs: [
      { id: 'analytics', name: { fa: 'تحلیل عملکرد', en: 'Performance analysis' }, icon: 'BarChart3' },
      { id: 'roadmap', name: { fa: 'نقشهٔ راه پروژه', en: 'Project roadmap' }, icon: 'Network' },
      { id: 'bottlenecks', name: { fa: 'موانع و تأخیرها', en: 'Blockers and delays' }, icon: 'AlertTriangle' },
      { id: 'timeline', name: { fa: 'زمان‌بندی وظایف', en: 'Task schedule' }, icon: 'Calendar' }
    ]
  },
  {
    id: 'projects',
    label: { fa: 'پروژه‌ها', en: 'Projects' },
    icon: 'FolderGit',
    tabs: [
      { id: 'overview', name: { fa: 'همه پروژه‌ها', en: 'All projects' }, icon: 'Folder' },
      { id: 'active_projects', name: { fa: 'طرح‌های فعال', en: 'Active Initiatives' }, icon: 'TrendingUp' },
      { id: 'development', name: { fa: 'یکپارچه‌سازی و سرویس‌ها', en: 'Integrations & Services' }, icon: 'Code' },
      { id: 'files', name: { fa: 'اسناد و فایل‌ها', en: 'Project Files' }, icon: 'FolderOpen' },
      { id: 'clients', name: { fa: 'تاییدیه و بازخورد کارفرما', en: 'Client Approval' }, icon: 'UserCheck' }
    ]
  },
  {
    id: 'tasks',
    label: { fa: 'وظایف', en: 'Tasks' },
    icon: 'CheckSquare',
    tabs: [
      { id: 'kanban_board', name: { fa: 'برد کانبان وظایف', en: 'Task Kanban board' }, icon: 'Trello' },
      { id: 'team_matrix', name: { fa: 'دسته‌بندی و لیست تیم‌ها', en: 'Teams and lists' }, icon: 'LayoutGrid' },
      { id: 'timeline', name: { fa: 'تقویم و گانت سررسیدها', en: 'Due date calendar' }, icon: 'Calendar' }
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
    label: { fa: 'تیم', en: 'Team' },
    icon: 'Users',
    tabs: [
      { id: 'team', name: { fa: 'پرسنل و متخصصین سازمانی', en: 'Specialists' }, icon: 'Users' },
      { id: 'team_reports', name: { fa: 'نمودار راندمان پرسنل', en: 'Performance logs' }, icon: 'BarChart' }
    ]
  },
  {
    id: 'reports',
    label: { fa: 'گزارش‌ها و OKR', en: 'Reports & OKRs' },
    icon: 'LineChart',
    tabs: [
      { id: 'weekly_reports', name: { fa: 'گزارش‌های هفتگی سازمان', en: 'Weekly Velocity' }, icon: 'FileText' },
      { id: 'monthly_reports', name: { fa: 'پیشرفت فیزیکی و بودجه', en: 'Financial Reports' }, icon: 'Layers' },
      { id: 'quarterly_reports', name: { fa: 'تحقق اهداف OKR فصلی', en: 'Quarterly OKRs' }, icon: 'PieChart' },
      { id: 'export', name: { fa: 'خروجی اکسل / CSV', en: 'Download Excel' }, icon: 'Download' },
      { id: 'analytics', name: { fa: 'تحلیل پیشرفته آماری', en: 'Advanced Analytics' }, icon: 'TrendingUp' }
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
    id: 'settings',
    label: { fa: 'تنظیمات', en: 'Settings' },
    icon: 'Settings',
    tabs: [
      { id: 'appearance', name: { fa: 'ظاهر و تم', en: 'Appearance' }, icon: 'Palette' },
      { id: 'localization', name: { fa: 'زبان', en: 'Language' }, icon: 'Globe' },
      { id: 'notifications', name: { fa: 'اعلان‌ها', en: 'Notifications' }, icon: 'Bell' },
      { id: 'profile', name: { fa: 'حساب کاربری', en: 'Account' }, icon: 'User' },
      { id: 'organization', name: { fa: 'فضای کاری', en: 'Workspace' }, icon: 'Building2' },
      { id: 'security', name: { fa: 'امنیت', en: 'Security' }, icon: 'ShieldCheck' },
      { id: 'modules', name: { fa: 'ماژول‌ها', en: 'Modules' }, icon: 'Sliders' }
    ]
  }
];

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { 
    activeTab, 
    setActiveTab, 
    activeSubTab,
    setActiveSubTab,
    selectedProject, 
    setSelectedProject,
    notifications,
    chatConversations, currentUser: chatCurrentUser, setActiveConversation, markConversationRead,
    projects,
    tasks,
    files,
    teamMembers,
    currentUser,
    userRole,
    setUserRole,
    logout,
    updateProfile,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    activeModules,
    getRoleLabel,
    locale,
    setLocale,
    theme,
    setTheme,
    t,
    // Automations states
    automationRules,
    automationLogs,
    createAutomationRule,
    toggleAutomationRule,
    deleteAutomationRule,
    runAutomationEngine,
    // Phase 6 Dynamic Org & Modules State Destructuring
    departments,
    moduleDefinitions,
    moduleInstances,
    departmentModules,
    teams,
    isNewProjectModalOpen,
    setIsNewProjectModalOpen
  } = useProject();

  const { isPageLoading, pageMessage, isNavigating } = useLoading();
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  // Mount the create-project modal (and download its chunk) only once it is first opened.
  const [hasOpenedNewProjectModal, setHasOpenedNewProjectModal] = useState(false);
  useEffect(() => { if (isNewProjectModalOpen) setHasOpenedNewProjectModal(true); }, [isNewProjectModalOpen]);
  useEffect(() => preloadWhenIdle(idleViews), []);


  const computedNavigationGroups = useMemo(() => {
    const list = [
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
        label: { fa: 'گزارش‌ها', en: 'Reports' },
        icon: 'Sparkles',
        tabs: [
          { id: 'analytics', name: { fa: 'تحلیل عملکرد', en: 'Performance analysis' }, icon: 'BarChart3' },
          { id: 'roadmap', name: { fa: 'نقشهٔ راه پروژه', en: 'Project roadmap' }, icon: 'Network' },
          { id: 'bottlenecks', name: { fa: 'موانع و تأخیرها', en: 'Blockers and delays' }, icon: 'AlertTriangle' },
          { id: 'timeline', name: { fa: 'زمان‌بندی وظایف', en: 'Task schedule' }, icon: 'Calendar' }
        ]
      }
    ];

    if (departments && Array.isArray(departments)) {
      departments.forEach((dept) => {
        const deptTabs: any[] = [];
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
        label: { fa: 'پروژه‌ها', en: 'Projects' },
        icon: 'FolderGit',
        tabs: [
          { id: 'overview', name: { fa: 'همه پروژه‌ها', en: 'All projects' }, icon: 'Folder' },
          { id: 'tasks', name: { fa: 'وظایف و زمان‌بندی', en: 'Tasks and schedule' }, icon: 'CheckSquare' },
          { id: 'files', name: { fa: 'فایل‌ها و مدارک', en: 'Files and documents' }, icon: 'FolderOpen' },
          { id: 'clients', name: { fa: 'بازخورد کارفرمایان', en: 'Client feedback' }, icon: 'UserCheck' }
        ]
      },
      {
        id: 'tasks',
        label: { fa: 'وظایف', en: 'Tasks' },
        icon: 'CheckSquare',
        tabs: [
          { id: 'kanban_board', name: { fa: 'برد کانبان وظایف', en: 'Task Kanban board' }, icon: 'Trello' },
          { id: 'team_matrix', name: { fa: 'دسته‌بندی و لیست تیم‌ها', en: 'Teams and lists' }, icon: 'LayoutGrid' },
          { id: 'timeline', name: { fa: 'تقویم و گانت سررسیدها', en: 'Due date calendar' }, icon: 'Calendar' }
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
        label: { fa: 'تیم', en: 'Team' },
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
        label: { fa: 'ساختار سازمانی', en: 'Organization' },
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
        label: { fa: 'تأیید اعضا', en: 'Approvals' },
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
        label: { fa: 'اعلان‌ها', en: 'Notifications' },
        icon: 'Bell',
        tabs: [
          { id: 'all_notifications', name: { fa: 'اعلان‌های سیستم', en: 'System Notifications' }, icon: 'Bell' }
        ]
      },
      {
        id: 'settings',
        label: { fa: 'تنظیمات', en: 'Settings' },
        icon: 'Settings',
        tabs: [
          { id: 'appearance', name: { fa: 'ظاهر و تم', en: 'Appearance' }, icon: 'Palette' },
          { id: 'localization', name: { fa: 'زبان', en: 'Language' }, icon: 'Globe' },
          { id: 'notifications', name: { fa: 'اعلان‌ها', en: 'Notifications' }, icon: 'Bell' },
          { id: 'profile', name: { fa: 'حساب کاربری', en: 'Account' }, icon: 'User' },
          ...(['OWNER', 'ADMIN'].includes(userRole) ? [{ id: 'organization', name: { fa: 'فضای کاری', en: 'Workspace' }, icon: 'Building2' }] : []),
          { id: 'security', name: { fa: 'امنیت', en: 'Security' }, icon: 'ShieldCheck' },
          ...(userRole === 'OWNER' ? [{ id: 'modules', name: { fa: 'ماژول‌ها', en: 'Modules' }, icon: 'Sliders' }] : [])
        ]
      }
    );

    // Filter groups strictly based on role and custom permissions (Dynamic RBAC)
    const normRole = (userRole || currentUser?.role || 'USER').toUpperCase();
    const userPerms = currentUser?.permissions || currentUser?.customPermissions || [];

    return list.filter(group => {
      // OWNER has superadmin access to everything
      if (group.id !== 'approvals' && (normRole === 'OWNER' || currentUser?.systemRole === 'ADMIN')) return true;

      // Identity & Approvals
      if (group.id === 'approvals') {
        return currentUser?.systemRole === 'ADMIN';
      }

      // Org Builder & Department Structure
      if (group.id === 'org_builder') {
        return normRole === 'ADMIN' || userPerms.includes('manage_org') || userPerms.includes('org_builder');
      }

      // Executive Reporting
      if (group.id === 'dept_tech') {
        return ['ADMIN', 'MANAGER', 'PROJECT_MANAGER'].includes(normRole) || userPerms.includes('view_executive_reports') || userPerms.includes('dept_tech');
      }

      // Specialists / Teams
      if (group.id === 'teams') {
        return normRole !== 'CLIENT' && normRole !== 'CLIENT_USER';
      }

      // Dynamic department groups
      if (group.id.startsWith('dept_') && group.id !== 'dept_tech') {
        if (normRole === 'CLIENT' || normRole === 'CLIENT_USER') return false;
      }

      return true;
    });
  }, [departments, moduleDefinitions, moduleInstances, departmentModules, teams, userRole, currentUser]);

  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
  const [showMessagesDropdown, setShowMessagesDropdown] = useState(false);
  const unreadMessages = chatConversations.filter(conversation=>conversation.unreadCount>0).map(conversation=>({
    id:conversation.id,conversation,read:false,sender:conversation.title || conversation.members?.filter((member:any)=>member.id!==chatCurrentUser?.id).map((member:any)=>member.name).join('، ') || 'گفتگو',
    avatar:conversation.members?.find((member:any)=>member.id!==chatCurrentUser?.id)?.avatar,
    snippet:conversation.lastMessage?.content || 'پیوست',time:conversation.lastMessage?.createdAt ? new Date(conversation.lastMessage.createdAt).toLocaleTimeString('fa-IR',{hour:'2-digit',minute:'2-digit'}) : ''
  }));
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [layoutSearchQuery, setLayoutSearchQuery] = useState('');
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [mobileSearchQuery, setMobileSearchQuery] = useState('');

  // Refs for Click-Outside Popup Handlers
  const messagesDropdownRef = useRef<HTMLDivElement>(null);
  const notificationDropdownRef = useRef<HTMLDivElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (messagesDropdownRef.current && !messagesDropdownRef.current.contains(target)) {
        setShowMessagesDropdown(false);
      }
      if (notificationDropdownRef.current && !notificationDropdownRef.current.contains(target)) {
        setShowNotificationDropdown(false);
      }
      if (searchContainerRef.current && !searchContainerRef.current.contains(target)) {
        setShowSearchResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Sidebar state
  const [isMenuCollapsed, setIsMenuCollapsed] = useState(() => {
    return localStorage.getItem('layout_menu_collapsed') === 'true';
  });
  const [expandedSection, setExpandedSection] = useState<string | null>(() => activeTab);
  const [isMobileProfileOpen, setIsMobileProfileOpen] = useState(false);
  // Opening on a personal page (for example after a reload) shows the personal menu.
  const [sidebarMode, setSidebarMode] = useState<'personal' | 'business'>(() => activeTab === 'personal_tasks' ? 'personal' : 'business');
  const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null);

  // Native Dynamic Bottom Scroll Cue
  const mainScrollRef = useRef<HTMLDivElement>(null);
  const [showBottomScrollCue, setShowBottomScrollCue] = useState(false);

  const checkBottomScrollCue = useCallback(() => {
    const el = mainScrollRef.current;
    if (!el) return;
    const hasOverflow = el.scrollHeight > el.clientHeight + 20;
    const notAtBottom = el.scrollTop + el.clientHeight < el.scrollHeight - 15;
    const shouldShow = hasOverflow && notAtBottom;
    setShowBottomScrollCue(prev => (prev !== shouldShow ? shouldShow : prev));
  }, []);

  useEffect(() => {
    const el = mainScrollRef.current;
    if (!el) return;

    const onScroll = () => {
      checkBottomScrollCue();
    };

    el.addEventListener('scroll', onScroll, { passive: true });

    // Initial check
    checkBottomScrollCue();

    const resizeObserver = new ResizeObserver(() => {
      checkBottomScrollCue();
    });
    resizeObserver.observe(el);

    const mutationObserver = new MutationObserver(() => {
      checkBottomScrollCue();
    });
    mutationObserver.observe(el, { childList: true, subtree: true });

    const onResize = () => {
      checkBottomScrollCue();
    };
    window.addEventListener('resize', onResize, { passive: true });

    return () => {
      el.removeEventListener('scroll', onScroll);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener('resize', onResize);
    };
  }, [checkBottomScrollCue]);

  useEffect(() => {
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollTop = 0;
    }
    const rafId = requestAnimationFrame(() => {
      checkBottomScrollCue();
    });
    return () => cancelAnimationFrame(rafId);
  }, [activeTab, activeSubTab, checkBottomScrollCue]);

  const handleModeToggle = (mode: 'personal' | 'business') => {
    setSidebarMode(mode);
    setIsMobileProfileOpen(false);
    if (mode === 'personal') {
      setActiveTab('personal_tasks');
      setActiveSubTab('my_dashboard');
    } else {
      setActiveTab('dashboard');
      setActiveSubTab('overview');
    }
  };

  useEffect(() => {
    if (sidebarMode === 'personal') {
      if (activeTab !== 'personal_tasks') {
        setActiveTab('personal_tasks');
        setActiveSubTab('my_dashboard');
      }
    } else if (sidebarMode === 'business') {
      if (activeTab === 'personal_tasks') {
        setActiveTab('dashboard');
        setActiveSubTab('overview');
      }
    }
  }, [sidebarMode]);

  // Automation rule form states
  const [ruleName, setRuleName] = useState('');
  const [ruleTrigger, setRuleTrigger] = useState('page_published');
  const [ruleActionType, setRuleActionType] = useState('complete_task');
  const [ruleActionMessage, setRuleActionMessage] = useState('');
  const [automationTab, setAutomationTab] = useState<'rules' | 'logs'>('rules');

  const toggleMenu = () => {
    setIsMenuCollapsed(prev => {
      const newVal = !prev;
      localStorage.setItem('layout_menu_collapsed', String(newVal));
      return newVal;
    });
  };

  const handleGroupClick = (sectionId: string) => {
    if (expandedSection === sectionId) {
      setExpandedSection(null);
    } else {
      setExpandedSection(sectionId);
    }
    
    // Set default tab for the section
    const group = computedNavigationGroups.find(g => g.id === sectionId);
    if (group && group.tabs.length > 0) {
      if (sectionId === 'teams') {
        // Redirection mapper to Projects/Reports without breaking types
        const firstTab = group.tabs[0];
        if (firstTab.id === 'team') {
          setActiveTab('projects');
          setActiveSubTab('team');
        } else {
          setActiveTab('reports');
          setActiveSubTab('team_reports');
        }
      } else if (sectionId === 'chat') {
        setActiveTab('chat');
        setActiveSubTab('messenger');
      } else {
        setActiveTab(sectionId);
        setActiveSubTab(group.tabs[0].id);
      }
    }
  };

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
    setIsMobileProfileOpen(false);
  };

  const isRtl = locale === 'fa';
  const unreadNotifsCount = (notifications || []).filter(n => n && !n.read).length;

  // Search filter
  const matchingProjects = (projects || []).filter(p => p && p.title && p.title.toLowerCase().includes((isMobileSearchOpen ? mobileSearchQuery : layoutSearchQuery).toLowerCase()));
  const matchingTasks = (tasks || []).filter(t => t && t.title && t.title.toLowerCase().includes((isMobileSearchOpen ? mobileSearchQuery : layoutSearchQuery).toLowerCase()));

  const handleSearchResultClick = (type: string, object: any) => {
    setLayoutSearchQuery('');
    setMobileSearchQuery('');
    setShowSearchResults(false);
    setIsMobileSearchOpen(false);
    
    if (type === 'project') {
      setSelectedProject(object as Project);
      setActiveTab('projects');
      setActiveSubTab('overview');
    } else if (type === 'task') {
      setActiveTab('tasks');
      setActiveSubTab('kanban_board');
    }
  };

  const renderIcon = (name: string, size = 15, className = "") => {
    const IconComp = iconByName(name, Sparkles);
    return <IconComp size={size} className={className} />;
  };

  const handleCreateRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleName.trim()) return;

    createAutomationRule({
      name: ruleName.trim(),
      description: `اتوماسیون خودکار هنگام رویداد ${ruleTrigger}`,
      trigger: ruleTrigger as any,
      thenAction: {
        type: ruleActionType as any,
        message: ruleActionMessage || 'عملیات اتوماسیون با موفقیت اجرا گردید'
      },
      isActive: true
    });

    setRuleName('');
    setRuleActionMessage('');
    // Trigger real background runner simulator
    if (runAutomationEngine) runAutomationEngine(ruleTrigger as any);
  };

  // Maps physical active tab to high level navigation group for styling
  const getMappedSectionGroup = () => {
    if (activeTab === 'projects' && activeSubTab === 'team') return 'teams';
    if (activeTab === 'reports' && activeSubTab === 'team_reports') return 'teams';
    return activeTab;
  };

  const isSubTabActiveHelper = (groupId: string, tabId: string) => {
    if (activeTab === groupId) {
      if (activeSubTab === tabId) return true;
      if (groupId === 'dept_tech' && tabId === 'analytics' && (!activeSubTab || activeSubTab === 'overview')) return true;
      if (tabId === 'overview' && (activeSubTab === 'all-projects' || activeSubTab === 'overview')) return true;
      if (tabId === 'tasks' && (activeSubTab === 'tasks-schedule' || activeSubTab === 'tasks')) return true;
      if (tabId === 'clients' && (activeSubTab === 'feedback' || activeSubTab === 'clients' || activeSubTab === 'portal')) return true;
      if (groupId === 'tasks' && (!activeSubTab || activeSubTab === 'tasks') && tabId === 'kanban_board') return true;
    }
    if (groupId === 'teams' && tabId === 'team' && activeTab === 'projects' && activeSubTab === 'team') return true;
    if (groupId === 'teams' && tabId === 'team_reports' && activeTab === 'reports' && activeSubTab === 'team_reports') return true;
    if (groupId === 'automation' && activeTab === 'automation' && activeSubTab === tabId) return true;
    return false;
  };

  const currentActiveGroup = getMappedSectionGroup();

  useEffect(() => {
    setExpandedSection(currentActiveGroup);
  }, [currentActiveGroup]);

  useEffect(() => {
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
    document.documentElement.lang = locale;
  }, [isRtl, locale]);

  useEffect(() => {
    if (isMobileProfileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileProfileOpen]);

  const getGroupColors = (groupId: string) => {
    if (groupId.startsWith('dept_')) {
      return {
        bgLight: 'bg-amber-100/80',
        bgDark: 'dark:bg-amber-950/30',
        textLight: 'text-amber-600',
        textDark: 'dark:text-amber-400',
        borderLight: 'border-amber-200/50',
        borderDark: 'dark:border-amber-900/30'
      };
    }
    switch (groupId) {
      case 'dashboard':
        return {
          bgLight: 'bg-blue-100/80',
          bgDark: 'dark:bg-blue-950/30',
          textLight: 'text-[#155DFC]',
          textDark: 'dark:text-blue-400',
          borderLight: 'border-blue-200/50',
          borderDark: 'dark:border-blue-900/30'
        };
      case 'dept_tech':
        return {
          bgLight: 'bg-blue-50',
          bgDark: 'dark:bg-blue-950/50',
          textLight: 'text-blue-700',
          textDark: 'dark:text-blue-300',
          borderLight: 'border-blue-200/50',
          borderDark: 'dark:border-blue-900/30'
        };
      case 'projects':
        return {
          bgLight: 'bg-blue-100/80',
          bgDark: 'dark:bg-blue-950/30',
          textLight: 'text-blue-600',
          textDark: 'dark:text-blue-400',
          borderLight: 'border-blue-200/50',
          borderDark: 'dark:border-blue-900/30'
        };
      case 'tasks':
        return {
          bgLight: 'bg-emerald-100/80',
          bgDark: 'dark:bg-emerald-950/30',
          textLight: 'text-emerald-600',
          textDark: 'dark:text-emerald-400',
          borderLight: 'border-emerald-200/50',
          borderDark: 'dark:border-emerald-900/30'
        };
      case 'teams':
        return {
          bgLight: 'bg-slate-100/80',
          bgDark: 'dark:bg-slate-800/30',
          textLight: 'text-slate-600',
          textDark: 'dark:text-slate-400',
          borderLight: 'border-slate-200/50',
          borderDark: 'dark:border-slate-800/30'
        };
      case 'chat':
        return {
          bgLight: 'bg-cyan-100/80',
          bgDark: 'dark:bg-cyan-950/30',
          textLight: 'text-cyan-600',
          textDark: 'dark:text-cyan-400',
          borderLight: 'border-cyan-200/50',
          borderDark: 'dark:border-cyan-900/30'
        };
      case 'org_builder':
        return {
          bgLight: 'bg-blue-100/80',
          bgDark: 'dark:bg-blue-950/30',
          textLight: 'text-blue-600',
          textDark: 'dark:text-blue-400',
          borderLight: 'border-blue-200/50',
          borderDark: 'dark:border-blue-900/30'
        };
      case 'approvals':
        return {
          bgLight: 'bg-rose-100/80',
          bgDark: 'dark:bg-rose-950/30',
          textLight: 'text-rose-600',
          textDark: 'dark:text-rose-400',
          borderLight: 'border-rose-200/50',
          borderDark: 'dark:border-rose-900/30'
        };
      case 'notifications':
        return {
          bgLight: 'bg-amber-100/80',
          bgDark: 'dark:bg-amber-950/30',
          textLight: 'text-amber-600',
          textDark: 'dark:text-amber-400',
          borderLight: 'border-amber-200/50',
          borderDark: 'dark:border-amber-900/30'
        };
      case 'settings':
      default:
        return {
          bgLight: 'bg-slate-100/80',
          bgDark: 'dark:bg-slate-800/40',
          textLight: 'text-slate-600',
          textDark: 'dark:text-slate-400',
          borderLight: 'border-slate-200/50',
          borderDark: 'dark:border-slate-700/30'
        };
    }
  };

  const getPrimaryItemStyles = (groupId: string, isActive: boolean) => {
    if (isActive) {
      return {
        rowClass: `bg-blue-50/80 dark:bg-[#161926] text-blue-600 dark:text-white font-bold rounded-2xl border border-blue-100 dark:border-[#222638] shadow-sm`,
        iconContainer: `w-10 h-10 rounded-xl bg-blue-100/60 dark:bg-[#1C2030] flex items-center justify-center text-blue-600 dark:text-slate-200 shrink-0 transition-all duration-300`,
        iconClass: `scale-105 font-bold transition-transform duration-300`
      };
    } else {
      return {
        rowClass: `text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-[#121522] hover:text-gray-900 dark:hover:text-slate-200 rounded-2xl transition-all border border-transparent`,
        iconContainer: `w-10 h-10 rounded-xl bg-gray-100 dark:bg-[#131522] flex items-center justify-center text-gray-500 dark:text-slate-400 shrink-0 transition-all duration-300`,
        iconClass: `scale-95 group-hover/l1:scale-100 transition-transform duration-300`
      };
    }
  };

  return (
    <div className="h-screen max-h-screen bg-bg-app text-text-primary flex flex-col antialiased relative overflow-hidden transition-colors duration-250">
      
      {/* Background Dot Matrix pattern */}
      <div className="dot-matrix pointer-events-none" />

      {/* GLOBAL WRAPPER: Left unified sidebar + Main workspace container */}
      <div className="flex-1 flex relative z-10 h-full max-h-full overflow-hidden lg:flex-row flex-col">
        
        {/* DESKTOP FLOATING SIDEBAR */}
        <aside 
          dir={isRtl ? 'rtl' : 'ltr'}
          className={`hidden lg:flex flex-col shrink-0 transition-all duration-300 ease-in-out ${
            isMenuCollapsed ? 'w-20' : 'w-72'
          } sticky top-6 h-[calc(100vh-48px)] min-h-[500px] my-6 ms-6 me-3 bg-white dark:bg-[#111322] border border-gray-200/70 dark:border-[#1E2235] rounded-[24px] shadow-2xl backdrop-blur-xl overflow-hidden z-20`}
        >
          
          {/* HEADER AREA */}
          <div className="pt-5 px-5 shrink-0 flex flex-col gap-2.5 text-start">
            {/* Title / Brand Block */}
            {!isMenuCollapsed ? (
              <div className="flex items-center gap-2.5 flex-row text-start">
                <div className="w-8 h-8 bg-gradient-to-tr from-[#155DFC] to-[#3B82F6] rounded-xl flex items-center justify-center text-white font-black text-xs shrink-0 shadow-[0_4px_12px_rgba(21,93,252,0.25)]">
                  TS
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-black text-slate-800 dark:text-white leading-tight truncate">TS Orbit</span>
                  <span className="text-[8.5px] text-slate-400 dark:text-slate-500 font-bold block mt-0.5 truncate">Business Operations Platform</span>
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

          {/* MODE TABS: PERSONAL vs BUSINESS */}
          {!isMenuCollapsed ? (
            <div className="px-5 py-2.5 shrink-0">
              <div className="bg-gray-100 dark:bg-[#121420] p-1 rounded-2xl border border-gray-200/50 dark:border-[#1A1D2B] flex items-center gap-1">
                <button
                  onClick={() => handleModeToggle('personal')}
                  className={`flex-1 text-center py-1.5 text-[9px] font-bold tracking-wider transition-all cursor-pointer ${
                    sidebarMode === 'personal'
                      ? 'bg-white dark:bg-[#1C1F2E] text-gray-900 dark:text-white font-bold shadow-md rounded-xl'
                      : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
                  }`}
                >
                  {isRtl ? 'شخصی' : 'PERSONAL'}
                </button>
                <button
                  onClick={() => handleModeToggle('business')}
                  className={`flex-1 text-center py-1.5 text-[9px] font-bold tracking-wider transition-all cursor-pointer ${
                    sidebarMode === 'business'
                      ? 'bg-white dark:bg-[#1C1F2E] text-gray-900 dark:text-white font-bold shadow-md rounded-xl'
                      : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
                  }`}
                >
                  {isRtl ? 'تجاری' : 'BUSINESS'}
                </button>
              </div>
            </div>
          ) : (
            <div className="py-2.5 shrink-0 flex justify-center">
              <button
                onClick={() => handleModeToggle(sidebarMode === 'personal' ? 'business' : 'personal')}
                className="w-8 h-8 rounded-xl bg-slate-100/70 dark:bg-white/[0.04] flex items-center justify-center text-slate-500 hover:text-[#155DFC] dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10 transition-all cursor-pointer"
                title={sidebarMode === 'personal' ? 'Switch to Business Mode' : 'Switch to Personal Mode'}
              >
                {sidebarMode === 'personal' ? (
                  <User size={13} className="text-[#155DFC]" />
                ) : (
                  <Briefcase size={13} className="text-[#27C93F]" />
                )}
              </button>
            </div>
          )}

          {/* GROUPED NAVIGATION LIST */}
          <SidebarScrollContainer>
            {(() => {
              if (sidebarMode === 'personal') {
                const personalNavItems = [
                  { id: 'my_dashboard', label: { fa: 'داشبورد من', en: 'My Dashboard' }, icon: 'LayoutDashboard' },
                  { id: 'my_projects', label: { fa: 'پروژه‌های من', en: 'My Projects' }, icon: 'FolderGit2' },
                  { id: 'my_tasks', label: { fa: 'وظایف من', en: 'My Tasks' }, icon: 'CheckSquare' },
                  { id: 'my_files', label: { fa: 'فایل‌های من', en: 'My Files' }, icon: 'Files' },
                  { id: 'activity-feed', label: { fa: 'فعالیت‌های من', en: 'My Activity' }, icon: 'Activity' },
                  { id: 'messages', label: { fa: 'پیام‌ها', en: 'Messages' }, icon: 'MessageSquare' },
                  { id: 'performance', label: { fa: 'عملکرد من', en: 'My Performance' }, icon: 'Award' },
                  { id: 'profile', label: { fa: 'پروفایل من', en: 'My Profile' }, icon: 'UserCheck' },
                ];

                return (
                  <div className="space-y-2">
                    {!isMenuCollapsed ? (
                      <div className="px-3.5 flex items-center gap-1.5 text-[9px] font-black tracking-wider uppercase text-slate-400 dark:text-slate-500 flex-row justify-start text-start">
                        <span>{isRtl ? 'فضای شخصی شما' : 'Personal Space'}</span>
                      </div>
                    ) : (
                      <div className="border-t border-slate-100 dark:border-white/[0.04] my-2.5 first:hidden" />
                    )}

                    <div className="space-y-1">
                      {personalNavItems.map((item) => {
                        const isItemActive = activeTab === 'personal_tasks' && 
                          (activeSubTab === item.id || 
                           (item.id === 'my_dashboard' && (!activeSubTab || activeSubTab === 'overview' || activeSubTab === 'my-dashboard')) ||
                           (item.id === 'my_projects' && activeSubTab === 'my-projects') ||
                           (item.id === 'my_tasks' && activeSubTab === 'my-tasks') ||
                           (item.id === 'messages' && activeSubTab === 'pv-messages') ||
                           (item.id === 'performance' && activeSubTab === 'performance-score') ||
                           (item.id === 'profile' && activeSubTab === 'resume-profile'));

                        const styles = getPrimaryItemStyles(item.id, isItemActive);

                        return (
                          <div
                            key={item.id}
                            className="relative"
                            onMouseEnter={() => { if (isMenuCollapsed) setHoveredGroupId(item.id); }}
                            onMouseLeave={() => { if (isMenuCollapsed) setHoveredGroupId(null); }}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setActiveTab('personal_tasks');
                                setActiveSubTab(item.id);
                              }}
                              className={`w-full group/l1 flex items-center transition-all duration-300 ease-in-out cursor-pointer text-start ${
                                isMenuCollapsed ? 'justify-center p-1.5' : 'justify-between px-3 py-2.5'
                              } rounded-[18px] ${styles.rowClass} flex-row`}
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-row">
                                <div className={styles.iconContainer}>
                                  {renderIcon(item.icon, 16, styles.iconClass)}
                                </div>
                                {!isMenuCollapsed && (
                                  <span className="text-[12px] font-semibold tracking-tight truncate">
                                    {isRtl ? item.label.fa : item.label.en}
                                  </span>
                                )}
                              </div>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              }

              // Business Mode Sections
              const filteredGroups = computedNavigationGroups;
              const sections = [
                {
                  key: 'workspace',
                  label: { fa: 'فضای کاری', en: 'Workspace' },
                  groups: filteredGroups.filter(g => g.id.startsWith('dept_') || ['dashboard', 'dept_tech'].includes(g.id))
                },
                {
                  key: 'projects_mgmt',
                  label: { fa: 'پروژه‌ها و وظایف', en: 'Projects & tasks' },
                  groups: filteredGroups.filter(g => ['projects', 'tasks'].includes(g.id))
                },
                {
                  key: 'collaboration',
                  label: { fa: 'همکاری تیمی', en: 'Team' },
                  groups: filteredGroups.filter(g => ['teams', 'chat'].includes(g.id))
                },
                {
                  key: 'administration',
                  label: { fa: 'مدیریت سیستم', en: 'Administration' },
                  groups: filteredGroups.filter(g => ['org_builder', 'approvals', 'notifications', 'settings'].includes(g.id))
                }
              ].filter(sec => sec.groups.length > 0);

              return sections.map(sec => (
                <div key={sec.key} className="space-y-2">
                  {/* Section Label */}
                  {!isMenuCollapsed ? (
                    <div className="px-3.5 flex items-center gap-1.5 text-[9px] font-black tracking-wider uppercase text-slate-400 dark:text-slate-500 flex-row justify-start text-start">
                      <span>{isRtl ? sec.label.fa : sec.label.en}</span>
                    </div>
                  ) : (
                    <div className="border-t border-slate-100 dark:border-white/[0.04] my-2.5 first:hidden" />
                  )}

                  {/* Level 1 Navigation Items */}
                  <div className="space-y-1">
                    {sec.groups.map(group => {
                      const isGroupActive = group.id === 'projects'
                        ? (activeTab === 'projects' && activeSubTab !== 'team')
                        : group.id === 'teams'
                        ? (activeTab === 'teams' || (activeTab === 'projects' && activeSubTab === 'team') || (activeTab === 'reports' && activeSubTab === 'team_reports'))
                        : group.id === 'reports'
                        ? (activeTab === 'reports' && activeSubTab !== 'team_reports')
                        : group.id === 'chat'
                        ? (activeTab === 'chat' || activeTab === 'messages')
                        : (activeTab === group.id || (group.id === 'automation' && activeTab === 'automation'));

                      const isExpanded = expandedSection === group.id;
                      const hasChildren = group.tabs.length > 1;

                      return (
                        <div 
                          key={group.id} 
                          className="relative"
                          onMouseEnter={() => { if (isMenuCollapsed) setHoveredGroupId(group.id); }}
                          onMouseLeave={() => { if (isMenuCollapsed) setHoveredGroupId(null); }}
                        >
                          {/* Level 1 Item Button */}
                          {(() => {
                            const styles = getPrimaryItemStyles(group.id, isGroupActive);
                            return (
                              <button
                                onClick={() => {
                                  if (hasChildren) {
                                    setExpandedSection(isExpanded ? null : group.id);
                                  } else {
                                    handleSubTabClick(group.id, group.tabs[0].id);
                                  }
                                }}
                                className={`w-full group/l1 flex items-center transition-all duration-300 ease-in-out cursor-pointer text-start ${
                                  isMenuCollapsed ? 'justify-center p-1.5' : 'justify-between px-3 py-2.5'
                                } rounded-[18px] ${styles.rowClass} flex-row`}
                              >
                                <div className="flex items-center gap-3 min-w-0 flex-row">
                                  <div className={styles.iconContainer}>
                                    {renderIcon(group.icon, 16, styles.iconClass)}
                                  </div>
                                  {!isMenuCollapsed && (
                                    <span className="text-[12px] font-semibold tracking-tight truncate">
                                      {isRtl ? group.label.fa : group.label.en}
                                    </span>
                                  )}
                                </div>

                                {/* Badges or Expand Arrow */}
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
                                    {false && (
                                      <span className="bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 text-[8px] font-extrabold px-1.5 py-0.5 rounded-md">
                                        NEW
                                      </span>
                                    )}
                                    {hasChildren && (
                                      <motion.div
                                        animate={{ rotate: isExpanded ? 180 : 0 }}
                                        transition={{ duration: 0.2 }}
                                        className="text-slate-400 dark:text-slate-500"
                                      >
                                        <ChevronDown size={12} />
                                      </motion.div>
                                    )}
                                  </div>
                                )}
                              </button>
                            );
                          })()}

                          {/* Level 2 Submenu (Expanded view) */}
                          {!isMenuCollapsed && hasChildren && (
                            <AnimatePresence initial={false}>
                              {isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.22, ease: 'easeInOut' }}
                                  className="overflow-hidden mt-1"
                                >
                                  <div className="bg-slate-50/50 dark:bg-[#0B0D17]/80 border border-slate-200/30 dark:border-[#1A1D2B] rounded-[16px] shadow-inner my-1 mx-1">
                                    <SubmenuScrollContainer>
                                      {group.tabs.map(tab => {
                                        const isTabActive = isSubTabActiveHelper(group.id, tab.id);

                                        return (
                                          <button
                                            key={tab.id}
                                            onClick={() => handleSubTabClick(group.id, tab.id)}
                                            className={`w-full group/l2 flex items-center justify-between px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer text-start border flex-row ${
                                              isTabActive
                                                ? 'bg-slate-100/90 dark:bg-[#161926] text-[#155DFC] dark:text-white font-semibold border-slate-200/40 dark:border-[#222638] shadow-xs'
                                                : 'text-slate-500 hover:bg-slate-100/50 dark:hover:bg-[#121522] hover:text-slate-800 dark:hover:text-slate-200 border-transparent'
                                            }`}
                                          >
                                            <div className="flex items-center gap-2.5 min-w-0 flex-row">
                                              <div className="shrink-0 transition-transform duration-150 group-hover/l2:scale-105">
                                                {renderIcon(tab.icon, 12, isTabActive ? 'text-[#155DFC] dark:text-blue-400 font-bold' : 'text-slate-400 dark:text-slate-500')}
                                              </div>
                                              <span className="text-[11px] font-medium leading-none truncate">
                                                {isRtl ? tab.name.fa : tab.name.en}
                                              </span>
                                            </div>

                                            {/* Colored status dot highlights inside submenus */}
                                            {tab.id === 'overview' && group.id === 'projects' && (
                                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_6px_rgba(37,99,235,0.5)]" />
                                            )}
                                            {tab.id === 'active_projects' && (
                                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
                                            )}
                                          </button>
                                        );
                                      })}
                                    </SubmenuScrollContainer>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          )}

                          {/* Hover Popover (Collapsed view) */}
                          <AnimatePresence>
                            {isMenuCollapsed && hoveredGroupId === group.id && (
                              <motion.div
                                initial={{ opacity: 0, x: -15, scale: 0.95 }}
                                animate={{ opacity: 1, x: 0, scale: 1 }}
                                exit={{ opacity: 0, x: -15, scale: 0.95 }}
                                transition={{ duration: 0.15 }}
                                className="absolute z-50 end-[68px] top-0 w-60 bg-white/95 dark:bg-[#121522]/95 backdrop-blur-xl border border-slate-200/80 dark:border-[#1A1D2B] rounded-[20px] shadow-2xl p-2 space-y-1"
                              >
                                {/* Popover Header */}
                                <div className="px-3.5 py-2.5 border-b border-slate-100 dark:border-white/[0.04] mb-1 text-start">
                                  <h4 className="text-[11.5px] font-extrabold text-slate-800 dark:text-white">
                                    {isRtl ? group.label.fa : group.label.en}
                                  </h4>
                                </div>

                                {/* Popover Sub-items */}
                                <div className="space-y-0.5">
                                  {group.tabs.map(tab => {
                                    const isTabActive = isSubTabActiveHelper(group.id, tab.id);

                                    return (
                                      <button
                                        key={tab.id}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleSubTabClick(group.id, tab.id);
                                          setHoveredGroupId(null);
                                        }}
                                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer text-start border flex-row ${
                                          isTabActive
                                            ? 'bg-slate-100/90 dark:bg-white/[0.05] text-[#155DFC] dark:text-blue-400 font-semibold border-slate-200/40 dark:border-white/[0.04] shadow-[0_1px_3px_rgba(0,0,0,0.01)]'
                                            : 'text-slate-500 hover:bg-slate-100/50 dark:hover:bg-white/[0.01] hover:text-slate-800 dark:hover:text-slate-200 border-transparent'
                                        }`}
                                      >
                                        <div className="flex items-center gap-2.5 min-w-0 flex-row">
                                          {renderIcon(tab.icon, 12, isTabActive ? 'text-[#155DFC] dark:text-blue-400 font-bold' : 'text-slate-400 dark:text-slate-500')}
                                          <span className="text-[11px] font-medium leading-none truncate">
                                            {isRtl ? tab.name.fa : tab.name.en}
                                          </span>
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ));
            })()}
          </SidebarScrollContainer>

          {/* DUAL-STATE BOTTOM PROFILE CARD */}
          <div className="shrink-0 p-3 mt-auto border-t border-slate-100 dark:border-[#1A1D2B] bg-slate-50/50 dark:bg-[#0B0D17]/60">
            {!isMenuCollapsed ? (
              <div 
                onClick={() => {
                  setSidebarMode('personal');
                  setActiveTab('personal_tasks');
                  setActiveSubTab('profile');
                }}
                className={cn(
                  "p-3 rounded-2xl border transition-all duration-200 flex items-center justify-between group cursor-pointer select-none",
                  ((activeTab === 'personal_tasks' && (activeSubTab === 'profile' || activeSubTab === 'resume-profile')) || activeTab === 'profile')
                    ? "bg-blue-50/60 dark:bg-blue-950/30 border-blue-500/50 dark:border-blue-500/40 shadow-sm"
                    : "bg-white dark:bg-[#0d121f] border-slate-200/90 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-[#131b2e] hover:border-slate-300 dark:hover:border-slate-700"
                )}
              >
                {/* Right: User Avatar & Info */}
                <div className="flex items-center gap-2.5">
                  <div className="relative">
                    <LocalImage
                      src={currentUser?.avatar || "/avatars/avatar-4.svg"}
                      alt={currentUser?.name || "User"}
                      className="w-10 h-10 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 group-hover:scale-105 transition-transform"
                    />
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 absolute -bottom-0.5 -start-0.5 border-2 border-white dark:border-[#0d121f]" />
                  </div>

                  <div className="text-start">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {currentUser?.name || ''}
                    </h4>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium block">
                      {getRoleLabel(currentUser?.role)}
                    </span>
                  </div>
                </div>

                {/* Left: Logout Action (Isolated with stopPropagation) */}
                <button
                  type="button"
                  title="خروج از حساب"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsLogoutModalOpen(true);
                  }}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4 rtl:rotate-180"/>
                </button>
              </div>
            ) : (
              <div className="py-2 flex flex-col items-center gap-2.5">
                {/* Collapsed view triggers quick profile view */}
                <div 
                  onClick={() => {
                    setSidebarMode('personal');
                    setActiveTab('personal_tasks');
                    setActiveSubTab('profile');
                  }}
                  className={cn(
                    "relative cursor-pointer group p-1 rounded-xl transition-all",
                    ((activeTab === 'personal_tasks' && (activeSubTab === 'profile' || activeSubTab === 'resume-profile')) || activeTab === 'profile')
                      ? "ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-950/40"
                      : "hover:bg-slate-100 dark:hover:bg-slate-800"
                  )}
                  title={currentUser?.name || 'User'}
                >
                  <LocalImage
                    src={currentUser?.avatar || "/avatars/avatar-4.svg"}
                    alt={currentUser?.name || "User"}
                    className="w-10 h-10 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 group-hover:scale-105 transition-transform"
                  />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 absolute -bottom-0.5 -start-0.5 border-2 border-white dark:border-[#0d121f]" />
                </div>

                {/* Logout in collapsed view */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsLogoutModalOpen(true);
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-all cursor-pointer"
                  title={isRtl ? 'خروج' : 'Logout'}
                >
                  <LogOut className="w-4 h-4 rtl:rotate-180" />
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* MAIN App Container with top modern bar */}
        <div className="flex-1 flex flex-col overflow-hidden h-full max-h-full lg:h-[calc(100vh-48px)] lg:my-6">
          
          {/* TOP HEADBAR */}
          <header className="h-16 mt-4 mb-2 mx-4 md:mx-6 rounded-2xl bg-white/80 dark:bg-[#111322] backdrop-blur-xl border border-gray-200/70 dark:border-[#1E2235] px-4 md:px-6 flex items-center justify-between shrink-0 z-20 shadow-sm md:shadow-[0_8px_32px_rgba(0,0,0,0.03)] md:mt-4 md:mb-2 lg:mt-0">
            
            <div className="flex items-center gap-2.5">
              {/* Menu Button for Desktop */}
              <button
                onClick={toggleMenu}
                className="p-1.5 rounded-xl text-text-secondary hover:bg-hover-overlay transition-all cursor-pointer shrink-0 hidden lg:flex"
                title={isMenuCollapsed ? (isRtl ? 'باز کردن منو' : 'Expand sidebar') : (isRtl ? 'جمع کردن منو' : 'Collapse sidebar')}
                aria-label={isMenuCollapsed ? (isRtl ? 'باز کردن منو' : 'Expand sidebar') : (isRtl ? 'جمع کردن منو' : 'Collapse sidebar')}
              >
                <Menu size={15} />
              </button>

              {/* Profile Identity Badge */}
              <div 
                onClick={() => {
                  setActiveTab('settings');
                  setActiveSubTab('profile');
                }}
                className={`flex items-center gap-1.5 p-1 ps-2.5 pe-1.5 bg-bg-app/50 dark:bg-slate-900/40 border border-border-primary/50 dark:border-white/5 rounded-xl cursor-pointer active:scale-95 hover:bg-hover-overlay transition-all shrink-0 select-none lg:hidden ${
                  isRtl ? 'flex-row-reverse' : 'flex-row'
                }`}
              >
                <div className={`min-w-0 ${isRtl ? 'text-start' : 'text-left'}`}>
                  <h4 className="text-[9px] font-black text-text-primary dark:text-white truncate max-w-[70px] leading-tight">{currentUser?.name || 'User'}</h4>
                  <span className="text-[7.5px] text-[#155DFC] font-black block mt-0.5 leading-none">
                    {getRoleLabel(currentUser?.role)}
                  </span>
                </div>
                <div className="w-7 h-7 rounded-lg bg-[#155DFC] text-white flex items-center justify-center font-black text-[11px] overflow-hidden shrink-0 border border-[#155DFC]/25 shadow-sm">
                  {currentUser?.avatar ? (
                    <LocalImage src={currentUser.avatar} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="font-bold">{currentUser?.name ? Array.from(currentUser.name.trim())[0] : ''}</span>
                  )}
                </div>
              </div>

              {/* Live Search Input box */}
              <div ref={searchContainerRef} className="hidden md:block relative w-56 lg:w-72">
                <Search className={`absolute top-3 text-text-secondary ${isRtl ? 'start-3.5' : 'end-3.5'}`} size={12} />
                <input 
                  type="text" 
                  placeholder={t('search_placeholder')}
                  value={layoutSearchQuery}
                  onChange={(e) => {
                    setLayoutSearchQuery(e.target.value);
                    setShowSearchResults(e.target.value.trim().length > 0);
                  }}
                  onFocus={() => { if(layoutSearchQuery) setShowSearchResults(true); }}
                  onBlur={() => setTimeout(() => setShowSearchResults(false), 200)}
                  className={`w-full bg-bg-app border border-border-primary text-xs text-text-primary py-2.5 rounded-full focus:outline-none focus:border-brand-accent focus:bg-surface-primary transition-all ${
                    isRtl ? 'ps-10 pe-4 text-start' : 'pe-10 ps-4 text-left'
                  }`}
                />

                {/* Search popover */}
                {showSearchResults && (
                  <div className={`absolute top-12 bg-surface-primary border border-border-strong w-80 rounded-2xl shadow-2xl p-4 space-y-3 max-h-72 overflow-y-auto z-50 text-start ${
                    isRtl ? 'start-0' : 'end-0'
                  }`}>
                    <h4 className="text-[10px] font-black text-[#155DFC] border-b border-border-primary/40 pb-1.5">{t('search_live_results')}</h4>
                    
                    {matchingProjects.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[9px] text-text-secondary font-black block">{t('projects')}</span>
                        {matchingProjects.slice(0, 3).map(p => (
                          <div 
                            key={p.id} 
                            onMouseDown={() => handleSearchResultClick('project', p)}
                            className="p-2 bg-bg-app hover:bg-brand-accent/15 rounded-xl text-xs text-text-primary cursor-pointer transition-all truncate"
                          >
                            📂 {p.title}
                          </div>
                        ))}
                      </div>
                    )}

                    {matchingTasks.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[9px] text-text-secondary font-black block">{t('tasks')}</span>
                        {matchingTasks.slice(0, 3).map(t => (
                          <div 
                            key={t.id} 
                            onMouseDown={() => handleSearchResultClick('task', t)}
                            className="p-2 bg-bg-app hover:bg-brand-accent/15 rounded-xl text-xs text-text-primary cursor-pointer transition-all truncate"
                          >
                            ✔️ {t.title}
                          </div>
                        ))}
                      </div>
                    )}

                    {matchingProjects.length === 0 && matchingTasks.length === 0 && (
                      <p className="text-[10px] text-text-secondary text-center py-3">{t('search_no_results')}</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right side status utility buttons bar */}
            <div className="flex items-center gap-2 md:gap-2.5 shrink-0">
              {/* 1. Notification Popover Icon */}
              <div ref={notificationDropdownRef} className="relative shrink-0">
                <button
                  onClick={() => setShowNotificationDropdown(!showNotificationDropdown)}
                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700/80 border border-slate-200/80 dark:border-slate-700/80 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-white transition-all relative cursor-pointer shadow-sm active:scale-95"
                  title={isRtl ? 'اعلان‌ها' : 'Notifications'}
                >
                  <Bell size={16} />
                  {unreadNotifsCount > 0 && (
                    <span className="absolute top-2 start-2 w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                  )}
                </button>

                {showNotificationDropdown && (
                  <div className={`absolute top-12 z-50 bg-white dark:bg-[#121526] border border-slate-200 dark:border-[#22273e] w-72 rounded-2xl p-4 shadow-2xl space-y-3 ${
                    isRtl ? 'end-0 text-start' : 'start-0 text-left'
                  }`} style={{ minWidth: '280px' }}>
                    <div className="flex justify-between items-center border-b border-slate-100 dark:border-[#1e2338] pb-2">
                      <span className="font-extrabold text-[11px] text-slate-800 dark:text-white block">{t('notification_center')}</span>
                      <span className="text-[9px] bg-brand-accent text-white font-black px-2 py-0.5 rounded-full font-mono">
                        {unreadNotifsCount}
                      </span>
                    </div>

                    <div className="space-y-1.5 max-h-56 overflow-y-auto scrollbar-thin">
                      {notifications.length === 0 ? (
                        <p className="text-[10px] text-slate-400 text-center py-4">{t('no_notifications')}</p>
                      ) : (
                        notifications.slice(0, 5).map(n => (
                          <div 
                            key={n.id} 
                            onClick={() => {
                              void markNotificationAsRead(n.id).catch(()=>{});
                              setShowNotificationDropdown(false);
                              setActiveTab('notifications');
                              setActiveSubTab('all_notifications');
                            }}
                            className={`p-2.5 border rounded-xl text-[10px] transition-all cursor-pointer ${
                              n.read 
                                ? 'bg-slate-50 dark:bg-[#16192d] border-slate-200/60 dark:border-[#1f243d] text-slate-500' 
                                : 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-200/60 dark:border-blue-900 text-slate-800 dark:text-white font-bold'
                            }`}
                          >
                            <p className="font-black line-clamp-1">{n.title}</p>
                            <p className="text-[9px] text-slate-400 mt-0.5 truncate font-normal">{n.description}</p>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-100 dark:border-[#1e2338] space-y-1.5">
                      <div className="flex gap-2">
                        <button 
                          onClick={() => {
                            markAllNotificationsAsRead();
                            setShowNotificationDropdown(false);
                          }}
                          disabled={unreadNotifsCount === 0}
                          className="flex-1 text-center text-[10px] text-white bg-[#155DFC] hover:bg-[#0E50D6] disabled:opacity-40 py-1.5 rounded-xl font-bold transition-all cursor-pointer"
                        >
                          {t('mark_all_read')}
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setShowNotificationDropdown(false);
                          setActiveTab('notifications');
                          setActiveSubTab('all_notifications');
                        }}
                        className="w-full text-center text-[10px] font-black text-[#155DFC] dark:text-blue-400 hover:bg-[#155DFC]/10 py-1.5 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1"
                      >
                        <span>{isRtl ? 'مشاهده همه اعلان‌ها' : 'View All Notifications'}</span>
                        <ArrowLeft size={12} />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Dedicated Unread Messages Popover Icon */}
              <div ref={messagesDropdownRef} className="relative shrink-0">
                <button
                  onClick={() => {
                    setShowMessagesDropdown(!showMessagesDropdown);
                    setShowNotificationDropdown(false);
                  }}
                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700/80 border border-slate-200/80 dark:border-slate-700/80 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-white transition-all relative cursor-pointer shadow-sm active:scale-95"
                  title={isRtl ? 'پیام‌های خوانده‌نشده' : 'Unread messages'}
                >
                  <MessageSquare size={16} />
                  {(unreadMessages || []).filter(m => m && !m.read).length > 0 && (
                    <span className="absolute -top-1 -start-1 min-w-[16px] h-4 px-1 rounded-full bg-blue-600 text-white text-[9px] font-black flex items-center justify-center animate-pulse">
                      {(unreadMessages || []).filter(m => m && !m.read).length}
                    </span>
                  )}
                </button>

                {showMessagesDropdown && (
                  <div className={`absolute top-12 z-50 bg-white dark:bg-[#121526] border border-slate-200 dark:border-[#22273e] w-80 rounded-2xl p-4 shadow-2xl space-y-3 ${
                    isRtl ? 'end-0 text-start' : 'start-0 text-left'
                  }`} style={{ minWidth: '300px' }}>
                    <div className="flex justify-between items-center border-b border-slate-100 dark:border-[#1e2338] pb-2">
                      <span className="font-extrabold text-[11px] text-slate-800 dark:text-white block flex items-center gap-1.5">
                        <MessageSquare size={13} className="text-blue-500" />
                        <span>{isRtl ? 'پیام‌های خوانده‌نشده' : 'Unread messages'}</span>
                      </span>
                      <span className="text-[9px] bg-blue-600 text-white font-black px-2 py-0.5 rounded-full font-mono">
                        {(unreadMessages || []).filter(m => m && !m.read).length}
                      </span>
                    </div>

                    <div className="space-y-2 max-h-60 overflow-y-auto scrollbar-thin">
                      {unreadMessages.length === 0 ? (
                        <p className="text-[10px] text-slate-400 text-center py-4">{isRtl ? 'پیام جدیدی وجود ندارد' : 'No new messages'}</p>
                      ) : (
                        unreadMessages.map(m => (
                          <div
                            key={m.id}
                            onClick={() => {
                              setShowMessagesDropdown(false);
                              setActiveTab('personal_tasks');
                              setActiveSubTab('pv-messages');
                              setActiveConversation(m.conversation);
                            }}
                            className={`p-2.5 border rounded-xl text-[10px] transition-all cursor-pointer flex items-start gap-2.5 ${
                              m.read
                                ? 'bg-slate-50 dark:bg-[#16192d] border-slate-200/60 dark:border-[#1f243d] text-slate-500'
                                : 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-200/60 dark:border-blue-900 text-slate-800 dark:text-white font-bold'
                            }`}
                          >
                            <LocalImage src={m.avatar} alt={m.sender} className="w-8 h-8 rounded-full object-cover shrink-0 ring-2 ring-blue-500/20" />
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-center">
                                <span className="font-black text-xs text-slate-800 dark:text-white truncate">{m.sender}</span>
                                <span className="text-[9px] text-slate-400 font-mono">{m.time}</span>
                              </div>
                              <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-2 leading-relaxed font-normal">{m.snippet}</p>
                              <div className="mt-1.5 flex justify-end">
                                <span className="text-[9px] font-extrabold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
                                  <span>{isRtl ? 'مشاهده و پاسخ' : 'View & Reply'}</span>
                                  <ArrowLeft size={10} />
                                </span>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-100 dark:border-[#1e2338] flex gap-2">
                      <button
                        onClick={() => {
                          void Promise.all(unreadMessages.map(message=>markConversationRead(message.id))).catch(()=>{});
                        }}
                        disabled={(unreadMessages || []).filter(m => m && !m.read).length === 0}
                        className="flex-1 text-center text-[10px] text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 py-1.5 rounded-xl font-bold transition-all cursor-pointer"
                      >
                        {isRtl ? 'علامت‌گذاری همه به عنوان خوانده‌شده' : 'Mark all as read'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Mobile search button */}
              <button
                onClick={() => setIsMobileSearchOpen(true)}
                className="md:hidden w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700/80 border border-slate-200/80 dark:border-slate-700/80 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-white transition-all cursor-pointer shadow-sm active:scale-95 shrink-0"
                title={isRtl ? 'جستجو در کارگاه' : 'Search'}
              >
                <Search size={16} />
              </button>

              {/* 3. Theme Switcher (Light / Dark Mode) */}
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-700/80 border border-slate-200/80 dark:border-slate-700/80 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-white transition-all cursor-pointer shadow-sm active:scale-95 shrink-0"
                title={isRtl ? 'تغییر تم رنگی' : 'Toggle Theme'}
              >
                {theme === 'dark' ? (
                  <Sun size={16} className="text-amber-400" />
                ) : (
                  <Moon size={16} className="text-slate-600 dark:text-slate-300" />
                )}
              </button>

              {/* 4. Matched Workspace Switcher Trigger Button */}
              <div className="shrink-0">
                <WorkspaceSwitcher isRtl={isRtl} />
              </div>
            </div>

          </header>

          {/* MAIN Workspace router area */}
          <main className="flex-1 overflow-hidden relative bg-bg-app flex flex-col min-h-0">
            <div
              ref={mainScrollRef}
              id="main-scroll-viewport"
              className="w-full h-full relative overflow-y-auto overflow-x-hidden flex-1 flex flex-col min-h-0 px-4 md:px-6 pb-6 md:pb-8 pt-2 md:pt-4"
            >
              {/* SUB HEADER - Secondary pills list (Only appears when entering specific multi-tab sections except projects and tasks) */}
            {computedNavigationGroups.map(group => {
              const isGroupActive = currentActiveGroup === group.id;
              if (!isGroupActive || group.tabs.length <= 1 || group.id === 'projects' || group.id === 'tasks' || group.id === 'dept_tech') return null;

              return (
                <div key={group.id} className="flex items-center gap-1.5 overflow-x-auto pb-3 mb-4 border-b border-border-primary/50 scrollbar-none animate-fade-in shrink-0">
                  {group.tabs.map(tab => {
                    // Correct active check supporting redirect tabs
                    const isTabActive = isSubTabActiveHelper(group.id, tab.id);

                    return (
                      <button
                        key={tab.id}
                        onClick={() => handleSubTabClick(group.id, tab.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                          isTabActive
                            ? 'bg-brand-accent text-white shadow-lg shadow-[#155DFC]/15'
                            : 'bg-surface-primary text-text-secondary hover:text-text-primary border border-border-primary'
                        }`}
                      >
                        {renderIcon(tab.icon, 12)}
                        <span>{isRtl ? tab.name.fa : tab.name.en}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })}

            {/* SCOPED PAGE CONTENT LOADING BOUNDARY WITH STRANDS */}
            <PageLoadingBoundary
              isLoading={isNavigating || isPageLoading}
              message={pageMessage}
              variant="workspace"
            >
              {/* Standalone Chat view */}
              <AnimatePresence mode="wait">
                {activeTab === 'chat' || activeTab === 'messages' ? (
                  <motion.div
                    key="chat-portal"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="space-y-6 text-start"
                    style={{ direction: isRtl ? 'rtl' : 'ltr' }}
                  >
                    <Suspense fallback={<StrandsLoader variant="workspace" />}>
                      <MessagesView />
                    </Suspense>
                  </motion.div>
                ) : (
                  /* Dynamic rendering of other views */
                  <motion.div
                    key={`${activeTab}-${activeSubTab}`}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className="h-full"
                  >
                    <Suspense fallback={<StrandsLoader variant="workspace" />}>
                    {activeTab === 'dashboard' && children}
                    {activeTab === 'dept_tech' && <DepartmentTechnicalView />}
                    {activeTab === 'projects' && <ProjectsView />}
                    {activeTab === 'tasks' && <TasksGlobalView />}
                    {activeTab === 'personal_tasks' && <PersonalTasksView />}
                    {activeTab === 'profile' && <ProfileView />}
                    {activeTab === 'reports' && <ReportsGlobalView />}
                    {activeTab === 'notifications' && <NotificationsView />}
                    {activeTab === 'settings' && <SystemSettingsView />}
                    {activeTab === 'approvals' && <ApprovalCenter />}
                    
                    {/* Phase 6 - Dynamic Org & Modules Routing */}
                    {activeTab === 'org_builder' && activeSubTab === 'org_builder_main' && <OrgBuilder />}
                    {activeTab === 'org_builder' && activeSubTab === 'org_permissions' && <OrgPermissions />}

                    {activeTab.startsWith('dept_') && activeSubTab.startsWith('mod_inst_') && (
                      <DynamicModuleView 
                        instanceId={activeSubTab.replace('mod_inst_', '')} 
                        deptId={activeTab.replace('dept_', '')} 
                      />
                    )}

                    {activeTab.startsWith('dept_') && activeSubTab.startsWith('team_tab_') && (
                      <TeamDashboardView 
                        teamId={activeSubTab.replace('team_tab_', '')} 
                        deptId={activeTab.replace('dept_', '')} 
                      />
                    )}

                    {activeTab.startsWith('dept_') && activeSubTab.startsWith('dept_reports_') && (
                      <DepartmentReportsView
                        deptId={activeTab.replace('dept_', '')}
                      />
                    )}
                    </Suspense>
                  </motion.div>
                )}
              </AnimatePresence>
            </PageLoadingBoundary>
            </div>

            {/* Dynamic Bottom Scroll Cue Shadow (Minimalist Native Indicator) */}
            <div
              id="bottom-scroll-cue-shadow"
              aria-hidden="true"
              className={`pointer-events-none absolute bottom-0 end-0 start-0 h-10 sm:h-12 z-20 bg-gradient-to-t from-slate-900/10 via-slate-900/5 to-transparent dark:from-black/50 dark:via-black/20 dark:to-transparent transition-opacity duration-300 ${
                showBottomScrollCue ? 'opacity-100' : 'opacity-0'
              }`}
              style={{ pointerEvents: 'none' }}
            />
          </main>
        </div>

      </div>

      {/* INTERACTIVE FLOATING BOTTOM-DOCKED SHEET (TRANSPARENT CLICK-OUTSIDE BACKDROP) */}
      <AnimatePresence>
        {isMobileProfileOpen && (
          <>
            {/* Transparent click-outside dismissal backdrop overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileProfileOpen(false)}
              className="fixed inset-0 z-[80] bg-transparent cursor-default"
            />

            <motion.div
              initial={{ y: 15, opacity: 0, scale: 0.96 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 15, opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="fixed bottom-[calc(var(--bottom-nav-height,72px)+16px)] start-4 end-4 sm:end-auto sm:start-6 sm:w-96 max-h-[65dvh] bg-white dark:bg-[#131b2e] border border-slate-200/90 dark:border-[#232f48] rounded-2xl shadow-2xl p-5 flex flex-col overflow-hidden z-[90]"
              style={{ direction: isRtl ? 'rtl' : 'ltr' }}
            >
              {(() => {
                const filteredGroups = sidebarMode === 'personal'
                  ? computedNavigationGroups.filter(g => ['dashboard', 'tasks', 'settings'].includes(g.id))
                  : computedNavigationGroups;

                const sections = [
                  {
                    key: 'workspace',
                    label: { fa: 'فضای کاری', en: 'Workspace' },
                    groups: filteredGroups.filter(g => g.id.startsWith('dept_') || ['dashboard', 'projects', 'tasks'].includes(g.id))
                  },
                  {
                    key: 'collaboration',
                    label: { fa: 'همکاری تیمی', en: 'Collaboration' },
                    groups: filteredGroups.filter(g => ['chat', 'teams'].includes(g.id))
                  },
                  {
                    key: 'administration',
                    label: { fa: 'مدیریت سیستم', en: 'Administration' },
                    groups: filteredGroups.filter(g => ['org_builder', 'approvals', 'settings'].includes(g.id))
                  }
                ].filter(sec => sec.groups.length > 0);

                return (
                  <div className="flex flex-col h-full w-full min-h-0">
                    {/* Floating Sheet Brand Header */}
                    <div className="shrink-0 pb-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-2.5 flex-row text-start">
                        <div className="w-8 h-8 bg-gradient-to-tr from-[#155DFC] to-[#3B82F6] rounded-xl flex items-center justify-center text-white font-black text-xs shrink-0 shadow-[0_4px_12px_rgba(21,93,252,0.25)]">
                          TS
                        </div>
                        <div className="flex flex-col min-w-0 text-start">
                          <span className="text-xs font-black text-slate-800 dark:text-white leading-tight truncate">TS Orbit</span>
                          <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold block mt-0.5 truncate">
                            {isRtl ? 'پلتفرم عملیات کسب‌وکار' : 'Business Operations Platform'}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => setIsMobileProfileOpen(false)}
                        className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-pointer transition-all shrink-0"
                      >
                        <X size={16} className="stroke-[2.5]" />
                      </button>
                    </div>

                    {/* Scrollable Container */}
                    <div className="flex-1 overflow-y-auto overscroll-contain touch-pan-y space-y-4 my-2 ps-1" style={{ WebkitOverflowScrolling: 'touch' }}>
                      {/* Personal vs Business mode switch */}
                      <div className="mt-4 mb-2">
                        <div className="bg-gray-100 dark:bg-[#121420] p-1 rounded-2xl border border-gray-200/50 dark:border-[#1A1D2B] flex items-center gap-1">
                          <button
                            onClick={() => handleModeToggle('personal')}
                            className={`flex-1 text-center py-2 text-[10px] font-bold tracking-wider transition-all cursor-pointer ${
                              sidebarMode === 'personal'
                                ? 'bg-white dark:bg-[#1C1F2E] text-gray-900 dark:text-white font-bold shadow-md rounded-xl'
                                : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
                            }`}
                          >
                            {isRtl ? 'شخصی' : 'PERSONAL'}
                          </button>
                          <button
                            onClick={() => handleModeToggle('business')}
                            className={`flex-1 text-center py-2 text-[10px] font-bold tracking-wider transition-all cursor-pointer ${
                              sidebarMode === 'business'
                                ? 'bg-white dark:bg-[#1C1F2E] text-gray-900 dark:text-white font-bold shadow-md rounded-xl'
                                : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200'
                            }`}
                          >
                            {isRtl ? 'تجاری' : 'BUSINESS'}
                          </button>
                        </div>
                      </div>

                    {/* Navigation Items */}
                    <div className="space-y-4">
                      {sidebarMode === 'personal' ? (
                        <div className="space-y-1">
                          <div className="px-2 flex items-center gap-1.5 text-[9px] font-black tracking-wider uppercase text-slate-400 dark:text-slate-500 flex-row">
                            <span>{isRtl ? 'فضای شخصی شما' : 'Personal Space'}</span>
                          </div>
                          <div className="space-y-1">
                            {[
                              { id: 'my-dashboard', label: { fa: 'داشبورد من', en: 'My Dashboard' }, icon: 'LayoutDashboard' },
                              { id: 'my-projects', label: { fa: 'پروژه‌های من', en: 'My Projects' }, icon: 'FolderKanban' },
                              { id: 'my-tasks', label: { fa: 'وظایف من', en: 'My Tasks' }, icon: 'CheckSquare' },
                              { id: 'today-planner', label: { fa: 'امروز', en: 'Today' }, icon: 'Sun' },
                              { id: 'my-collaborations', label: { fa: 'مشارکت‌های من', en: 'My Collaborations' }, icon: 'Users' },
                              { id: 'work-calendar', label: { fa: 'تقویم کاری', en: 'Work Calendar' }, icon: 'Calendar' },
                              { id: 'activity-feed', label: { fa: 'فعالیت‌ها', en: 'Activity Feed' }, icon: 'Activity' },
                              { id: 'my-files', label: { fa: 'فایل‌های من', en: 'My Files' }, icon: 'Files' },
                              { id: 'pv-messages', label: { fa: 'پیام‌ها', en: 'Messages' }, icon: 'MessageSquare' },
                              { id: 'performance-score', label: { fa: 'عملکرد من', en: 'My Performance' }, icon: 'Award' },
                              { id: 'resume-profile', label: { fa: 'پروفایل من', en: 'My Profile' }, icon: 'UserCheck' },
                              { id: 'personal-settings', label: { fa: 'تنظیمات شخصی', en: 'Personal Settings' }, icon: 'Sliders' },
                            ].map((item) => {
                              const isItemActive = activeTab === 'personal_tasks' && 
                                (activeSubTab === item.id || (item.id === 'my-dashboard' && (!activeSubTab || activeSubTab === 'overview')));
                              const styles = getPrimaryItemStyles(item.id, isItemActive);

                              return (
                                <button
                                  key={item.id}
                                  onClick={() => {
                                    setIsMobileProfileOpen(false);
                                    setActiveTab('personal_tasks');
                                    setActiveSubTab(item.id);
                                  }}
                                  className={`w-full group/l1 flex items-center justify-between px-3 py-2.5 min-h-[42px] rounded-xl transition-all duration-200 cursor-pointer text-start ${styles.rowClass} flex-row`}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0 flex-row">
                                    <div className={styles.iconContainer}>
                                      {renderIcon(item.icon, 15, styles.iconClass)}
                                    </div>
                                    <span className="text-[11.5px] font-semibold tracking-tight truncate">
                                      {isRtl ? item.label.fa : item.label.en}
                                    </span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        sections.map(sec => (
                          <div key={sec.key} className="space-y-1.5">
                          <div className="px-2 flex items-center gap-1.5 text-[9px] font-black tracking-wider uppercase text-slate-400 dark:text-slate-500 flex-row">
                            <span>{isRtl ? sec.label.fa : sec.label.en}</span>
                          </div>

                          <div className="space-y-1">
                            {sec.groups.map(group => {
                              const isGroupActive = group.id === 'projects'
                                ? (activeTab === 'projects' && activeSubTab !== 'team')
                                : group.id === 'teams'
                                ? (activeTab === 'teams' || (activeTab === 'projects' && activeSubTab === 'team') || (activeTab === 'reports' && activeSubTab === 'team_reports'))
                                : group.id === 'reports'
                                ? (activeTab === 'reports' && activeSubTab !== 'team_reports')
                                : group.id === 'chat'
                                ? (activeTab === 'chat' || activeTab === 'messages')
                                : (activeTab === group.id || (group.id === 'automation' && activeTab === 'automation'));

                              const isExpanded = expandedSection === group.id;
                              const hasChildren = group.tabs.length > 1;
                              const styles = getPrimaryItemStyles(group.id, isGroupActive);

                              return (
                                <div key={group.id} className="space-y-1">
                                  <button
                                    onClick={() => {
                                      if (hasChildren) {
                                        setExpandedSection(isExpanded ? null : group.id);
                                      } else {
                                        setIsMobileProfileOpen(false);
                                        handleSubTabClick(group.id, group.tabs[0].id);
                                      }
                                    }}
                                    className={`w-full group/l1 flex items-center justify-between px-3 py-2.5 min-h-[42px] rounded-xl transition-all duration-200 cursor-pointer text-start ${styles.rowClass} flex-row`}
                                  >
                                    <div className="flex items-center gap-2.5 min-w-0 flex-row">
                                      <div className={styles.iconContainer}>
                                        {renderIcon(group.icon, 15, styles.iconClass)}
                                      </div>
                                      <span className="text-[11.5px] font-semibold tracking-tight truncate">
                                        {isRtl ? group.label.fa : group.label.en}
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0 flex-row">
                                      {group.id === 'tasks' && (
                                        <span className="bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300 text-[8.5px] font-black px-1.5 py-0.5 rounded-full min-w-[16px] text-center">
                                          {(tasks || []).filter(t => t && t.status !== 'completed' && t.status !== 'done').length}
                                        </span>
                                      )}
                                      {group.id === 'notifications' && unreadNotifsCount > 0 && (
                                        <span className="bg-red-500/10 text-red-500 dark:bg-red-500/20 dark:text-red-400 text-[8.5px] font-black px-1.5 py-0.5 rounded-full min-w-[16px] text-center animate-pulse">
                                          {unreadNotifsCount}
                                        </span>
                                      )}
                                      {hasChildren && (
                                        <motion.div
                                          animate={{ rotate: isExpanded ? 180 : 0 }}
                                          transition={{ duration: 0.2 }}
                                          className="text-slate-400 dark:text-slate-500"
                                        >
                                          <ChevronDown size={12} />
                                        </motion.div>
                                      )}
                                    </div>
                                  </button>

                                  {hasChildren && (
                                    <AnimatePresence initial={false}>
                                      {isExpanded && (
                                        <motion.div
                                          initial={{ height: 0, opacity: 0 }}
                                          animate={{ height: 'auto', opacity: 1 }}
                                          exit={{ height: 0, opacity: 0 }}
                                          transition={{ duration: 0.2, ease: 'easeInOut' }}
                                          className="overflow-hidden mt-0.5"
                                        >
                                          <div className="bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-700/50 rounded-xl my-1 mx-1 p-1 space-y-0.5">
                                            {group.tabs.map(tab => {
                                              const isTabActive = isSubTabActiveHelper(group.id, tab.id);

                                              return (
                                                <button
                                                  key={tab.id}
                                                  onClick={() => {
                                                    setIsMobileProfileOpen(false);
                                                    handleSubTabClick(group.id, tab.id);
                                                  }}
                                                  className={`w-full group/l2 flex items-center justify-between px-3 py-2 min-h-[38px] rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer text-start border flex-row ${
                                                    isTabActive
                                                      ? 'bg-white dark:bg-slate-700 text-[#155DFC] dark:text-blue-400 font-semibold border-slate-200 dark:border-slate-600 shadow-2xs'
                                                      : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-800 dark:hover:text-slate-200 border-transparent'
                                                  }`}
                                                >
                                                  <div className="flex items-center gap-2 min-w-0 flex-row">
                                                    <div className="shrink-0 transition-transform duration-150 group-hover/l2:scale-105">
                                                      {renderIcon(tab.icon, 12, isTabActive ? 'text-[#155DFC] dark:text-blue-400 font-bold' : 'text-slate-400 dark:text-slate-500')}
                                                    </div>
                                                    <span className="text-[10.5px] font-medium leading-none truncate">
                                                      {isRtl ? tab.name.fa : tab.name.en}
                                                    </span>
                                                  </div>
                                                </button>
                                              );
                                            })}
                                          </div>
                                        </motion.div>
                                      )}
                                    </AnimatePresence>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )))}
                    </div>
                  </div>

                  {/* Sticky Footer Area */}
                  <div className="shrink-0 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                    <button
                      onClick={() => {
                        setIsMobileProfileOpen(false);
                        handleSubTabClick('settings', 'system_settings');
                      }}
                      className="flex-1 flex items-center justify-center gap-1.5 min-h-[38px] rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer"
                    >
                      <Settings size={14} />
                      <span>{isRtl ? 'تنظیمات' : 'Settings'}</span>
                    </button>
                    <button
                      onClick={() => {
                        setIsMobileProfileOpen(false);
                        setActiveTab('projects');
                        setActiveSubTab('team');
                      }}
                      className="flex-1 py-2.5 px-4 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all shadow-sm bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200/60 dark:bg-blue-600 dark:text-white dark:hover:bg-blue-500 cursor-pointer shrink-0"
                    >
                      <UserPlus size={15} />
                      <span>{isRtl ? 'دعوت اعضای تیم' : 'Invite Team'}</span>
                    </button>
                  </div>
                </div>
              );
            })()}
          </motion.div>
        </>
      )}
      </AnimatePresence>

      {/* MOBILE SEARCH OVERLAY DIALOG */}
      <AnimatePresence>
        {isMobileSearchOpen && (
          <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 md:hidden">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileSearchOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            />
            {/* Search Glass Panel */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="relative bg-surface-primary/95 dark:bg-[#1A1A24]/95 border border-border-primary/90 dark:border-white/5 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4 text-start backdrop-blur-md"
              style={{ direction: isRtl ? 'rtl' : 'ltr' }}
            >
              <div className="flex justify-between items-center border-b border-border-primary/50 dark:border-white/5 pb-2.5">
                <h3 className="text-xs font-black text-text-primary dark:text-white flex items-center gap-1.5">
                  <Search size={14} className="text-brand-accent" />
                  {isRtl ? 'جستجو در کارگاه' : 'Search Workspace'}
                </h3>
                <button 
                  onClick={() => setIsMobileSearchOpen(false)}
                  className="text-text-secondary dark:text-slate-400 hover:text-text-primary dark:hover:text-white text-[10px] font-bold p-1 bg-hover-overlay dark:bg-white/5 rounded-lg transition-all"
                >
                  {isRtl ? 'بستن' : 'Close'}
                </button>
              </div>

              {/* Search input field */}
              <div className="relative">
                <Search className={`absolute top-3.5 text-text-secondary ${isRtl ? 'start-3.5' : 'end-3.5'}`} size={13} />
                <input 
                  type="text"
                  autoFocus
                  placeholder={t('search_placeholder')}
                  value={mobileSearchQuery}
                  onChange={(e) => setMobileSearchQuery(e.target.value)}
                  className={`w-full bg-bg-app dark:bg-slate-900 border border-border-primary dark:border-white/5 p-3 rounded-xl focus:outline-none focus:border-brand-accent font-bold text-xs text-text-primary dark:text-white ${
                    isRtl ? 'ps-10 pe-4 text-start' : 'pe-10 ps-4 text-left'
                  }`}
                />
              </div>

              {/* Search results cards exactly below the search field */}
              <div className="space-y-2.5 max-h-64 overflow-y-auto ps-1 scrollbar-thin">
                {mobileSearchQuery.trim().length > 0 ? (
                  <>
                    {matchingProjects.length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[10px] text-text-secondary font-black block border-b border-border-primary/30 pb-1 ms-1">
                          {isRtl ? 'پروژه‌های پیدا شده' : 'Projects Found'}
                        </span>
                        <div className="grid grid-cols-1 gap-2">
                          {matchingProjects.map(p => (
                            <div 
                              key={p.id}
                              onClick={() => handleSearchResultClick('project', p)}
                              className="p-3 bg-bg-app hover:bg-[#155DFC]/10 border border-border-primary/50 dark:border-white/5 rounded-xl text-xs text-text-primary cursor-pointer transition-all flex items-center justify-between group"
                            >
                              <span className="text-[10px] font-bold text-[#155DFC] opacity-0 group-hover:opacity-100 transition-opacity">← {isRtl ? 'ورود' : 'Enter'}</span>
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-text-primary dark:text-white text-xs">{p.title}</span>
                                <span className="p-1 rounded bg-[#155DFC]/10 text-[#155DFC] text-[10px]">📁</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {matchingTasks.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <span className="text-[10px] text-text-secondary font-black block border-b border-border-primary/30 pb-1 ms-1">
                          {isRtl ? 'وظایف پیدا شده' : 'Tasks Found'}
                        </span>
                        <div className="grid grid-cols-1 gap-2">
                          {matchingTasks.map(t => (
                            <div 
                              key={t.id}
                              onClick={() => handleSearchResultClick('task', t)}
                              className="p-3 bg-bg-app hover:bg-[#155DFC]/10 border border-border-primary/50 dark:border-white/5 rounded-xl text-xs text-text-primary cursor-pointer transition-all flex items-center justify-between group"
                            >
                              <span className="text-[10px] font-bold text-[#155DFC] opacity-0 group-hover:opacity-100 transition-opacity">← {isRtl ? 'ورود' : 'Enter'}</span>
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-text-primary dark:text-white text-xs truncate max-w-[200px]">{t.title}</span>
                                <span className="p-1 rounded bg-amber-500/10 text-amber-500 text-[10px]">✔️</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {matchingProjects.length === 0 && matchingTasks.length === 0 && (
                      <div className="text-center py-6 text-text-secondary text-xs">
                        😞 {isRtl ? 'موردی برای جستجوی شما یافت نشد.' : 'No items matched your query.'}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-6 text-text-secondary text-[11px] font-bold">
                    🔍 {isRtl ? 'نام کلاینت، سایت یا وظیفه را تایپ کنید...' : 'Type name of client, site or task to query...'}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MOBILE BOTTOM TAB BAR */}
      <nav 
        dir={isRtl ? 'rtl' : 'ltr'} 
        className="fixed bottom-4 end-4 start-4 h-16 bg-surface-primary/80 dark:bg-[#1A1A24]/90 backdrop-blur-xl border border-border-primary/80 dark:border-white/5 z-[95] lg:hidden flex justify-around items-center px-2 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.15)]"
      >
        {[
          { id: 'menu', label: { fa: 'منو', en: 'Menu' }, icon: 'Menu', defaultSubTab: '' },
          { id: 'dashboard', label: { fa: 'داشبورد', en: 'Dashboard' }, icon: 'LayoutGrid', defaultSubTab: 'overview' },
          { id: 'projects', label: { fa: 'پروژه‌ها', en: 'Projects' }, icon: 'Folder', defaultSubTab: 'overview' },
          { id: 'tasks', label: { fa: 'وظایف', en: 'Tasks' }, icon: 'CheckSquare', defaultSubTab: 'kanban_board' },
          { id: 'teams', label: { fa: 'متخصصین', en: 'Teams' }, icon: 'Users', defaultSubTab: 'team' }
        ].map((item) => {
          const isMenuTab = item.id === 'menu';
          const isTabActive = isMenuTab 
            ? isMobileProfileOpen
            : item.id === 'projects'
            ? (activeTab === 'projects' && activeSubTab !== 'team' && !isMobileProfileOpen)
            : item.id === 'teams'
            ? ((activeTab === 'teams' || (activeTab === 'projects' && activeSubTab === 'team') || (activeTab === 'reports' && activeSubTab === 'team_reports')) && !isMobileProfileOpen)
            : (activeTab === item.id && !isMobileProfileOpen);

          return (
            <button
              key={item.id}
              onClick={() => {
                if (isMenuTab) {
                  setIsMobileProfileOpen(prev => !prev);
                } else {
                  setIsMobileProfileOpen(false);
                  if (item.id === 'teams') {
                    setActiveTab('projects');
                    setActiveSubTab('team');
                  } else {
                    setActiveTab(item.id);
                    setActiveSubTab(item.defaultSubTab);
                  }
                }
              }}
              className="flex flex-col items-center justify-center py-1 flex-1 relative cursor-pointer h-full"
            >
              {isTabActive && (
                <motion.div
                  layoutId="mobileActiveTabIndicator"
                  className="absolute top-1.5 w-6 h-0.5 bg-brand-accent rounded-full"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <div className={`p-1 transition-all duration-200 mt-1 ${
                isTabActive ? 'text-brand-accent scale-110' : 'text-text-secondary'
              }`}>
                {renderIcon(item.icon, 16)}
              </div>
              <span className={`text-[8.5px] font-black transition-colors duration-200 mt-0.5 ${
                isTabActive ? 'text-brand-accent' : 'text-text-secondary/80'
              }`}>
                {isRtl ? item.label.fa : item.label.en}
              </span>
            </button>
          );
        })}
      </nav>

      {/* GLOBAL CREATE PROJECT MODAL */}
      {hasOpenedNewProjectModal && (
        <Suspense fallback={null}>
          <CreateProjectModal
            isOpen={isNewProjectModalOpen}
            onClose={() => setIsNewProjectModalOpen(false)}
          />
        </Suspense>
      )}

      {/* LOGOUT CONFIRMATION MODAL */}
      <LogoutConfirmModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        onConfirm={() => {
          setIsLogoutModalOpen(false);
          void logout().catch(() => {});
        }}
      />

      {/* GLOBAL NON-INTRUSIVE BACKGROUND SYNC & PERSISTENCE TOAST */}
      <GlobalSyncAndToast />

    </div>
  );
};
