/**
 * Skeleton for HomePage — mirrors the real layout: header, CTA card,
 * unfinished rows and For You feed cards. Mounting is controlled by the
 * parent's isLoading (the old internal 800ms self-hide could blank the page
 * behind a slower real fetch).
 */
export function HomePageSkeleton() {
  return (
    <div className="flex flex-col min-h-screen animate-pulse">
      {/* Header Skeleton */}
      <header className="flex items-center justify-between px-4 py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        {/* Left: Logo */}
        <div className="flex items-end gap-2">
          <div className="w-10 h-10 rounded-full skeleton" />
        </div>

        {/* Right: Notification + avatar buttons */}
        <div className="flex items-center gap-1">
          <div className="w-8 h-8 rounded-full skeleton" />
          <div className="w-10 h-10 rounded-full skeleton" />
        </div>
      </header>

      {/* Main Content Skeleton */}
      <main className="flex-1 pb-20">
        <div className="space-y-6 pt-2 px-4">
          {/* Create Quiz Card Skeleton */}
          <div className="rounded-3xl overflow-hidden skeleton-gradient shadow-lg">
            <div className="p-6">
              <div className="h-6 w-3/4 skeleton-rounded mb-2" />
              <div className="h-4 w-5/6 skeleton-rounded" />
            </div>
            <div className="bottom-0 left-0 right-0 p-4 pt-0 px-6 pb-6 space-y-3">
              <div className="h-11 w-full max-w-xs skeleton-rounded" />
              <div className="h-9 w-full max-w-xs skeleton-rounded" />
            </div>
          </div>

          {/* Unfinished rows skeleton */}
          <div className="space-y-2" aria-hidden="true">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-3"
              >
                <SkeletonBase className="w-11 h-11 rounded-xl flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <SkeletonBase className="h-4 w-3/4 rounded" />
                  <SkeletonBase className="h-2 w-full rounded-full" />
                  <SkeletonBase className="h-3 w-1/2 rounded" />
                </div>
              </div>
            ))}
          </div>

          {/* For You feed cards skeleton */}
          <div className="space-y-3" aria-hidden="true">
            {Array.from({ length: 2 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl overflow-hidden bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
              >
                <SkeletonBase className="h-[76px]" />
                <div className="px-4 py-2.5">
                  <SkeletonBase className="h-3 w-1/3 rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

/**
 * Reusable skeleton primitives with shimmer
 */
function SkeletonBase({ className = '', style = {}, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`relative overflow-hidden bg-gray-200 dark:bg-gray-700 ${className}`}
      style={{
        background: 'linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s infinite',
        ...style,
      }}
      {...props}
    />
  );
}

// Shimmer keyframes injected once
if (typeof document !== 'undefined' && !document.getElementById('skeleton-shimmer')) {
  const style = document.createElement('style');
  style.id = 'skeleton-shimmer';
  style.textContent = `
    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
    .dark @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
    .skeleton {
      background: linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
    }
    .dark .skeleton {
      background: linear-gradient(90deg, #374151 25%, #4b5563 50%, #374151 75%);
      background-size: 200% 100%;
    }
    .skeleton-rounded {
      border-radius: 0.5rem;
    }
    .skeleton-gradient {
      background: linear-gradient(135deg, #93c5fd 25%, #60a5fa 50%, #93c5fd 75%);
      background-size: 200% 200%;
      animation: shimmer-gradient 2s infinite;
    }
    .dark .skeleton-gradient {
      background: linear-gradient(135deg, #1e3a5f 25%, #1e40af 50%, #1e3a5f 75%);
      background-size: 200% 200%;
    }
    @keyframes shimmer-gradient {
      0% { background-position: 200% 200%; }
      50% { background-position: 0% 0%; }
      100% { background-position: 200% 200%; }
    }
  `;
  document.head.appendChild(style);
}

export { SkeletonBase };