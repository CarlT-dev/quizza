import {
  collection,
  getDocsFromServer,
  limit,
  query,
  where,
  type Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

/**
 * notifications/{notificationId} — one doc per event. The ACTOR writes the
 * doc into the RECIPIENT's feed (the rules pin fromUid == auth.uid and
 * userId != auth.uid), so every row's fromUid is the user who caused it: the
 * friend-request sender, the request accepter, or the quiz sharer. Feeds
 * resolve the actor's display name fresh per open (MessagesPage convention)
 * — nothing denormalized, so renames show up.
 */
export type NotificationType = 'friend-request' | 'friend-request-accepted' | 'quiz-share';

export interface NotificationDocument {
  id?: string;
  /** The recipient — whose notification feed this row belongs to. */
  userId: string;
  /** The actor who caused the event (and wrote the doc). */
  fromUid: string;
  type: NotificationType;
  /** quiz-share rows only. */
  quizId?: string;
  /** quiz-share rows only; denormalized so rows survive quiz deletion. */
  quizTitle?: string;
  createdAt: Timestamp;
}

/**
 * Deterministic id for a friend-request notification: one live row per
 * (recipient, sender) pair, so settling the request can delete the exact row
 * without a query (there is no update rule — rows are only ever created or
 * removed). A re-request after decline/cancel recreates the row, because
 * settling deleted it.
 */
export function buildRequestNotificationId(recipientUid: string, fromUid: string): string {
  return `fr_${recipientUid}_${fromUid}`;
}

/**
 * The user's notification rows, newest first. `userId ==` alone — the
 * client-side sort avoids a composite index (project convention, see
 * messages.ts getUserConvos).
 */
export async function getNotifications(
  userId: string,
  maxCount = 50
): Promise<NotificationDocument[]> {
  const q = query(
    collection(db, 'notifications'),
    where('userId', '==', userId),
    limit(maxCount)
  );
  const snapshot = await getDocsFromServer(q);
  const notifications = snapshot.docs.map(d => ({ id: d.id, ...d.data() }) as NotificationDocument);
  return notifications.sort(
    (a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)
  );
}
