/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense } from 'react';
import {portalAddress} from './lib/portal';
import { lazyNamed } from './lib/lazy';
import { acceptPendingInvite, captureInviteFromUrl } from './lib/pendingInvite';
import { ProjectProvider, useProject } from './context/ProjectContext';
import { LoadingProvider } from './components/loading/LoadingProvider';
import ClickSpark from './components/ui/ClickSpark';
import { BrandLogo } from './components/common/BrandLogo';
import { SmartRefreshNotifier } from './components/common/SmartRefreshNotifier';
import { useSmartRefresh } from './hooks/useSmartRefresh';

// The sign-in page, the public client portal and the workspace shell are separate
// entry points; visitors download only the one they open.
const Layout = lazyNamed(() => import('./components/Layout'), 'Layout');
const DashboardView = lazyNamed(() => import('./components/DashboardView'), 'DashboardView');
const AuthPortal = lazyNamed(() => import('./components/AuthPortal'), 'AuthPortal');
const ClientPortalPage = lazyNamed(() => import('./components/ClientPortalPage'), 'ClientPortalPage');

const ScreenFallback = () => (
  <div className="min-h-screen w-full flex items-center justify-center bg-bg-app" role="status" aria-busy="true">
    <span className="h-8 w-8 rounded-full border-2 border-brand-accent/30 border-t-brand-accent animate-spin" />
    <span className="sr-only">در حال بارگذاری…</span>
  </div>
);

class AppErrorBoundary extends React.Component<{ children?: React.ReactNode }, { failed: boolean }> {
  declare readonly props: { children?: React.ReactNode };
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error('TS Orbit could not render the current release.', error);
  }

  private retry = () => {
    const next = new URL(window.location.href);
    next.searchParams.set('__orbit_release', String(Date.now()));
    window.location.replace(next.toString());
  };

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="min-h-screen w-full flex items-center justify-center bg-bg-app p-6">
        <section className="w-full max-w-md rounded-2xl border border-border-primary bg-bg-surface p-8 text-center shadow-xl">
          <BrandLogo className="w-12 h-12 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-text-primary">بارگذاری برنامه کامل نشد</h1>
          <p className="mt-3 text-sm leading-7 text-text-secondary">
            نسخهٔ تازه را دریافت می‌کنیم. اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.
          </p>
          <button type="button" onClick={this.retry} className="mt-6 rounded-xl bg-brand-accent px-5 py-3 text-sm font-semibold text-white">
            تلاش دوباره
          </button>
        </section>
      </main>
    );
  }
}

// A stored sign-in that the server could not confirm yet (offline, or a cold start
// that kept failing). The sign-in is kept; the visitor decides when to try again.
const SessionOffline = ({ onRetry }: { onRetry: () => void }) => (
  <main className="min-h-screen w-full flex items-center justify-center bg-bg-app p-6">
    <section className="w-full max-w-md rounded-2xl border border-border-primary bg-bg-surface p-8 text-center shadow-xl">
      <BrandLogo className="w-12 h-12 mx-auto mb-4" />
      <h1 className="text-xl font-bold text-text-primary">ارتباط با سرور برقرار نشد</h1>
      <p className="mt-3 text-sm leading-7 text-text-secondary">
        ورود شما محفوظ است. اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.
      </p>
      <button type="button" onClick={onRetry} className="mt-6 rounded-xl bg-brand-accent px-5 py-3 text-sm font-semibold text-white">
        تلاش دوباره
      </button>
    </section>
  </main>
);

function AppContent() {
  const { isAuthenticated, currentUser, refreshAllData, sessionStatus, retrySession } = useProject();
  // Captured before the sign-in page renders, so it can tell the visitor about the invite.
  const [inviteCode] = React.useState(captureInviteFromUrl);
  const [address,setAddress]=React.useState(()=>window.location.href);
  React.useEffect(() => {
    if (isAuthenticated && currentUser?.id && inviteCode) void acceptPendingInvite(inviteCode).catch(() => undefined);
  }, [isAuthenticated, currentUser?.id, inviteCode]);
  React.useEffect(()=>{const changed=()=>setAddress(window.location.href);window.addEventListener('popstate',changed);window.addEventListener('hashchange',changed);return()=>{window.removeEventListener('popstate',changed);window.removeEventListener('hashchange',changed);};},[]);

  // Task 2: Smart Data Refresh Notification System
  const {
    hasPendingUpdate,
    pendingUpdate,
    isRefreshing,
    triggerRefresh,
    dismissUpdate
  } = useSmartRefresh({
    onRefresh: refreshAllData,
    checkIntervalMs: 45000,
    enabled: isAuthenticated
  });

  // Public Guest Client Portal Access via direct SPA query parameters or token
  const addressURL=new URL(address);
  const urlParams = addressURL.searchParams;
  const viewMode = urlParams.get('view');
  const targetProjectId = urlParams.get('projectId');
  const portalToken=portalAddress(address).token;

  const isClientPortal = viewMode === 'client' || urlParams.has('portalToken') || urlParams.has('token') || !!portalToken || addressURL.pathname.includes('/portal');

  if (isClientPortal) {
    return (
      <ClientPortalPage 
        projectId={targetProjectId || undefined}
        tokenParam={portalToken}
      />
    );
  }

  if (!isAuthenticated && sessionStatus === 'checking') return <ScreenFallback />;
  if (!isAuthenticated && sessionStatus === 'offline') return <SessionOffline onRetry={retrySession} />;
  if (!isAuthenticated) {
    return <AuthPortal />;
  }

  // Block accounts by their actual status; local users own their workspace.
  if (currentUser?.isActive === false || ['pending', 'rejected', 'blocked'].includes(currentUser?.approvalStatus)) {
    return <AuthPortal />;
  }

  return (
    <>
      <Layout>
        <DashboardView />
      </Layout>
      <SmartRefreshNotifier
        hasPendingUpdate={hasPendingUpdate}
        pendingUpdate={pendingUpdate}
        isRefreshing={isRefreshing}
        onRefresh={triggerRefresh}
        onDismiss={dismissUpdate}
      />
    </>
  );
}

export default function App() {
  return (
    <AppErrorBoundary>
      <LoadingProvider>
        <ProjectProvider>
          <Suspense fallback={<ScreenFallback />}>
            <AppWithSpark />
          </Suspense>
        </ProjectProvider>
      </LoadingProvider>
    </AppErrorBoundary>
  );
}

function AppWithSpark() {
  const { theme, locale } = useProject();
  const isDarkMode = typeof document !== 'undefined'
    ? document.documentElement.classList.contains('dark') || (theme === 'dark' || (theme === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches))
    : false;
  const sparkColor = isDarkMode ? '#ffffff' : '#2563eb';

  return (
    <ClickSpark
      sparkColor={sparkColor}
      sparkSize={6}
      sparkRadius={16}
      sparkCount={8}
      duration={350}
    >
      {/* A language switch renders the interface afresh, so text, numbers and
          dates are all produced in the new language. */}
      <AppContent key={locale} />
    </ClickSpark>
  );
}

