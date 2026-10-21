import React from 'react';
import { LoadingProvider as CoreLoadingProvider, useLoading } from '../../context/LoadingContext';
import PageLoadingBoundary from './PageLoadingBoundary';
import SectionLoadingBoundary from './SectionLoadingBoundary';
import SectionLoader from './SectionLoader';
import StrandsLoader from './StrandsLoader';
import LoadingOverlay from './LoadingOverlay';
import LoadingButton from './LoadingButton';

export const LoadingProvider: React.FC<{ 
  children: React.ReactNode; 
}> = ({
  children
}) => {
  return (
    <CoreLoadingProvider>
      {children}
    </CoreLoadingProvider>
  );
};

export { 
  useLoading, 
  PageLoadingBoundary, 
  SectionLoadingBoundary, 
  SectionLoader, 
  StrandsLoader, 
  LoadingOverlay, 
  LoadingButton
};

export default LoadingProvider;
