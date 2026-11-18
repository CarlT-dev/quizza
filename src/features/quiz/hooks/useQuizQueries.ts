import { useQuery } from '@tanstack/react-query';
import {
  getQuizById,
  getUserQuizzes,
  getUserQuizCount,
  getQuizProgress,
  getQuizzesProgress,
  getUserAttempts,
  getQuizAttempts,
  getQuizzesByIds,
  getQuizzesColorPreferences,
  getQuizzesTitles,
} from '../api/quiz';
import { queryKeys } from '@/lib/queryKeys';

/** Fetch a single quiz by ID */
export function useQuizById(quizId: string | undefined) {
  return useQuery({
    queryKey: quizId ? queryKeys.quiz.byId(quizId) : ['quiz', 'byId', ''],
    queryFn: () => getQuizById(quizId!),
    enabled: !!quizId,
    // Quiz documents are immutable after creation (except sharedWith), so longer staleTime is fine
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}

/** Fetch quizzes created by a user */
export function useUserQuizzes(userId: string | undefined, limit = 20) {
  return useQuery({
    queryKey: userId ? queryKeys.quiz.userQuizzes(userId, limit) : ['quiz', 'userQuizzes', ''],
    queryFn: () => getUserQuizzes(userId!, limit),
    enabled: !!userId,
    // Quiz list changes occasionally; 2-minute staleTime balances freshness and caching
    staleTime: 1000 * 60 * 2,
    // Keep in cache for 30 minutes after unmount
    gcTime: 1000 * 60 * 30,
  });
}

/** Fetch count of quizzes created by a user */
export function useUserQuizCount(userId: string | undefined) {
  return useQuery({
    queryKey: userId ? queryKeys.quiz.userQuizCount(userId) : ['quiz', 'userQuizCount', ''],
    queryFn: () => getUserQuizCount(userId!),
    enabled: !!userId,
    // Count queries are cheap; cache longer
    staleTime: 1000 * 60 * 15, // 15 minutes
    gcTime: 1000 * 60 * 30,
  });
}

/** Fetch a user's progress on a specific quiz */
export function useQuizProgress(quizId: string | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: quizId && userId
      ? queryKeys.quiz.progress(quizId, userId)
      : ['quiz', 'progress', '', ''],
    queryFn: () => getQuizProgress(quizId!, userId!),
    enabled: !!quizId && !!userId,
    // Progress changes frequently during a quiz; keep staleTime short
    staleTime: 1000 * 30, // 30 seconds
  });
}

/** Fetch progress for multiple quizzes for a user */
export function useQuizzesProgress(quizIds: string[] | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: quizIds && userId && quizIds.length > 0
      ? queryKeys.quiz.quizzesProgress(quizIds, userId)
      : ['quiz', 'quizzesProgress', '', ''],
    queryFn: () => getQuizzesProgress(quizIds!, userId!),
    enabled: !!quizIds && quizIds.length > 0 && !!userId,
    staleTime: 1000 * 30, // 30 seconds
  });
}

/** Fetch all attempt documents for a user */
export function useUserAttempts(userId: string | undefined) {
  return useQuery({
    queryKey: userId ? queryKeys.quiz.attempts(userId) : ['quiz', 'attempts', ''],
    queryFn: () => getUserAttempts(userId!),
    enabled: !!userId,
    // Attempts list drives "Continue where you left off" — moderate staleTime
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

/** Fetch all attempt documents for a specific quiz (owner view) */
export function useQuizAttempts(quizId: string | undefined) {
  return useQuery({
    queryKey: quizId ? queryKeys.quiz.quizAttempts(quizId) : ['quiz', 'quizAttempts', ''],
    queryFn: () => getQuizAttempts(quizId!),
    enabled: !!quizId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

/** Fetch multiple quizzes by IDs */
export function useQuizzesByIds(quizIds: string[] | undefined) {
  return useQuery({
    queryKey: quizIds && quizIds.length > 0
      ? queryKeys.quiz.byIds(quizIds)
      : ['quiz', 'byIds', ''],
    queryFn: () => getQuizzesByIds(quizIds!),
    enabled: !!quizIds && quizIds.length > 0,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/** Fetch color preferences for multiple quizzes for a user */
export function useQuizzesColorPreferences(quizIds: string[] | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: quizIds && userId && quizIds.length > 0
      ? queryKeys.quiz.quizzesColorPrefs(quizIds, userId)
      : ['quiz', 'quizzesColorPrefs', '', ''],
    queryFn: () => getQuizzesColorPreferences(quizIds!, userId!),
    enabled: !!quizIds && quizIds.length > 0 && !!userId,
    // Color preferences change rarely; cache for 10 minutes
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
  });
}

/** Fetch custom titles for multiple quizzes for a user */
export function useQuizzesTitles(quizIds: string[] | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: quizIds && userId && quizIds.length > 0
      ? queryKeys.quiz.quizzesTitles(quizIds, userId)
      : ['quiz', 'quizzesTitles', '', ''],
    queryFn: () => getQuizzesTitles(quizIds!, userId!),
    enabled: !!quizIds && quizIds.length > 0 && !!userId,
    // Custom titles change rarely; cache for 10 minutes
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
  });
}

/** Type helpers for query return types */
export type UseQuizByIdResult = ReturnType<typeof useQuizById>;
export type UseUserQuizzesResult = ReturnType<typeof useUserQuizzes>;
export type UseUserQuizCountResult = ReturnType<typeof useUserQuizCount>;
export type UseQuizProgressResult = ReturnType<typeof useQuizProgress>;
export type UseQuizzesProgressResult = ReturnType<typeof useQuizzesProgress>;
export type UseUserAttemptsResult = ReturnType<typeof useUserAttempts>;
export type UseQuizAttemptsResult = ReturnType<typeof useQuizAttempts>;
export type UseQuizzesByIdsResult = ReturnType<typeof useQuizzesByIds>;
export type UseQuizzesColorPreferencesResult = ReturnType<typeof useQuizzesColorPreferences>;
export type UseQuizzesTitlesResult = ReturnType<typeof useQuizzesTitles>;