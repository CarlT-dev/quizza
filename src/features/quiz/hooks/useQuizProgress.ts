import { useState, useEffect, useCallback, useMemo } from 'react';
import { getQuizzesProgress, getQuizzesColorPreferences, getQuizzesTitles, type QuizProgress, type CardColorId } from '../api/quiz';

interface UseQuizProgressOptions {
  quizIds: string[];
  userId: string | null | undefined;
  enabled?: boolean;
}

interface UseQuizProgressResult {
  progressMap: Map<string, QuizProgress>;
  colorPrefsMap: Map<string, CardColorId>;
  titlePrefsMap: Map<string, string>;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  updateColorPref: (quizId: string, colorId: CardColorId) => void;
  updateTitle: (quizId: string, title: string) => void;
}

export function useQuizProgress({
  quizIds,
  userId,
  enabled = true,
}: UseQuizProgressOptions): UseQuizProgressResult {
  const [progressMap, setProgressMap] = useState<Map<string, QuizProgress>>(new Map());
  const [colorPrefsMap, setColorPrefsMap] = useState<Map<string, CardColorId>>(new Map());
  const [titlePrefsMap, setTitlePrefsMap] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const quizIdsKey = useMemo(() => quizIds.sort().join(','), [quizIds]);

  const fetchData = useCallback(async () => {
    if (!userId || quizIdsKey === '' || !enabled) {
      setProgressMap(new Map());
      setColorPrefsMap(new Map());
      setTitlePrefsMap(new Map());
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

      // Titles are optional - fetch independently so a titles failure (e.g.
      // quizTitles Firestore rules not yet deployed) doesn't block colors.
      try {
        const titles = await getQuizzesTitles(quizIds, userId);
        setTitlePrefsMap(titles);
      } catch (err) {
        console.error('Failed to fetch quiz titles:', err);
      }
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

  const updateTitle = useCallback((quizId: string, title: string) => {
    setTitlePrefsMap(prev => new Map(prev).set(quizId, title));
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    progressMap,
    colorPrefsMap,
    titlePrefsMap,
    isLoading,
    error,
    refetch: fetchData,
    updateColorPref,
    updateTitle,
  };
}