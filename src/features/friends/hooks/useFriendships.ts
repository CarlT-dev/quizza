import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/features/auth';
import { getFriendships, type FriendshipsData } from '../api/friends';

interface UseFriendshipsResult {
  friendships: FriendshipsData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Loads the signed-in user's friendships (accepted friends plus pending
 * incoming/outgoing requests) for the FriendsPage and the share panel's
 * friends quick-pick. null friendships after a settled load means signed
 * out; refetch() re-reads after any request accept/decline/add.
 */
export function useFriendships(): UseFriendshipsResult {
  const { user, loading: authLoading } = useAuth();
  const [friendships, setFriendships] = useState<FriendshipsData | null>(null);
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
        setFriendships(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const data = await getFriendships(user.uid);
        if (cancelled) return;
        setFriendships(data);
        setError(null);
      } catch (err) {
        console.error('Failed to load friendships:', err);
        if (!cancelled) setError('Failed to load friends. Please try again.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [user, authLoading, reloadToken]);

  const refetch = useCallback(() => setReloadToken(token => token + 1), []);

  return { friendships, isLoading, error, refetch };
}
