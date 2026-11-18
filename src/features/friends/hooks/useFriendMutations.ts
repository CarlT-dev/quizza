import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  cancelFriendRequest,
  removeFriend,
} from '../api/friends';

/** Send a friend request */
export function useSendFriendRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (targetUsername: string) => sendFriendRequest(targetUsername),
    onSuccess: () => {
      // Invalidate friendships for current user (outgoing will update)
      // Note: We need the current user's ID — typically from auth context
      // The component should call queryClient.invalidateQueries with the specific userId
      queryClient.invalidateQueries({ queryKey: ['friends', 'friendships'] });
      // Also invalidate notifications for the recipient (they'll see the request)
      queryClient.invalidateQueries({ queryKey: ['notifications', 'list'] });
    },
  });
}

/** Accept a friend request */
export function useAcceptFriendRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (otherUid: string) => acceptFriendRequest(otherUid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friends', 'friendships'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'list'] });
    },
  });
}

/** Decline a friend request */
export function useDeclineFriendRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (otherUid: string) => declineFriendRequest(otherUid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friends', 'friendships'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'list'] });
    },
  });
}

/** Cancel an outgoing friend request */
export function useCancelFriendRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (otherUid: string) => cancelFriendRequest(otherUid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friends', 'friendships'] });
      queryClient.invalidateQueries({ queryKey: ['notifications', 'list'] });
    },
  });
}

/** Remove an accepted friend */
export function useRemoveFriend() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (otherUid: string) => removeFriend(otherUid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friends', 'friendships'] });
      // Note: convo/shared quizzes stay per product decision
    },
  });
}

// Type helpers
export type UseSendFriendRequestResult = ReturnType<typeof useSendFriendRequest>;
export type UseAcceptFriendRequestResult = ReturnType<typeof useAcceptFriendRequest>;
export type UseDeclineFriendRequestResult = ReturnType<typeof useDeclineFriendRequest>;
export type UseCancelFriendRequestResult = ReturnType<typeof useCancelFriendRequest>;
export type UseRemoveFriendResult = ReturnType<typeof useRemoveFriend>;