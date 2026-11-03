import { useCallback, useEffect, useRef, useState } from 'react';
import { getSavedQuizzes, saveQuizForUser, unsaveQuiz } from '../api/quiz';

interface UseSavedQuizzesResult {
  savedIds: Set<string>;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  toggleSave: (quizId: string) => void;
}

/**
 * Tracks which public quizzes the user has saved to their Quizzes page,
 * with optimistic toggle + rollback (useQuizProgress hook pattern).
 */
export function useSavedQuizzes(userId: string | null | undefined): UseSavedQuizzesResult {
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Read through a ref so toggleSave stays referentially stable — a stable
  // handler lets memoized quiz cards re-render individually on a toggle.
  const savedIdsRef = useRef(savedIds);
  useEffect(() => { savedIdsRef.current = savedIds; }, [savedIds]);

  const fetchData = useCallback(async () => {
    if (!userId) {
      setSavedIds(new Set());
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const saved = await getSavedQuizzes(userId);
      setSavedIds(new Set(saved.map(row => row.quizId)));
    } catch (err) {
      console.error('Failed to fetch saved quizzes:', err);
      setError('Failed to load saved quizzes');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    // Deferred to a microtask so the loading state isn't set synchronously
    // inside the effect (react/set-state-in-effect).
    void Promise.resolve().then(fetchData);
  }, [fetchData]);

  const toggleSave = useCallback((quizId: string) => {
    if (!userId) return;
    const wasSaved = savedIdsRef.current.has(quizId);

    setSavedIds(prev => {
      const next = new Set(prev);
      if (wasSaved) next.delete(quizId); else next.add(quizId);
      return next;
    });

    const request = wasSaved ? unsaveQuiz(quizId, userId) : saveQuizForUser(quizId, userId);
    request.catch(err => {
      console.error('Failed to update saved quiz:', err);
      // Roll back the optimistic update
      setSavedIds(prev => {
        const next = new Set(prev);
        if (wasSaved) next.add(quizId); else next.delete(quizId);
        return next;
      });
    });
  }, [userId]);

  return { savedIds, isLoading, error, refetch: fetchData, toggleSave };
}
