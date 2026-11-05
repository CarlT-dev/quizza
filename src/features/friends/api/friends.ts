import {
  collection,
  doc,
  getDoc,
  getDocsFromServer,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  where,
  writeBatch,
  type Timestamp,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { buildRequestNotificationId } from '@/features/notifications';

/**
 * friendships/{uidA_uidB} — one doc per pair of users; the deterministic id
 * follows the convos convention, so a request from A to B and from B to A
 * can only ever land on the same document. The doc carries the request
 * lifecycle: `pending` until the non-requester accepts, which flips status
 * to `accepted`. Decline, cancel and unfriend all delete the doc, freeing
 * the pair id for a future re-request.
 */
export type FriendshipStatus = 'pending' | 'accepted';

export interface FriendshipDocument {
  id?: string;
  /** Exactly 2 uids, lexicographically sorted (same order as the doc id). */
  participants: string[];
  status: FriendshipStatus;
  /** The uid who sent the request; decides whose "outgoing" / whose "incoming". */
  requestedBy: string;
  createdAt: Timestamp;
  /** Set only on accept. */
  respondedAt?: Timestamp;
}

/** Both members of a pair must compute the same id; sort() makes it order-independent. */
export function buildFriendshipId(uidA: string, uidB: string): string {
  return [uidA, uidB].sort().join('_');
}

/** The other member of the pair; falls back to myUid for malformed docs. */
export function getOtherParticipantUid(
  friendship: FriendshipDocument,
  myUid: string
): string {
  return friendship.participants.find(uid => uid !== myUid) ?? myUid;
}

/** The user's friendships, partitioned by request lifecycle stage. */
export interface FriendshipsData {
  /** Accepted friendships (both directions). */
  friends: FriendshipDocument[];
  /** Pending requests the user received (someone else asked them). */
  incoming: FriendshipDocument[];
  /** Pending requests the user sent. */
  outgoing: FriendshipDocument[];
}

/**
 * The user's friendships, partitioned into friends / incoming / outgoing.
 * `participants array-contains` alone — the client-side partition avoids a
 * composite index (project convention, see messages.ts getUserConvos). No
 * sort here — callers order rows after usernames resolve.
 */
export async function getFriendships(
  userId: string,
  maxCount = 200
): Promise<FriendshipsData> {
  const q = query(
    collection(db, 'friendships'),
    where('participants', 'array-contains', userId),
    limit(maxCount)
  );
  const snapshot = await getDocsFromServer(q);
  const data: FriendshipsData = { friends: [], incoming: [], outgoing: [] };
  for (const d of snapshot.docs) {
    const friendship = { id: d.id, ...d.data() } as FriendshipDocument;
    if (friendship.status === 'accepted') {
      data.friends.push(friendship);
    } else if (friendship.requestedBy !== userId) {
      data.incoming.push(friendship);
    } else {
      data.outgoing.push(friendship);
    }
  }
  return data;
}

export type FriendRequestErrorCode =
  | 'unauthenticated'
  | 'invalid-username'
  | 'username-not-found'
  | 'self-request'
  | 'already-friends'
  | 'request-already-pending'
  | 'request-already-incoming'
  | 'send-failed';

export interface FriendRequestResult {
  success: boolean;
  errorCode?: FriendRequestErrorCode;
}

/**
 * Sends a friend request to the owner of a username. Resolves the uid via
 * the public usernames collection, then creates friendships/{pairId} inside
 * a transaction — the deterministic id makes the collision check atomic, so
 * a request from either direction can never produce a second doc or skip
 * consent (the write must satisfy the friendships create-rule, which pins
 * the canonical pair id).
 */
export async function sendFriendRequest(
  targetUsername: string
): Promise<FriendRequestResult> {
  const user = auth.currentUser;
  if (!user) return { success: false, errorCode: 'unauthenticated' };

  const lower = targetUsername.trim().toLowerCase();
  if (!lower) return { success: false, errorCode: 'invalid-username' };

  try {
    const usernameSnap = await getDoc(doc(db, 'usernames', lower));
    const targetUid = usernameSnap.exists()
      ? (usernameSnap.data().uid as string | undefined)
      : undefined;
    if (!targetUid) return { success: false, errorCode: 'username-not-found' };
    if (targetUid === user.uid) {
      return { success: false, errorCode: 'self-request' };
    }

    const friendshipRef = doc(db, 'friendships', buildFriendshipId(user.uid, targetUid));
    const collision = await runTransaction(db, async (tx) => {
      const snap = await tx.get(friendshipRef);
      if (snap.exists()) {
        const existing = snap.data() as FriendshipDocument;
        if (existing.status === 'accepted') return 'already-friends' as const;
        return existing.requestedBy === user.uid
          ? ('request-already-pending' as const)
          : ('request-already-incoming' as const);
      }
      tx.set(friendshipRef, {
        participants: [user.uid, targetUid].sort(),
        status: 'pending' as const,
        requestedBy: user.uid,
        createdAt: serverTimestamp(),
      });
      // The recipient's notification row rides in the same transaction: the
      // request and the row announcing it can never exist apart. The
      // deterministic id lets the recipient settle (accept/decline) it later.
      tx.set(
        doc(db, 'notifications', buildRequestNotificationId(targetUid, user.uid)),
        {
          userId: targetUid,
          fromUid: user.uid,
          type: 'friend-request' as const,
          createdAt: serverTimestamp(),
        }
      );
      return null;
    });

    return collision ? { success: false, errorCode: collision } : { success: true };
  } catch (err) {
    console.error('Failed to send friend request:', err);
    return { success: false, errorCode: 'send-failed' };
  }
}

/**
 * Accepts a pending incoming request and settles its notification in one
 * atomic transaction: the status flip, the removal of the pending row from
 * my own feed, and the "accepted" confirmation dropped into the requester's
 * feed — so their notification panel reflects the accept without any
 * re-request. Only the non-requester may do this (rules-enforced); a false
 * return after a double-tap just means the request is already settled — the
 * caller refetches and the row leaves the feed.
 */
export async function acceptFriendRequest(otherUid: string): Promise<boolean> {
  const user = auth.currentUser;
  if (!user) return false;

  const friendshipRef = doc(db, 'friendships', buildFriendshipId(user.uid, otherUid));
  try {
    return await runTransaction(db, async (tx) => {
      const snap = await tx.get(friendshipRef);
      if (!snap.exists()) return false;
      const existing = snap.data() as FriendshipDocument;
      if (existing.status !== 'pending' || existing.requestedBy === user.uid) return false;

      tx.update(friendshipRef, {
        status: 'accepted' as const,
        respondedAt: serverTimestamp(),
      });
      // Retire the pending row from my own feed (owner delete)…
      tx.delete(doc(db, 'notifications', buildRequestNotificationId(user.uid, otherUid)));
      // …and notify the requester, whose "accepted" row is unique per event
      // (auto id — there is no update rule to overwrite a previous one).
      tx.set(doc(collection(db, 'notifications')), {
        userId: otherUid,
        fromUid: user.uid,
        type: 'friend-request-accepted' as const,
        createdAt: serverTimestamp(),
      });
      return true;
    });
  } catch (err) {
    console.error('Failed to accept friend request:', err);
    return false;
  }
}

/**
 * Deletes a friendship doc after verifying the caller's direction, guarded
 * by the rules' participant-only delete. Shared by decline (pending, sent
 * by the other side), cancel (pending, sent by me) and removeFriend
 * (accepted). A pending settle also retracts the pair's friend-request
 * notification row in the same atomic batch — for cancel that row lives in
 * the OTHER user's feed, which the rules permit because its fromUid is the
 * canceller (a sender may retract what they planted).
 */
async function deleteFriendshipIf(
  otherUid: string,
  predicate: (existing: FriendshipDocument, myUid: string) => boolean
): Promise<boolean> {
  const user = auth.currentUser;
  if (!user) return false;

  const friendshipRef = doc(db, 'friendships', buildFriendshipId(user.uid, otherUid));
  try {
    const snap = await getDoc(friendshipRef);
    if (!snap.exists()) return false;
    const existing = snap.data() as FriendshipDocument;
    if (!predicate(existing, user.uid)) return false;

    // fr_{recipient}_{sender}: the recipient is whoever did NOT send. For an
    // accepted pair the row was already deleted at accept, so this delete is
    // a no-op — kept uniform so a settled request can never leave its row.
    const batch = writeBatch(db);
    batch.delete(friendshipRef);
    batch.delete(
      doc(
        db,
        'notifications',
        buildRequestNotificationId(
          existing.requestedBy === user.uid ? otherUid : user.uid,
          existing.requestedBy
        )
      )
    );
    await batch.commit();
    return true;
  } catch (err) {
    console.error('Failed to delete friendship:', err);
    return false;
  }
}

/** Declines a pending incoming request (doc deleted; the sender may re-request). */
export function declineFriendRequest(otherUid: string): Promise<boolean> {
  return deleteFriendshipIf(
    otherUid,
    (existing, myUid) => existing.status === 'pending' && existing.requestedBy !== myUid
  );
}

/** Cancels the caller's own pending outgoing request. */
export function cancelFriendRequest(otherUid: string): Promise<boolean> {
  return deleteFriendshipIf(
    otherUid,
    (existing, myUid) => existing.status === 'pending' && existing.requestedBy === myUid
  );
}

/**
 * Removes an accepted friendship. Intentionally does not touch convos or
 * quizzes.sharedWith — previously shared quizzes stay playable under the
 * app's open-sharing model.
 */
export function removeFriend(otherUid: string): Promise<boolean> {
  return deleteFriendshipIf(otherUid, (existing) => existing.status === 'accepted');
}
