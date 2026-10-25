import type { ReactNode } from 'react';
import { FooterNav } from './FooterNav';

interface LayoutProps {
  children: ReactNode;
  title?: string;
  showHeader?: boolean;
  showFooter?: boolean;
  showFooterNav?: boolean;
  minHeight?: boolean;
}

export function Layout({
  children,
  title = 'Quizza',
  showHeader = false,
  showFooter = false,
  showFooterNav = false,
  minHeight = true,
}: LayoutProps) {
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 md:flex md:justify-center">
      <main
        className={`relative w-full max-w-[500px] overflow-x-hidden bg-white pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] dark:bg-gray-900 ${minHeight ? 'min-h-screen' : 'min-h-[calc(100vh-env(safe-area-inset-top)-env(safe-area-inset-bottom))]'}`}
      >
        {/* Status bar safe area */}
        <div className="absolute inset-x-0 top-0 h-[env(safe-area-inset-top)] bg-white dark:bg-gray-900" />

        {showHeader && (
          <header className="sticky top-0 z-10 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700">
            <div className="px-4 py-3">
              <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 text-center">{title}</h1>
            </div>
          </header>
        )}

        {/* App content */}
        <div className="p-6 pb-20">{children}</div>

        {showFooter && (
          <footer className="absolute bottom-0 inset-x-0 p-4 border-t border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
            <p className="text-center text-sm text-gray-500 dark:text-gray-400">
              &copy; {new Date().getFullYear()} Quizza. All rights reserved.
            </p>
          </footer>
        )}

        {showFooterNav && <FooterNav />}

        {/* Home indicator safe area */}
        <div className="absolute inset-x-0 bottom-0 h-[env(safe-area-inset-bottom)] bg-white dark:bg-gray-900" />
      </main>
    </div>
  );
}