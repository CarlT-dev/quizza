import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/context/AuthContext';
import { Button } from '@/shared/components/ui';
import { Bell, X } from 'lucide-react';

export function HomePage() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [notificationOpen, setNotificationOpen] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning,';
    if (hour < 17) return 'Good afternoon,';
    return 'Good evening,';
  };

  const username = user?.displayName || user?.email?.split('@')[0] || 'User';

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
        if (buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
          setNotificationOpen(false);
        }
      }
    };

    if (notificationOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = '';
    };
  }, [notificationOpen]);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Top Section */}
      <header className="flex items-center justify-between px-2 py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        {/* Left side: Avatar + Greeting + Username */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary-500 flex items-center justify-center text-white font-medium text-lg">
            {username.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">{getGreeting()}</p>
            <p className="text-base font-semibold text-text-primary dark:text-gray-100">{username}</p>
          </div>
        </div>

        {/* Right side: Notification button */}
        <Button
          ref={buttonRef}
          variant="ghost"
          size="sm"
          className="pr-2 pl-2"
          onClick={() => setNotificationOpen(!notificationOpen)}
          aria-label="Notifications"
          aria-expanded={notificationOpen}
        >
          <Bell className="w-6 h-6 text-text-primary dark:text-gray-300" />
        </Button>
      </header>

      {/* Main Content */}
      <main className="flex-1 pb-20">
        <div className="space-y-6 pt-2 px-6">
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
                className="sm:w-auto bg-white text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-100"
                onClick={() => navigate('/create-quiz')}
              >
                Create Quiz
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-white/20"
                onClick={handleLogout}
              >
                Logout
              </Button>
            </div>
          </div>
        </div>
      </main>

      {/* Notification Sidebar - slides from right edge */}
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 ease-in-out ${
          notificationOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setNotificationOpen(false)}
        aria-hidden="true"
      />
      {/* Sidebar panel */}
      <aside
        ref={sidebarRef}
        className={`fixed right-0 top-0 h-full w-[320px] max-w-full bg-white dark:bg-gray-800 shadow-xl z-50 transform transition-transform duration-300 ease-in-out ${
          notificationOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        role="dialog"
        aria-label="Notifications"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Notifications</h3>
          <Button
            variant="ghost"
            size="sm"
            className="p-1"
            onClick={() => setNotificationOpen(false)}
            aria-label="Close notifications"
          >
            <X className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {/* Empty container - ready for content */}
        </div>
      </aside>
    </div>
  );
}