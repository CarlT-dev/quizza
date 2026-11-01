import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/context/AuthContext';
import { Button } from '@/shared/components/ui';
import { Bell } from 'lucide-react';
import { HomePageSkeleton } from '../components/HomePageSkeleton';
import { SlidePanel } from '@/shared/components/ui/SlidePanel';
import { NotificationContent } from '../components/NotificationContent';
import { UserMenuContent } from '../components/UserMenuContent';

export function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Simulate initial load - replace with actual data fetching if needed
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 600);
    return () => clearTimeout(timer);
  }, []);

  const username = user?.displayName || user?.email?.split('@')[0] || 'User';
  const userInitial = username.charAt(0).toUpperCase();

  return (
    <div className="flex flex-col min-h-screen">
      {isLoading ? (
        <HomePageSkeleton />
      ) : (
        <>
          {/* Top Header */}
          <header className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
            {/* Left side: Logo */}
            <div className="flex items-end gap-2">
              <img
                src="/logo.png"
                alt="Quizza logo"
                className="w-10 h-10 object-contain"
              />
            </div>

            {/* Right side: Notification + User Avatar */}
            <div className="flex items-center gap-1">
              {/* Notification Button */}
              <Button
                variant="ghost"
                padding='none'
                className="p-1"
                onClick={() => setNotificationOpen(true)}
                aria-label="Notifications"
                aria-expanded={notificationOpen}
              >
                <Bell className="w-6 h-6 text-gray-700 dark:text-gray-300" />
              </Button>

              {/* User Avatar Button */}
              <Button
                variant="ghost"
                padding='none'
                className="p-1"
                onClick={() => setUserMenuOpen(true)}
                aria-label="User menu"
                aria-expanded={userMenuOpen}
              >
                <div className="w-10 h-10 border border-primary-50/80 rounded-full bg-primary-500 flex items-center justify-center text-white font-medium text-base">
                  {userInitial}
                </div>
              </Button>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 pb-20 bg-primary-50/30 dark:bg-gray-900">
            <div className="space-y-6 pt-2 px-4">
              {/* Create Quiz Card */}
              <div className="rounded-3xl overflow-hidden bg-gradient-to-br from-primary-400 to-primary-600 shadow-lg">
                <div className="p-6">
                  <h2 className="text-xl font-bold text-white">Create your Own Quiz</h2>
                  <p className="mt-2 text-white/90 text-sm">Build engaging quizzes in minutes with our intuitive editor</p>
                </div>
                <div className="bottom-0 left-0 right-0 p-4 pt-0 px-6 pb-6">
                  <Button
                    variant="secondary"
                    size="md"
                    radius="rounded"
                    className="sm:w-auto bg-white text-primary-500 hover:bg-primary-50 dark:bg-primary-100 dark:text-primary dark:border dark:border-white dark:hover:bg-primary-100"
                    onClick={() => navigate('/create-quiz')}
                  >
                    Create Quiz
                  </Button>
                </div>
              </div>
            </div>
          </main>

          {/* Notification Slide Panel */}
          <SlidePanel
            isOpen={notificationOpen}
            onClose={() => setNotificationOpen(false)}
            title="Notifications"
            width="w-full sm:w-[400px] lg:w-[480px]"
          >
            <NotificationContent />
          </SlidePanel>

          {/* User Menu Slide Panel */}
          <SlidePanel
            isOpen={userMenuOpen}
            onClose={() => setUserMenuOpen(false)}
            title="Account"
            width="w-full sm:w-[360px] lg:w-[400px]"
            className="flex flex-col"
          >
            <UserMenuContent />
          </SlidePanel>
        </>
      )}
    </div>
  );
}