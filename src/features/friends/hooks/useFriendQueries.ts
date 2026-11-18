import { useQuery } from '@tanstack/react-query';
import { getFriendships } from '../api/friends';
import { queryKeys } from '@/lib/queryKeys';

/** Fetch all friendships for a user (friends, incoming, outgoing) */
export function useFriendships(userId: string | undefined) {
  return useQuery({
    queryKey: userId ? queryKeys.friends.friendships(userId) : ['friends', 'friendships', ''],
    queryFn: () => getFriendships(userId!),
    enabled: !!userId,
    // Friendships change moderately; 2-minute staleTime balances freshness and caching
    staleTime: 1000 * 60 * 2,
  });
}

// Type helper
export type UseFriendshipsResult = ReturnType<typeof useFriendships>;