/**
 * Haptic feedback via the Vibration API, with a graceful no-op where it is
 * unsupported (iOS Safari has no navigator.vibrate at all). Never throws —
 * a failed buzz must never break the interaction that triggered it.
 */
export function vibrate(pattern: number | number[] = 15): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
    return;
  }
  try {
    navigator.vibrate(pattern);
  } catch {
    // Vibration can be blocked by settings or hardware; silently ignore.
  }
}
