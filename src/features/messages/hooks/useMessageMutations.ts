import { useMutation, useQueryClient } from '@tanstack/react-query';
import { shareQuizToUser } from '../api/messages';
import { queryKeys } from '@/lib/queryKeys';
import type { QuizDocument } from '@/features/quiz/api/quiz';

/** Share a quiz with another user */
export function useShareQuizToUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      quiz,
      fromUid,
      toUid,
    }: {
      quiz: QuizDocument;
      fromUid: string;
      toUid: string;
    }) => shareQuizToUser(quiz, fromUid, toUid),
    onSuccess: (_data, variables) => {
      // Invalidate convo list for both users
      queryClient.invalidateQueries({
        queryKey: queryKeys.messages.convos(variables.fromUid),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.messages.convos(variables.toUid),
      });
      // Invalidate notifications for recipient (quiz-share notification)
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.list(variables.toUid),
      });
      // Invalidate quiz queries since sharedWith array changed
      queryClient.invalidateQueries({
        queryKey: queryKeys.quiz.byId(variables.quiz.id!),
      });
    },
  });
}

// Type helper
export type UseShareQuizToUserResult = ReturnType<typeof useShareQuizToUser>;