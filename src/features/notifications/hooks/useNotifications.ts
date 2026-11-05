import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/features/auth';
import { getNotifications, type NotificationDocument } from '../api/notifications';

interface UseNotificationsResult {
  notifications: NotificationDocument[] | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Loads the signed-in user's notification feed (pending friend requests,
 * accept confirmations, quiz shares) for the Home page's bell dot and the
 * notifications panel. null notifications after a settled load means signed
 * out; refetch() re-reads after acting on a row inside the panel.
 */
export function useNotifications(): UseNotificationsResult {
  const { user, loading: authLoading } = useAuth();
  const [notifications, setNotifications] = useState<NotificationDocument[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;

    // Deferred so setIsLoading isn't a synchronous effect setState
    // (react(set-state-in-effect)) — same pattern as the quiz data hooks.
    void Promise.resolve().then(async () => {
      if (!user) {
        setNotifications(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const data = await getNotifications(user.uid);
        if (cancelled) return;
        setNotifications(data);
        setError(null);
      } catch (err) {
        console.error('Failed to load notifications:', err);
        if (!cancelled) setError('Failed to load notifications. Please try again.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [user, authLoading, reloadToken]);

  const refetch = useCallback(() => setReloadToken(token => token + 1), []);

  return { notifications, isLoading, error, refetch };
}
