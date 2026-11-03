import { useCallback, useEffect, useState } from 'react';
import { getUserAttempts, type QuizProgress } from '../api/quiz';
import { computeUserStats, type UserStats } from '@/shared/utils/quizStats';

interface UseUserStatsResult {
  stats: UserStats | null;
  /** The raw attempts behind stats — StatusPage's results list reuses them. */
  attempts: Array<QuizProgress & { quizId: string }>;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * The signed-in user's first-attempt stats, computed client-side from the
 * freshest attempts read — self-healing for legacy users whose
 * users/{uid}.stats copy hasn't been written yet (other users' profiles read
 * that denormalized copy instead, since attempts are private).
 */
export function useUserStats(userId: string | null | undefined): UseUserStatsResult {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [attempts, setAttempts] = useState<Array<QuizProgress & { quizId: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!userId) {
      setStats(null);
      setAttempts([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const loaded = await getUserAttempts(userId);
      setStats(computeUserStats(loaded));
      setAttempts(loaded);
    } catch (err) {
      console.error('Failed to load user stats:', err);
      setError('Failed to load your stats');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    // Deferred to a microtask so the loading state isn't set synchronously
    // inside the effect (react/set-state-in-effect).
    void Promise.resolve().then(fetchData);
  }, [fetchData]);

  return { stats, attempts, isLoading, error, refetch: fetchData };
}
