export type DomainType = 'web_dev' | 'seo' | 'ui_ux' | 'graphic' | 'social';

export interface RoadmapDeliverable {
  id: string;
  title: string;
  completed: boolean;
  required: boolean;
}

export interface RoadmapNode {
  id: string;
  phaseNumber: string;
  title: string;
  description: string;
  team: 'web' | 'seo' | 'ui_ux' | 'graphic' | 'social';
  teamName: string;
  iconName: string;
  initialX: number;
  initialY: number;
  isDecisionNode?: boolean;
  decisionQuestion?: string;
  decisionOptions?: { id: string; label: string; branch: 'wp' | 'custom' }[];
  deliverables: RoadmapDeliverable[];
  evidenceRequired: string[];
  teamLead: string;
  estimatedDays: number;
  dependencies: string[]; // IDs of parent nodes
  branch?: 'wp' | 'custom' | 'all';
}

export interface RoadmapConnection {
  id: string;
  from: string;
  to: string;
  fromPort?: 'right' | 'left' | 'bottom' | 'top';
  toPort?: 'left' | 'right' | 'top' | 'bottom';
  label?: string;
  branch?: 'wp' | 'custom' | 'all';
}

export interface DomainRoadmapConfig {
  id: DomainType;
  title: string;
  titleEn: string;
  description: string;
  teamBadge: string;
  accentColor: string;
  nodes: RoadmapNode[];
  connections: RoadmapConnection[];
}

export const DOMAIN_ROADMAPS: Record<DomainType, DomainRoadmapConfig> = {
  web_dev: {
    id: 'web_dev',
    title: 'توسعه و طراحی وب‌سایت',
    titleEn: 'Website Engineering Lifecycle',
    description: 'جریان اجرای کامل فنی از استارت و کشف نیازمندی‌ها تا معماری، کدنویسی، تست و لانچ',
    teamBadge: 'تیم فنی و برنامه‌نویسی',
    accentColor: '#38bdf8',
    nodes: [
      // Level 0: Root Node (Top Center)
      {
        id: 'web_kickoff',
        phaseNumber: 'فاز ۰۱',
        title: 'شروع پروژه و کشف نیازمندی‌های فنی',
        description: 'دریافت بریف کامل، ثبت دامنه، پیکربندی هاست ابری، DNS، گواهی SSL و ممیزی زیرساخت',
        team: 'web',
        teamName: 'زیرساخت و فنی',
        iconName: 'Server',
        initialX: 450,
        initialY: 40,
        deliverables: [
          { id: 'del_1', title: 'دریافت و تحلیل سند بریف کارفرما', completed: true, required: true },
          { id: 'del_2', title: 'اتصال نیم‌سرورها (DNS) و فعال‌سازی SSL رایگان/تجاری', completed: true, required: true },
          { id: 'del_3', title: 'تخصیص محیط تست و مخزن کد گیت‌لب/گیت‌هاب', completed: true, required: true }
        ],
        evidenceRequired: ['اسکرین‌شات رکورد DNS فعال', 'لاگ موفقیت‌آمیز برقراری اتصال SSL'],
        teamLead: 'مهندس سهرابی (معمار ارشد زیرساخت)',
        estimatedDays: 4,
        dependencies: []
      },

      // Level 1: Central Decision Node (Directly Below Root)
      {
        id: 'web_decision',
        phaseNumber: 'فاز ۰۲',
        title: 'گره تصمیم‌گیری: انتخاب معماری پیاده‌سازی',
        description: 'تصمیم‌گیری استراتژیک بین پایپ‌لاین وردپرس (مدیریت محتوا) و پایپ‌لاین کدنویسی اختصاصی',
        team: 'web',
        teamName: 'معماری فنی',
        iconName: 'GitBranch',
        initialX: 450,
        initialY: 200,
        isDecisionNode: true,
        decisionQuestion: 'آیا پروژه روی وردپرس با هسته بهینه‌سازی‌شده پیاده می‌شود یا کدنویسی اختصاصی فول‌استک؟',
        decisionOptions: [
          { id: 'opt_wp', label: 'شاخه A: پایپ‌لاین وردپرس', branch: 'wp' },
          { id: 'opt_custom', label: 'شاخه B: پایپ‌لاین اختصاصی', branch: 'custom' }
        ],
        deliverables: [
          { id: 'del_dec_1', title: 'ارزیابی مقیاس‌پذیری و بودجه نگهداری', completed: true, required: true },
          { id: 'del_dec_2', title: 'تایید رسمی معماری توسط مدیر پروژه', completed: true, required: true }
        ],
        evidenceRequired: ['سند ارزیابی فنی معماری', 'امضای معمار فنی'],
        teamLead: 'طاها ناصری (توسعه‌دهنده فول‌استک)',
        estimatedDays: 2,
        dependencies: ['web_kickoff']
      },

      // Level 2 - Branch A (Right Sub-Tree): WordPress Architecture Tree
      {
        id: 'wp_setup',
        phaseNumber: 'فاز ۰۲-A۱',
        title: 'پیکربندی هاست، DNS و هسته وردپرس',
        description: 'نصب جدیدترین نسخه هسته، دیتابیس MariaDB، کانفیگ نمک‌های امنیتی و تغییر آدرس لاگین',
        team: 'web',
        teamName: 'توسعه وردپرس',
        iconName: 'Cpu',
        initialX: 740,
        initialY: 380,
        branch: 'wp',
        deliverables: [
          { id: 'wp_d1', title: 'کانفیگ فایل wp-config و جداول دیتابیس اختصاصی', completed: false, required: true },
          { id: 'wp_d2', title: 'نصب افزونه امنیتی و مسدودسازی دسترسی XML-RPC', completed: false, required: true },
          { id: 'wp_d3', title: 'پیکربندی سیستم کشینگ سمت سرور Redis/LSCache', completed: false, required: true }
        ],
        evidenceRequired: ['لاگ سلامت سایت (Site Health 100%)', 'تست موفقیت اتصال Redis'],
        teamLead: 'مهدی کریمی (کارشناس ارشد وردپرس)',
        estimatedDays: 3,
        dependencies: ['web_decision']
      },
      {
        id: 'wp_cpt_elementor',
        phaseNumber: 'فاز ۰۲-A۲',
        title: 'انتخاب ابزار طراحی (Elementor / قالب)',
        description: 'ایجاد Custom Post Types، فیلدهای پیشرفته ACF Pro و تبدیل کامپوننت‌های دیزاین به المان‌های پویا',
        team: 'web',
        teamName: 'توسعه وردپرس',
        iconName: 'Layout',
        initialX: 740,
        initialY: 530,
        branch: 'wp',
        deliverables: [
          { id: 'wp_e1', title: 'پیاده‌سازی دقیق قالب‌های داینامیک هدر و فوتر', completed: false, required: true },
          { id: 'wp_e2', title: 'کدنویسی شورت‌کدهای اختصاصی و استایل‌دهی مدرن', completed: false, required: true },
          { id: 'wp_e3', title: 'سازگاری کامل با تم دارک و واکنش‌گرایی در موبایل', completed: false, required: true }
        ],
        evidenceRequired: ['پیش‌نمایش زنده در استیجینگ', 'تایید چیدمان در ابعاد تبلت و موبایل'],
        teamLead: 'مهدی کریمی (کارشناس ارشد وردپرس)',
        estimatedDays: 6,
        dependencies: ['wp_setup']
      },
      {
        id: 'wp_plugins',
        phaseNumber: 'فاز ۰۲-A۳',
        title: 'پیاده‌سازی افزونه‌ها و ماژول‌های اختصاصی',
        description: 'توسعه ماژول‌های اختصاصی، یکپارچه‌سازی وب‌هوک‌ها، پیامک کاوه‌نگار و پیکربندی سئو/امنیت',
        team: 'web',
        teamName: 'توسعه وردپرس',
        iconName: 'Cpu',
        initialX: 740,
        initialY: 680,
        branch: 'wp',
        deliverables: [
          { id: 'wp_p1', title: 'توسعه افزونه اختصاصی همگام‌سازی وب‌سرویس‌ها', completed: false, required: true },
          { id: 'wp_p2', title: 'کانفیگ افزونه‌های سئو Yoast/RankMath و امنیت Wordfence', completed: false, required: true },
          { id: 'wp_p3', title: 'پیاده‌سازی ماژول ارسال پیامک خودکار ورود با OTP', completed: false, required: true }
        ],
        evidenceRequired: ['کد افزونه در مخزن گیت', 'لاگ وب‌هوک‌های تستی'],
        teamLead: 'مهدی کریمی (کارشناس ارشد وردپرس)',
        estimatedDays: 5,
        dependencies: ['wp_cpt_elementor']
      },
      {
        id: 'wp_woocommerce',
        phaseNumber: 'فاز ۰۲-A۴',
        title: 'فروشگاه آنلاین و درگاه پرداخت (WooCommerce)',
        description: 'تنظیم ماژول فروشگاهی، پیکربندی درگاه پرداخت زرین‌پال/بانک، پیامک اعتباری و مالیات',
        team: 'web',
        teamName: 'توسعه وردپرس',
        iconName: 'ShoppingBag',
        initialX: 740,
        initialY: 830,
        branch: 'wp',
        deliverables: [
          { id: 'wp_w1', title: 'کانفیگ فرم تسویه‌حساب اختصاصی بدون افزونه زائد', completed: false, required: true },
          { id: 'wp_w2', title: 'تست موفقیت تراکنش ریالی تستی درگاه بانکی', completed: false, required: true },
          { id: 'wp_w3', title: 'اتصال وب‌هوک پیامک وضعیت سفارش (کاوه‌نگار/ملی‌پیامک)', completed: false, required: true }
        ],
        evidenceRequired: ['رسید تراکنش موفق در محیط Sandbox', 'لاگ دریافت پیامک خرید'],
        teamLead: 'مهدی کریمی (کارشناس ارشد وردپرس)',
        estimatedDays: 5,
        dependencies: ['wp_plugins']
      },

      // Level 2 - Branch B (Left Sub-Tree): Custom Full-Stack Architecture Tree
      {
        id: 'custom_arch',
        phaseNumber: 'فاز ۰۲-B۱',
        title: 'انتخاب استک فنی و دیتابیس (React/Node)',
        description: 'راه‌اندازی ساختار تمیز React/Next.js، تایپ‌اسکریپت، تیلویند و مایگریشن دیتابیس پستگرس',
        team: 'web',
        teamName: 'فول‌استک اختصاصی',
        iconName: 'Code',
        initialX: 160,
        initialY: 380,
        branch: 'custom',
        deliverables: [
          { id: 'cc_1', title: 'تنظیم ساختار مونو یا میکرو سرویس و ESLint/Prettier', completed: false, required: true },
          { id: 'cc_2', title: 'پیاده‌سازی توکن‌های رنگی و فونت دیزاین سیستم', completed: false, required: true },
          { id: 'cc_3', title: 'اتصال دیتابیس PostgreSQL و مایگریشن اول', completed: false, required: true }
        ],
        evidenceRequired: ['تست کامپایل بدون ارور در گیت‌اکشنز', 'فایل اسکیما دیتابیس'],
        teamLead: 'طاها ناصری (توسعه‌دهنده فول‌استک)',
        estimatedDays: 4,
        dependencies: ['web_decision']
      },
      {
        id: 'custom_api_auth',
        phaseNumber: 'فاز ۰۲-B۲',
        title: 'توسعه API، احراز هویت JWT و پایگاه داده',
        description: 'طراحی روت‌های امن REST/GraphQL، ریت‌لیمیتینگ، توکن‌های JWT و رول‌های دسترسی RBAC',
        team: 'web',
        teamName: 'فول‌استک اختصاصی',
        iconName: 'Key',
        initialX: 160,
        initialY: 530,
        branch: 'custom',
        deliverables: [
          { id: 'cc_a1', title: 'اندپوینت‌های لاگین دو مرحله‌ای OTP و رفرش توکن', completed: false, required: true },
          { id: 'cc_a2', title: 'پایپ‌لاین تست‌های واحد (Unit Testing) برای سرویس‌های اصلی', completed: false, required: true },
          { id: 'cc_a3', title: 'مستندات تعاملی Swagger/OpenAPI برای فرانت‌اند', completed: false, required: true }
        ],
        evidenceRequired: ['مستندات Swagger زنده', 'پوشش تست بالای ۸۰٪ در Jest'],
        teamLead: 'طاها ناصری (توسعه‌دهنده فول‌استک)',
        estimatedDays: 7,
        dependencies: ['custom_arch']
      },
      {
        id: 'custom_frontend_panel',
        phaseNumber: 'فاز ۰۲-B۳',
        title: 'توسعه کامپوننت‌های فرانت‌اند و پنل مدیریت',
        description: 'کدنویسی صفحات اختصاصی کاربر، پنل داشبورد، مدیریت محتوا و نمودارهای آماری با فرم‌های تعاملی',
        team: 'web',
        teamName: 'فول‌استک اختصاصی',
        iconName: 'Layers',
        initialX: 160,
        initialY: 680,
        branch: 'custom',
        deliverables: [
          { id: 'cc_f1', title: 'پیاده‌سازی ساختار صفحات کلاینت با SSR/CSR بهینه', completed: false, required: true },
          { id: 'cc_f2', title: 'طراحی پنل مدیریت کامل و امن با فرم‌های اعتبارسنجی React Hook Form', completed: false, required: true },
          { id: 'cc_f3', title: 'یکپارچه‌سازی نمودارهای تحلیلی و جداول داده‌ای با فیلتر پیشرفته', completed: false, required: true }
        ],
        evidenceRequired: ['پیش‌نمایش استیجینگ فرانت‌اند', 'تست‌های ریسپانسیو کامپوننت‌ها'],
        teamLead: 'طاها ناصری (توسعه‌دهنده فول‌استک)',
        estimatedDays: 7,
        dependencies: ['custom_api_auth']
      },
      {
        id: 'custom_integration',
        phaseNumber: 'فاز ۰۲-B۴',
        title: 'تست سرویس‌ها، کش و اتصال میکروسرویس‌ها',
        description: 'اتصال رابط کاربری به API، استیت منیجر کلاینت، کشینگ هوشمند و تست‌های یکپارچگی سرور',
        team: 'web',
        teamName: 'فول‌استک اختصاصی',
        iconName: 'Zap',
        initialX: 160,
        initialY: 830,
        branch: 'custom',
        deliverables: [
          { id: 'cc_i1', title: 'بهینه‌سازی ری‌رندرها و کشینگ کوئری‌ها با TanStack', completed: false, required: true },
          { id: 'cc_i2', title: 'مدیریت خطاهای شبکه با ارور باوندری و توست‌های تعاملی', completed: false, required: true },
          { id: 'cc_i3', title: 'تست یکپارچه جریان کاربر E2E در Cypress/Playwright', completed: false, required: true }
        ],
        evidenceRequired: ['ویدیو تست اجرای E2E خودکار', 'سایز باندل بهینه‌شده زیر ۲۰۰ کیلوبایت'],
        teamLead: 'طاها ناصری (توسعه‌دهنده فول‌استک)',
        estimatedDays: 6,
        dependencies: ['custom_frontend_panel']
      },

      // Level 3: Converging Quality Gate & Production
      {
        id: 'web_unified_qa',
        phaseNumber: 'فاز ۰۳',
        title: 'تست کنترل کیفیت جامع و استاندارد WCAG',
        description: 'ممیزی ولیدیشن فرم‌ها، دسترس‌پذیری WCAG 2.2 AA، تست سرعت پینگ‌دام و PageSpeed بالای ۹۰',
        team: 'web',
        teamName: 'تضمین کیفیت و امنیت',
        iconName: 'ShieldCheck',
        initialX: 450,
        initialY: 1010,
        deliverables: [
          { id: 'qa_1', title: 'تست عملکرد در مرورگرهای Chrome, Safari, Firefox, Edge', completed: false, required: true },
          { id: 'qa_2', title: 'ممیزی کنتراست رنگ و برچسب‌های ARIA دسترس‌پذیری', completed: false, required: true },
          { id: 'qa_3', title: 'تست بار و آسیب‌پذیری تزریق SQL و اسکریپت XSS', completed: false, required: true }
        ],
        evidenceRequired: ['گزارش امتیاز لایت‌هاوس بالای ۹۰', 'چک‌لیست تست امنیت امضاشده'],
        teamLead: 'سارا یوسفی (سرپرست تضمین کیفیت QA)',
        estimatedDays: 4,
        dependencies: ['wp_woocommerce', 'custom_integration']
      },
      {
        id: 'web_launch_cutover',
        phaseNumber: 'فاز ۰۴',
        title: 'انتشار در محیط پروداکشن و سوئیچ DNS',
        description: 'انتقال دیتابیس پروداکشن، سوئیچ رکورد A دامنه، تست درگاه واقعی و حذف دسترسی‌های آزمایشی',
        team: 'web',
        teamName: 'دواپس و لانچ',
        iconName: 'Rocket',
        initialX: 450,
        initialY: 1170,
        deliverables: [
          { id: 'ln_1', title: 'پیکربندی کش ابری Cloudflare/ArvanCloud و WAF', completed: false, required: true },
          { id: 'ln_2', title: 'تراکنش زنده ۵۰۰۰ تومانی با کارت واقعی در پروداکشن', completed: false, required: true },
          { id: 'ln_3', title: 'تغییر وضعیت سایت به ایندکس‌پذیر و ثبت نقشه سایت', completed: false, required: true }
        ],
        evidenceRequired: ['رسید بانکی پروداکشن', 'گواهی انتشار رسمی با دامنه اصلی'],
        teamLead: 'مهندس سهرابی (معمار ارشد زیرساخت)',
        estimatedDays: 2,
        dependencies: ['web_unified_qa']
      },
      {
        id: 'web_post_sla',
        phaseNumber: 'فاز ۰۵',
        title: 'پایش مستمر SLA، بک‌آپ خودکار و مانیتورینگ',
        description: 'اتصال به آپ‌تایم روبوت، بک‌آپ‌گیری روزانه در فضای ذخیره‌سازی S3 و مانیتورینگ سرچ‌کنسول',
        team: 'web',
        teamName: 'پشتیبانی فنی',
        iconName: 'Activity',
        initialX: 450,
        initialY: 1330,
        deliverables: [
          { id: 'sla_1', title: 'فعال‌سازی آلرت پیامکی قطعی سرور (زیر ۲ دقیقه)', completed: false, required: true },
          { id: 'sla_2', title: 'تست ریستور آزمایشی بک‌آپ هفتگی در محیط ایزوله', completed: false, required: true },
          { id: 'sla_3', title: 'تحویل دسترسی‌ها و مستند آموزشی به کارفرما', completed: false, required: true }
        ],
        evidenceRequired: ['قرارداد SLA امضاشده', 'سند تاییدیه تحویل پروژه کارفرما'],
        teamLead: 'امیر رضایی (مدیر پشتیبانی و رضایت مشتری)',
        estimatedDays: 3,
        dependencies: ['web_launch_cutover']
      }
    ],
    connections: [
      { id: 'c_kickoff_decision', from: 'web_kickoff', to: 'web_decision', fromPort: 'bottom', toPort: 'top' },
      { id: 'c_decision_wp', from: 'web_decision', to: 'wp_setup', fromPort: 'bottom', toPort: 'top', branch: 'wp', label: 'شاخه وردپرس' },
      { id: 'c_wp_1_2', from: 'wp_setup', to: 'wp_cpt_elementor', fromPort: 'bottom', toPort: 'top', branch: 'wp' },
      { id: 'c_wp_2_3', from: 'wp_cpt_elementor', to: 'wp_plugins', fromPort: 'bottom', toPort: 'top', branch: 'wp' },
      { id: 'c_wp_3_4', from: 'wp_plugins', to: 'wp_woocommerce', fromPort: 'bottom', toPort: 'top', branch: 'wp' },
      { id: 'c_wp_qa', from: 'wp_woocommerce', to: 'web_unified_qa', fromPort: 'bottom', toPort: 'top', branch: 'wp' },
      { id: 'c_decision_custom', from: 'web_decision', to: 'custom_arch', fromPort: 'bottom', toPort: 'top', branch: 'custom', label: 'شاخه اختصاصی' },
      { id: 'c_cc_1_2', from: 'custom_arch', to: 'custom_api_auth', fromPort: 'bottom', toPort: 'top', branch: 'custom' },
      { id: 'c_cc_2_3', from: 'custom_api_auth', to: 'custom_frontend_panel', fromPort: 'bottom', toPort: 'top', branch: 'custom' },
      { id: 'c_cc_3_4', from: 'custom_frontend_panel', to: 'custom_integration', fromPort: 'bottom', toPort: 'top', branch: 'custom' },
      { id: 'c_cc_qa', from: 'custom_integration', to: 'web_unified_qa', fromPort: 'bottom', toPort: 'top', branch: 'custom' },
      { id: 'c_qa_launch', from: 'web_unified_qa', to: 'web_launch_cutover', fromPort: 'bottom', toPort: 'top' },
      { id: 'c_launch_sla', from: 'web_launch_cutover', to: 'web_post_sla', fromPort: 'bottom', toPort: 'top' }
    ]
  },

  seo: {
    id: 'seo',
    title: 'موتور رشد و استراتژی سئو',
    titleEn: 'SEO & Growth Engine',
    description: 'رودمپ گام‌به‌گام ارتقای رتبه، ممیزی تکنیکال، معماری سیلوی کلمات و فتح صفحه اول گوگل',
    teamBadge: 'دپارتمان سئو و رشد',
    accentColor: '#10b981',
    nodes: [
      {
        id: 'seo_discovery',
        phaseNumber: 'فاز ۰۱',
        title: 'کشف استراتژی، رقبا و اهداف بیزینس',
        description: 'بررسی تارگت مارکت، شناخت پرسونای مخاطب و استخراج سهم کلیک رقبای سرسخت بازار',
        team: 'seo',
        teamName: 'استراتژی سئو',
        iconName: 'Compass',
        initialX: 450,
        initialY: 40,
        deliverables: [
          { id: 'sd_1', title: 'ماتریس تحلیل ۵ رقیب اصلی در نتایج ارگانیک', completed: true, required: true },
          { id: 'sd_2', title: 'تعیین KPIهای ملموس (رشد کلیک، ایمپرشن و ورودی هدف)', completed: true, required: true }
        ],
        evidenceRequired: ['سند تحلیل شکاف رقبا (Gap Analysis)', 'اکسل کلمات رقیب'],
        teamLead: 'مهدی حسینی (مدیر ارشد سئو)',
        estimatedDays: 5,
        dependencies: []
      },
      {
        id: 'seo_domain_decision',
        phaseNumber: 'فاز ۰۲',
        title: 'گره تصمیم‌گیری: دامنه جدید یا ممیزی موجود',
        description: 'بررسی پیشینه دامنه، پنالتی‌های گذشته، تاریخچه بک‌لینک و تصمیم بر ریدیزاین یا لانچ جدید',
        team: 'seo',
        teamName: 'آنالیز داده',
        iconName: 'GitMerge',
        initialX: 450,
        initialY: 200,
        isDecisionNode: true,
        decisionQuestion: 'آیا سایت از دامنه خام و نوساز استفاده می‌کند یا ریدیزاین سایت با سابقه قبلی است؟',
        decisionOptions: [
          { id: 'seo_new', label: 'دامنه تازه تاسیس (رویکرد لانچ تدریجی)', branch: 'custom' },
          { id: 'seo_audit', label: 'دامنه موجود (ممیزی و ریدایرکت‌های ۳۰۱)', branch: 'wp' }
        ],
        deliverables: [
          { id: 'sd_d1', title: 'استخراج تاریخچه ایندکس و خطاهای ۴۰۴ سرچ‌کنسول', completed: false, required: true },
          { id: 'sd_d2', title: 'بررسی اسپم‌اسکور و پروفایل بک‌لینک با Ahrefs', completed: false, required: true }
        ],
        evidenceRequired: ['گزارش بک‌لینک اسپم', 'جدول ریدایرکت ۳۰۱ صفحات قدیمی'],
        teamLead: 'مهدی حسینی (مدیر ارشد سئو)',
        estimatedDays: 3,
        dependencies: ['seo_discovery']
      },
      {
        id: 'seo_kw_cluster',
        phaseNumber: 'فاز ۰۳',
        title: 'تحقیق کلمات کلیدی، خوشه‌بندی و اینتنت',
        description: 'دسته‌بندی عبارات بر اساس قصد کاربر (Informational, Transactional) و طراحی تاپیک کلاسترها',
        team: 'seo',
        teamName: 'تحقیق کلمات',
        iconName: 'Target',
        initialX: 450,
        initialY: 370,
        deliverables: [
          { id: 'sk_1', title: 'تحقیق جامع بیش از ۵۰۰ کیورد هدفمند با حجم جستجو', completed: false, required: true },
          { id: 'sk_2', title: 'تشکیل خوشه‌های محتوایی (Topic Clusters) و پیلارها', completed: false, required: true }
        ],
        evidenceRequired: ['شیت کلمات کلیدی دسته‌بندی‌شده با اولویت تجاری'],
        teamLead: 'نرگس صالحی (کارشناس کیورد ریسرچ)',
        estimatedDays: 6,
        dependencies: ['seo_domain_decision']
      },
      {
        id: 'seo_tech_audit',
        phaseNumber: 'فاز ۰۴',
        title: 'ممیزی تکنیکال، معماری سیلو و اسکیمای معنایی',
        description: 'بررسی بودجه خزش، اصلاح robots.txt، بهینه‌سازی نقشه سایت، کانونیکال و اسکیماهای JSON-LD',
        team: 'seo',
        teamName: 'سئو تکنیکال',
        iconName: 'Terminal',
        initialX: 450,
        initialY: 530,
        deliverables: [
          { id: 'st_1', title: 'تزریق اسکیمای BreadcrumbList، Organization و FAQ', completed: false, required: true },
          { id: 'st_2', title: 'حل هدررفت بودجه خزش و مسدودسازی پارامترهای تکراری', completed: false, required: true }
        ],
        evidenceRequired: ['تست معتبر Rich Results گوگل', 'خروجی کرولر Screaming Frog با صفر خطای بحرانی'],
        teamLead: 'مهدی حسینی (مدیر ارشد سئو)',
        estimatedDays: 5,
        dependencies: ['seo_kw_cluster']
      },
      {
        id: 'seo_content_pillars',
        phaseNumber: 'فاز ۰۵',
        title: 'تولید محتوای ستونی و لینک‌سازی داخلی هوشمند',
        description: 'نگارش مقالات مادر، لینک‌سازی هرمی، بهینه‌سازی تصاویر (WebP/Alt) و فاکتورهای E-E-A-T',
        team: 'seo',
        teamName: 'تولید محتوا',
        iconName: 'FileText',
        initialX: 450,
        initialY: 690,
        deliverables: [
          { id: 'sc_1', title: 'نگارش و انتشار ۱۰ مقاله پیلار جامع بالای ۲۰۰۰ کلمه', completed: false, required: true },
          { id: 'sc_2', title: 'لینک‌سازی داخلی ارگانیک بین کلاسترهای وابسته', completed: false, required: true }
        ],
        evidenceRequired: ['لینک مقالات منتشرشده و ایندکس‌شده', 'امتیاز بهینه‌سازی محتوا'],
        teamLead: 'فاطمه صادقی (سردبیر محتوا)',
        estimatedDays: 10,
        dependencies: ['seo_tech_audit']
      },
      {
        id: 'seo_offpage_loop',
        phaseNumber: 'فاز ۰۶',
        title: 'روابط عمومی دیجیتال، رپورتاژ و پایش نتایج',
        description: 'اجرای کمپین‌های لینک‌سازی باکیفیت، رپورتاژ در خبرگزاری‌های معتبر و پایش مداوم رتبه‌ها',
        team: 'seo',
        teamName: 'آف‌پیج و مانیتورینگ',
        iconName: 'TrendingUp',
        initialX: 450,
        initialY: 850,
        deliverables: [
          { id: 'so_1', title: 'انتشار رپورتاژهای خبری در رسانه‌های مرتبط با انکرتکست متنوع', completed: false, required: true },
          { id: 'so_2', title: 'پایش هفتگی ایمپرشن‌ها و نرخ کلیک در سرچ‌کنسول', completed: false, required: true }
        ],
        evidenceRequired: ['لینک رپورتاژهای تاییدشده', 'داشبورد آنالیتیکس و سرچ‌کنسول'],
        teamLead: 'مهدی حسینی (مدیر ارشد سئو)',
        estimatedDays: 14,
        dependencies: ['seo_content_pillars']
      }
    ],
    connections: [
      { id: 'sc_1', from: 'seo_discovery', to: 'seo_domain_decision', fromPort: 'bottom', toPort: 'top' },
      { id: 'sc_2', from: 'seo_domain_decision', to: 'seo_kw_cluster', fromPort: 'bottom', toPort: 'top' },
      { id: 'sc_3', from: 'seo_kw_cluster', to: 'seo_tech_audit', fromPort: 'bottom', toPort: 'top' },
      { id: 'sc_4', from: 'seo_tech_audit', to: 'seo_content_pillars', fromPort: 'bottom', toPort: 'top' },
      { id: 'sc_5', from: 'seo_content_pillars', to: 'seo_offpage_loop', fromPort: 'bottom', toPort: 'top' }
    ]
  },

  ui_ux: {
    id: 'ui_ux',
    title: 'طراحی محصول و تجربه کاربری (UI/UX)',
    titleEn: 'UI/UX Product Design System',
    description: 'تحقیقات کاربری عمیق، وایرفریم، پروتوتایپ تعاملی فیگما و دیزاین سیستم استاندارد',
    teamBadge: 'دپارتمان تجربه کاربری',
    accentColor: '#a855f7',
    nodes: [
      {
        id: 'ux_brief_research',
        phaseNumber: 'فاز ۰۱',
        title: 'تحقیقات کاربری و شناسایی پرسونای مخاطب',
        description: 'مصاحبه با ذینفعان، مصاحبه‌های عمیق کاربر، نقشه‌های همدلی و تدوین ماتریس نیازها',
        team: 'ui_ux',
        teamName: 'تحقیقات کاربری',
        iconName: 'Users',
        initialX: 450,
        initialY: 40,
        deliverables: [
          { id: 'ux_1', title: 'سند پرسونا و نقشه همدلی (Empathy Map)', completed: true, required: true },
          { id: 'ux_2', title: 'تحلیل بنچ‌مارک بصری ۱۰ محصول رقیب بین‌المللی', completed: true, required: true }
        ],
        evidenceRequired: ['سند گزارش تحقیقات در فرمت PDF', 'فایل فیگما پرسوناها'],
        teamLead: 'الهام مقدسی (سرپرست طراحی محصول)',
        estimatedDays: 5,
        dependencies: []
      },
      {
        id: 'ux_ia_wireframes',
        phaseNumber: 'فاز ۰۲',
        title: 'معماری اطلاعات و وایرفریم‌های ساده (Low-Fi)',
        description: 'ترسیم User Flow، نقشه‌سایت درختی و پروتوتایپ خاکستری جهت تایید منطق بیزینس',
        team: 'ui_ux',
        teamName: 'طراحی ساختار',
        iconName: 'Grid',
        initialX: 450,
        initialY: 200,
        deliverables: [
          { id: 'ux_wf_1', title: 'طراحی وایرفریم‌های کلیه صفحات کلیدی دسکتاپ و موبایل', completed: false, required: true },
          { id: 'ux_wf_2', title: 'تاییدیه رسمی ساختار چیدمان توسط کارفرما', completed: false, required: true }
        ],
        evidenceRequired: ['لینک بورد Miro یا Figma وایرفریم‌ها'],
        teamLead: 'الهام مقدسی (سرپرست طراحی محصول)',
        estimatedDays: 6,
        dependencies: ['ux_brief_research']
      },
      {
        id: 'ux_design_system',
        phaseNumber: 'فاز ۰۳',
        title: 'تدوین دیزاین سیستم جامع و توکن‌های بصری',
        description: 'تعریف پالت رنگ، تایپوگرافی سلسله‌مراتبی، گرید ۸ پیکسلی، آیکون‌ها و کامپوننت‌های اتمیک',
        team: 'ui_ux',
        teamName: 'دیزاین سیستم',
        iconName: 'Palette',
        initialX: 450,
        initialY: 370,
        deliverables: [
          { id: 'ux_ds_1', title: 'کتابخانه کامپوننت‌ها با متغیرهای حالت دارک و لایت', completed: false, required: true },
          { id: 'ux_ds_2', title: 'سازگاری فرم‌ها و دکمه‌ها با استاندارد WCAG 2.2', completed: false, required: true }
        ],
        evidenceRequired: ['کتابخانه متصل فیگما (Figma UI Kit)'],
        teamLead: 'الهام مقدسی (سرپرست طراحی محصول)',
        estimatedDays: 7,
        dependencies: ['ux_ia_wireframes']
      },
      {
        id: 'ux_prototype_test',
        phaseNumber: 'فاز ۰۴',
        title: 'پروتوتایپ تعاملی و تست کاربردپذیری',
        description: 'پیاده‌سازی انیمیشن‌های ترنزیشن، تست عملکرد با کاربران واقعی و اصلاح نقاط اصطکاک',
        team: 'ui_ux',
        teamName: 'تست و اعتبارسنجی',
        iconName: 'Smartphone',
        initialX: 450,
        initialY: 530,
        deliverables: [
          { id: 'ux_pt_1', title: 'پروتوتایپ کلیک‌پذیر با انیمیشن‌های هوشمند Smart Animate', completed: false, required: true },
          { id: 'ux_pt_2', title: 'انجام ۵ جلسه تست کاربردپذیری با سناریوی مشخص', completed: false, required: true }
        ],
        evidenceRequired: ['ویدیو ضبط‌شده جلسات تست کاربری', 'گزارش ارزیابی نقاط درد کاربری'],
        teamLead: 'الهام مقدسی (سرپرست طراحی محصول)',
        estimatedDays: 5,
        dependencies: ['ux_design_system']
      },
      {
        id: 'ux_dev_handoff',
        phaseNumber: 'فاز ۰۵',
        title: 'تحویل نهایی به توسعه‌دهندگان (Handoff)',
        description: 'آماده‌سازی اسپک‌های توسعه، اکسپورت اس وی جی بهینه، مستندات ترنزیشن و جلسات همگام‌سازی',
        team: 'ui_ux',
        teamName: 'تحویل فنی',
        iconName: 'Share2',
        initialX: 450,
        initialY: 690,
        deliverables: [
          { id: 'ux_hd_1', title: 'تنظیم متغیرهای Dev Mode در فیگما با مقادیر CSS', completed: false, required: true },
          { id: 'ux_hd_2', title: 'جلسه مرور دیزاین با تیم فنی برنامه‌نویسی', completed: false, required: true }
        ],
        evidenceRequired: ['تاییدیه تحویل فنی امضاشده توسط تیم فرانت'],
        teamLead: 'الهام مقدسی (سرپرست طراحی محصول)',
        estimatedDays: 3,
        dependencies: ['ux_prototype_test']
      }
    ],
    connections: [
      { id: 'uc_1', from: 'ux_brief_research', to: 'ux_ia_wireframes', fromPort: 'bottom', toPort: 'top' },
      { id: 'uc_2', from: 'ux_ia_wireframes', to: 'ux_design_system', fromPort: 'bottom', toPort: 'top' },
      { id: 'uc_3', from: 'ux_design_system', to: 'ux_prototype_test', fromPort: 'bottom', toPort: 'top' },
      { id: 'uc_4', from: 'ux_prototype_test', to: 'ux_dev_handoff', fromPort: 'bottom', toPort: 'top' }
    ]
  },

  graphic: {
    id: 'graphic',
    title: 'طراحی گرافیک و هویت بصری برند',
    titleEn: 'Brand Identity & Visual Engineering',
    description: 'خلق هویت پایدار برند، نشان تجاری، پالت‌های بصری، گایدلاین رسمی و اقلام تبلیغاتی',
    teamBadge: 'دپارتمان هویت بصری',
    accentColor: '#ec4899',
    nodes: [
      {
        id: 'gr_brief_moodboard',
        phaseNumber: 'فاز ۰۱',
        title: 'بریف خلاقانه، بورد الهام و لحن برند',
        description: 'واکاوی ارزش‌های برند، استخراج صفات شخصیتی، مودبورد و تعریف پالت احساسی برند',
        team: 'graphic',
        teamName: 'خلاقیت بصری',
        iconName: 'Sparkles',
        initialX: 450,
        initialY: 40,
        deliverables: [
          { id: 'gb_1', title: 'تدوین سند بریف خلاقانه و منشور ارزش‌ها', completed: true, required: true },
          { id: 'gb_2', title: 'تهیه مودبورد بصری با نمونه‌های الهام‌بخش', completed: true, required: true }
        ],
        evidenceRequired: ['فایل مودبورد تاییدشده'],
        teamLead: 'پارسا درخشان (کارگردان هنری)',
        estimatedDays: 4,
        dependencies: []
      },
      {
        id: 'gr_concept_explorations',
        phaseNumber: 'فاز ۰۲',
        title: 'ایده‌پردازی و خلق اتودهای سه‌گانه (A/B/C)',
        description: 'طراحی ۳ کانسپت کاملا متمایز نشان تجاری (تایپوگرافی، مونوگرام، پیکتوگرام)',
        team: 'graphic',
        teamName: 'طراحی نشان',
        iconName: 'PenTool',
        initialX: 450,
        initialY: 200,
        deliverables: [
          { id: 'gc_1', title: 'خلق اتودهای دستی و دیجیتالیزه‌کردن وکتور در ایلاستریتور', completed: false, required: true },
          { id: 'gc_2', title: 'ارائه اتودها روی موکاپ‌های واقعی تجاری', completed: false, required: true }
        ],
        evidenceRequired: ['کاتالوگ پرزنتیشن کانسپت‌ها'],
        teamLead: 'پارسا درخشان (کارگردان هنری)',
        estimatedDays: 7,
        dependencies: ['gr_brief_moodboard']
      },
      {
        id: 'gr_approval_gate',
        phaseNumber: 'فاز ۰۳',
        title: 'جلسه تاییدیه کارفرما و اصلاحات تکمیلی',
        description: 'پرزنتیشن رسمی، ثبت فیدبک‌های کارفرما و اعمال فاینال اصلاحات روی کانسپت منتخب',
        team: 'graphic',
        teamName: 'مدیریت تاییدیه',
        iconName: 'CheckSquare',
        initialX: 450,
        initialY: 370,
        deliverables: [
          { id: 'ga_1', title: 'جلسه ارائه به هیئت‌مدیره و جمع‌بندی اصلاحات', completed: false, required: true },
          { id: 'ga_2', title: 'امضای رسمی فرم تایید نهایی لوگو', completed: false, required: true }
        ],
        evidenceRequired: ['سند امضاشده تاییدیه هویت بصری'],
        teamLead: 'پارسا درخشان (کارگردان هنری)',
        estimatedDays: 3,
        dependencies: ['gr_concept_explorations']
      },
      {
        id: 'gr_brandbook_export',
        phaseNumber: 'فاز ۰۴',
        title: 'تدوین دفترچه راهنمای برند (Brandbook) و خروجی‌ها',
        description: 'تدوین قوانین حریم امن لوگو، رنگ‌های CMYK/RGB/Pantone، فرمت‌های وکتوری SVG و چاپ ست اداری',
        team: 'graphic',
        teamName: 'پکیجینگ و گایدلاین',
        iconName: 'BookOpen',
        initialX: 450,
        initialY: 530,
        deliverables: [
          { id: 'gbb_1', title: 'دفترچه رسمی هویت بصری (Brand Guidelines) در حداقل ۳۰ صفحه', completed: false, required: true },
          { id: 'gbb_2', title: 'پکیج کامل فایل‌های لایه‌باز و وکتوری با استاندارد صنعتی', completed: false, required: true }
        ],
        evidenceRequired: ['فایل PDF برندهوک', 'لینک فضای ابری آرشیو فایل‌ها'],
        teamLead: 'پارسا درخشان (کارگردان هنری)',
        estimatedDays: 6,
        dependencies: ['gr_approval_gate']
      }
    ],
    connections: [
      { id: 'gc_1', from: 'gr_brief_moodboard', to: 'gr_concept_explorations', fromPort: 'bottom', toPort: 'top' },
      { id: 'gc_2', from: 'gr_concept_explorations', to: 'gr_approval_gate', fromPort: 'bottom', toPort: 'top' },
      { id: 'gc_3', from: 'gr_approval_gate', to: 'gr_brandbook_export', fromPort: 'bottom', toPort: 'top' }
    ]
  },

  social: {
    id: 'social',
    title: 'معماری محتوا و شبکه‌های اجتماعی',
    titleEn: 'Social Media & Content Architecture',
    description: 'جریان استراتژیک تولید ریلز، اسلایدی، سناریونویسی، تقویم موضوعی و جذب مخاطب ارگانیک',
    teamBadge: 'دپارتمان شبکه‌های اجتماعی',
    accentColor: '#f59e0b',
    nodes: [
      {
        id: 'soc_pillars',
        phaseNumber: 'فاز ۰۱',
        title: 'موقعیت‌یابی برند و ستون‌های محتوایی (Pillars)',
        description: 'تدوین ۴ ستون محتوایی آموزشی، انگیزشی، تعاملی و پروموشن به همراه لحن کپشن‌نویسی',
        team: 'social',
        teamName: 'استراتژی سوشال',
        iconName: 'Layers',
        initialX: 450,
        initialY: 40,
        deliverables: [
          { id: 'sp_1', title: 'سند استراتژی سوشال مدیا و تدوین پرسونای مخاطب', completed: true, required: true },
          { id: 'sp_2', title: 'تعریف تم بصری کاورها و گرید اینستاگرام', completed: true, required: true }
        ],
        evidenceRequired: ['سند تقویم موضوعی ماهانه'],
        teamLead: 'آرش علوی (مدیر ارشد شبکه‌های اجتماعی)',
        estimatedDays: 4,
        dependencies: []
      },
      {
        id: 'soc_scripting',
        phaseNumber: 'فاز ۰۲',
        title: 'سناریونویسی ویدیوهای کوتاه و هوک‌های جذاب',
        description: 'طراحی هوک ۳ ثانیه اول (Visual & Verbal Hook)، متن کامل سناریو و چیدمان استوری‌بورد',
        team: 'social',
        teamName: 'سناریو و کارگردانی',
        iconName: 'Film',
        initialX: 450,
        initialY: 200,
        deliverables: [
          { id: 'ss_1', title: 'نگارش ۱۵ سناریوی ریلز بر اساس ترندهای روز', completed: false, required: true },
          { id: 'ss_2', title: 'طراحی کال‌تو‌اکشن‌های (CTA) موثر برای افزایش نرخ ذخیره', completed: false, required: true }
        ],
        evidenceRequired: ['فایل شیت سناریوها و هوک‌ها'],
        teamLead: 'نیلوفر رضایی (کارشناس سناریونویسی)',
        estimatedDays: 5,
        dependencies: ['soc_pillars']
      },
      {
        id: 'soc_production_edit',
        phaseNumber: 'فاز ۰۳',
        title: 'تصویربرداری حرفه‌ای و تدوین پویا',
        description: 'ضبط ویدیو با تجهیزات حرفه‌ای، نورپردازی ۳ نقطه‌ای، سانددیزاین و کپشن‌های متحرک',
        team: 'social',
        teamName: 'تولید و تدوین',
        iconName: 'Video',
        initialX: 450,
        initialY: 370,
        deliverables: [
          { id: 'spe_1', title: 'ضبط و تدوین راف‌کات اولیه ویدیوها', completed: false, required: true },
          { id: 'spe_2', title: 'طراحی زیرنویس موشن و جلوه‌های صوتی جذاب', completed: false, required: true }
        ],
        evidenceRequired: ['پیش‌نمایش ویدیوهای ادیت‌شده در کلود'],
        teamLead: 'کیوان رحمانی (تدوینگر ارشد)',
        estimatedDays: 7,
        dependencies: ['soc_scripting']
      },
      {
        id: 'soc_distribute_loop',
        phaseNumber: 'فاز ۰۴',
        title: 'انتشار چندکاناله، تعامل فعال و تحلیل ROAS',
        description: 'پست‌گذاری در بهترین ساعات تعامل اینستاگرام و لینکدین، پاسخ به کامنت‌ها و مانیتورینگ نرخ تعامل',
        team: 'social',
        teamName: 'انتشار و کامینیوتی',
        iconName: 'Activity',
        initialX: 450,
        initialY: 530,
        deliverables: [
          { id: 'sdl_1', title: 'انتشار طبق تقویم زمان‌بندی‌شده دقیق', completed: false, required: true },
          { id: 'sdl_2', title: 'ارائه گزارش هفتگی واچ‌تایم، شیر و ورودی پروفایل', completed: false, required: true }
        ],
        evidenceRequired: ['اسکرین‌شات Insights اینستاگرام'],
        teamLead: 'آرش علوی (مدیر ارشد شبکه‌های اجتماعی)',
        estimatedDays: 14,
        dependencies: ['soc_production_edit']
      }
    ],
    connections: [
      { id: 'soc_c1', from: 'soc_pillars', to: 'soc_scripting', fromPort: 'bottom', toPort: 'top' },
      { id: 'soc_c2', from: 'soc_scripting', to: 'soc_production_edit', fromPort: 'bottom', toPort: 'top' },
      { id: 'soc_c3', from: 'soc_production_edit', to: 'soc_distribute_loop', fromPort: 'bottom', toPort: 'top' }
    ]
  }
};
