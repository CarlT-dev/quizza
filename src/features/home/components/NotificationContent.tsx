import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Bell,
  ChevronRight,
  Loader2,
  MessageCircle,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import { useAuth } from '@/features/auth';
import { getUserProfile } from '@/features/users';
import { acceptFriendRequest, declineFriendRequest } from '@/features/friends';
import { formatRelativeTime } from '@/shared/utils';
import { Button } from '@/shared/components/ui';
import { useNotifications } from '@/features/notifications';

/**
 * The Home page's notification feed, backed by the real notifications
 * collection: pending friend requests (with Accept / Decline), accept
 * confirmations, and quiz shares (tapping one opens the conversation).
 * Actor names resolve fresh per open — the MessagesPage convention — so
 * renames show up.
 */
export function NotificationContent() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { notifications, isLoading, error, refetch } = useNotifications();

  const [names, setNames] = useState<Record<string, string>>({});
  const [busyUids, setBusyUids] = useState<Set<string>>(new Set());
  const [failedUids, setFailedUids] = useState<Set<string>>(new Set());

  // Resolve each actor's current username — fresh per open, so renames show
  // up. Falls back to a uid slice (same as MessagesPage).
  useEffect(() => {
    if (!user || !notifications) return;
    let cancelled = false;

    // Deferred so setNames isn't a synchronous effect setState
    // (react(set-state-in-effect)) — same pattern as the quiz data hooks.
    void Promise.resolve().then(async () => {
      const actorUids = [...new Set(notifications.map(n => n.fromUid))];
      const resolved = await Promise.all(
        actorUids.map(async uid => {
          try {
            const profile = await getUserProfile(uid);
            return [uid, profile?.name ?? profile?.username ?? uid.slice(0, 8)] as const;
          } catch (err) {
            console.error('Failed to load profile:', err);
            return [uid, uid.slice(0, 8)] as const;
          }
        })
      );
      if (!cancelled) setNames(Object.fromEntries(resolved));
    });

    return () => {
      cancelled = true;
    };
  }, [user, notifications]);

  /**
   * Runs a guarded mutation: busy spinner per row, refetch either way.
   * Success — and the already-settled false — delete the row's doc
   * server-side, so the row leaves the feed on refetch; only a genuine
   * failure keeps the row and shows the inline note.
   */
  const runMutation = async (uid: string, action: () => Promise<boolean>) => {
    setBusyUids(prev => new Set(prev).add(uid));
    let ok = false;
    try {
      ok = await action();
    } finally {
      setBusyUids(prev => {
        const next = new Set(prev);
        next.delete(uid);
        return next;
      });
    }
    if (!ok) setFailedUids(prev => new Set(prev).add(uid));
    refetch();
  };

  if (authLoading || isLoading) {
    return (
      <div className="p-4 space-y-2" aria-hidden="true">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50">
            <div className="w-5 h-5 rounded-full skeleton" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-44 skeleton skeleton-rounded" />
              <div className="h-3 w-24 skeleton skeleton-rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="flex flex-col items-center py-10 text-center">
          <AlertTriangle className="w-10 h-10 text-red-500 mb-3" aria-hidden="true" />
          <p className="text-gray-500 dark:text-gray-400 mb-4">{error}</p>
          <Button size="sm" onClick={refetch}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  if (!notifications) return null;

  if (notifications.length === 0) {
    return (
      <div className="p-4">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Bell className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" aria-hidden="true" />
          <p className="text-gray-500 dark:text-gray-400">No notifications yet</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            You'll see updates here when you have new activity
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <ul className="space-y-2" role="list" aria-label="Notifications">
        {notifications.map((notification) => {
          const name = names[notification.fromUid] ?? notification.fromUid.slice(0, 8);

          // Quiz share: the whole row opens the conversation
          if (notification.type === 'quiz-share') {
            return (
              <li key={notification.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/messages/${notification.fromUid}`, { state: { username: name } })}
                  className="w-full flex gap-3 p-3 rounded-xl text-left bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="flex-shrink-0 mt-0.5">
                    <MessageCircle className="w-5 h-5 text-primary-500" aria-hidden="true" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      <span className="font-medium text-gray-900 dark:text-gray-100">{name}</span>{' '}
                      shared{' '}
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {notification.quizTitle ?? 'a quiz'}
                      </span>{' '}
                      with you
                    </p>
                    <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
                      {formatRelativeTime(notification.createdAt)}
                    </p>
                  </div>
                  <ChevronRight
                    className="w-4 h-4 text-gray-400 flex-shrink-0 self-center"
                    aria-hidden="true"
                  />
                </button>
              </li>
            );
          }

          // Accept confirmation: static info row
          if (notification.type === 'friend-request-accepted') {
            return (
              <li
                key={notification.id}
                className="flex gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50"
              >
                <div className="flex-shrink-0 mt-0.5">
                  <UserCheck className="w-5 h-5 text-green-500" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    <span className="font-medium text-gray-900 dark:text-gray-100">{name}</span>{' '}
                    accepted your friend request
                  </p>
                  <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
                    {formatRelativeTime(notification.createdAt)}
                  </p>
                </div>
              </li>
            );
          }

          // Friend request: the actionable row
          const actorBusy = busyUids.has(notification.fromUid);
          const actorFailed = failedUids.has(notification.fromUid);
          return (
            <li
              key={notification.id}
              className="p-3 rounded-xl bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-900/30"
            >
              <div className="flex gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  <UserPlus className="w-5 h-5 text-primary-500" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {name} sent you a friend request
                  </p>
                  <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
                    {formatRelativeTime(notification.createdAt)}
                  </p>
                </div>
              </div>
              <div className="mt-2.5 flex items-center gap-2 pl-8">
                {actorBusy ? (
                  <Loader2 className="w-5 h-5 text-gray-400 animate-spin" aria-hidden="true" />
                ) : (
                  <>
                    <Button
                      size="sm"
                      onClick={() =>
                        runMutation(notification.fromUid, () =>
                          acceptFriendRequest(notification.fromUid)
                        )
                      }
                    >
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        runMutation(notification.fromUid, () =>
                          declineFriendRequest(notification.fromUid)
                        )
                      }
                    >
                      Decline
                    </Button>
                  </>
                )}
                {actorFailed && !actorBusy && (
                  <span className="text-xs text-red-600 dark:text-red-400" role="alert">
                    Failed — try again
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
