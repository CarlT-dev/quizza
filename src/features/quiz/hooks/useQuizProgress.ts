import { useState, useEffect, useCallback, useMemo } from 'react';
import { getQuizzesProgress, getQuizzesColorPreferences, type QuizProgress, type CardColorId } from '../api/quiz';

interface UseQuizProgressOptions {
  quizIds: string[];
  userId: string | null | undefined;
  enabled?: boolean;
}

interface UseQuizProgressResult {
  progressMap: Map<string, QuizProgress>;
  colorPrefsMap: Map<string, CardColorId>;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  updateColorPref: (quizId: string, colorId: CardColorId) => void;
}

export function useQuizProgress({
  quizIds,
  userId,
  enabled = true,
}: UseQuizProgressOptions): UseQuizProgressResult {
  const [progressMap, setProgressMap] = useState<Map<string, QuizProgress>>(new Map());
  const [colorPrefsMap, setColorPrefsMap] = useState<Map<string, CardColorId>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const quizIdsKey = useMemo(() => quizIds.sort().join(','), [quizIds]);

  const fetchData = useCallback(async () => {
    if (!userId || quizIdsKey === '' || !enabled) {
      setProgressMap(new Map());
      setColorPrefsMap(new Map());
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [progress, colors] = await Promise.all([
        getQuizzesProgress(quizIds, userId),
        getQuizzesColorPreferences(quizIds, userId),
      ]);

      setProgressMap(progress);
      setColorPrefsMap(colors);
    } catch (err) {
      console.error('Failed to fetch quiz progress/preferences:', err);
      setError('Failed to load quiz data');
    } finally {
      setIsLoading(false);
    }
  }, [quizIds, quizIdsKey, userId, enabled]);

  const updateColorPref = useCallback((quizId: string, colorId: CardColorId) => {
    setColorPrefsMap(prev => new Map(prev).set(quizId, colorId));
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    progressMap,
    colorPrefsMap,
    isLoading,
    error,
    refetch: fetchData,
    updateColorPref,
  };
}