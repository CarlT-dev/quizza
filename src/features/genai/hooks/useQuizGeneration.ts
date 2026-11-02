/**
 * Hook for Quiz Generation
 * Provides state management and API integration for quiz generation,
 * with a live elapsed timer, one-tap retry, and a real cancel that
 * aborts the in-flight request.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import type { QuizRequest, QuizResponse } from '../schema';
import { generateQuiz, cancelActiveGeneration, type GenerationResult } from '../services/ai-providers.service';

export interface UseQuizGenerationReturn {
  /** Current generation state */
  isLoading: boolean;
  /** Error message if generation failed */
  error: string | null;
  /** Generated quiz data */
  quizData: QuizResponse | null;
  /** Milliseconds since the current generation started (0 when idle) */
  elapsedMs: number;
  /** Function to generate a quiz */
  generate: (request: QuizRequest) => Promise<GenerationResult>;
  /** Re-run the last generate() request, if there was one */
  retry: () => Promise<GenerationResult | null>;
  /** Abort the in-flight generation */
  cancel: () => void;
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
  const [elapsedMs, setElapsedMs] = useState(0);

  const lastRequestRef = useRef<QuizRequest | null>(null);

  // Live elapsed timer: starts on the loading edge, resets when it ends.
  useEffect(() => {
    if (!isLoading) {
      setElapsedMs(0);
      return;
    }
    const startedAt = Date.now();
    setElapsedMs(0);
    const interval = setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, 1000);
    return () => clearInterval(interval);
  }, [isLoading]);

  const applyResult = useCallback((result: GenerationResult) => {
    if (result.success && result.data) {
      setQuizData(result.data);
      setError(null);
    } else if (!result.cancelled) {
      // Cancelled generations are not errors — the user chose to stop.
      setError(result.error || 'Unknown error occurred');
    }
    setIsLoading(false);
  }, []);

  const generate = useCallback(
    async (request: QuizRequest): Promise<GenerationResult> => {
      lastRequestRef.current = request;
      setIsLoading(true);
      setError(null);

      const result = await generateQuiz(request);
      applyResult(result);
      return result;
    },
    [applyResult],
  );

  const retry = useCallback(async (): Promise<GenerationResult | null> => {
    const request = lastRequestRef.current;
    if (!request) return null;
    return generate(request);
  }, [generate]);

  const cancel = useCallback(() => {
    // Abort the in-flight request. The pending generate() call resolves with
    // a cancelled result, which clears isLoading without setting an error.
    cancelActiveGeneration();
    setIsLoading(false);
  }, []);

  const reset = useCallback(() => {
    setIsLoading(false);
    setError(null);
    setQuizData(null);
    setElapsedMs(0);
    lastRequestRef.current = null;
  }, []);

  return {
    isLoading,
    error,
    quizData,
    elapsedMs,
    generate,
    retry,
    cancel,
    reset,
  };
}
