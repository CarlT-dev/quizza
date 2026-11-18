import { Suspense, useState, useEffect, type ReactNode } from 'react';

/**
 * DelayedSuspense - Shows fallback only after a delay.
 *
 * On first visit: chunk loads, fallback shows after delayMs (default 200ms)
 * On subsequent visits: chunk is cached, loads instantly, NO fallback shows
 *
 * This prevents the "flash of loading skeleton" on cached route revisits.
 */
interface DelayedSuspenseProps {
  /** Fallback to show after delay */
  fallback: ReactNode;
  /** Child components (lazy-loaded routes) */
  children: ReactNode;
  /** Delay in ms before showing fallback (default: 200) */
  delayMs?: number;
}

export function DelayedSuspense({
  fallback,
  children,
  delayMs = 200
}: DelayedSuspenseProps) {
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowFallback(true), delayMs);
    return () => clearTimeout(timer);
  }, [delayMs]);

  return (
    <Suspense fallback={showFallback ? fallback : null}>
      {children}
    </Suspense>
  );
}