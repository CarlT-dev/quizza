import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateBio, updateName, renameUsername, type RenameUsernameResult } from '../api/users';
import { queryKeys } from '@/lib/queryKeys';

/** Update user's bio */
export function useUpdateBio() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, bio }: { userId: string; bio: string }) => updateBio(userId, bio),
    onSuccess: (_data, variables) => {
      // Invalidate profile (contains bio)
      queryClient.invalidateQueries({
        queryKey: queryKeys.user.profile(variables.userId),
      });
      // Invalidate search caches since bio appears in search results
      queryClient.invalidateQueries({
        queryKey: ['search', 'usernames'],
      });
      queryClient.invalidateQueries({
        queryKey: ['search', 'names'],
      });
    },
  });
}

/** Update user's display name */
export function useUpdateName() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, name }: { userId: string; name: string }) => updateName(userId, name),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.user.profile(variables.userId),
      });
      // Name appears in search results
      queryClient.invalidateQueries({
        queryKey: ['search', 'usernames'],
      });
      queryClient.invalidateQueries({
        queryKey: ['search', 'names'],
      });
    },
  });
}

/** Rename username (also updates usernames collection and Auth displayName) */
export function useRenameUsername() {
  const queryClient = useQueryClient();

  return useMutation<RenameUsernameResult, Error, { newUsername: string }>({
    mutationFn: ({ newUsername }) => renameUsername(newUsername),
    onSuccess: (_data, _variables) => {
      // Username change affects many things — broad invalidation
      // Note: we don't have the userId here easily, so invalidate all user profiles
      // In practice, the current user's uid is available via auth context
      queryClient.invalidateQueries({
        queryKey: ['user', 'profile'],
      });
      queryClient.invalidateQueries({
        queryKey: ['search', 'usernames'],
      });
      queryClient.invalidateQueries({
        queryKey: ['search', 'names'],
      });
      // Also invalidate friendships, messages, notifications since they reference username
      queryClient.invalidateQueries({
        queryKey: ['friends', 'friendships'],
      });
      queryClient.invalidateQueries({
        queryKey: ['messages', 'convos'],
      });
      queryClient.invalidateQueries({
        queryKey: ['notifications', 'list'],
      });
    },
  });
}

// Type helpers
export type UseUpdateBioResult = ReturnType<typeof useUpdateBio>;
export type UseUpdateNameResult = ReturnType<typeof useUpdateName>;
export type UseRenameUsernameResult = ReturnType<typeof useRenameUsername>;