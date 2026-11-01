import { useEffect, useState } from 'react';

/**
 * Semi-high fidelity skeleton for HomePage
 * Mirrors the actual layout structure with shimmer animation
 */
export function HomePageSkeleton() {
  const [showSkeleton, setShowSkeleton] = useState(true);

  // Minimum display time to prevent flash (optional)
  useEffect(() => {
    const timer = setTimeout(() => setShowSkeleton(false), 800);
    return () => clearTimeout(timer);
  }, []);

  if (!showSkeleton) return null;

  return (
    <div className="flex flex-col min-h-screen animate-pulse">
      {/* Header Skeleton */}
      <header className="flex items-center justify-between px-4 py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        {/* Left: Avatar + Greeting + Username */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full skeleton" />
          <div className="space-y-1">
            <div className="h-3 w-32 skeleton rounded" />
            <div className="h-4 w-24 skeleton rounded font-medium" />
          </div>
        </div>

        {/* Right: Notification button */}
        <div className="w-10 h-10 rounded-full skeleton" />
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