import React from 'react';
import { PublicClientPortal } from './PublicClientPortal';

interface ClientPortalPageProps {
  projectId?: string;
  tokenParam?: string;
  onClosePreview?: () => void;
  isPreview?: boolean;
}

export const ClientPortalPage: React.FC<ClientPortalPageProps> = ({
  projectId,
  tokenParam,
  onClosePreview,
  isPreview = false
}) => {
  return (
    <div className="w-full min-h-screen bg-slate-950 text-slate-100 font-['Vazirmatn'] dir-rtl">
      <PublicClientPortal
        projectIdParam={projectId}
        tokenParam={tokenParam}
        onClosePreview={onClosePreview}
        isPreview={isPreview}
      />
    </div>
  );
};

export default ClientPortalPage;
