import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  saveQuizProgress,
  saveQuiz,
  deleteQuiz,
  recordFirstCompletion,
  saveQuizFavorite,
  removeQuizFavorite,
  saveQuizColorPreference,
  saveQuizTitle,
  type QuizProgress,
  type CardColorId,
} from '../api/quiz';
import { queryKeys } from '@/lib/queryKeys';

/** Save quiz progress (answers, answeredCount, completed status) */
export function useSaveQuizProgress() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      quizId,
      userId,
      progress,
    }: {
      quizId: string;
      userId: string;
      progress: Omit<QuizProgress, 'lastAttemptAt'>;
    }) => saveQuizProgress(quizId, userId, progress),
    onSuccess: (_data, variables) => {
      // Invalidate the specific progress query
      queryClient.invalidateQueries({
        queryKey: queryKeys.quiz.progress(variables.quizId, variables.userId),
      });
      // Invalidate the multi-quiz progress query
      queryClient.invalidateQueries({
        queryKey: ['quiz', 'quizzesProgress'],
        predicate: (query) => {
          const key = query.queryKey;
          return key[1] === 'quizzesProgress' && key[3] === variables.userId;
        },
      });
      // Invalidate user attempts (drives "Continue where you left off")
      queryClient.invalidateQueries({
        queryKey: queryKeys.quiz.attempts(variables.userId),
      });
    },
  });
}

/** Save a new quiz */
export function useSaveQuiz() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ quizData, userId }: { quizData: any; userId: string }) =>
      saveQuiz(quizData, userId),
    onSuccess: (_data, variables) => {
      // Invalidate user's quiz list and count
      queryClient.invalidateQueries({
        queryKey: queryKeys.quiz.userQuizzes(variables.userId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.quiz.userQuizCount(variables.userId),
      });
    },
  });
}

/** Delete a quiz */
export function useDeleteQuiz() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ quizId, userId }: { quizId: string; userId: string }) =>
      deleteQuiz(quizId, userId),
    onSuccess: (_data, variables) => {
      // Invalidate user's quiz list and count
      queryClient.invalidateQueries({
        queryKey: queryKeys.quiz.userQuizzes(variables.userId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.quiz.userQuizCount(variables.userId),
      });
      // Invalidate any cached quiz by ID
      queryClient.invalidateQueries({
        queryKey: queryKeys.quiz.byId(variables.quizId),
      });
    },
  });
}

/** Record first completion (transactional, runs once per quiz per user) */
export function useRecordFirstCompletion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      quizId,
      userId,
      score,
    }: {
      quizId: string;
      userId: string;
      score: { correct: number; total: number };
    }) => recordFirstCompletion(quizId, userId, score),
    onSuccess: (_data, variables) => {
      // Invalidate progress and attempts since firstScore may be set
      queryClient.invalidateQueries({
        queryKey: queryKeys.quiz.progress(variables.quizId, variables.userId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.quiz.attempts(variables.userId),
      });
    },
  });
}

/** Add a quiz to user's favorites */
export function useSaveQuizFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ quizId, userId }: { quizId: string; userId: string }) =>
      saveQuizFavorite(quizId, userId),
    onSuccess: (_data, variables) => {
      // No direct query for favorites list yet; invalidate user quizzes if needed
      queryClient.invalidateQueries({
        queryKey: queryKeys.quiz.userQuizzes(variables.userId),
      });
    },
  });
}

/** Remove a quiz from user's favorites */
export function useRemoveQuizFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ quizId, userId }: { quizId: string; userId: string }) =>
      removeQuizFavorite(quizId, userId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.quiz.userQuizzes(variables.userId),
      });
    },
  });
}

/** Save user's color preference for a quiz */
export function useSaveQuizColorPreference() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      quizId,
      userId,
      colorId,
    }: {
      quizId: string;
      userId: string;
      colorId: CardColorId;
    }) => saveQuizColorPreference(quizId, userId, colorId),
    onSuccess: (_data, variables) => {
      // Color prefs are fetched via getQuizzesColorPreferences — invalidate related
      queryClient.invalidateQueries({
        queryKey: ['quiz', 'colorPreferences'],
        predicate: (query) => query.queryKey[3] === variables.userId,
      });
    },
  });
}

/** Save user's custom title for a quiz */
export function useSaveQuizTitle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      quizId,
      userId,
      title,
    }: {
      quizId: string;
      userId: string;
      title: string;
    }) => saveQuizTitle(quizId, userId, title),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['quiz', 'titles'],
        predicate: (query) => query.queryKey[3] === variables.userId,
      });
    },
  });
}

// CardColorId is exported from '../api/quiz' and re-exported via the quiz index