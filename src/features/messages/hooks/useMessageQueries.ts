import { useQuery } from '@tanstack/react-query';
import { getUserConvos } from '../api/messages';
import { getUserProfile } from '@/features/users';
import { queryKeys } from '@/lib/queryKeys';

/** Fetch conversation list for a user */
export function useUserConvos(userId: string | undefined) {
  return useQuery({
    queryKey: userId ? queryKeys.messages.convos(userId) : ['messages', 'convos', ''],
    queryFn: () => getUserConvos(userId!),
    enabled: !!userId,
    // Conversations change moderately; 2-minute staleTime balances freshness and caching
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 30,
  });
}

/** Fetch multiple user profiles by UIDs (for displaying names in conversations) */
export function useUserProfiles(uids: string[] | undefined) {
  return useQuery({
    queryKey: uids && uids.length > 0
      ? queryKeys.user.profiles(uids)
      : ['user', 'profiles', ''],
    queryFn: async () => {
      if (!uids || uids.length === 0) return {};
      const results = await Promise.all(
        uids.map(async (uid) => {
          try {
            const profile = await getUserProfile(uid);
            return [uid, profile?.name ?? profile?.username ?? uid.slice(0, 8)] as const;
          } catch {
            return [uid, uid.slice(0, 8)] as const;
          }
        })
      );
      return Object.fromEntries(results);
    },
    enabled: !!uids && uids.length > 0,
    // User names change rarely; cache for 10 minutes
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
  });
}

// Type helpers
export type UseUserConvosResult = ReturnType<typeof useUserConvos>;
export type UseUserProfilesResult = ReturnType<typeof useUserProfiles>;