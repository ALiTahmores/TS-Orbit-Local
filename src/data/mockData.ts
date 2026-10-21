import { 
  Project, 
  Task, 
  TeamMember, 
  Client, 
  WordPressChecklistItem, 
  SeoChecklistItem, 
  ContentItem, 
  QaBug, 
  FileAsset, 
  AppNotification,
  WordPressSyncData,
  AutomationRule,
  AutomationLog
} from '../types';

export const INITIAL_TEAM_MEMBERS: TeamMember[] = [
  {
    id: 'usr_owner',
    name: 'کاربر نمونه',
    role: 'راهبر ارشد توسعه',
    department: 'wp_dev',
    avatar: 'ع',
    taskCount: 6,
    completedCount: 3,
    status: 'online'
  },
  {
    id: 'mem-2',
    name: 'محمد رضایی',
    role: 'متخصص پایگاه‌داده',
    department: 'wp_dev',
    avatar: 'م',
    taskCount: 3,
    completedCount: 1,
    status: 'online'
  },
  {
    id: 'mem-3',
    name: 'سارا احمدی',
    role: 'طراح ارشد UI/UX',
    department: 'ui_ux',
    avatar: 'س',
    taskCount: 2,
    completedCount: 1,
    status: 'online'
  },
  {
    id: 'mem-4',
    name: 'رضا معتمدی',
    role: 'کارشناس کنترل کیفی',
    department: 'qa',
    avatar: 'ر',
    taskCount: 2,
    completedCount: 1,
    status: 'away'
  }
];

export const INITIAL_PROJECTS: Project[] = [
  {
    id: 'prj-1',
    title: 'پلتفرم تجارت الکترونیک آریا',
    description: 'توسعه فروشگاه اینترنتی سازمانی با سیستم پرداخت هوشمند',
    progress: 75,
    totalTasks: 12,
    completedTasks: 9,
    status: 'ACTIVE',
    startDate: '1404/10/01',
    deadline: '1405/06/15',
    budget: '۱۲۰,۰۰۰,۰۰۰ تومان',
    clientName: 'هلدینگ تجاری آریا',
    teamLead: 'کاربر نمونه',
    clientPortalEnabled: true,
    isPortalActive: true
  },
  {
    id: 'prj-2',
    title: 'پورتال مشتریان و زیرساخت سئو',
    description: 'بهینه‌سازی کلمات کلیدی و مانیتورینگ آنالیتیکس',
    progress: 40,
    totalTasks: 8,
    completedTasks: 3,
    status: 'ACTIVE',
    startDate: '1405/01/10',
    deadline: '1405/07/01',
    budget: '۴۵,۰۰۰,۰۰۰ تومان',
    clientName: 'شرکت فناوری پارس',
    teamLead: 'سارا احمدی',
    clientPortalEnabled: true,
    isPortalActive: true
  }
];

export const INITIAL_TASKS: Task[] = [
  {
    id: 'tsk-1',
    projectId: 'prj-1',
    title: 'طراحی و بهینه‌سازی API سئو و وردپرس',
    description: 'پیاده‌سازی اندپوینت‌های سیستم همگام‌سازی وب‌هوک',
    assignedTo: 'کاربر نمونه',
    priority: 'high',
    status: 'completed',
    department: 'wp_dev',
    startDate: '1405/04/01',
    deadline: '1405/05/10',
    tags: ['Backend', 'API'],
    attachments: [],
    dependencies: [],
    estimatedHours: 12,
    loggedHours: 10
  },
  {
    id: 'tsk-2',
    projectId: 'prj-1',
    title: 'بررسی لایه‌های امنیتی و توکن‌های OAuth',
    description: 'اعتبارسنجی توکن‌های احراز هویت در اجرای محلی',
    assignedTo: 'کاربر نمونه',
    priority: 'critical',
    status: 'completed',
    department: 'wp_dev',
    startDate: '1405/04/05',
    deadline: '1405/05/12',
    tags: ['Security', 'OAuth'],
    attachments: [],
    dependencies: [],
    estimatedHours: 8,
    loggedHours: 7
  },
  {
    id: 'tsk-3',
    projectId: 'prj-1',
    title: 'ارتقای سیستم آنالیتیکس و داشبورد پرسنلی',
    description: 'محاسبه دینامیک XP و شاخص‌های عملکرد پرسنل',
    assignedTo: 'کاربر نمونه',
    priority: 'high',
    status: 'inprogress',
    department: 'wp_dev',
    startDate: '1405/05/01',
    deadline: '1405/05/20',
    tags: ['Analytics', 'Frontend'],
    attachments: [],
    dependencies: [],
    estimatedHours: 16,
    loggedHours: 8
  },
  {
    id: 'tsk-4',
    projectId: 'prj-2',
    title: 'بررسی ددلاین‌ها و مانیتورینگ کارکرد اعضای تیم',
    description: 'کنترل پیشرفت روزانه و رفع بلاکرهای احتمالی',
    assignedTo: 'کاربر نمونه',
    priority: 'medium',
    status: 'inprogress',
    department: 'wp_dev',
    startDate: '1405/05/02',
    deadline: '1405/05/25',
    tags: ['Management', 'Tasks'],
    attachments: [],
    dependencies: [],
    estimatedHours: 10,
    loggedHours: 4
  },
  {
    id: 'tsk-5',
    projectId: 'prj-1',
    title: 'بازبینی کدهای QA و ماژول جدید',
    description: 'بررسی گزارش‌های اشکالات QA قبل از ریلیز',
    assignedTo: 'کاربر نمونه',
    priority: 'low',
    status: 'pending',
    department: 'qa',
    startDate: '1405/05/05',
    deadline: '1405/05/30',
    tags: ['Review', 'QA'],
    attachments: [],
    dependencies: [],
    estimatedHours: 6,
    loggedHours: 0
  },
  {
    id: 'tsk-6',
    projectId: 'prj-1',
    title: 'تست واحد کامپوننت‌های UI',
    description: 'اجرای لینتر و تست رندرینگ فرانت‌اند',
    assignedTo: 'کاربر نمونه',
    priority: 'medium',
    status: 'completed',
    department: 'ui_ux',
    startDate: '1405/04/10',
    deadline: '1405/05/01',
    tags: ['UI', 'Testing'],
    attachments: [],
    dependencies: [],
    estimatedHours: 5,
    loggedHours: 5
  },
  {
    id: 'tsk-7',
    projectId: 'prj-1',
    title: 'بهینه‌سازی کوئری‌های دیتابیس PostgreSQL',
    description: 'افزایش سرعت ایندکس‌ها و کاهش زمان پاسخگویی',
    assignedTo: 'محمد رضایی',
    priority: 'high',
    status: 'completed',
    department: 'wp_dev',
    startDate: '1405/04/15',
    deadline: '1405/05/05',
    tags: ['Database', 'SQL'],
    attachments: [],
    dependencies: [],
    estimatedHours: 14,
    loggedHours: 12
  },
  {
    id: 'tsk-8',
    projectId: 'prj-1',
    title: 'ایجاد اسکیما دیتابیس برای سیستم چت',
    description: 'تعریف جداول پیام‌ها و دسترسی اعضا',
    assignedTo: 'محمد رضایی',
    priority: 'medium',
    status: 'inprogress',
    department: 'wp_dev',
    startDate: '1405/05/01',
    deadline: '1405/05/18',
    tags: ['Database', 'Chat'],
    attachments: [],
    dependencies: [],
    estimatedHours: 10,
    loggedHours: 6
  },
  {
    id: 'tsk-9',
    projectId: 'prj-2',
    title: 'پشتیبان‌گیری از سرور و مایگریشن داده‌ها',
    description: 'ایجاد نسخه پشتیبان تایید شده از پایگاه داده',
    assignedTo: 'محمد رضایی',
    priority: 'low',
    status: 'pending',
    department: 'wp_dev',
    startDate: '1405/05/10',
    deadline: '1405/05/28',
    tags: ['DevOps', 'Backup'],
    attachments: [],
    dependencies: [],
    estimatedHours: 4,
    loggedHours: 0
  },
  {
    id: 'tsk-10',
    projectId: 'prj-2',
    title: 'طراحی وایرفریم‌های بخش مدیریت دپارتمان',
    description: 'خلق کامپوننت‌های مدرن سیستم طراحی',
    assignedTo: 'سارا احمدی',
    priority: 'high',
    status: 'completed',
    department: 'ui_ux',
    startDate: '1405/04/12',
    deadline: '1405/05/08',
    tags: ['Figma', 'UI/UX'],
    attachments: [],
    dependencies: [],
    estimatedHours: 20,
    loggedHours: 18
  },
  {
    id: 'tsk-11',
    projectId: 'prj-2',
    title: 'بهینه‌سازی نسخه موبایل داشبورد پرسنلی',
    description: 'تطبیق کامل گریدها و کامپوننت‌های تاچ',
    assignedTo: 'سارا احمدی',
    priority: 'high',
    status: 'inprogress',
    department: 'ui_ux',
    startDate: '1405/05/03',
    deadline: '1405/05/19',
    tags: ['Responsive', 'UI'],
    attachments: [],
    dependencies: [],
    estimatedHours: 12,
    loggedHours: 5
  },
  {
    id: 'tsk-12',
    projectId: 'prj-1',
    title: 'تست جامع ماژول‌های اتصال به وردپرس',
    description: 'ارزیابی رفتار وب‌هوک‌ها در شرایط انقطاع شبکه',
    assignedTo: 'رضا معتمدی',
    priority: 'medium',
    status: 'completed',
    department: 'qa',
    startDate: '1405/04/20',
    deadline: '1405/05/07',
    tags: ['QA', 'WordPress'],
    attachments: [],
    dependencies: [],
    estimatedHours: 8,
    loggedHours: 8
  },
  {
    id: 'tsk-13',
    projectId: 'prj-1',
    title: 'ارزیابی گزارش‌های خطای QA',
    description: 'طبقه‌بندی گزارش‌های باگ بر اساس اولویت سیستم',
    assignedTo: 'رضا معتمدی',
    priority: 'low',
    status: 'inprogress',
    department: 'qa',
    startDate: '1405/05/02',
    deadline: '1405/05/22',
    tags: ['QA', 'Bugs'],
    attachments: [],
    dependencies: [],
    estimatedHours: 6,
    loggedHours: 3
  }
];

export const INITIAL_CLIENTS: Client[] = [];
export const INITIAL_WP_SITES: WordPressSyncData[] = [];
export const INITIAL_AUTOMATION_RULES: AutomationRule[] = [];
export const INITIAL_AUTOMATION_LOGS: AutomationLog[] = [];
export const INITIAL_WP_CHECKLIST: WordPressChecklistItem[] = [];
export const INITIAL_SEO_CHECKLIST: SeoChecklistItem[] = [];
export const INITIAL_CONTENT_CENTER: ContentItem[] = [];
export const INITIAL_QA_BUGS: QaBug[] = [];

export const INITIAL_FILES: FileAsset[] = [
  {
    id: 'file-1',
    name: 'مستندات معماری نرم‌افزار TS Orbit',
    category: 'dev',
    size: '2.4 MB',
    uploadDate: '1405/04/25',
    version: 1,
    versionHistory: [],
    tag: 'معماری'
  },
  {
    id: 'file-2',
    name: 'تایپوگرافی و هویت بصری پروژه',
    category: 'brand',
    size: '5.1 MB',
    uploadDate: '1405/05/01',
    version: 2,
    versionHistory: [],
    tag: 'دیزاین'
  },
  {
    id: 'file-3',
    name: 'گزارش آنالیتیکس و سئو سه‌ماهه',
    category: 'seo',
    size: '1.8 MB',
    uploadDate: '1405/05/03',
    version: 1,
    versionHistory: [],
    tag: 'سئو'
  }
];

export const INITIAL_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'notif-1',
    title: 'منشن جدید در تسک #TSK-3',
    description: 'محمد رضایی شما را در کامنت تسک ارتقای آنالیتیکس منشن کرد.',
    timestamp: '۱۰ دقیقه پیش',
    read: false,
    type: 'task_assigned'
  },
  {
    id: 'notif-2',
    title: 'تکمیل موفقیت‌آمیز فاز اول پروژه آریا',
    description: 'تمام تسک‌های فاز اولیه با نرخ آنتایم ۱۰۰٪ بسته شدند.',
    timestamp: '۱ ساعت پیش',
    read: false,
    type: 'task_completed'
  },
  {
    id: 'notif-3',
    title: 'درخواست بازبینی کد سئو',
    description: 'سارا احمدی طرح جدید UI را جهت تایید ارسال کرد.',
    timestamp: '۳ ساعت پیش',
    read: false,
    type: 'approval_needed'
  }
];

export const INITIAL_WP_LOGS: any[] = [];

