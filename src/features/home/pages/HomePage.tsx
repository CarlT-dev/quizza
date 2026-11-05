import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/context/AuthContext';
import {
  getUserAttempts,
  getQuizzesByIds,
  type QuizDocument,
  type QuizProgress,
} from '@/features/quiz';
import { UnfinishedQuizCard } from '@/features/quizzes/components/UnfinishedQuizCard';
import { Button } from '@/shared/components/ui';
import { Bell } from 'lucide-react';
import { HomePageSkeleton } from '../components/HomePageSkeleton';
import { SlidePanel } from '@/shared/components/ui/SlidePanel';
import { NotificationContent } from '../components/NotificationContent';
import { UserMenuContent } from '../components/UserMenuContent';
import {
  getLastSeenNotificationsAt,
  markNotificationsSeen,
  useNotifications,
} from '@/features/notifications';

const MAX_UNFINISHED = 3;

export function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Notification feed for the bell's red dot; the panel's own copy lives in
  // NotificationContent (fresh per open).
  const { notifications, refetch: refetchNotifications } = useNotifications();
  // Per-device "seen" marker — localStorage on purpose: opening the panel in
  // THIS browser clears the dot here only.
  const [lastSeenMs, setLastSeenMs] = useState(() => getLastSeenNotificationsAt());

  // Unfinished attempts ("continue where you left off")
  const [unfinished, setUnfinished] = useState<Array<{ quiz: QuizDocument; progress: QuizProgress }>>([]);

  // Real initial load (replaces the old fake 600ms timer)
  useEffect(() => {
    let cancelled = false;

    // Deferred so setIsLoading isn't a synchronous effect setState
    // (react(set-state-in-effect)) — same pattern as the quiz data hooks.
    void Promise.resolve().then(async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        const attempts = await getUserAttempts(user.uid);
        if (cancelled) return;

        // In-progress attempts: started but not completed, newest first
        const unfinishedAttempts = attempts
          .filter(a => !a.completed && a.answeredCount > 0)
          .sort((a, b) => b.lastAttemptAt.toMillis() - a.lastAttemptAt.toMillis())
          .slice(0, MAX_UNFINISHED);
        const unfinishedQuizzes = unfinishedAttempts.length > 0
          ? await getQuizzesByIds(unfinishedAttempts.map(a => a.quizId))
          : [];
        if (cancelled) return;

        // A quiz doc can be gone (deleted since the attempt): drop those rows
        const quizzesById = new Map(unfinishedQuizzes.map(q => [q.id, q]));
        setUnfinished(
          unfinishedAttempts
            .filter(a => quizzesById.has(a.quizId))
            .map(a => ({ quiz: quizzesById.get(a.quizId)!, progress: a }))
        );
      } catch (err) {
        console.error('Failed to load home data:', err);
        // Sections stay empty; the page still renders
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleOpenQuiz = useCallback((quizId: string) => {
    navigate(`/quiz/${quizId}`);
  }, [navigate]);

  // Opening the panel marks everything seen on this device: the dot clears
  // immediately and stays clear until something newer arrives.
  useEffect(() => {
    if (!notificationOpen) return;
    // Deferred so setLastSeenMs isn't a synchronous effect setState
    // (react(set-state-in-effect)) — same pattern as the quiz data hooks.
    void Promise.resolve().then(() => {
      const now = Date.now();
      markNotificationsSeen(now);
      setLastSeenMs(now);
    });
  }, [notificationOpen]);

  const handleCreateQuiz = useCallback(() => {
    navigate('/create-quiz');
  }, [navigate]);

  const username = user?.displayName || user?.email?.split('@')[0] || 'User';
  const userInitial = username.charAt(0).toUpperCase();

  // Red dot: a live friend request (its notification row exists exactly while
  // the request is pending) or any other notification newer than the last
  // time this device opened the panel.
  const hasUnseen =
    !!notifications &&
    (notifications.some(n => n.type === 'friend-request') ||
      notifications.some(
        n => n.type !== 'friend-request' && (n.createdAt?.toMillis?.() ?? 0) > lastSeenMs
      ));

  return (
    <div className="flex flex-col flex-1">
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
                className="p-1 relative"
                onClick={() => setNotificationOpen(true)}
                aria-label={hasUnseen ? 'Notifications, new activity' : 'Notifications'}
                aria-expanded={notificationOpen}
              >
                <Bell className="w-6 h-6 text-gray-700 dark:text-gray-300" />
                {hasUnseen && (
                  <span
                    className="absolute top-0.5 right-0.5 w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-white dark:ring-gray-900"
                    aria-hidden="true"
                  />
                )}
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
              {/* Create Quiz Card — the only Create entry point */}
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
                    onClick={handleCreateQuiz}
                  >
                    Create Quiz
                  </Button>
                </div>
              </div>

              {/* Continue where you left off — unfinished attempts only */}
              {unfinished.length > 0 && (
                <section aria-label="Continue where you left off">
                  <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                    Continue where you left off
                  </h2>
                  <div className="space-y-2">
                    {unfinished.map(({ quiz, progress }) => (
                      <UnfinishedQuizCard
                        key={quiz.id}
                        quiz={quiz}
                        progress={progress}
                        onClick={handleOpenQuiz}
                      />
                    ))}
                  </div>
                </section>
              )}

            </div>
          </main>

          {/* Notification Slide Panel */}
          <SlidePanel
            isOpen={notificationOpen}
            onClose={() => {
              setNotificationOpen(false);
              // Refresh the feed so the dot reflects anything acted on inside
              // the panel (an accepted request's row is gone server-side).
              refetchNotifications();
            }}
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
