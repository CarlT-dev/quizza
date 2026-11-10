/**
 * Skeleton for MessagesPage — mirrors the real layout: header with "Messages"
 * title, white card container with message list item(s), and bottom navigation
 * bar with 5 tabs. Mounting is controlled by the parent's loading states.
 */
import React from 'react';
import { ChevronRight, Home, Search, BookOpen, MessageCircle, User } from 'lucide-react';

function SkeletonBase({ className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`relative overflow-hidden bg-gray-200 dark:bg-gray-700 ${className}`}
      style={{
        background: 'linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s infinite',
      }}
      {...props}
    />
  );
}

// Shimmer keyframes injected once
if (typeof document !== 'undefined' && !document.getElementById('skeleton-shimmer-messages')) {
  const style = document.createElement('style');
  style.id = 'skeleton-shimmer-messages';
  style.textContent = `
    @keyframes shimmer {
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
  `;
  document.head.appendChild(style);
}

export function MessagesPageSkeleton() {
  return (
    <div className="flex flex-col flex-1 animate-pulse">
      {/* Main Content Skeleton */}
      <main className="pb-20">
        <div className="max-w-[500px] mx-auto">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden">
            {Array.from({ length: 3 }).map((_, i) => (
              <button
                key={i}
                type="button"
                className="w-full flex items-center gap-3 px-4 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                disabled
                aria-hidden="true"
              >
                <span className="w-11 h-11 rounded-full skeleton flex-shrink-0" />
                <span className="flex-1 min-w-0">
                  <SkeletonBase className="block h-4 w-3/4 mb-1" />
                  <SkeletonBase className="block h-3 w-full" />
                </span>
                <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      </main>

      {/* Bottom Navigation Skeleton */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
        <div className="flex justify-around px-2 py-3">
          {[Home, Search, BookOpen, MessageCircle, User].map((Icon, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <Icon className="w-5 h-5 text-gray-400 skeleton flex-shrink-0" />
              <SkeletonBase className="w-16 h-2 flex-shrink-0" />
            </div>
          ))}
        </div>
      </nav>
    </div>
  );
}