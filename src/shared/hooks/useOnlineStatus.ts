import { useState, useEffect, useCallback } from 'react';

/**
 * Hook for detecting online/offline status.
 * Uses native navigator.onLine + online/offline events with periodic fetch polling
 * for reliability (browser events don't always fire in all scenarios).
 */
interface OnlineStatusState {
  /** Current online status */
  isOnline: boolean;
  /** True if we just transitioned from offline to online (for "back online" notification) */
  wasOffline: boolean;
  /** Call to acknowledge the reconnect notification */
  acknowledgeReconnect: () => void;
}

export function useOnlineStatus(): OnlineStatusState {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof navigator !== 'undefined') {
      return navigator.onLine;
    }
    return true; // Default to online for SSR
  });

  const [wasOffline, setWasOffline] = useState(false);

  const acknowledgeReconnect = useCallback(() => {
    setWasOffline(false);
  }, []);

  useEffect(() => {
    // Handler for browser online/offline events
    const handleOnline = () => {
      setIsOnline(true);
      setWasOffline(true); // Trigger "you're back online" notification
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Periodic fetch polling as fallback (some browsers don't fire events reliably)
    // Uses favicon.ico as a lightweight endpoint that always exists
    const interval = setInterval(async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        await fetch('/favicon.ico', {
          method: 'HEAD',
          cache: 'no-cache',
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        if (!isOnline) {
          handleOnline();
        }
      } catch {
        if (isOnline) {
          handleOffline();
        }
      }
    }, 30000); // Check every 30 seconds

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [isOnline]);

  return { isOnline, wasOffline, acknowledgeReconnect };
}