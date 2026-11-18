import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus';
import { Wifi, WifiOff, X } from 'lucide-react';
import { useState, useEffect } from 'react';

/**
 * Persistent banner that shows at the top of the screen when offline,
 * and briefly shows a "back online" message when connection is restored.
 */
export function OfflineBanner() {
  const { isOnline, wasOffline, acknowledgeReconnect } = useOnlineStatus();
  const [showReconnect, setShowReconnect] = useState(false);

  // Show "back online" notification for 5 seconds when reconnecting
  useEffect(() => {
    if (wasOffline) {
      setShowReconnect(true);
      const timeoutId = setTimeout(() => {
        setShowReconnect(false);
        acknowledgeReconnect();
      }, 5000);
      return () => clearTimeout(timeoutId);
    }
  }, [wasOffline, acknowledgeReconnect]);

  // Nothing to show if online and not in reconnect notification period
  if (isOnline && !showReconnect) return null;

  return (
    <div
      className={`
        fixed top-0 left-0 right-0 z-40 px-4 py-2 text-center text-sm font-medium transition-all duration-300
        ${isOnline
          ? 'bg-green-500 text-white shadow-lg'
          : 'bg-amber-500 text-white shadow-lg'
        }
      `}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="max-w-[500px] mx-auto flex items-center justify-center gap-2">
        {isOnline ? (
          // Back online notification
          <>
            <Wifi className="w-4 h-4 animate-pulse" aria-hidden="true" />
            <span>You're back online</span>
          </>
        ) : (
          // Offline banner
          <>
            <WifiOff className="w-4 h-4" aria-hidden="true" />
            <span>You're offline. Changes will sync when reconnected.</span>
            <button
              onClick={acknowledgeReconnect}
              className="ml-2 px-2 py-1 text-xs bg-white/20 rounded hover:bg-white/30 transition-colors flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-amber-500"
              aria-label="Dismiss offline banner"
            >
              <X className="w-3 h-3" aria-hidden="true" />
              Dismiss
            </button>
          </>
        )}
      </div>
    </div>
  );
}