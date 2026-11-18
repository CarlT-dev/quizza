import { useQuery } from '@tanstack/react-query';
import { searchUsernames, searchNames } from '../api/search';
import { queryKeys } from '@/lib/queryKeys';

/** Search usernames by prefix */
export function useSearchUsernames(prefix: string) {
  return useQuery({
    queryKey: queryKeys.search.usernames(prefix),
    queryFn: () => searchUsernames(prefix),
    enabled: prefix.length >= 2, // Only search with 2+ characters
    // Search results should feel instant; short staleTime for fresh results
    staleTime: 1000 * 30, // 30 seconds
    // Don't refetch on window focus for search
    refetchOnWindowFocus: false,
  });
}

/** Search display names by prefix */
export function useSearchNames(prefix: string) {
  return useQuery({
    queryKey: queryKeys.search.names(prefix),
    queryFn: () => searchNames(prefix),
    enabled: prefix.length >= 2,
    staleTime: 1000 * 30,
    refetchOnWindowFocus: false,
  });
}

// Type helpers
export type UseSearchUsernamesResult = ReturnType<typeof useSearchUsernames>;
export type UseSearchNamesResult = ReturnType<typeof useSearchNames>;