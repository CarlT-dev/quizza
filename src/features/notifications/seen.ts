/**
 * Per-device "notifications seen" marker for the Home page's red dot.
 * localStorage on purpose: "seen" is a property of THIS browser (the user
 * opened the panel here), not of the account — the same account signed in on
 * another device still shows its dot until it opens the panel there. There
 * is deliberately no Firestore read-flag to keep in sync.
 */
const SEEN_KEY = 'quizza_notifications_seen_at';

/** Epoch ms of the last panel open on this device; 0 when never opened. */
export function getLastSeenNotificationsAt(): number {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    const parsed = raw ? Number(raw) : 0;
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    // Private mode / blocked storage: everything counts as unseen
    return 0;
  }
}

export function markNotificationsSeen(nowMs: number): void {
  try {
    localStorage.setItem(SEEN_KEY, String(nowMs));
  } catch {
    // Storage unavailable: opening the panel simply never clears the dot
  }
}
