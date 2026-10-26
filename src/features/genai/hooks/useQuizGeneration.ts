/**
 * Hook for Quiz Generation
 * Provides state management and API integration for quiz generation
 */

import { useState, useCallback } from 'react';
import type { QuizRequest, QuizResponse } from '../schema';
import { generateQuiz, type GenerationResult } from '../services/gemini.service';

export interface UseQuizGenerationReturn {
  /** Current generation state */
  isLoading: boolean;
  /** Error message if generation failed */
  error: string | null;
  /** Generated quiz data */
  quizData: QuizResponse | null;
  /** Function to generate a quiz */
  generate: (request: QuizRequest) => Promise<GenerationResult>;
  /** Reset state */
  reset: () => void;
}

/**
 * Custom hook for quiz generation functionality
 */
export function useQuizGeneration(): UseQuizGenerationReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quizData, setQuizData] = useState<QuizResponse | null>(null);

  const generate = useCallback(async (request: QuizRequest): Promise<GenerationResult> => {
    setIsLoading(true);
    setError(null);

    const result = await generateQuiz(request);

    if (result.success && result.data) {
      setQuizData(result.data);
      setIsLoading(false);
      return result;
    } else {
      setError(result.error || 'Unknown error occurred');
      setIsLoading(false);
      return result;
    }
  }, []);

  const reset = useCallback(() => {
    setIsLoading(false);
    setError(null);
    setQuizData(null);
  }, []);

  return {
    isLoading,
    error,
    quizData,
    generate,
    reset,
  };
}