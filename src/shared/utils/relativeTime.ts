/**
 * Compact relative time for row captions ("just now", "5m ago", "2h ago",
 * "3d ago", then a short date). Takes a Firestore Timestamp ({ toMillis }),
 * a Date, or an epoch-ms number.
 */
export function formatRelativeTime(
  timestamp: { toMillis: () => number } | Date | number
): string {
  const ms =
    typeof timestamp === 'number'
      ? timestamp
      : timestamp instanceof Date
        ? timestamp.getTime()
        : timestamp.toMillis();

  const minutes = Math.floor((Date.now() - ms) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
