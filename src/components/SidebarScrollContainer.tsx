import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronsUp, ChevronsDown } from 'lucide-react';

interface SidebarScrollContainerProps {
  children: React.ReactNode;
}

export const SidebarScrollContainer: React.FC<SidebarScrollContainerProps> = ({ children }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const checkScrollLimits = () => {
    const el = containerRef.current;
    if (!el) return;

    const { scrollTop, scrollHeight, clientHeight } = el;
    
    // Check if we can scroll up (with a small buffer)
    setCanScrollUp(scrollTop > 4);
    
    // Check if we can scroll down (with a small buffer)
    setCanScrollDown(scrollTop + clientHeight < scrollHeight - 4);
  };

  const handleScroll = () => {
    checkScrollLimits();
    
    // Set active scrolling state
    setIsScrolling(true);

    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    // Restore original opacity 300ms after scroll ceases
    scrollTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false);
    }, 300);
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Run initial check
    checkScrollLimits();

    el.addEventListener('scroll', handleScroll, { passive: true });

    // Monitor resize events in case content expands or collapses
    const resizeObserver = new ResizeObserver(() => {
      checkScrollLimits();
    });
    resizeObserver.observe(el);

    // Monitor inside DOM mutations
    const mutationObserver = new MutationObserver(() => {
      checkScrollLimits();
    });
    mutationObserver.observe(el, { childList: true, subtree: true });

    // Short delayed check to capture animations/transitions
    const timer = setTimeout(checkScrollLimits, 200);

    return () => {
      el.removeEventListener('scroll', handleScroll);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      clearTimeout(timer);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [children]);

  return (
    <div className="relative flex-1 flex flex-col overflow-hidden min-h-0 w-full">
      
      {/* Top scroll fade shadow */}
      <AnimatePresence>
        {canScrollUp && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="absolute top-0 inset-x-0 h-10 bg-gradient-to-b from-white via-white/30 to-transparent dark:from-[#0e0e15] dark:via-[#0e0e15]/30 dark:to-transparent pointer-events-none z-20"
          />
        )}
      </AnimatePresence>

      {/* Floating Top Indicator (Double Chevron) */}
      <AnimatePresence>
        {canScrollUp && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ 
              opacity: isScrolling ? 0.25 : 0.85, 
              y: 0, 
              scale: 1 
            }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ 
              opacity: { duration: 0.2, ease: 'easeInOut' },
              default: { duration: 0.3, ease: 'easeOut' }
            }}
            className="absolute top-3 left-1/2 -translate-x-1/2 z-30 pointer-events-none"
          >
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-white/80 dark:bg-[#14141d]/85 backdrop-blur-md border border-slate-200/40 dark:border-white/[0.08] shadow-[0_4px_12px_rgba(0,0,0,0.05)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.3)] text-slate-500 dark:text-slate-400">
              <motion.div
                animate={{ y: [0, -3, 0] }}
                transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
              >
                <ChevronsUp size={15} className="stroke-[2.5]" />
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actual Scrollable Container */}
      <div
        ref={containerRef}
        className="flex-1 py-4 px-3 space-y-6 overflow-y-auto overflow-x-hidden scrollbar-none scroll-smooth"
      >
        {children}
      </div>

      {/* Bottom scroll fade shadow */}
      <AnimatePresence>
        {canScrollDown && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="absolute bottom-0 inset-x-0 h-10 bg-gradient-to-t from-white via-white/30 to-transparent dark:from-[#0e0e15] dark:via-[#0e0e15]/30 dark:to-transparent pointer-events-none z-20"
          />
        )}
      </AnimatePresence>

      {/* Floating Bottom Indicator (Double Chevron) */}
      <AnimatePresence>
        {canScrollDown && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ 
              opacity: isScrolling ? 0.25 : 0.85, 
              y: 0, 
              scale: 1 
            }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ 
              opacity: { duration: 0.2, ease: 'easeInOut' },
              default: { duration: 0.3, ease: 'easeOut' }
            }}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 pointer-events-none"
          >
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-white/80 dark:bg-[#14141d]/85 backdrop-blur-md border border-slate-200/40 dark:border-white/[0.08] shadow-[0_4px_12px_rgba(0,0,0,0.05)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.3)] text-slate-500 dark:text-slate-400">
              <motion.div
                animate={{ y: [0, 3, 0] }}
                transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
              >
                <ChevronsDown size={15} className="stroke-[2.5]" />
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};
