import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState, type ReactNode } from 'react';

/**
 * Creates a stable QueryClient instance per session.
 * Using useState initializer ensures the same client persists across renders.
 */
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Data is considered fresh for 5 minutes — no refetch on mount/remount
        staleTime: 1000 * 60 * 5,
        // Inactive queries are garbage-collected after 30 minutes
        gcTime: 1000 * 60 * 30,
        // Don't refetch on window focus (mobile-friendly, avoids Firestore spam)
        refetchOnWindowFocus: false,
        // Refetch on reconnect is useful for mobile/network flakiness
        refetchOnReconnect: 'always',
        // Retry once on failure — fail fast on permission-denied (common in Firestore)
        retry: 1,
        // Don't throw errors to error boundary; let components handle isError
        throwOnError: false,
      },
      mutations: {
        // Mutations should never auto-retry — user must explicitly retry
        retry: 0,
        // Don't throw; let components handle mutation state
        throwOnError: false,
      },
    },
  });
}

interface QueryProviderProps {
  children: ReactNode;
}

/**
 * QueryProvider wraps the app with TanStack Query's QueryClientProvider
 * and includes ReactQueryDevtools in development mode.
 */
export function QueryProvider({ children }: QueryProviderProps) {
  const [queryClient] = useState(makeQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* DevTools only mount in development; zero cost in production */}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}