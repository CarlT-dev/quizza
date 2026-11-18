import { useQuery } from '@tanstack/react-query';
import { getUserProfile } from '../api/users';
import { queryKeys } from '@/lib/queryKeys';

/** Fetch a user's public profile */
export function useUserProfile(uid: string | undefined) {
  return useQuery({
    queryKey: uid ? queryKeys.user.profile(uid) : ['user', 'profile', ''],
    queryFn: () => getUserProfile(uid!),
    enabled: !!uid,
    // Profiles change infrequently; cache for 10 minutes
    staleTime: 1000 * 60 * 10,
  });
}

/** Fetch a user's denormalized stats */
export function useUserStats(uid: string | undefined) {
  return useQuery({
    queryKey: uid ? queryKeys.user.stats(uid) : ['user', 'stats', ''],
    queryFn: async () => {
      const profile = await getUserProfile(uid!);
      return profile?.stats ?? null;
    },
    enabled: !!uid,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// Type helpers
export type UseUserProfileResult = ReturnType<typeof useUserProfile>;
export type UseUserStatsResult = ReturnType<typeof useUserStats>;