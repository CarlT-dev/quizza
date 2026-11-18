/**
 * Centralized query key factory for TanStack Query.
 *
 * Using `as const` preserves tuple types for precise invalidation.
 * Example: queryClient.invalidateQueries({ queryKey: queryKeys.quiz.progress('quizId', 'userId') })
 *          queryClient.invalidateQueries({ queryKey: ['quiz', 'progress'] }) // invalidates ALL progress queries
 */

export const queryKeys = {
  /** Quiz-related queries */
  quiz: {
    /** Single quiz by ID */
    byId: (id: string) => ['quiz', 'byId', id] as const,

    /** Multiple quizzes by IDs array */
    byIds: (ids: string[]) => ['quiz', 'byIds', [...ids].sort().join(',')] as const,

    /** Quizzes created by a user */
    userQuizzes: (userId: string, limit?: number) =>
      ['quiz', 'userQuizzes', userId, limit ?? 'default'] as const,

    /** Count of quizzes created by a user */
    userQuizCount: (userId: string) => ['quiz', 'userQuizCount', userId] as const,

    /** Single user's progress on a specific quiz */
    progress: (quizId: string, userId: string) =>
      ['quiz', 'progress', quizId, userId] as const,

    /** Progress for multiple quizzes for a user */
    quizzesProgress: (quizIds: string[], userId: string) =>
      ['quiz', 'quizzesProgress', [...quizIds].sort().join(','), userId] as const,

    /** Color preferences for multiple quizzes for a user */
    quizzesColorPrefs: (quizIds: string[], userId: string) =>
      ['quiz', 'quizzesColorPrefs', [...quizIds].sort().join(','), userId] as const,

    /** Custom titles for multiple quizzes for a user */
    quizzesTitles: (quizIds: string[], userId: string) =>
      ['quiz', 'quizzesTitles', [...quizIds].sort().join(','), userId] as const,

    /** All attempt documents for a user */
    attempts: (userId: string) => ['quiz', 'attempts', userId] as const,

    /** All attempt documents for a specific quiz (owner view) */
    quizAttempts: (quizId: string) => ['quiz', 'quizAttempts', quizId] as const,
  },

  /** User profile & stats queries */
  user: {
    /** Public profile document */
    profile: (uid: string) => ['user', 'profile', uid] as const,

    /** Multiple user profiles by UIDs */
    profiles: (uids: string[]) => ['user', 'profiles', [...uids].sort().join(',')] as const,

    /** Denormalized stats on profile */
    stats: (uid: string) => ['user', 'stats', uid] as const,
  },

  /** Friends & friendships queries */
  friends: {
    /** All friendships for a user (friends + incoming + outgoing) */
    friendships: (userId: string) => ['friends', 'friendships', userId] as const,
  },

  /** Messages / conversations queries */
  messages: {
    /** Conversation list for a user */
    convos: (userId: string) => ['messages', 'convos', userId] as const,

    /** Shares within a conversation (real-time subscription handles updates) */
    shares: (convoId: string) => ['messages', 'shares', convoId] as const,
  },

  /** Notifications queries */
  notifications: {
    /** Notification feed for a user */
    list: (userId: string) => ['notifications', 'list', userId] as const,
  },

  /** Search queries */
  search: {
    /** Username prefix search */
    usernames: (prefix: string) => ['search', 'usernames', prefix] as const,

    /** Display name prefix search */
    names: (prefix: string) => ['search', 'names', prefix] as const,
  },
} as const;

/** Type helper for query keys — enables autocomplete in invalidateQueries */
export type QueryKeys = typeof queryKeys;