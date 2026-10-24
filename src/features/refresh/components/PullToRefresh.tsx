import { useRef, useEffect, useState, useCallback } from 'react';
import { usePullToRefresh } from '../hooks/usePullToRefresh';

interface PullToRefreshProps {
  children: React.ReactNode;
  onRefresh: () => Promise<void>;
  threshold?: number;
  resistance?: number;
}

export function PullToRefresh({
  children,
  onRefresh,
  threshold = 80,
  resistance = 2.5,
}: PullToRefreshProps) {
  const indicatorRef = useRef<HTMLDivElement>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Toast helper
  const showToast = useCallback((message: string, duration = 2000) => {
    setToast(message);
    setTimeout(() => setToast(null), duration);
  }, []);

  // Wrap onRefresh to show toast notifications
  const handleRefresh = useCallback(async () => {
    showToast('Refreshing...');
    try {
      await onRefresh();
      showToast('Refreshed!', 1500);
    } catch (error) {
      showToast('Refresh failed', 2000);
    }
  }, [onRefresh, showToast]);

  const {
    containerRef,
    pullDistance,
    isRefreshing,
    progress,
    handlers,
  } = usePullToRefresh({ onRefresh: handleRefresh, threshold, resistance });

  // Animate the indicator height/opacity based on progress
  useEffect(() => {
    if (indicatorRef.current) {
      indicatorRef.current.style.transform = `translateY(${-60 + pullDistance}px)`;
      indicatorRef.current.style.opacity = `${progress}`;
    }
  }, [pullDistance, progress]);

  return (
    <div
      ref={containerRef}
      {...handlers}
      className="relative min-h-screen overflow-auto"
      style={{
        touchAction: 'pan-y',
        overscrollBehaviorY: 'contain', // Disable native pull-to-refresh
      }}
    >
      {/* Pull to Refresh Indicator */}
      <div
        ref={indicatorRef}
        className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[500px] pointer-events-none z-10"
        style={{ transform: `translateX(-50%) translateY(${-60 + pullDistance}px)`, opacity: progress }}
      >
        <div className="flex items-center justify-center px-4 h-16">
          <div className="flex items-center gap-2 text-primary-600 dark:text-primary-400">
            {/* Spinner / Arrow */}
            <div className="relative w-5 h-5">
              {isRefreshing ? (
                <svg
                  className="animate-spin w-5 h-5 text-current"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              ) : (
                <svg
                  className="w-5 h-5 transition-transform duration-200"
                  style={{
                    transform: `rotate(${progress > 0.8 ? 180 : 0}deg)`,
                  }}
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="2.5"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 14l-7 7m0 0l-7-7m7 7V3"
                  />
                </svg>
              )}
            </div>
            <span className="text-sm font-medium">
              {isRefreshing
                ? 'Refreshing...'
                : progress >= 1
                ? 'Release to refresh'
                : 'Pull to refresh'}
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="relative pb-20">{children}</div>

      {/* Toast Notification */}
      {toast && (
        <div
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 animate-fade-in"
          role="alert"
          aria-live="polite"
        >
          <div className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-6 py-3 rounded-lg shadow-lg flex items-center gap-2">
            <span className="text-sm">{toast}</span>
          </div>
        </div>
      )}
    </div>
  );
}