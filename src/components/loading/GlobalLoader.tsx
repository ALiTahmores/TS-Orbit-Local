import React from 'react';
import { PageLoadingBoundary } from './PageLoadingBoundary';
import { useLoading } from '../../context/LoadingContext';

export interface GlobalLoaderProps {
  forcedLoading?: boolean;
  message?: string;
  children?: React.ReactNode;
}

/**
 * GlobalLoader is maintained for backward compatibility.
 * In accordance with enterprise architectural constraints, it delegates
 * directly to the scoped PageLoadingBoundary rather than rendering a full-screen overlay.
 */
export const GlobalLoader: React.FC<GlobalLoaderProps> = ({ 
  forcedLoading, 
  message, 
  children 
}) => {
  const { isPageLoading, pageMessage } = useLoading();
  const active = forcedLoading !== undefined ? forcedLoading : isPageLoading;
  const displayMessage = message || pageMessage;

  return (
    <PageLoadingBoundary isLoading={active} message={displayMessage}>
      {children}
    </PageLoadingBoundary>
  );
};

export default GlobalLoader;
