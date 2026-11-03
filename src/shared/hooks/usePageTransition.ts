import { useLocation } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';

type SlideDirection = 'left' | 'right' | 'none';

interface PageTransitionState {
  direction: SlideDirection;
  isTransitioning: boolean;
}

/**
 * Tab order matching FooterNav items.
 * Pages NOT in this map (detail pages like /quiz/:id, /user/:uid) are treated as "push" from right.
 */
const TAB_INDEX: Record<string, number> = {
  '/': 0,
  '/search': 1,
  '/quizzes': 2,
  '/status': 3,
} as const;

/**
 * Get slide direction based on tab spatial order.
 * - Tab → Tab: direction by index (right in tab bar = slide left)
 * - Tab → Detail: slide left (push)
 * - Detail → Tab/Detail: slide right (pop)
 */
function getSlideDirection(fromPath: string, toPath: string): SlideDirection {
  const fromIdx = TAB_INDEX[fromPath as keyof typeof TAB_INDEX] ?? -1;
  const toIdx = TAB_INDEX[toPath as keyof typeof TAB_INDEX] ?? -1;

  // Both are tab pages: use spatial order
  if (fromIdx !== -1 && toIdx !== -1) {
    if (toIdx === fromIdx) return 'none';
    return toIdx > fromIdx ? 'left' : 'right';
  }

  // To is a detail page (not in tab bar): push from right
  if (toIdx === -1) return 'left';

  // From is a detail page, going back to tab: pop from right
  return 'right';
}

/**
 * Hook to track page navigation and compute slide direction based on tab order.
 */
export function usePageTransition(): PageTransitionState {
  const location = useLocation();

  const [direction, setDirection] = useState<SlideDirection>('none');
  const [isTransitioning, setIsTransitioning] = useState(false);
  const previousPathRef = useRef<string>('/');
  const isInitialMount = useRef(true);

  useEffect(() => {
    const currentPath = location.pathname;

    if (isInitialMount.current) {
      isInitialMount.current = false;
      previousPathRef.current = currentPath;
      return;
    }

    // Ignore hash/query changes, only care about pathname
    if (currentPath === previousPathRef.current) {
      return;
    }

    const slideDirection = getSlideDirection(previousPathRef.current, currentPath);

    // Trigger transition
    setDirection(slideDirection);
    setIsTransitioning(true);

    // Update ref AFTER computing direction
    previousPathRef.current = currentPath;

    // Reset transition state after animation completes
    const timer = setTimeout(() => {
      setIsTransitioning(false);
      setDirection('none');
    }, 300); // Match CSS animation duration

    return () => clearTimeout(timer);
  }, [location.pathname]);

  return { direction, isTransitioning };
}

/**
 * Get the slide transform value based on direction and whether page is entering/exiting
 */
export function getSlideTransform(direction: SlideDirection, isExiting: boolean): string {
  if (direction === 'none') return 'translateX(0)';

  if (direction === 'left') {
    // Slide left: entering from right, exiting to left
    return isExiting ? 'translateX(-100%)' : 'translateX(100%)';
  } else {
    // Slide right: entering from left, exiting to right
    return isExiting ? 'translateX(100%)' : 'translateX(-100%)';
  }
}