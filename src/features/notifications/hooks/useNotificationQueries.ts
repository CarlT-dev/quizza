import { useQuery } from '@tanstack/react-query';
import { getNotifications } from '../api/notifications';
import { queryKeys } from '@/lib/queryKeys';

/** Fetch notification feed for a user */
export function useNotifications(userId: string | undefined) {
  return useQuery({
    queryKey: userId ? queryKeys.notifications.list(userId) : ['notifications', 'list', ''],
    queryFn: () => getNotifications(userId!),
    enabled: !!userId,
    // Notifications are time-sensitive; short staleTime for fresh feel
    staleTime: 1000 * 30, // 30 seconds
    // Refetch interval for live feel (optional — panel opens trigger refetch anyway)
    refetchInterval: 1000 * 60 * 2, // 2 minutes when window focused
  });
}

// Type helper
export type UseNotificationsResult = ReturnType<typeof useNotifications>;