/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {portalAddress} from './lib/portal';
import { ProjectProvider, useProject } from './context/ProjectContext';
import { LoadingProvider } from './components/loading/LoadingProvider';
import { Layout } from './components/Layout';
import { DashboardView } from './components/DashboardView';
import { AuthPortal } from './components/AuthPortal';
import { ClientPortalPage } from './components/ClientPortalPage';
import ClickSpark from './components/ui/ClickSpark';
import { SmartRefreshNotifier } from './components/common/SmartRefreshNotifier';
import { useSmartRefresh } from './hooks/useSmartRefresh';

function AppContent() {
  const { isAuthenticated, currentUser, refreshAllData } = useProject();
  const [address,setAddress]=React.useState(()=>window.location.href);
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
    <LoadingProvider>
      <ProjectProvider>
        <AppWithSpark />
      </ProjectProvider>
    </LoadingProvider>
  );
}

function AppWithSpark() {
  const { theme } = useProject();
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
      <AppContent />
    </ClickSpark>
  );
}

