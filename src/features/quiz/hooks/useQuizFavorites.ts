import { useCallback, useEffect, useRef, useState } from 'react';
import { getQuizFavorites, removeQuizFavorite, saveQuizFavorite } from '../api/quiz';

interface UseQuizFavoritesResult {
  favoriteIds: Set<string>;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  toggleFavorite: (quizId: string) => void;
}

/**
 * Tracks the user's favorite (starred) quizzes, with optimistic toggle +
 * rollback (useQuizProgress hook pattern). Distinct from saved quizzes:
 * favoriting stars a card and gathers it in the favorites section.
 */
export function useQuizFavorites(userId: string | null | undefined): UseQuizFavoritesResult {
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Read through a ref so toggleFavorite stays referentially stable — a stable
  // handler lets memoized quiz cards re-render individually on a star toggle.
  const favoriteIdsRef = useRef(favoriteIds);
  useEffect(() => { favoriteIdsRef.current = favoriteIds; }, [favoriteIds]);

  const fetchData = useCallback(async () => {
    if (!userId) {
      setFavoriteIds(new Set());
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const favorites = await getQuizFavorites(userId);
      setFavoriteIds(new Set(favorites.map(row => row.quizId)));
    } catch (err) {
      console.error('Failed to fetch favorites:', err);
      setError('Failed to load favorites');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    // Deferred to a microtask so the loading state isn't set synchronously
    // inside the effect (react/set-state-in-effect).
    void Promise.resolve().then(fetchData);
  }, [fetchData]);

  const toggleFavorite = useCallback((quizId: string) => {
    if (!userId) return;
    const wasFavorite = favoriteIdsRef.current.has(quizId);

    setFavoriteIds(prev => {
      const next = new Set(prev);
      if (wasFavorite) next.delete(quizId); else next.add(quizId);
      return next;
    });

    const request = wasFavorite
      ? removeQuizFavorite(quizId, userId)
      : saveQuizFavorite(quizId, userId);
    request.catch(err => {
      console.error('Failed to update favorite:', err);
      // Roll back the optimistic update
      setFavoriteIds(prev => {
        const next = new Set(prev);
        if (wasFavorite) next.add(quizId); else next.delete(quizId);
        return next;
      });
    });
  }, [userId]);

  return { favoriteIds, isLoading, error, refetch: fetchData, toggleFavorite };
}
