import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import * as LucideIcons from 'lucide-react';

interface SubmenuScrollContainerProps {
  children: React.ReactNode;
}

export const SubmenuScrollContainer: React.FC<SubmenuScrollContainerProps> = ({ children }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);

  const checkScrollLimits = () => {
    const el = containerRef.current;
    if (!el) return;

    const { scrollTop, scrollHeight, clientHeight } = el;
    
    // We can scroll up if we are not at the very top (using a small 2px buffer)
    setCanScrollUp(scrollTop > 2);
    
    // We can scroll down if we haven't reached the bottom (using a small 2px buffer)
    setCanScrollDown(scrollTop + clientHeight < scrollHeight - 2);
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Check on initial load
    checkScrollLimits();

    // Attach scroll event listener
    el.addEventListener('scroll', checkScrollLimits, { passive: true });

    // Monitor resize events (e.g. content changing dynamically or section expanding)
    const resizeObserver = new ResizeObserver(() => {
      checkScrollLimits();
    });
    resizeObserver.observe(el);

    // Monitor DOM mutations inside the submenu to handle dynamic content additions
    const mutationObserver = new MutationObserver(() => {
      checkScrollLimits();
    });
    mutationObserver.observe(el, { childList: true, subtree: true });

    // Perform an additional check after a short delay to account for layout/framer transitions
    const timer = setTimeout(checkScrollLimits, 150);

    return () => {
      el.removeEventListener('scroll', checkScrollLimits);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      clearTimeout(timer);
    };
  }, [children]);

  return (
    <div className="relative w-full overflow-hidden rounded-2xl">
      {/* Top scroll indicator & subtle fade shadow */}
      <AnimatePresence>
        {canScrollUp && (
          <>
            {/* Top Fade Shadow - soft gray in light mode, soft deep dark in dark mode */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="absolute top-0 inset-x-0 h-8 bg-gradient-to-b from-slate-100/95 via-slate-100/40 to-transparent dark:from-[#07070b]/95 dark:via-[#07070b]/40 dark:to-transparent pointer-events-none z-10"
            />
            {/* Top Up Arrow - faint, premium floating up arrow */}
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="absolute top-1 left-1/2 -translate-x-1/2 z-20 pointer-events-none"
            >
              <motion.div
                animate={{ y: [0, -3, 0] }}
                transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                className="text-slate-400/80 dark:text-slate-500/80 shadow-glow"
              >
                <LucideIcons.ChevronUp size={11} className="stroke-[3]" />
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Internal Scroll Container (scrollbar-none to hide browser scrollbar) */}
      <div
        ref={containerRef}
        className="max-h-[160px] overflow-y-auto scrollbar-none scroll-smooth p-1.5 space-y-1"
      >
        {children}
      </div>

      {/* Bottom scroll indicator & subtle fade shadow */}
      <AnimatePresence>
        {canScrollDown && (
          <>
            {/* Bottom Fade Shadow - soft gray in light mode, soft deep dark in dark mode */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="absolute bottom-0 inset-x-0 h-8 bg-gradient-to-t from-slate-100/95 via-slate-100/40 to-transparent dark:from-[#07070b]/95 dark:via-[#07070b]/40 dark:to-transparent pointer-events-none z-10"
            />
            {/* Bottom Down Arrow - faint, premium floating down arrow */}
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="absolute bottom-1 left-1/2 -translate-x-1/2 z-20 pointer-events-none"
            >
              <motion.div
                animate={{ y: [0, 3, 0] }}
                transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
                className="text-slate-400/80 dark:text-slate-500/80 shadow-glow"
              >
                <LucideIcons.ChevronDown size={11} className="stroke-[3]" />
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
