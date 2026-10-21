import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { StrandsLoaderVariant } from '../components/loading/StrandsLoader';

export interface LoadingOptions {
  type?: StrandsLoaderVariant;
  id?: string;
  message?: string;
  loading?: boolean;
  minDurationMs?: number;
}

export interface LoadingContextType {
  isPageLoading: boolean;
  pageMessage?: string;
  isTransitionLoading: boolean;
  transitionMessage?: string;
  isNavigating: boolean;
  showPageLoader: (message?: string) => void;
  hidePageLoader: () => void;
  triggerPageTransition: (durationMs?: number, message?: string) => void;
  startNavigationTransition: (callback: () => void, durationMs?: number) => void;
  showSectionLoader: (id: string) => void;
  hideSectionLoader: (id: string) => void;
  isSectionLoading: (id: string) => boolean;
  showModalLoader: (id?: string) => void;
  hideModalLoader: (id?: string) => void;
  isModalLoading: (id?: string) => boolean;
  setLoading: (options: LoadingOptions) => void;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export const LoadingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isPageLoading, setIsPageLoading] = useState(false);
  const [pageMessage, setPageMessage] = useState<string | undefined>(undefined);
  const [isTransitionLoading, setIsTransitionLoading] = useState(false);
  const [transitionMessage, setTransitionMessage] = useState<string | undefined>(undefined);
  const [isNavigating, setIsNavigating] = useState(false);
  const [activeSections, setActiveSections] = useState<Record<string, boolean>>({});
  const [activeModals, setActiveModals] = useState<Record<string, boolean>>({});

  const pageTimerRef = useRef<NodeJS.Timeout | null>(null);
  const transitionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const navTimerRef = useRef<NodeJS.Timeout | null>(null);

  const showPageLoader = useCallback((message?: string) => {
    if (pageTimerRef.current) clearTimeout(pageTimerRef.current);
    setPageMessage(message);
    setIsPageLoading(true);
  }, []);

  const hidePageLoader = useCallback(() => {
    if (pageTimerRef.current) clearTimeout(pageTimerRef.current);
    setIsPageLoading(false);
    setPageMessage(undefined);
  }, []);

  const triggerPageTransition = useCallback((durationMs = 200, message?: string) => {
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    setTransitionMessage(message);
    setIsTransitionLoading(true);
    transitionTimerRef.current = setTimeout(() => {
      setIsTransitionLoading(false);
      setTransitionMessage(undefined);
    }, durationMs);
  }, []);

  const startNavigationTransition = useCallback((callback: () => void, durationMs = 180) => {
    if (navTimerRef.current) clearTimeout(navTimerRef.current);
    setIsNavigating(true);
    callback();
    navTimerRef.current = setTimeout(() => {
      setIsNavigating(false);
    }, durationMs);
  }, []);

  const showSectionLoader = useCallback((id: string) => {
    if (!id) return;
    setActiveSections((prev) => ({ ...prev, [id]: true }));
  }, []);

  const hideSectionLoader = useCallback((id: string) => {
    if (!id) return;
    setActiveSections((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const isSectionLoading = useCallback(
    (id: string) => !!activeSections[id],
    [activeSections]
  );

  const showModalLoader = useCallback((id = 'default') => {
    setActiveModals((prev) => ({ ...prev, [id]: true }));
  }, []);

  const hideModalLoader = useCallback((id = 'default') => {
    setActiveModals((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const isModalLoading = useCallback(
    (id = 'default') => !!activeModals[id],
    [activeModals]
  );

  const setLoading = useCallback(
    ({ type = 'section', id = 'default', message, loading = true }: LoadingOptions) => {
      if (type === 'page') {
        if (loading) showPageLoader(message);
        else hidePageLoader();
      } else if (type === 'modal') {
        if (loading) showModalLoader(id);
        else hideModalLoader(id);
      } else {
        if (loading) showSectionLoader(id);
        else hideSectionLoader(id);
      }
    },
    [showPageLoader, hidePageLoader, showModalLoader, hideModalLoader, showSectionLoader, hideSectionLoader]
  );

  return (
    <LoadingContext.Provider
      value={{
        isPageLoading,
        pageMessage,
        isTransitionLoading,
        transitionMessage,
        isNavigating,
        showPageLoader,
        hidePageLoader,
        triggerPageTransition,
        startNavigationTransition,
        showSectionLoader,
        hideSectionLoader,
        isSectionLoading,
        showModalLoader,
        hideModalLoader,
        isModalLoading,
        setLoading
      }}
    >
      {children}
    </LoadingContext.Provider>
  );
};

export const useLoading = () => {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return context;
};

export default LoadingContext;
