import React from 'react';
import { cn } from '../../lib/utils';
import { LoaderSkeleton, type LoaderSkeletonProps } from '../ui/loaders-skeleton';

/*
 * Loading skeletons shaped like each page: the same cards, grids, rows and
 * breakpoints, so the page fills in where its placeholders stood. A page and
 * its skeleton should change together.
 */

// Blocks narrow with the screen; squares and circles (icons, avatars) keep their shape.
const Bone: React.FC<LoaderSkeletonProps> = ({ borderRadius = 8, className, ...props }: LoaderSkeletonProps) => <LoaderSkeleton borderRadius={borderRadius} className={cn('max-w-full min-w-0', typeof props.width === 'number' && props.width === props.height && 'shrink-0', className)} {...props} />;
const Line: React.FC<{ w?: number | string; h?: number; className?: string }> = ({ w = '100%', h = 12, className }) => <Bone width={w} height={h} borderRadius={6} className={className} />;
const Circle: React.FC<{ size: number; className?: string }> = ({ size, className }) => <Bone width={size} height={size} borderRadius={9999} className={className} />;
const Pill: React.FC<{ w: number; h?: number; className?: string }> = ({ w, h = 24, className }) => <Bone width={w} height={h} borderRadius={9999} className={className} />;
const Card: React.FC<{ className?: string; children?: React.ReactNode; style?: React.CSSProperties }> = ({ className, children, style }) => (
  <div className={cn('rounded-3xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#0d121f] shadow-sm', className)} style={style}>{children}</div>
);
const documentDirection = () => (typeof document !== 'undefined' && document.documentElement.dir === 'ltr' ? 'ltr' : 'rtl');

const SkeletonPage = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div role="status" aria-busy="true" aria-live="polite" className={cn('w-full space-y-6 text-start pointer-events-none select-none', className)}>
    {children}
    <span className="sr-only">در حال بارگذاری…</span>
  </div>
);

/** Title, description and the page's main actions. */
const PageHeader = ({ actions = [140], icon = false, badge = false, title = 220, subtitle = 360 }: { actions?: number[]; icon?: boolean; badge?: boolean; title?: number; subtitle?: number }) => (
  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
    <div className="space-y-2.5 min-w-0">
      <div className="flex items-center gap-2">
        {icon && <Bone width={24} height={24} />}
        <Line w={title} h={22} />
        {badge && <Pill w={84} h={22} />}
      </div>
      <Line w={subtitle} h={12} />
    </div>
    {actions.length > 0 && <div className="flex items-center gap-3">{actions.map((width, index) => <Bone key={index} width={width} height={44} borderRadius={14} />)}</div>}
  </div>
);

/** A page's own row of section pills (projects, reports). */
const SectionPills = ({ widths }: { widths: number[] }) => (
  <div className="flex items-center gap-2 overflow-hidden">{widths.map((width, index) => <Bone key={index} width={width} height={38} borderRadius={12} />)}</div>
);

/** Icon, title and one line, as at the top of most cards. */
const CardTitle = ({ icon = 36, title = 160, subtitle = 220, action }: { icon?: number; title?: number; subtitle?: number; action?: number }) => (
  <div className="flex items-start justify-between gap-3">
    <div className="flex items-center gap-3 min-w-0">
      {icon > 0 && <Bone width={icon} height={icon} borderRadius={12} />}
      <div className="space-y-2 min-w-0"><Line w={title} h={14} /><Line w={subtitle} h={10} /></div>
    </div>
    {action && <Bone width={action} height={30} borderRadius={10} />}
  </div>
);

const KpiCards = ({ count = 4 }: { count?: number }) => (
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
    {Array.from({ length: count }, (_, index) => (
      <Card key={index} className="p-5 space-y-4">
        <div className="flex items-center justify-between gap-2"><Line w={110} h={12} /><Bone width={34} height={34} borderRadius={10} /></div>
        <Line w={80} h={26} />
        <Bone height={6} borderRadius={9999} />
      </Card>
    ))}
  </div>
);

/** A data table: header row, then rows whose first cell has an icon and two lines. */
const TableSkeleton = ({ columns = 5, rows = 5, className }: { columns?: number; rows?: number; className?: string }) => {
  const template = { gridTemplateColumns: `minmax(0,2fr) repeat(${columns - 1}, minmax(0,1fr))` };
  return (
    <div className={cn('rounded-2xl border border-slate-200/80 dark:border-slate-800/80 overflow-hidden', className)}>
      <div className="grid items-center gap-4 px-4 h-11 bg-slate-50 dark:bg-slate-900/50" style={template}>
        {Array.from({ length: columns }, (_, index) => <Line key={index} w={index === 0 ? 110 : 64} h={10} className={index > 1 ? 'hidden sm:block' : ''} />)}
      </div>
      {Array.from({ length: rows }, (_, row) => (
        <div key={row} className="grid items-center gap-4 px-4 py-3.5 border-t border-slate-100 dark:border-slate-800/70" style={template}>
          <div className="flex items-center gap-3 min-w-0"><Bone width={32} height={32} borderRadius={10} /><div className="space-y-2 min-w-0 flex-1"><Line w={150} h={12} /><Line w={96} h={10} /></div></div>
          {Array.from({ length: columns - 1 }, (_, cell) => (
            cell === columns - 2
              ? <div key={cell} className="hidden sm:flex items-center gap-2">{[0, 1, 2].map(index => <Bone key={index} width={28} height={28} borderRadius={8} />)}</div>
              : <div key={cell} className={cell > 0 ? 'hidden sm:block' : ''}>{cell % 2 ? <Pill w={78} h={24} /> : <Line w={70} h={10} />}</div>
          ))}
        </div>
      ))}
    </div>
  );
};

/** A list card: rows with an icon, two lines and a trailing note. */
const ListRows = ({ rows = 5, icon = 40 }: { rows?: number; icon?: number }) => (
  <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
    {Array.from({ length: rows }, (_, index) => (
      <div key={index} className="flex items-center gap-4 p-4">
        <Bone width={icon} height={icon} borderRadius={12} />
        <div className="flex-1 min-w-0 space-y-2"><Line w="62%" h={13} /><Line w="38%" h={10} /></div>
        <Line w={56} h={10} />
      </div>
    ))}
  </div>
);

/** Page title and description with the page's own actions (dashboard kit layout). */
const KitHeader = ({ actions = [120], eyebrow = true }: { actions?: number[]; eyebrow?: boolean }) => (
  <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
    <div className="space-y-2.5 min-w-0">{eyebrow && <Line w={110} h={10} />}<Line w={220} h={24} /><Line w={420} h={12} /></div>
    {actions.length > 0 && <div className="flex flex-wrap items-center gap-2">{actions.map((width, index) => <Bone key={index} width={width} height={40} borderRadius={12} />)}</div>}
  </div>
);
/** The tinted figure tiles at the top of a page. */
const TileRow = ({ count = 4 }: { count?: number }) => (
  <div className={cn('grid grid-cols-2 gap-4', count === 5 ? 'lg:grid-cols-5' : 'xl:grid-cols-4')}>
    {Array.from({ length: count }, (_, index) => (
      <div key={index} className="rounded-2xl p-5 space-y-4 bg-slate-100/80 dark:bg-slate-800/40">
        <div className="flex items-center justify-between"><Line w={90} h={12} /><Bone width={16} height={16} borderRadius={4} /></div>
        <Line w={70} h={26} /><Line w={130} h={10} />
      </div>
    ))}
  </div>
);
/** A panel of rows: a marker, two lines and a trailing value. */
const PanelRows = ({ rows = 5, className, tabs = false }: { rows?: number; className?: string; tabs?: boolean }) => (
  <div className={cn('rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#0d121f] p-5 space-y-4', className)}>
    <div className="flex items-center justify-between"><div className="space-y-2"><Line w={130} h={14} /><Line w={220} h={10} /></div><Bone width={70} height={14} borderRadius={6} /></div>
    {tabs && <Bone width={320} height={40} borderRadius={12} />}
    {Array.from({ length: rows }, (_, index) => (
      <div key={index} className="flex items-center gap-3 py-1"><Circle size={8} /><div className="flex-1 min-w-0 space-y-2"><Line w="55%" h={12} /><Line w="35%" h={10} /></div><Line w={60} h={10} /></div>
    ))}
  </div>
);

// ---------------------------------------------------------------- Dashboard

export const DashboardSkeleton: React.FC = () => {
  const direction = documentDirection();
  return (
    <SkeletonPage>
      <KitHeader actions={[110, 208, 120]} />
      <TileRow />
      {/* The analytics row keeps the chart on the physical left, as the page does. */}
      <div className="grid grid-cols-12 gap-6" style={{ direction: 'ltr' }}>
        <Card className="col-span-12 lg:col-span-8 p-6 space-y-6" style={{ direction }}>
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="space-y-2.5"><Line w={90} h={10} /><Line w={260} h={22} /><Line w={300} h={12} /></div>
            <div className="flex items-center gap-2"><Bone width={230} height={38} borderRadius={14} /><Bone width={32} height={32} borderRadius={10} /></div>
          </div>
          <Bone height={220} borderRadius={16} />
        </Card>
        <Card className="col-span-12 lg:col-span-4 p-6 flex flex-col gap-5" style={{ direction }}>
          <div className="space-y-2.5"><Line w={90} h={10} /><Line w={160} h={20} /></div>
          <Circle size={170} className="mx-auto my-2" />
          <div className="grid grid-cols-2 gap-3">{Array.from({ length: 4 }, (_, index) => <Bone key={index} height={34} borderRadius={12} />)}</div>
        </Card>
      </div>
      <div className="grid grid-cols-12 gap-6">
        <PanelRows tabs rows={5} className="col-span-12 xl:col-span-7" />
        <div className="col-span-12 xl:col-span-5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#0d121f] p-5 space-y-5">
          <div className="space-y-2"><Line w={120} h={14} /><Line w={180} h={10} /></div>
          {[0, 1, 2, 3].map(index => <div key={index} className="space-y-2.5"><div className="flex justify-between"><Line w={150} h={12} /><Pill w={70} h={22} /></div><Bone height={6} borderRadius={9999} /><Line w={200} h={10} /></div>)}
        </div>
      </div>
      <div className="grid grid-cols-12 gap-6">
        <PanelRows rows={5} className="col-span-12 lg:col-span-6 xl:col-span-4" />
        <PanelRows rows={4} className="col-span-12 lg:col-span-6 xl:col-span-4" />
        <PanelRows rows={4} className="col-span-12 xl:col-span-4" />
      </div>
    </SkeletonPage>
  );
};

// ---------------------------------------------------------------- Projects

const FolderTiles = () => (
  <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-5 space-y-4">
    <CardTitle icon={32} title={170} subtitle={260} />
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[0, 1, 2, 3].map(index => (
        <div key={index} className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 h-[170px] flex flex-col items-center justify-center gap-3 p-4">
          <Bone width={80} height={60} borderRadius={12} /><Line w={110} h={13} /><Line w={80} h={10} />
        </div>
      ))}
    </div>
  </div>
);

const ProjectsSkeleton = ({ subTab }: { subTab: string }) => (
  <SkeletonPage>
    <SectionPills widths={[130, 150, 130, 160]} />
    <Card className="p-5 sm:p-6 space-y-6">
      <div className="flex items-center gap-2"><Line w={50} h={10} /><Line w={80} h={10} /><Line w={70} h={10} /></div>
      {subTab === 'overview' && <div className="flex items-center gap-2"><Bone width={110} height={30} borderRadius={10} /><Bone width={170} height={30} borderRadius={10} /></div>}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <CardTitle icon={44} title={210} subtitle={300} />
        <Bone width={120} height={40} borderRadius={12} />
      </div>
      {subTab === 'files' ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }, (_, index) => <div key={index} className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-3 space-y-3"><Bone height={90} borderRadius={12} /><Line w="70%" h={12} /><Line w="45%" h={10} /></div>)}
        </div>
      ) : subTab === 'clients' ? (
        <div className="space-y-3">{[0, 1, 2, 3].map(index => <div key={index} className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-4 space-y-3"><div className="flex items-center justify-between"><CardTitle icon={32} title={150} subtitle={90} /><Pill w={70} h={22} /></div><Line w="85%" h={10} /><Line w="60%" h={10} /></div>)}</div>
      ) : subTab === 'tasks' ? (
        <>
          <div className="flex flex-col sm:flex-row gap-3"><Bone height={40} borderRadius={12} className="sm:flex-1" /><Bone width={150} height={40} borderRadius={12} /><Bone width={150} height={40} borderRadius={12} /></div>
          <TableSkeleton columns={6} rows={6} />
        </>
      ) : (
        <>
          <FolderTiles />
          <TableSkeleton columns={5} rows={4} />
        </>
      )}
    </Card>
  </SkeletonPage>
);

/** Specialists and other people pages: a grid of member cards. */
const PeopleSkeleton = () => (
  <SkeletonPage>
    <KitHeader eyebrow={false} actions={[110, 120]} />
    <TileRow />
    <div className="flex flex-col xl:flex-row gap-3"><Bone height={40} borderRadius={12} className="xl:flex-1" /><div className="flex gap-2"><Bone width={240} height={40} borderRadius={12} /><Bone width={144} height={40} borderRadius={12} /></div></div>
    <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#0d121f] overflow-hidden">
      <div className="hidden lg:flex h-11 px-5 items-center gap-6 bg-slate-50 dark:bg-slate-900/50">{[120, 60, 60, 80, 50, 90, 70].map((width, index) => <Line key={index} w={width} h={10} />)}</div>
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="px-5 py-4 flex items-center gap-4 border-t border-slate-100 dark:border-slate-800/70">
          <Circle size={38} /><div className="w-40 space-y-2"><Line w={120} h={12} /><Line w={90} h={10} /></div>
          <div className="hidden lg:flex flex-1 items-center justify-between gap-6">{[30, 30, 30, 40].map((width, cell) => <Line key={cell} w={width} h={14} />)}<div className="w-40 space-y-2"><Line w={80} h={10} /><Bone height={6} borderRadius={9999} /></div><Line w={60} h={10} /></div>
        </div>
      ))}
    </div>
  </SkeletonPage>
);

// ---------------------------------------------------------------- Tasks

const TaskCardSkeleton: React.FC = () => (
  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
    <div className="flex items-center justify-between"><Pill w={52} h={16} /><Pill w={40} h={16} /></div>
    <Line w="78%" h={14} /><Line w="55%" h={10} />
    <Bone height={26} borderRadius={8} />
    <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Circle size={20} /><Line w={60} h={10} /></div><Line w={70} h={10} /></div>
  </div>
);

/** Kanban columns, laid out like the board: one column per screen width on phones. */
const KanbanColumns = ({ columns = 4, cards = 3 }: { columns?: number; cards?: number }) => (
  <div className="overflow-hidden -mx-4 px-4 sm:mx-0 sm:px-0">
    <div className={cn('grid gap-3 sm:gap-4', columns === 3 ? 'grid-cols-1 md:grid-cols-3' : 'grid-flow-col auto-cols-[82%] sm:auto-cols-[minmax(15rem,1fr)]')}>
      {Array.from({ length: columns }, (_, column) => (
        <div key={column} className="rounded-2xl border border-slate-200/60 dark:border-slate-700/60 bg-slate-100/70 dark:bg-slate-800/50 p-3.5 space-y-3">
          <div className="flex items-center justify-between pb-3 mb-1 border-b border-slate-200/50 dark:border-slate-700/60"><Line w={80} h={14} /><Pill w={56} h={18} /></div>
          {Array.from({ length: cards }, (_, index) => <TaskCardSkeleton key={index} />)}
        </div>
      ))}
    </div>
  </div>
);

const TasksSkeleton = ({ subTab }: { subTab: string }) => (
  <SkeletonPage>
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
      <div className="flex items-center gap-2 overflow-hidden"><Bone width={150} height={40} borderRadius={12} /><Bone width={170} height={40} borderRadius={12} /><Bone width={160} height={40} borderRadius={12} /></div>
      <Bone width={140} height={40} borderRadius={12} />
    </div>
    {subTab === 'team_matrix' ? (
      <>
        <div className="flex items-center gap-2"><Bone width={110} height={34} borderRadius={10} /><Bone width={110} height={34} borderRadius={10} /></div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div className="space-y-2"><Line w={120} h={16} /><Line w={320} h={10} /></div><div className="flex gap-2"><Bone width={200} height={38} borderRadius={12} /><Bone width={110} height={38} borderRadius={12} /></div></div>
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }, (_, index) => (
            <Card key={index} className="p-5 space-y-4">
              <div className="flex items-start gap-3"><Bone width={44} height={44} borderRadius={12} /><div className="space-y-2 flex-1"><Line w="60%" h={14} /><Line w="40%" h={10} /></div></div>
              <Line w="100%" h={10} /><Line w="70%" h={10} />
              <div className="grid grid-cols-3 gap-2">{[0, 1, 2].map(cell => <Bone key={cell} height={46} borderRadius={10} />)}</div>
              <div className="flex items-center justify-between"><Line w={60} h={10} /><Line w={50} h={10} /></div>
            </Card>
          ))}
        </div>
      </>
    ) : subTab === 'timeline' ? (
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between"><Line w={160} h={16} /><div className="flex gap-2"><Bone width={36} height={36} borderRadius={10} /><Bone width={36} height={36} borderRadius={10} /></div></div>
        <div className="grid grid-cols-7 gap-2">{Array.from({ length: 7 }, (_, index) => <Line key={index} w="60%" h={10} className="mx-auto" />)}</div>
        <div className="grid grid-cols-7 gap-2">{Array.from({ length: 35 }, (_, index) => <Bone key={index} height={56} borderRadius={10} />)}</div>
      </Card>
    ) : (
      <>
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#0d121f] p-3 flex flex-col sm:flex-row gap-3">
          <Bone height={40} borderRadius={12} className="sm:flex-1" />
          <div className="hidden sm:flex gap-3"><Bone width={150} height={40} borderRadius={12} /><Bone width={150} height={40} borderRadius={12} /><Bone width={150} height={40} borderRadius={12} /></div>
        </div>
        <KanbanColumns />
      </>
    )}
  </SkeletonPage>
);

const PersonalTasksSkeleton = () => (
  <SkeletonPage>
    <PageHeader title={130} subtitle={280} actions={[220, 120]} />
    <Card className="p-5 space-y-3"><div className="flex items-center justify-between"><Line w={140} h={16} /><Line w={90} h={10} /></div><Bone height={44} borderRadius={12} /></Card>
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
      <div className="flex items-center gap-2"><Line w={100} h={16} /><Pill w={56} h={20} /></div>
      <div className="flex items-center gap-2 overflow-hidden">{[64, 56, 70, 56, 64].map((width, index) => <Pill key={index} w={width} h={30} />)}</div>
      <div className="flex items-center gap-2"><Bone width={90} height={32} borderRadius={10} /><Bone width={90} height={32} borderRadius={10} /><Bone width={90} height={32} borderRadius={10} /></div>
    </div>
    <KanbanColumns columns={3} cards={2} />
  </SkeletonPage>
);

// ---------------------------------------------------------------- Reports

const RoadmapSkeleton = () => (
  <Card className="p-5 sm:p-7 space-y-6">
    <div className="p-2 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/80 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
      <div className="flex items-center gap-1.5 overflow-hidden">{[150, 140, 120, 140, 130].map((width, index) => <Bone key={index} width={width} height={36} borderRadius={12} />)}</div>
      <Bone width={220} height={36} borderRadius={12} />
    </div>
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
      <div className="flex items-start gap-2"><Bone width={36} height={36} borderRadius={12} /><div className="space-y-2.5"><div className="flex items-center gap-2"><Line w={220} h={20} /><Pill w={80} h={20} /></div><Line w={380} h={12} /></div></div>
      <Bone width={190} height={52} borderRadius={12} />
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><Circle size={8} /><Line w={160} h={12} /></div><div className="flex gap-2"><Bone width={110} height={26} borderRadius={8} /><Bone width={130} height={26} borderRadius={8} /></div></div>
    <div className="border-t border-slate-100 dark:border-slate-800" />
    {[0, 1, 2].map(phase => (
      <div key={phase} className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-4 space-y-4">
        <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Circle size={22} /><Pill w={50} h={20} /><Line w={200} h={14} /></div><Pill w={64} h={20} /></div>
        <Line w={260} h={10} />
        {phase === 0 && [0, 1, 2].map(step => <div key={step} className="flex items-center justify-between ps-6"><div className="flex items-center gap-2"><Circle size={16} /><Line w={230} h={12} /></div><Pill w={60} h={20} /></div>)}
      </div>
    ))}
  </Card>
);

const ReportsSkeleton = ({ subTab }: { subTab: string }) => (
  <SkeletonPage>
    <SectionPills widths={[130, 140, 130, 140]} />
    {subTab === 'roadmap' ? <RoadmapSkeleton /> : subTab === 'bottlenecks' ? (
      <>
        <TileRow count={5} />
        <div className="grid grid-cols-12 gap-6">
          <PanelRows rows={6} className="col-span-12 xl:col-span-8" />
          <div className="col-span-12 xl:col-span-4 space-y-6"><PanelRows rows={3} /><PanelRows rows={4} /></div>
        </div>
      </>
    ) : subTab === 'timeline' ? (
      <>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3"><div className="flex gap-2"><Bone width={180} height={40} borderRadius={12} /><Bone width={170} height={40} borderRadius={12} /></div><Bone width={256} height={40} borderRadius={12} /></div>
        <Card className="p-5 space-y-4">
          <div className="space-y-2"><Line w={160} h={14} /><Line w={360} h={10} /></div>
          <div className="grid grid-cols-7 sm:grid-cols-14 gap-2">{Array.from({ length: 14 }, (_, index) => <div key={index} className="flex flex-col items-center gap-2 py-2"><Line w={14} h={10} /><Bone width={20} height={24 + (index * 7) % 40} borderRadius={6} /><Line w={14} h={10} /></div>)}</div>
        </Card>
        {[0, 1].map(group => <div key={group} className="space-y-2"><Line w={90} h={12} /><PanelRows rows={3} /></div>)}
      </>
    ) : (
      <>
        <Card className="p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-3"><Pill w={210} h={24} /><Line w={290} h={26} /><Line w={440} h={12} /><Line w={360} h={12} /></div>
          <Bone width={190} height={46} borderRadius={14} />
        </Card>
        <KpiCards />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/60">{[90, 60, 70, 60].map((width, index) => <Bone key={index} width={width} height={30} borderRadius={10} />)}</div>
          <div className="flex gap-2"><Bone width={160} height={34} borderRadius={10} /><Bone width={130} height={34} borderRadius={10} /></div>
        </div>
        <Card className="p-2"><ListRows rows={4} /></Card>
      </>
    )}
  </SkeletonPage>
);

/** Report pages built from figures and charts (team performance). */
const AnalyticsSkeleton = () => (
  <SkeletonPage>
    <KitHeader eyebrow={false} actions={[180]} />
    <TileRow />
    <div className="grid grid-cols-12 gap-6">
      <PanelRows rows={6} className="col-span-12 xl:col-span-7" />
      <div className="col-span-12 xl:col-span-5 space-y-6"><PanelRows rows={4} /><Card className="p-5"><Bone height={150} borderRadius={12} /></Card></div>
    </div>
    <Card className="p-5"><TableSkeleton columns={6} rows={4} /></Card>
  </SkeletonPage>
);

// ---------------------------------------------------------------- Chat

const ChatSkeleton = () => (
  <SkeletonPage>
    <Card className="overflow-hidden flex flex-col h-[calc(100dvh-13rem)] min-h-[480px]">
      <div className="h-16 px-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3"><Bone width={34} height={34} borderRadius={10} /><Line w={140} h={16} /></div>
        <div className="flex items-center gap-2"><Pill w={64} h={24} /><Bone width={84} height={30} borderRadius={10} /></div>
      </div>
      <div className="flex flex-1 min-h-0">
        <div className="w-full md:w-80 shrink-0 border-e border-slate-100 dark:border-slate-800 p-3 space-y-3">
          <div className="flex justify-end"><Bone width={30} height={30} borderRadius={8} /></div>
          <Bone height={38} borderRadius={12} />
          <Bone height={36} borderRadius={12} />
          <Bone height={34} borderRadius={10} />
          {Array.from({ length: 5 }, (_, index) => <div key={index} className="px-2 py-2.5 space-y-2"><Line w="80%" h={12} /><Line w="45%" h={10} /></div>)}
        </div>
        <div className="hidden md:flex flex-1 flex-col justify-between p-6">
          <div className="space-y-4">
            <Bone width="46%" height={54} borderRadius={18} />
            <Bone width="38%" height={44} borderRadius={18} className="ms-auto" />
            <Bone width="52%" height={64} borderRadius={18} />
            <Bone width="30%" height={40} borderRadius={18} className="ms-auto" />
          </div>
          <Bone height={48} borderRadius={16} />
        </div>
      </div>
    </Card>
  </SkeletonPage>
);

// ---------------------------------------------------------------- Settings, notifications, administration

const SettingsSkeleton = () => (
  <SkeletonPage>
    <div className="space-y-2.5"><Line w={110} h={26} /><Line w={320} h={12} /></div>
    <div className="flex items-center gap-6 border-b border-slate-200/80 dark:border-slate-800 pb-3 overflow-hidden">{[70, 90, 60, 90, 70, 50, 60].map((width, index) => <Line key={index} w={width} h={14} />)}</div>
    <Card className="p-6 space-y-2">
      <div className="flex items-center justify-between gap-4 pb-4"><div className="space-y-2"><Line w={60} h={18} /><Line w={240} h={10} /></div><Bone width={120} height={40} borderRadius={12} /></div>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-5 border-t border-slate-100 dark:border-slate-800">
        <div className="space-y-2"><Line w={90} h={14} /><Line w={220} h={10} /></div>
        <div className="grid grid-cols-3 gap-3 w-full md:w-auto">{[0, 1, 2].map(index => <Bone key={index} width={170} height={50} borderRadius={14} />)}</div>
      </div>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-5 border-t border-slate-100 dark:border-slate-800">
        <div className="space-y-2"><Line w={110} h={14} /><Line w={200} h={10} /></div>
        <Bone width={300} height={42} borderRadius={12} />
      </div>
    </Card>
  </SkeletonPage>
);

const NotificationsSkeleton = () => (
  <SkeletonPage>
    <KitHeader eyebrow={false} actions={[110, 120]} />
    <div className="grid grid-cols-12 gap-6">
      <div className="col-span-12 xl:col-span-8 space-y-4">
        <Bone width={480} height={40} borderRadius={12} />
        {[0, 1].map(section => <div key={section} className="space-y-2"><Line w={60} h={12} /><Card className="p-2"><ListRows rows={3} icon={36} /></Card></div>)}
      </div>
      <PanelRows rows={5} className="col-span-12 xl:col-span-4" />
    </div>
  </SkeletonPage>
);

const OrgBuilderSkeleton = () => (
  <SkeletonPage>
    <div className="space-y-2.5"><Line w={240} h={26} /><Line w={420} h={12} /></div>
    <div className="flex items-center gap-6 border-b border-slate-200/80 dark:border-slate-800 pb-3 overflow-hidden">{[90, 70, 60, 70].map((width, index) => <div key={index} className="flex items-center gap-2"><Line w={width} h={14} /><Pill w={20} h={18} /></div>)}</div>
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"><Line w={360} h={12} /><Bone width={130} height={40} borderRadius={12} /></div>
    <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#0d121f] p-5 space-y-3">
          <CardTitle icon={40} title={140} subtitle={90} />
          <Line w="90%" h={10} />
          <div className="flex gap-2">{[60, 70, 50].map((width, cell) => <Pill key={cell} w={width} h={22} />)}</div>
        </div>
      ))}
    </div>
  </SkeletonPage>
);

const ApprovalsSkeleton = () => (
  <SkeletonPage>
    <Card className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <CardTitle icon={40} title={300} subtitle={380} />
      <Bone width={150} height={40} borderRadius={12} />
    </Card>
    <KpiCards />
    <div className="flex items-center gap-6 border-b border-slate-200/80 dark:border-slate-800 pb-3 overflow-hidden">{[130, 150, 160].map((width, index) => <Line key={index} w={width} h={14} />)}</div>
    <Card className="p-5 space-y-4">
      <div className="flex flex-col md:flex-row gap-3"><Bone height={40} borderRadius={12} className="md:flex-1" /><Bone width={280} height={38} borderRadius={12} /></div>
      <TableSkeleton columns={6} rows={4} />
    </Card>
  </SkeletonPage>
);

const ProfileSkeleton = () => (
  <SkeletonPage>
    <Card className="p-6 flex items-center gap-5"><Circle size={80} /><div className="space-y-2.5"><Line w={170} h={20} /><Line w={120} h={12} /><Pill w={90} h={22} /></div></Card>
    <div className="grid md:grid-cols-2 gap-6">
      {[0, 1].map(card => <Card key={card} className="p-6 space-y-5"><Line w={140} h={16} />{[0, 1, 2, 3].map(field => <div key={field} className="space-y-2"><Line w={90} h={10} /><Bone height={42} borderRadius={12} /></div>)}</Card>)}
    </div>
  </SkeletonPage>
);

/** Department and module pages, and any page without a closer match. */
const GenericSkeleton = () => (
  <SkeletonPage>
    <PageHeader actions={[140]} />
    <KpiCards />
    <Card className="p-5"><TableSkeleton columns={5} rows={5} /></Card>
  </SkeletonPage>
);

/** The skeleton for the page a tab and sub-tab open. */
/** Backlog and sprints: header, view switch, then sprint sections of task rows. */
export const SprintsSkeleton: React.FC = () => (
  <div className="space-y-5" aria-busy="true">
    <KitHeader actions={[220, 130]} eyebrow={false} />
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3"><Bone width={330} height={40} borderRadius={12} /><div className="flex gap-2"><Bone width={260} height={40} borderRadius={12} /><Bone width={120} height={40} borderRadius={12} /></div></div>
    {[4, 3, 5].map((rows, index) => (
      <div key={index} className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#0d121f] p-5 space-y-3">
        <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><Bone width={28} height={28} borderRadius={8} /><div className="space-y-2"><Line w={160} h={14} /><Line w={220} h={10} /></div></div><div className="flex gap-1">{[0, 1, 2].map(cell => <Bone key={cell} width={28} height={24} borderRadius={6} />)}</div></div>
        {Array.from({ length: rows }, (_, row) => <div key={row} className="flex items-center gap-3 py-1.5"><Bone width={44} height={20} borderRadius={6} /><Line w="45%" h={12} /><div className="ms-auto flex items-center gap-2"><Pill w={64} h={22} /><Bone width={24} height={24} borderRadius={9999} /><Bone width={44} height={28} borderRadius={6} /></div></div>)}
      </div>
    ))}
  </div>
);
export const PageSkeleton: React.FC<{ tab: string; subTab?: string }> = ({ tab, subTab = '' }) => {
  if (tab === 'dashboard') return <DashboardSkeleton />;
  if (tab === 'projects') return subTab === 'team' ? <PeopleSkeleton /> : <ProjectsSkeleton subTab={subTab || 'overview'} />;
  if (tab === 'tasks') return subTab === 'sprints' ? <SprintsSkeleton /> : <TasksSkeleton subTab={subTab || 'kanban_board'} />;
  if (tab === 'personal_tasks') return <PersonalTasksSkeleton />;
  if (tab === 'dept_tech') return <ReportsSkeleton subTab={subTab} />;
  if (tab === 'reports') return <AnalyticsSkeleton />;
  if (tab === 'chat' || tab === 'messages') return <ChatSkeleton />;
  if (tab === 'settings') return <SettingsSkeleton />;
  if (tab === 'notifications') return <NotificationsSkeleton />;
  if (tab === 'org_builder') return subTab === 'org_permissions' ? <GenericSkeleton /> : <OrgBuilderSkeleton />;
  if (tab === 'approvals') return <ApprovalsSkeleton />;
  if (tab === 'profile') return <ProfileSkeleton />;
  return <GenericSkeleton />;
};

/** A block inside a card or dialog that is still loading. */
export const SectionSkeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div role="status" aria-busy="true" className={cn('w-full space-y-3 p-2 text-start', className)}>
    <div className="flex items-center gap-3"><Bone width={36} height={36} borderRadius={10} /><div className="flex-1 space-y-2"><Line w="50%" h={12} /><Line w="32%" h={10} /></div></div>
    <Line w="100%" h={10} /><Line w="86%" h={10} /><Line w="64%" h={10} />
    <span className="sr-only">در حال بارگذاری…</span>
  </div>
);

/** The page this browser tab was last on, so a reload shows that page's skeleton. */
const lastView = (): { tab: string; subTab: string } => {
  try {
    const view = JSON.parse(sessionStorage.getItem('orbit_current_view') || 'null');
    if (view && typeof view.tab === 'string') return { tab: view.tab, subTab: typeof view.subTab === 'string' ? view.subTab : '' };
  } catch { /* storage unavailable */ }
  return { tab: 'dashboard', subTab: '' };
};

/** The theme the signed-in workspace will open in; the document has none yet. */
const savedDarkTheme = (): boolean => {
  try {
    const user = JSON.parse(localStorage.getItem('currentUser') || 'null');
    const settings = user?.id ? JSON.parse(localStorage.getItem('userSettings_' + user.id) || '{}') : {};
    const theme = settings.theme || localStorage.getItem('wp_manager_theme') || 'light';
    return theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  } catch { return false; }
};

/**
 * The workspace frame (sidebar, top bar, phone tab bar) around a page skeleton,
 * shown while a stored sign-in is confirmed and the workspace code loads.
 */
export const AppShellSkeleton: React.FC = () => {
  const view = lastView();
  const direction = documentDirection();
  return (
    <div className={cn('h-screen max-h-screen bg-bg-app flex overflow-hidden', savedDarkTheme() && 'dark')} dir={direction}>
      <aside className="hidden lg:flex flex-col w-72 shrink-0 my-6 ms-6 me-3 h-[calc(100vh-48px)] rounded-[24px] border border-gray-200/70 dark:border-[#1E2235] bg-white dark:bg-[#111322] shadow-2xl p-5 gap-4">
        <div className="flex items-center gap-3"><Bone width={36} height={36} borderRadius={10} /><div className="space-y-2"><Line w={80} h={14} /><Line w={120} h={10} /></div></div>
        <Bone height={36} borderRadius={12} />
        {[2, 2, 2].map((items, section) => (
          <div key={section} className="space-y-3 pt-2">
            <Line w={60} h={10} />
            {Array.from({ length: items }, (_, index) => <div key={index} className="flex items-center gap-3 px-2"><Bone width={36} height={36} borderRadius={12} /><Line w={90} h={13} /></div>)}
          </div>
        ))}
        <Bone height={64} borderRadius={18} className="mt-auto" />
      </aside>
      <div className="flex-1 flex flex-col min-w-0 h-full lg:h-[calc(100vh-48px)] lg:my-6">
        <div className="h-16 mt-4 mb-2 mx-4 md:mx-6 lg:mt-0 rounded-2xl border border-gray-200/70 dark:border-[#1E2235] bg-white/80 dark:bg-[#111322] px-4 md:px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5"><Bone width={32} height={32} borderRadius={10} /><Bone width={300} height={36} borderRadius={12} className="hidden sm:block" /></div>
          <div className="flex items-center gap-2">{[0, 1, 2, 3].map(index => <Bone key={index} width={36} height={36} borderRadius={12} className={index > 1 ? 'hidden sm:block' : ''} />)}</div>
        </div>
        <div className="flex-1 min-h-0 overflow-hidden px-4 md:px-6 pt-2 md:pt-4">
          <PageSkeleton tab={view.tab} subTab={view.subTab} />
        </div>
      </div>
      <div className="lg:hidden fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] start-4 end-4 h-16 rounded-2xl border border-slate-200/80 dark:border-white/5 bg-white/90 dark:bg-[#1A1A24]/90 flex justify-around items-center px-2">
        {[0, 1, 2, 3, 4].map(index => <div key={index} className="flex flex-col items-center gap-1.5"><Bone width={22} height={22} borderRadius={6} /><Line w={32} h={8} /></div>)}
      </div>
    </div>
  );
};

/** The client portal's frame: top bar, project summary and figures. */
export const PortalSkeleton: React.FC = () => (
  <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
    <div className="border-b border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/90">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3"><Bone width={40} height={40} borderRadius={12} /><div className="space-y-2"><Line w={160} h={14} /><Line w={100} h={10} /></div></div>
        <div className="flex items-center gap-2"><Bone width={36} height={36} borderRadius={10} /><Bone width={36} height={36} borderRadius={10} /></div>
      </div>
    </div>
    <div className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 space-y-6">
      <SkeletonPage>
        <Card className="p-6 space-y-3"><Line w={220} h={22} /><Line w="80%" h={12} /><Line w="60%" h={12} /><Bone height={8} borderRadius={9999} /></Card>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[0, 1, 2, 3].map(index => <Card key={index} className="p-4 space-y-3"><Line w={90} h={10} /><Line w={60} h={22} /></Card>)}</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{[0, 1].map(index => <Card key={index} className="p-5 space-y-3"><Line w={140} h={14} /><Line w="90%" h={10} /><Line w="70%" h={10} /></Card>)}</div>
      </SkeletonPage>
    </div>
  </div>
);
