// Team roadmaps: the phased steps a team follows from the start of a project to its
// hand-over. A team owns its roadmap (editable on the Teams page); a project assigned
// to the team receives a copy as its checklist, ticked off by the team as work is done.
// The defaults below follow common agency practice (launch checklists, technical SEO
// and Core Web Vitals targets, UX research and Dev Mode hand-off, brand systems and
// social media onboarding) and are only a starting point for each workspace.

export interface RoadmapStep { id: string; title: string; required?: boolean }
export interface RoadmapPhase { id: string; title: string; description?: string; steps: RoadmapStep[] }
export interface TeamRoadmap { phases: RoadmapPhase[] }

export interface ChecklistStep extends RoadmapStep {
  completed: boolean;
  completedById?: string | null;
  completedByName?: string;
  completedAt?: string | null;
}
export interface ChecklistPhase { id: string; title: string; description?: string; steps: ChecklistStep[] }
export interface TeamChecklist { id: string; teamId: string; teamName: string; color?: string; phases: ChecklistPhase[]; createdAt?: string }

export interface DefaultTeam { key: string; name: string; description: string; color: string; roadmap: TeamRoadmap }

export const ROADMAP_LIMITS = { phases: 20, steps: 40, title: 200, stepTitle: 300, description: 1000 } as const;

type StepSpec = string | [string, false];
const phase = (id: string, title: string, description: string, steps: StepSpec[]): RoadmapPhase => ({
  id, title, description,
  steps: steps.map((step, index) => typeof step === 'string'
    ? { id: `${id}-s${index + 1}`, title: step, required: true }
    : { id: `${id}-s${index + 1}`, title: step[0], required: false }),
});
const optional = (title: string): [string, false] => [title, false];

export const DEFAULT_TEAMS: DefaultTeam[] = [
  {
    key: 'wordpress', name: 'تیم توسعهٔ وردپرس', color: '#2563EB',
    description: 'طراحی، پیاده‌سازی و راه‌اندازی وب‌سایت‌های وردپرسی از بریف تا پشتیبانی پس از انتشار.',
    roadmap: { phases: [
      phase('wp-1', 'شروع و کشف نیازها', 'بریف کارفرما، اهداف و دامنهٔ کار روشن و تأیید می‌شود.', [
        'دریافت بریف و تأیید دامنهٔ کار و فهرست صفحات',
        'تعریف اهداف کسب‌وکار، مخاطب و شاخص‌های موفقیت',
        'تحویل دسترسی‌ها: دامنه، هاست، ایمیل و حساب‌های قبلی',
        'تعیین مسئولان، زمان‌بندی و نقاط تحویل',
      ]),
      phase('wp-2', 'زیرساخت و راه‌اندازی', 'محیط آزمایشی، وردپرس و امنیت پایه آماده می‌شود.', [
        'راه‌اندازی محیط آزمایشی (Staging) جدا از سایت اصلی',
        'نصب وردپرس، تنظیم پایگاه داده و wp-config امن',
        'گواهی SSL، تنظیم DNS و CDN مانند Cloudflare',
        'سخت‌سازی امنیتی: رمزهای قوی، ورود دومرحله‌ای، فایروال و محدودیت ورود',
        'پشتیبان‌گیری خودکار و آزمودن بازیابی آن',
      ]),
      phase('wp-3', 'طراحی و پیاده‌سازی', 'قالب، صفحات و قابلیت‌ها بر اساس طرح تأییدشده ساخته می‌شوند.', [
        'نصب قالب یا صفحه‌ساز و افزونه‌های ضروری با لایسنس معتبر',
        'پیاده‌سازی صفحات کلیدی بر اساس طرح تأییدشده',
        'فرم‌ها، ایمیل‌های سیستمی و اعلان‌ها',
        optional('فروشگاه و درگاه پرداخت (در صورت نیاز)'),
        'بارگذاری محتوای نهایی و حذف متن‌ها و تصاویر نمونه',
      ]),
      phase('wp-4', 'تست و کنترل کیفیت', 'سایت پیش از انتشار روی دستگاه‌ها و مرورگرهای مختلف آزموده می‌شود.', [
        'تست فرم‌ها، پرداخت و همهٔ لینک‌ها',
        'تست موبایل، تبلت و مرورگرهای اصلی',
        'سرعت و Core Web Vitals: LCP زیر ۲٫۵ ثانیه، INP زیر ۲۰۰ میلی‌ثانیه و CLS زیر ۰٫۱',
        'دسترس‌پذیری پایه: کنتراست، متن جایگزین تصاویر و کار با کیبورد',
        'به‌روزرسانی هسته، قالب و افزونه‌ها و بررسی سازگاری با نسخهٔ PHP',
      ]),
      phase('wp-5', 'انتشار', 'سایت به‌صورت کنترل‌شده به نسخهٔ اصلی منتقل می‌شود.', [
        'پشتیبان کامل پیش از انتقال',
        'انتقال به سرور اصلی و جایگزینی آدرس‌ها',
        'برداشتن noindex و بررسی robots.txt و نقشهٔ سایت',
        optional('ریدایرکت ۳۰۱ آدرس‌های قدیمی (در بازطراحی)'),
        'فعال‌سازی کش و تست دوبارهٔ سرعت پس از انتشار',
      ]),
      phase('wp-6', 'پس از انتشار و تحویل', 'سایت پایش، ثبت و به کارفرما تحویل داده می‌شود.', [
        'ثبت در Google Search Console و ارسال نقشهٔ سایت',
        'اتصال Google Analytics 4 و تعریف رویدادهای کلیدی',
        'پایش در دسترس بودن (Uptime) و خطاها در هفتهٔ اول',
        'آموزش پنل مدیریت و تحویل مستندات و دسترسی‌ها',
        'دریافت تأییدیهٔ کتبی تحویل از کارفرما',
        optional('توافق دربارهٔ برنامهٔ نگهداری و به‌روزرسانی‌های دوره‌ای'),
      ]),
    ] },
  },
  {
    key: 'custom', name: 'تیم توسعهٔ اختصاصی', color: '#7C3AED',
    description: 'ساخت وب‌اپلیکیشن و سامانه‌های اختصاصی با کدنویسی، از معماری تا استقرار.',
    roadmap: { phases: [
      phase('cu-1', 'تحلیل و نیازمندی‌ها', 'نیازها به داستان‌های کاربری و معیارهای پذیرش تبدیل می‌شوند.', [
        'جلسهٔ کشف نیازها و نگارش داستان‌های کاربری',
        'تعریف معیارهای پذیرش و دامنهٔ نسخهٔ اول (MVP)',
        'برآورد زمان و تعیین نقاط تحویل',
      ]),
      phase('cu-2', 'معماری و زیرساخت', 'استک، مدل داده و فرایند تحویل کد پیش از شروع توسعه تثبیت می‌شوند.', [
        'انتخاب استک فنی و طراحی معماری',
        'طراحی مدل داده و مایگریشن‌ها',
        'مخزن کد، شاخه‌بندی و بازبینی کد (Code Review)',
        'خط تحویل خودکار (CI/CD) و محیط‌های توسعه، آزمایشی و اصلی',
      ]),
      phase('cu-3', 'توسعه', 'قابلیت‌ها در بازه‌های کوتاه ساخته و نمایش داده می‌شوند.', [
        'پیاده‌سازی API و منطق کسب‌وکار',
        'احراز هویت و کنترل دسترسی نقش‌ها',
        'پیاده‌سازی رابط کاربری بر اساس طرح تأییدشده',
        optional('یکپارچه‌سازی سرویس‌های بیرونی (پرداخت، پیامک، ایمیل)'),
      ]),
      phase('cu-4', 'آزمون و امنیت', 'کیفیت، امنیت و کارایی پیش از انتشار سنجیده می‌شوند.', [
        'تست واحد و تست یکپارچه برای مسیرهای اصلی',
        optional('تست سرتاسری (E2E) جریان‌های کلیدی کاربر'),
        'بررسی امنیتی بر اساس OWASP Top 10',
        optional('تست کارایی و بار'),
      ]),
      phase('cu-5', 'استقرار و تحویل', 'نسخهٔ اصلی با پایش و مستندات کامل تحویل داده می‌شود.', [
        'استقرار روی سرور اصلی با امکان بازگشت (Rollback)',
        'ثبت لاگ، پایش خطا و هشدارها',
        'مستندات فنی، راهنمای استقرار و تحویل کد',
        'جلسهٔ تحویل و دریافت تأییدیهٔ کارفرما',
      ]),
    ] },
  },
  {
    key: 'seo', name: 'تیم سئو', color: '#059669',
    description: 'بهبود دیده‌شدن در جست‌وجو با سئوی فنی، محتوایی و برون‌صفحه‌ای و گزارش منظم.',
    roadmap: { phases: [
      phase('seo-1', 'شروع و خط پایه', 'وضعیت فعلی ثبت و اهداف قابل اندازه‌گیری تعیین می‌شوند.', [
        'دسترسی به Search Console، Analytics و پنل سایت',
        'ثبت وضعیت فعلی: ترافیک، رتبه‌ها و صفحات ایندکس‌شده',
        'تعیین اهداف و شاخص‌های کلیدی (KPI) با کارفرما',
      ]),
      phase('seo-2', 'تحقیق کلمات کلیدی و رقبا', 'جست‌وجوهای ارزشمند و فرصت‌های محتوایی شناسایی می‌شوند.', [
        'تحقیق کلمات کلیدی بر اساس هدف جست‌وجو',
        optional('تحلیل رقبا و شکاف محتوایی'),
        'نگاشت کلمات کلیدی به صفحات (Keyword Mapping)',
      ]),
      phase('seo-3', 'سئوی فنی', 'موتورهای جست‌وجو باید بتوانند سایت را سریع بخزند و درست ایندکس کنند.', [
        'بررسی خزش و ایندکس و رفع خطاهای Search Console',
        'نقشهٔ سایت XML، فایل robots.txt و تگ canonical',
        'Core Web Vitals: LCP زیر ۲٫۵ ثانیه، INP زیر ۲۰۰ میلی‌ثانیه و CLS زیر ۰٫۱',
        'سازگاری با موبایل و HTTPS',
        optional('داده‌های ساختاریافته (Schema) و رفع خطاهای آن'),
      ]),
      phase('seo-4', 'سئوی داخلی و محتوا', 'صفحات و محتوا برای کاربر و جست‌وجو بهینه می‌شوند.', [
        'بهینه‌سازی عنوان، توضیحات متا و ساختار سرتیترها',
        'لینک‌سازی داخلی خوشه‌ای',
        'برنامهٔ محتوا و نگارش بر پایهٔ تجربه، تخصص و اعتبار (E-E-A-T)',
        'بهینه‌سازی تصاویر و متن جایگزین',
      ]),
      phase('seo-5', 'سئوی برون‌صفحه‌ای و محلی', 'اعتبار سایت با پیوندهای طبیعی و حضور محلی تقویت می‌شود.', [
        optional('لینک‌سازی طبیعی و رپورتاژ در رسانه‌های معتبر'),
        optional('پروفایل Google Business Profile برای کسب‌وکار محلی'),
        optional('پایش بک‌لینک‌ها و رد پیوندهای مخرب'),
      ]),
      phase('seo-6', 'گزارش و بهبود مستمر', 'نتایج سنجیده و برنامهٔ دورهٔ بعد تنظیم می‌شود.', [
        'گزارش ماهانه بر اساس KPIها',
        optional('بازبینی و به‌روزرسانی محتوای کم‌بازده'),
        'تعیین اولویت‌های ماه بعد با کارفرما',
      ]),
    ] },
  },
  {
    key: 'uiux', name: 'تیم طراحی UI/UX', color: '#DB2777',
    description: 'از تحقیق کاربر تا طراحی نهایی و تحویل دقیق به تیم توسعه.',
    roadmap: { phases: [
      phase('ux-1', 'کشف و تحقیق', 'نیاز کسب‌وکار و رفتار کاربران پیش از طراحی شناخته می‌شود.', [
        'جلسه با ذی‌نفعان و تعریف اهداف محصول',
        'تحقیق کاربر: مصاحبه یا نظرسنجی با کاربران هدف',
        optional('تحلیل رقبا و الگوهای رایج'),
      ]),
      phase('ux-2', 'تعریف مسئله', 'یافته‌ها به ساختار و مسیرهای روشن تبدیل می‌شوند.', [
        'پرسونا و نقشهٔ سفر کاربر',
        'معماری اطلاعات و نقشهٔ صفحات (Sitemap)',
        'جریان‌های کاربری (User Flow) برای کارهای اصلی',
      ]),
      phase('ux-3', 'وایرفریم', 'چیدمان و اولویت محتوا پیش از طراحی بصری تأیید می‌شود.', [
        'وایرفریم کم‌جزئیات صفحات کلیدی',
        'بازبینی وایرفریم با کارفرما و ثبت بازخورد',
      ]),
      phase('ux-4', 'طراحی بصری و دیزاین سیستم', 'ظاهر نهایی بر پایهٔ یک سیستم طراحی یکپارچه ساخته می‌شود.', [
        'توکن‌های طراحی: رنگ، تایپوگرافی و فاصله‌ها',
        'کتابخانهٔ کامپوننت با همهٔ حالت‌ها (پیش‌فرض، هاور، فعال، غیرفعال، خطا)',
        'طراحی نهایی دسکتاپ و موبایل',
        'بررسی دسترس‌پذیری: کنتراست حداقل ۴٫۵ به ۱ و حالت فوکوس',
      ]),
      phase('ux-5', 'پروتوتایپ و تست', 'طرح پیش از توسعه با کاربران واقعی آزموده می‌شود.', [
        'پروتوتایپ تعاملی از جریان‌های اصلی',
        'تست کاربردپذیری با ۵ تا ۸ کاربر هدف',
        optional('اعمال اصلاحات حاصل از تست'),
      ]),
      phase('ux-6', 'تحویل به توسعه', 'تیم توسعه همهٔ جزئیات لازم برای پیاده‌سازی دقیق را دارد.', [
        'تحویل در Figma Dev Mode با مشخصات و همهٔ حالت‌ها',
        optional('خروجی آیکون‌ها، تصاویر و فونت‌ها'),
        'بازبینی طراحی پس از پیاده‌سازی (Design QA)',
      ]),
    ] },
  },
  {
    key: 'brand', name: 'تیم هویت بصری و گرافیک', color: '#EA580C',
    description: 'طراحی لوگو و نظام هویت بصری برند تا دفترچهٔ راهنما و فایل‌های نهایی.',
    roadmap: { phases: [
      phase('br-1', 'بریف و تحقیق', 'شخصیت برند و جهت‌گیری بصری روشن می‌شود.', [
        'بریف برند: ارزش‌ها، مخاطب و شخصیت برند',
        optional('تحلیل هویت بصری رقبا'),
        'مودبورد و جهت‌گیری بصری',
      ]),
      phase('br-2', 'کانسپت', 'ایده‌های متمایز ارائه و یکی انتخاب می‌شود.', [
        'ارائهٔ ۲ تا ۳ کانسپت متمایز لوگو',
        'انتخاب کانسپت و دور اصلاحات',
      ]),
      phase('br-3', 'نظام هویت', 'قواعد استفاده از لوگو، رنگ و قلم تثبیت می‌شوند.', [
        'نسخه‌های لوگو: افقی، عمودی، نشانه و تک‌رنگ',
        'فضای امن، حداقل اندازه و موارد استفادهٔ نادرست',
        'پالت رنگ با کدهای HEX، RGB، CMYK و Pantone',
        'تایپوگرافی فارسی و لاتین برند',
      ]),
      phase('br-4', 'کاربردها', 'هویت در اقلام پرکاربرد پیاده و آزموده می‌شود.', [
        optional('ست اداری: کارت ویزیت، سربرگ و پاکت'),
        optional('قالب‌های شبکه‌های اجتماعی و ارائه'),
        optional('تست چاپ و نمایش در اندازه‌های کوچک'),
      ]),
      phase('br-5', 'تحویل', 'فایل‌ها و راهنمای کامل برند تحویل داده می‌شود.', [
        'دفترچهٔ راهنمای هویت بصری (Brand Guideline)',
        'فایل‌های نهایی SVG، PDF، PNG و فایل‌های لایه‌باز',
        'دریافت تأییدیهٔ نهایی کارفرما',
      ]),
    ] },
  },
  {
    key: 'social', name: 'تیم محتوا و شبکه‌های اجتماعی', color: '#0891B2',
    description: 'مدیریت محتوا و شبکه‌های اجتماعی از شروع همکاری تا انتشار منظم و گزارش.',
    roadmap: { phases: [
      phase('so-1', 'شروع همکاری', 'دسترسی‌ها و نقش‌ها پیش از تولید محتوا روشن می‌شوند.', [
        'قرارداد و جلسهٔ شروع (Kickoff)',
        'دریافت دسترسی صفحات و فایل‌های برند',
        'تعیین مسئول تأیید نهایی و زمان پاسخ‌گویی',
      ]),
      phase('so-2', 'تحلیل و استراتژی', 'هدف، مخاطب و لحن محتوا تعیین می‌شود.', [
        optional('بررسی صفحات فعلی و رقبا'),
        'اهداف و KPI: دسترسی، تعامل و تبدیل',
        'ستون‌های محتوایی، لحن برند و مخاطب هدف',
      ]),
      phase('so-3', 'برنامهٔ محتوا', 'یک ماه محتوا پیش از اجرا برنامه‌ریزی و تأیید می‌شود.', [
        'تقویم محتوایی ۳۰ روزه',
        'تأیید تقویم توسط کارفرما',
      ]),
      phase('so-4', 'تولید و تأیید', 'محتوا ساخته، بازبینی و برای تأیید فرستاده می‌شود.', [
        'نگارش کپشن و متن‌ها',
        'طراحی تصاویر و تدوین ویدیو',
        'بازبینی داخلی و ارسال برای تأیید کارفرما',
      ]),
      phase('so-5', 'انتشار و تعامل', 'محتوا طبق برنامه منتشر و گفت‌وگوها مدیریت می‌شوند.', [
        'زمان‌بندی و انتشار طبق تقویم',
        optional('پاسخ به نظرات و پیام‌ها (مدیریت جامعه)'),
      ]),
      phase('so-6', 'گزارش و بهینه‌سازی', 'نتایج سنجیده و برنامهٔ دورهٔ بعد بهتر می‌شود.', [
        'گزارش منظم عملکرد (هفتگی یا ماهانه)',
        'تحلیل نتایج و تنظیم برنامهٔ دورهٔ بعد',
      ]),
    ] },
  },
];

/** A team's roadmap as stored, or an empty one when the team has none yet. */
export function teamRoadmap(team: any): TeamRoadmap {
  const phases = Array.isArray(team?.roadmap?.phases) ? team.roadmap.phases : [];
  return { phases: phases.filter((phase: any) => phase && typeof phase.title === 'string').map((phase: any) => ({
    id: String(phase.id), title: phase.title, description: typeof phase.description === 'string' ? phase.description : '',
    steps: (Array.isArray(phase.steps) ? phase.steps : []).filter((step: any) => step && typeof step.title === 'string')
      .map((step: any) => ({ id: String(step.id), title: step.title, required: step.required !== false })),
  })) };
}

export const roadmapStepCount = (roadmap: TeamRoadmap) => roadmap.phases.reduce((sum, phase) => sum + phase.steps.length, 0);

/** The checklists a project carries, newest team last. */
export function projectChecklists(project: any): TeamChecklist[] {
  return Array.isArray(project?.teamChecklists) ? project.teamChecklists.filter((row: any) => row && Array.isArray(row.phases)) : [];
}

export function checklistProgress(checklist: { phases: { steps: { completed?: boolean }[] }[] }) {
  const steps = checklist.phases.flatMap(phase => phase.steps);
  const done = steps.filter(step => step.completed).length;
  return { done, total: steps.length, percent: steps.length ? Math.round((done / steps.length) * 100) : 0 };
}

export function phaseProgress(phase: { steps: { completed?: boolean }[] }) {
  const done = phase.steps.filter(step => step.completed).length;
  return { done, total: phase.steps.length, complete: phase.steps.length > 0 && done === phase.steps.length, started: done > 0 };
}

/** A short random identifier for a new phase or step edited on the Teams page. */
export const roadmapId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;
