import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth';
import { getCurrentUserProfile, updateBio, type CurrentUserProfile } from '../api';
import { queryKeys } from '@/lib/queryKeys';

/**
 * React Query hook for current user's profile.
 *
 * Benefits over manual useState/useEffect:
 * - Automatic caching with staleTime (no skeleton on revisits if data is fresh)
 * - Background refetching (stale-while-revalidate)
 * - Deduplication (multiple components = one fetch)
 * - Retry logic
 * - Optimistic updates for bio
 */
export function useCurrentUserProfileQuery() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch profile with React Query
  const profileQuery = useQuery({
    queryKey: user ? queryKeys.user.profile(user.uid) : ['user', 'profile', ''],
    queryFn: () => getCurrentUserProfile(user!.uid),
    enabled: !!user,
    // Profile data doesn't change frequently; cache for 5 minutes
    staleTime: 1000 * 60 * 5,
    // Keep in cache for 30 minutes after unmount
    gcTime: 1000 * 60 * 30,
  });

  // Optimistic bio update mutation
  const bioMutation = useMutation({
    mutationFn: (bio: string) => updateBio(user!.uid, bio),
    onMutate: async (newBio: string) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.user.profile(user!.uid) });

      // Snapshot the previous value
      const previousProfile = queryClient.getQueryData<CurrentUserProfile>(
        queryKeys.user.profile(user!.uid)
      );

      // Optimistically update
      queryClient.setQueryData<CurrentUserProfile>(
        queryKeys.user.profile(user!.uid),
        (old) => old ? { ...old, bio: newBio.trim().slice(0, 160) } : undefined
      );

      return { previousProfile };
    },
    onError: (err, _newBio, context) => {
      // Rollback on error
      if (context?.previousProfile) {
        queryClient.setQueryData(queryKeys.user.profile(user!.uid), context.previousProfile);
      }
      console.error('Failed to update bio:', err);
    },
    onSettled: () => {
      // Refetch to ensure consistency (optional - can remove if optimistic is trusted)
      queryClient.invalidateQueries({ queryKey: queryKeys.user.profile(user!.uid) });
    },
  });

  // Wrapper to match the old interface
  const refetch = () => profileQuery.refetch();

  return {
    profile: profileQuery.data ?? null,
    isLoading: profileQuery.isLoading,
    error: profileQuery.error?.message ?? null,
    refetch,
    updateBio: bioMutation.mutateAsync,
    isUpdating: bioMutation.isPending,
  };
}

/** Type alias for backward compatibility */
export type UseCurrentUserProfileResult = ReturnType<typeof useCurrentUserProfileQuery>;