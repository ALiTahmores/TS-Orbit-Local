import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Network, 
  GitBranch, 
  Code, 
  Server, 
  CheckCircle2, 
  Sparkles, 
  Globe, 
  Search, 
  Palette, 
  LayoutGrid, 
  Share2, 
  RotateCcw,
  Sliders,
  Filter,
  Layers,
  ChevronDown,
  Info
} from 'lucide-react';
import { useProject } from '../../../context/ProjectContext';
import { 
  AgentPlan, 
  AgentPlanTask, 
  AgentPlanSubtask, 
  AgentPlanStatus 
} from '../../ui/agent-plan';

export type DomainType = 'web_dev' | 'seo' | 'ui_ux' | 'graphic' | 'social';

export const DOMAIN_OPTIONS: { id: DomainType; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { id: 'web_dev', label: 'توسعه وب‌سایت', icon: Globe },
  { id: 'seo', label: 'سئو و بهینه‌سازی', icon: Search },
  { id: 'ui_ux', label: 'طراحی UI/UX', icon: LayoutGrid },
  { id: 'graphic', label: 'هویت بصری و گرافیک', icon: Palette },
  { id: 'social', label: 'شبکه‌های اجتماعی', icon: Share2 },
];

export const ProjectRoadmapPlan: React.FC = () => {
  const { 
    projects, 
    selectedProject, 
    setSelectedProject, 
    tasks: globalTasks,
    updateProject 
  } = useProject();

  const currentProject = selectedProject || projects[0] || null;

  // Detect domain from current project or default to web_dev
  const detectedDomain = useMemo<DomainType>(() => {
    if (!currentProject) return 'web_dev';
    const text = `${currentProject.title} ${currentProject.category || ''} ${currentProject.department || ''}`.toLowerCase();
    if (text.includes('سئو') || text.includes('seo')) return 'seo';
    if (text.includes('گرافیک') || text.includes('برند') || text.includes('لوگو')) return 'graphic';
    if (text.includes('سوشال') || text.includes('اینستاگرام') || text.includes('محتوا')) return 'social';
    if (text.includes('ui') || text.includes('ux') || text.includes('رابط') || text.includes('تجربه')) return 'ui_ux';
    return 'web_dev';
  }, [currentProject]);

  const [activeDomain, setActiveDomain] = useState<DomainType>(detectedDomain);
  
  // Sync domain when active project changes
  useEffect(() => {
    setActiveDomain(detectedDomain);
  }, [detectedDomain]);

  // Architecture branch toggle for web development ('wp' | 'custom')
  const [webBranch, setWebBranch] = useState<'wp' | 'custom'>('wp');

  // Initial plan generator based on domain & architecture
  const getInitialTasks = (domain: DomainType, branch: 'wp' | 'custom'): AgentPlanTask[] => {
    if (domain === 'web_dev') {
      return [
        {
          id: 'phase_01',
          phaseNumber: 'فاز ۰۱',
          title: 'شروع پروژه و کشف نیازمندی‌ها (Kickoff & Discovery)',
          description: 'دریافت سند بریف کارفرما، تحلیل اهداف کسب‌وکار، ممیزی هاست و دامنه، و تعیین ساختار تیم و سررسیدها.',
          status: 'completed',
          teamLead: 'مهندس سهرابی (معمار ارشد زیرساخت)',
          estimatedDays: 4,
          tools: ['DNS', 'Cloudflare', 'SSL', 'GitLab'],
          subtasks: [
            {
              id: 'st_01_1',
              title: 'دریافت و تحلیل بریف کامل کارفرما',
              description: 'بررسی اهداف تجاری، پرسونای مخاطب و استخراج ماتریس نیازمندی‌ها',
              status: 'completed',
              required: true,
              tools: ['Notion', 'Google Docs']
            },
            {
              id: 'st_01_2',
              title: 'بررسی زیرساخت فنی، هاست و دامنه',
              description: 'پیکربندی رکوردهای DNS کلودفلر، گواهی SSL و تخصیص فضای هاست پرسرعت NVMe',
              status: 'completed',
              required: true,
              tools: ['cPanel', 'DirectAdmin', 'Cloudflare']
            },
            {
              id: 'st_01_3',
              title: 'تعیین متولیان دپارتمان‌ها و تقویم ددلاین‌ها',
              description: 'تعیین متولیان فرانت، بک‌اند، کنترل کیفیت و تدوین مایلستون‌های تحویل',
              status: 'completed',
              required: true,
              tools: ['Jira', 'Trello']
            }
          ]
        },
        {
          id: 'phase_02',
          phaseNumber: 'فاز ۰۲',
          title: branch === 'wp' 
            ? 'تعیین معماری و زیرساخت فنی: پایپ‌لاین وردپرس (Technical Architecture)' 
            : 'تعیین معماری و زیرساخت فنی: پایپ‌لاین اختصاصی (Technical Architecture)',
          description: branch === 'wp'
            ? 'پیکربندی دیتابیس MySQL، نصب هسته بهینه‌شده وردپرس، سخت‌سازی امنیتی و انتخاب کیت طراحی المنتور پرو / قالب اختصاصی.'
            : 'انتخاب استک مدرن Next.js/React + Node.js، مدلسازی اسکیما در دیتابیس PostgreSQL، معماری REST/GraphQL و سیستم احراز هویت JWT.',
          status: 'in_progress',
          teamLead: branch === 'wp' ? 'مهندس رضایی (توسعه‌دهنده ارشد وردپرس)' : 'مهندس کاظمی (تک‌لید فول‌استک)',
          estimatedDays: 7,
          tools: branch === 'wp' ? ['WordPress 6.7', 'WooCommerce', 'Elementor Pro', 'Redis Cache'] : ['Next.js 15', 'TypeScript', 'PostgreSQL', 'Docker', 'JWT'],
          subtasks: branch === 'wp' ? [
            {
              id: 'st_02_wp_1',
              title: 'کانفیگ پایگاه داده و پیکربندی MariaDB/MySQL با UTF8mb4',
              description: 'ایجاد پایگاه داده امن، بهینه‌سازی بافرها و تنظیم کلیدهای سالت wp-config',
              status: 'completed',
              required: true,
              tools: ['phpMyAdmin', 'MySQL']
            },
            {
              id: 'st_02_wp_2',
              title: 'نصب هسته، افزونه‌های امنیتی و سخت‌سازی سرور (Security Hardening)',
              description: 'تغییر مسیر ادمین، فعال‌سازی 2FA، فایروال Wordfence و ریدایرکت‌های امنیتی',
              status: 'in_progress',
              required: true,
              tools: ['Wordfence', 'WP-Rocket']
            },
            {
              id: 'st_02_wp_3',
              title: 'انتخاب و راه‌اندازی ابزار طراحی (المنتور پرو / قالب اختصاصی)',
              description: 'نصب لایسنس معتبر، بارگذاری فونت‌های سازمانی فارسی و تایپوگرافی اختصاصی',
              status: 'pending',
              required: true,
              tools: ['Elementor Pro', 'ACF Pro']
            }
          ] : [
            {
              id: 'st_02_cu_1',
              title: 'انتخاب استک فنی و راه‌اندازی مونو‌ریپو با کانتینرهای Docker',
              description: 'پیکربندی محیط‌های Dev/Staging با داکر کامپوز و پایپ‌لاین CI/CD گیت‌هاب اکشنز',
              status: 'completed',
              required: true,
              tools: ['Docker', 'Next.js', 'Turborepo']
            },
            {
              id: 'st_02_cu_2',
              title: 'مدل‌سازی دیتابیس و طراحی مایگریشن‌ها در PostgreSQL/Prisma',
              description: 'طراحی جداول کاربران، محصولات، تراکنش‌ها، لاگ‌ها و شاخص‌گذاری مناسب (Indexing)',
              status: 'in_progress',
              required: true,
              tools: ['PostgreSQL', 'Prisma ORM']
            },
            {
              id: 'st_02_cu_3',
              title: 'طراحی روت‌های API، مدیریت دسترسی RBAC و احراز هویت با JWT',
              description: 'ایجاد اندپوینت‌های رفرش توکن، رمزنگاری bcrypt و اعتبارسنجی ورودی‌ها با Zod',
              status: 'pending',
              required: true,
              tools: ['Zod', 'JWT', 'Swagger']
            }
          ]
        },
        {
          id: 'phase_03',
          phaseNumber: 'فاز ۰۳',
          title: 'پیاده‌سازی و توسعه کامل (Execution & Build)',
          description: 'پیاده‌سازی ماژولار صفحات اصلی، فرم‌های ارتباط و استعلام، فرآیند سبد خرید و درگاه پرداخت شاپرک، سازگاری کامل رسپانسیو.',
          status: 'pending',
          teamLead: 'مهندس ابراهیمی (مدیر پروژه فرانت‌اند)',
          estimatedDays: 14,
          tools: ['React/UI', 'CSS3', 'درگاه شاپرک', 'SMS API'],
          subtasks: [
            {
              id: 'st_03_1',
              title: 'طراحی صفحات کلیدی (خانه، درباره، خدمات و تماس)',
              description: 'کدنویسی چیدمان ریسپانسیو و بهینه‌سازی فرمت تصاویر به WebP با ابعاد مناسب',
              status: 'pending',
              required: true,
              tools: ['Figma to Code', 'Tailwind']
            },
            {
              id: 'st_03_2',
              title: 'توسعه فرم‌ها، استعلامات و اعتبارسنجی آنلاین فیلدها',
              description: 'اتصال فرم‌ها به سامانه پیامک خدماتی جهت ارسال کدرهگیری آنی به کاربر و ادمین',
              status: 'pending',
              required: true,
              tools: ['Kavenegar', 'Formik']
            },
            {
              id: 'st_03_3',
              title: 'پیاده‌سازی سبد خرید، اتصال به درگاه بانکی شاپرک و صدور پیش‌فاکتور',
              description: 'یکپارچه‌سازی متدهای پرداخت اینترنتی، تست وب‌هوک و تسویه‌حساب خودکار',
              status: 'pending',
              required: true,
              tools: ['زرین‌پال / به‌پرداخت', 'Invoice PDF']
            },
            {
              id: 'st_03_4',
              title: 'تست جامع رسپانسیو روی موبایل، تبلت و نمایشگرهای فوق‌عریض',
              description: 'بهبود تجربه لمسی در اسمارت‌فون‌ها، مگامنوهای کشویی و منوی چسبان (Sticky)',
              status: 'pending',
              required: true,
              tools: ['BrowserStack', 'Chrome DevTools']
            }
          ]
        },
        {
          id: 'phase_04',
          phaseNumber: 'فاز ۰۴',
          title: 'کنترل کیفیت یکپارچه (QA & Accessibility)',
          description: 'آزمون‌های جامع کارایی، امنیت، ممیزی کد، بارگذاری پرفشار و بررسی انطباق استاندارد دسترس‌پذیری بین‌المللی WCAG 2.2 AA.',
          status: 'pending',
          teamLead: 'خانم مهندس یوسفی (سرپرست تضمین کیفیت QA)',
          estimatedDays: 5,
          tools: ['Lighthouse', 'SonarQube', 'WCAG AA', 'GTmetrix'],
          subtasks: [
            {
              id: 'st_04_1',
              title: 'تست عملکردی، کارکرد لینک‌ها و تست فرم‌ها (Functional Testing)',
              description: 'اطمینان از ذخیره بدون خطای داده‌ها، ارسال صحیح ایمیل‌ها و صحت محاسبات مالی',
              status: 'pending',
              required: true,
              tools: ['Cypress', 'Postman']
            },
            {
              id: 'st_04_2',
              title: 'ارزیابی امنیت و آزمون نفوذ پایه (Penetration & Vulnerability Check)',
              description: 'بررسی هدرهای امنیتی، ممانعت از حملات XSS، SQL Injection و CSRF',
              status: 'pending',
              required: true,
              tools: ['OWASP ZAP', 'SSL Labs']
            },
            {
              id: 'st_04_3',
              title: 'بهینه‌سازی شاخص‌های حیاتی سرعت (Core Web Vitals) و امتیاز بالای ۹۰',
              description: 'بهینه‌سازی LCP, INP, CLS، فشرده‌سازی Gzip/Brotli و مینیفای کردن اسکریپت‌ها',
              status: 'pending',
              required: true,
              tools: ['Google PageSpeed', 'Cloudflare CDN']
            },
            {
              id: 'st_04_4',
              title: 'بررسی سازگاری دسترس‌پذیری استاندارد WCAG 2.2 AA',
              description: 'کنتراست صحیح رنگی متون، برچسب‌های ARIA برای صفحه‌خوان‌ها و ناوبری با کیبورد',
              status: 'pending',
              required: false,
              tools: ['axe DevTools', 'WAVE']
            }
          ]
        },
        {
          id: 'phase_05',
          phaseNumber: 'فاز ۰۵',
          title: 'تحویل، انتقال به سرور و لانچ (Deployment & Cutover)',
          description: 'انتقال امن از محیط استیجینگ به پروداکشن، سئو پایه On-Page، ثبت در سرچ کنسول گوگل و تحویل مدارک و آموزش پنل به کارفرما.',
          status: 'pending',
          teamLead: 'مهندس حسینی (مدیر ارشد تحویل پروژه)',
          estimatedDays: 3,
          tools: ['Search Console', 'Google Analytics 4', 'Schema Org', 'کتابچه تحویل'],
          subtasks: [
            {
              id: 'st_05_1',
              title: 'انتقال به سرور پروداکشن و تغییر رکوردهای اصلی دامنه',
              description: 'همگام‌سازی دیتابیس، جایگزینی آدرس‌ها، فعال‌سازی کش سرور و پشتیبان‌گیری کامل',
              status: 'pending',
              required: true,
              tools: ['SSH', 'Git Deploy']
            },
            {
              id: 'st_05_2',
              title: 'پیکربندی سئو فنی پایه و ساخت خودکار نقشه سایت XML',
              description: 'تنظیم فایل robots.txt، اسکیمای سازمانی Organization و اعتبارسنجی متاتگ‌ها',
              status: 'pending',
              required: true,
              tools: ['Yoast/RankMath', 'Schema Validator']
            },
            {
              id: 'st_05_3',
              title: 'اتصال به گوگل سرچ کنسول و Google Analytics 4',
              description: 'ثبت متاتگ وریفای سرچ کنسول، تعریف ایونت‌های کلیک و فعال‌سازی مانیتورینگ خطاها',
              status: 'pending',
              required: true,
              tools: ['Google Search Console', 'GA4']
            },
            {
              id: 'st_05_4',
              title: 'جلسه تحویل نهایی، ارائه ویدیوهای آموزشی و دریافت تاییدیه کتبی',
              description: 'ارائه مستندات مدیریتی، گذرواژه‌های امنیتی و امضای فرم تحویل پروژه توسط کارفرما',
              status: 'pending',
              required: true,
              tools: ['سند تحویل', 'Loom Video']
            }
          ]
        }
      ];
    }

    if (domain === 'seo') {
      return [
        {
          id: 'seo_01',
          phaseNumber: 'فاز ۰۱',
          title: 'تحلیل عمیق کسب‌وکار، کیورد ریسرچ و رقبا',
          description: 'استخراج کلمات کلیدی درآمدزا، بررسی حجم سرچ، تحلیل گپ محتوایی رقبا و تدوین استراتژی موضوعی.',
          status: 'completed',
          teamLead: 'سینا رحیمی (استراتژیست ارشد سئو)',
          estimatedDays: 10,
          tools: ['Ahrefs', 'SEMrush', 'KWFinder', 'Google Sheets'],
          subtasks: [
            { id: 'seo_1_1', title: 'تحلیل معماری سایت رقبا و شناسایی نقاط ضعف آن‌ها', status: 'completed', required: true },
            { id: 'seo_1_2', title: 'استخراج درخت کلمات کلیدی (Keyword Mapping) با اینتنت خرید', status: 'completed', required: true },
            { id: 'seo_1_3', title: 'تدوین تقویم محتوایی سه‌ماهه اول', status: 'completed', required: true }
          ]
        },
        {
          id: 'seo_02',
          phaseNumber: 'فاز ۰۲',
          title: 'ممیزی جامع سئو تکنیکال (Technical SEO Audit)',
          description: 'بررسی بودجه خزش، ارزیابی ساختار URLها، برطرف کردن خطاهای 4xx و ریدایرکت‌های زنجیره‌ای.',
          status: 'in_progress',
          teamLead: 'نیلوفر مهدوی (متخصص سئو فنی)',
          estimatedDays: 8,
          tools: ['Screaming Frog', 'Search Console', 'PageSpeed Insights'],
          subtasks: [
            { id: 'seo_2_1', title: 'حل خطاهای ایندکس و کرال در سرچ کنسول (Page Indexing Issues)', status: 'completed', required: true },
            { id: 'seo_2_2', title: 'پیاده‌سازی اسکیماهای ساختاریافته (Article, FAQ, Product, Breadcrumbs)', status: 'in_progress', required: true },
            { id: 'seo_2_3', title: 'بهینه‌سازی بودجه خزش و اصلاح فایل‌های Sitemap و Robots.txt', status: 'pending', required: true }
          ]
        },
        {
          id: 'seo_03',
          phaseNumber: 'فاز ۰۳',
          title: 'بهینه‌سازی درون‌صفحه‌ای (On-Page SEO) و تولید محتوا',
          description: 'بهینه‌سازی تگ‌های عنوان، توضیحات متا، استراکچر H1-H3 و بارگذاری مقالات عمیق هدفمند.',
          status: 'pending',
          teamLead: 'آرش شریفی (سرپرست تیم محتوا)',
          estimatedDays: 15,
          tools: ['Yoast SEO', 'Grammarly', 'SurferSEO'],
          subtasks: [
            { id: 'seo_3_1', title: 'بهینه‌سازی عنوان و متادیسکریپشن صفحات لندینگ کلیدی', status: 'pending', required: true },
            { id: 'seo_3_2', title: 'لینک‌سازی داخلی خوشه‌ای (Topic Cluster & Pillar Pages)', status: 'pending', required: true },
            { id: 'seo_3_3', title: 'تولید ۱۰ مقاله تخصصی بر اساس گایدلاین‌های سئو معنایی', status: 'pending', required: true }
          ]
        },
        {
          id: 'seo_04',
          phaseNumber: 'فاز ۰۴',
          title: 'سئو برون‌صفحه‌ای (Off-Page SEO) و لینک‌سازی کلاه‌سفید',
          description: 'رپرتاژ آگهی در رسانه‌های مرجع، ایجاد بک‌لینک‌های پروفایلی معتبر و مدیریت برند منشن‌ها.',
          status: 'pending',
          teamLead: 'مهدی کریمی (مدیر کمپین‌های سئو)',
          estimatedDays: 20,
          tools: ['تسمینو', 'تریبون', 'Disavow Tool'],
          subtasks: [
            { id: 'seo_4_1', title: 'انتخاب رسانه‌های هدف برای انتشار ۳ رپرتاژ استراتژیک', status: 'pending', required: true },
            { id: 'seo_4_2', title: 'پایش و مانیتورینگ سلامت پروفایل بک‌لینک‌ها جهت پیشگیری از پنالتی', status: 'pending', required: true }
          ]
        }
      ];
    }

    if (domain === 'ui_ux') {
      return [
        {
          id: 'ui_01',
          phaseNumber: 'فاز ۰۱',
          title: 'تحقیقات کاربری و معماری اطلاعات (Information Architecture)',
          description: 'مصاحبه با ذی‌نفعان، ترسیم پرسونای مشتریان، تدوین سفر کاربر (User Journey) و ساختار درختی سایت.',
          status: 'completed',
          teamLead: 'مریم عسگری (طراح ارشد تجربه کاربری)',
          estimatedDays: 6,
          tools: ['Miro', 'FigJam', 'Notion'],
          subtasks: [
            { id: 'ui_1_1', title: 'مصاحبه عمیق با کارفرما و تحلیل مشتریان بالقوه', status: 'completed', required: true },
            { id: 'ui_1_2', title: 'ترسیم سایت‌مپ مفهومی و دیاگرام فلوچارت صفحات', status: 'completed', required: true }
          ]
        },
        {
          id: 'ui_02',
          phaseNumber: 'فاز ۰۲',
          title: 'وایرفریم‌های کم‌دقت (Low-Fidelity Wireframes)',
          description: 'ترسیم وایرفریم‌های اولیه چیدمان محتوا، هدایت چشم کاربر و تست ساختار در تیم محصول.',
          status: 'in_progress',
          teamLead: 'پارسا درخشان (طراح محصول)',
          estimatedDays: 8,
          tools: ['Figma Wireframing', 'Balsamiq'],
          subtasks: [
            { id: 'ui_2_1', title: 'طراحی وایرفریم صفحه اصلی و صفحات خدمات', status: 'completed', required: true },
            { id: 'ui_2_2', title: 'طراحی وایرفریم سبد خرید و مراحل ثبت سفارش', status: 'in_progress', required: true },
            { id: 'ui_2_3', title: 'جلسه بازخورد اولیه با کارفرما جهت تایید اسکلت طراحی', status: 'pending', required: true }
          ]
        },
        {
          id: 'ui_03',
          phaseNumber: 'فاز ۰۳',
          title: 'دیزاین سیستم و طراحی باکیفیت (High-Fidelity UI)',
          description: 'تدوین دیزاین سیستم کامل (پالت رنگی، تایپوگرافی، آیکون‌ها، دکمه‌ها و استیت‌ها) و طراحی پیکسلی صفحات.',
          status: 'pending',
          teamLead: 'مریم عسگری',
          estimatedDays: 12,
          tools: ['Figma Components', 'AutoLayout 5.0'],
          subtasks: [
            { id: 'ui_3_1', title: 'تدوین راهنمای سبک بصری (Style Guide) و کتابخانه المان‌ها', status: 'pending', required: true },
            { id: 'ui_3_2', title: 'طراحی فاینال نسخه دسکتاپ تمام صفحات اصلی و فرعی', status: 'pending', required: true },
            { id: 'ui_3_3', title: 'طراحی نسخه موبایل استاندارد و منوهای ناوبری واکنش‌گرا', status: 'pending', required: true }
          ]
        },
        {
          id: 'ui_04',
          phaseNumber: 'فاز ۰۴',
          title: 'پروتوتایپ تعاملی و آماده‌سازی برای دولوپرها (Dev Handoff)',
          description: 'پیاده‌سازی انیمیشن‌های میکرو، نمونه اولیه قابل کلیک و اکسپورت فایل‌ها و توکن‌های طراحی برای تیم توسعه.',
          status: 'pending',
          teamLead: 'پارسا درخشان',
          estimatedDays: 5,
          tools: ['Figma Prototype', 'Zeplin / DevMode'],
          subtasks: [
            { id: 'ui_4_1', title: 'ساخت پروتوتایپ کلیک‌پذیر از فرآیند خرید و ثبت فرم', status: 'pending', required: true },
            { id: 'ui_4_2', title: 'مستندسازی دقیق توکن‌های رنگی، فاصله‌ها و اکسپورت فونت‌ها', status: 'pending', required: true }
          ]
        }
      ];
    }

    // Default Graphic / Social fallback
    return [
      {
        id: 'gen_01',
        phaseNumber: 'فاز ۰۱',
        title: 'کشف هویت برند و کانسپت‌های بصری اولیه',
        description: 'بررسی رقبای بصری، تعریف پالت هویت، ارزش‌های سازمانی و تدوین بورد الهام‌بخش (Moodboard).',
        status: 'completed',
        teamLead: 'الناز تقوی (مدیر هنری)',
        estimatedDays: 5,
        tools: ['Pinterest', 'Illustrator', 'Photoshop'],
        subtasks: [
          { id: 'gen_1_1', title: 'مصاحبه ارزیابی لحن و هویت برند', status: 'completed', required: true },
          { id: 'gen_1_2', title: 'تهیه مودبورد و پیشنهادات اولیه رنگ و فرم', status: 'completed', required: true }
        ]
      },
      {
        id: 'gen_02',
        phaseNumber: 'فاز ۰۲',
        title: 'طراحی نشانه، لوگوتایپ و اقلام ست اداری',
        description: 'طراحی اتودهای اولیه لوگو، بازبینی کانسپت‌ها، ترسیم مهندسی نشانه و طراحی کارت ویزیت و سربرگ.',
        status: 'in_progress',
        teamLead: 'الناز تقوی',
        estimatedDays: 10,
        tools: ['Adobe Illustrator', 'Vector Math'],
        subtasks: [
          { id: 'gen_2_1', title: 'ارائه ۳ کانسپت متمایز لوگو به کارفرما', status: 'completed', required: true },
          { id: 'gen_2_2', title: 'اعمال اصلاحات و بازنگری روی کانسپت منتخب', status: 'in_progress', required: true },
          { id: 'gen_2_3', title: 'طراحی ست اداری، پاکت نامه و کارت ویزیت', status: 'pending', required: true }
        ]
      },
      {
        id: 'gen_03',
        phaseNumber: 'فاز ۰۳',
        title: 'تدوین دفترچه راهنمای هویت بصری برند (Brand Book)',
        description: 'قوانین استفاده از لوگو، فضای تنفس، کاربردهای مجاز و غیرمجاز، پالت رنگی چاپی CMYK و فرمت‌های خروجی.',
        status: 'pending',
        teamLead: 'رضا کمالی',
        estimatedDays: 7,
        tools: ['InDesign', 'PDF Interactive'],
        subtasks: [
          { id: 'gen_3_1', title: 'تدوین استانداردهای چاپ و کدهای رنگی پنتون', status: 'pending', required: true },
          { id: 'gen_3_2', title: 'آماده‌سازی فایل‌های برداری نهایی و راهنمای فونت‌ها', status: 'pending', required: true }
        ]
      }
    ];
  };

  // State of the tasks in the current view
  const [tasks, setTasks] = useState<AgentPlanTask[]>(() => 
    getInitialTasks(activeDomain, webBranch)
  );

  // Update tasks whenever activeDomain or webBranch changes
  useEffect(() => {
    setTasks(getInitialTasks(activeDomain, webBranch));
  }, [activeDomain, webBranch]);

  // Handle task status changes from AgentPlan
  const handleTaskStatusChange = (taskId: string, newStatus: AgentPlanStatus) => {
    setTasks((prev) => 
      prev.map((t) => {
        if (t.id === taskId) {
          // If marked completed, also mark all subtasks completed
          const updatedSubtasks = newStatus === 'completed'
            ? t.subtasks.map((s) => ({ ...s, status: 'completed' as AgentPlanStatus }))
            : (newStatus === 'pending'
                ? t.subtasks.map((s) => ({ ...s, status: 'pending' as AgentPlanStatus }))
                : t.subtasks);
          return { ...t, status: newStatus, subtasks: updatedSubtasks };
        }
        return t;
      })
    );
  };

  // Handle subtask toggle
  const handleSubtaskToggle = (taskId: string, subtaskId: string, completed: boolean) => {
    setTasks((prev) => 
      prev.map((task) => {
        if (task.id !== taskId) return task;

        const updatedSubtasks = task.subtasks.map((sub) => {
          if (sub.id === subtaskId) {
            return {
              ...sub,
              status: (completed ? 'completed' : 'pending') as AgentPlanStatus
            };
          }
          return sub;
        });

        // Check if all subtasks are completed -> auto-advance parent phase to completed
        const allCompleted = updatedSubtasks.length > 0 && updatedSubtasks.every((s) => s.status === 'completed');
        const anyCompleted = updatedSubtasks.some((s) => s.status === 'completed');

        let newParentStatus = task.status;
        if (allCompleted) {
          newParentStatus = 'completed';
        } else if (task.status === 'completed' && !allCompleted) {
          newParentStatus = 'in_progress';
        } else if (anyCompleted && task.status === 'pending') {
          newParentStatus = 'in_progress';
        }

        return {
          ...task,
          status: newParentStatus,
          subtasks: updatedSubtasks
        };
      })
    );
  };

  // Dynamic overall metrics
  const totalSubtasks = useMemo(() => 
    tasks.reduce((sum, t) => sum + (t.subtasks?.length || 0), 0), 
    [tasks]
  );
  
  const completedSubtasksCount = useMemo(() => 
    tasks.reduce((sum, t) => sum + (t.subtasks?.filter((s) => s.status === 'completed').length || 0), 0), 
    [tasks]
  );

  const overallProgressPercentage = totalSubtasks > 0 
    ? Math.round((completedSubtasksCount / totalSubtasks) * 100) 
    : 0;

  // Sync with project context if project exists
  useEffect(() => {
    if (currentProject && updateProject) {
      // Keep project progress updated smoothly
      if (Math.abs((currentProject.progress || 0) - overallProgressPercentage) > 3) {
        updateProject(currentProject.id, {
          progress: overallProgressPercentage
        });
      }
    }
  }, [overallProgressPercentage, currentProject, updateProject]);

  return (
    <div dir="rtl" className="w-full text-right font-vazirmatn">
      {/* SINGLE UNIFIED WHITE CARD CONTAINER */}
      <div className="bg-white dark:bg-[#0d121f] rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-sm p-6 sm:p-7 space-y-6 overflow-hidden">
        
        {/* SECTION A — Top Controls & Filter Strip (نوار فیلتر و معماری) */}
        <div className="p-2 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
          
          {/* Department Selection Pills */}
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {DOMAIN_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const isActive = activeDomain === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => setActiveDomain(opt.id)}
                  className={`flex items-center gap-1.5 sm:gap-2 transition-all cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-blue-600 text-white font-bold shadow-sm rounded-xl px-4 py-2 text-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 text-xs font-semibold px-3 py-1.5 transition-colors'
                  }`}
                >
                  <Icon size={14} />
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>

          {/* Architecture Picker: WordPress vs Custom Code (Visible for Web Dev) */}
          {activeDomain === 'web_dev' && (
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 shrink-0 self-start lg:self-auto">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 px-2 flex items-center gap-1">
                <GitBranch size={13} className="text-blue-500" />
                <span>معماری فنی:</span>
              </span>

              <button
                onClick={() => setWebBranch('wp')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  webBranch === 'wp'
                    ? 'bg-white dark:bg-blue-600 text-blue-600 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <span>وردپرس (WordPress)</span>
              </button>

              <button
                onClick={() => setWebBranch('custom')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  webBranch === 'custom'
                    ? 'bg-white dark:bg-blue-600 text-blue-600 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Code size={13} />
                <span>توسعه اختصاصی (Custom Code)</span>
              </button>
            </div>
          )}

        </div>

        {/* SECTION B — Integrated Project Metadata & Progress Banner */}
        <div className="space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            
            {/* Main Summary & Title */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                  <Layers size={18} />
                </span>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                    {`جریان و رودمپ اجرایی: ${DOMAIN_OPTIONS.find(d => d.id === activeDomain)?.label || 'توسعه وب‌سایت'}`}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">
                    فازهای متوالی پروژه با قابلیت گسترش، تیک‌زدن وظایف، محاسبه خودکار پیشرفت و مانیتورینگ متولیان
                  </p>
                </div>
              </div>
            </div>

            {/* Overall Progress Meter */}
            <div className="flex items-center gap-3 px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/80 shrink-0 self-start lg:self-auto">
              <div className="text-left">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-medium">پیشرفت کلی</span>
                <span className="text-xs font-black font-mono text-slate-800 dark:text-slate-100">
                  {overallProgressPercentage}٪
                </span>
              </div>
              <div className="w-24 sm:w-32 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${overallProgressPercentage}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                  className="h-full bg-blue-600 dark:bg-blue-500 rounded-full"
                />
              </div>
            </div>

          </div>

          {/* Project Status Bar / Metadata Row */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs">
            {/* Active Project Indicator Pill */}
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-slate-500 dark:text-slate-400 font-medium">پروژه فعال:</span>
              <span className="font-bold text-slate-800 dark:text-slate-100">
                {currentProject ? currentProject.title : 'هیچ پروژه‌ای ثبت نشده است'}
              </span>
              {currentProject?.category && (
                <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded text-[10px] font-mono">
                  {currentProject.category}
                </span>
              )}
            </div>

            {/* Total Phases, Completed Tasks, and Reset Button */}
            <div className="flex items-center gap-3 sm:gap-4 text-slate-500 dark:text-slate-400 text-[11px]">
              <span className="inline-flex items-center gap-1 bg-slate-50 dark:bg-slate-900/50 px-2.5 py-1 rounded-lg border border-slate-100 dark:border-slate-800/80">
                <span>مجموع فازها:</span>
                <strong className="text-slate-800 dark:text-slate-200 font-mono font-bold">{tasks.length}</strong>
              </span>

              <span className="inline-flex items-center gap-1 bg-slate-50 dark:bg-slate-900/50 px-2.5 py-1 rounded-lg border border-slate-100 dark:border-slate-800/80">
                <span>تسک‌های تکمیل‌شده:</span>
                <strong className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">
                  {completedSubtasksCount} / {totalSubtasks}
                </strong>
              </span>

              <button
                onClick={() => setTasks(getInitialTasks(activeDomain, webBranch))}
                className="inline-flex items-center gap-1 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer mr-1 px-2 py-1 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900/40"
                title="بازنشانی فازها به حالت پیش‌فرض"
              >
                <RotateCcw size={12} />
                <span>بازنشانی پیش‌فرض</span>
              </button>
            </div>
          </div>

          {/* Clean hairline horizontal separator */}
          <div className="border-t border-slate-100 dark:border-slate-800 pt-1" />
        </div>

        {/* SECTION C — Embedded Workflow & Phases Accordion (Agent-Plan) */}
        <div className="pt-1">
          <AgentPlan
            tasks={tasks}
            onTaskStatusChange={handleTaskStatusChange}
            onSubtaskToggle={handleSubtaskToggle}
            overallProgress={overallProgressPercentage}
            embedded={true}
            hideHeader={true}
          />
        </div>

      </div>
    </div>
  );
};
