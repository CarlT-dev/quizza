import {
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  getDocsFromServer,
  increment,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
  type Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { QuizDocument } from '@/features/quiz/api/quiz';

/**
 * convos/{convoId} — one convo per ordered pair of users; the deterministic
 * id follows the `${userId}_${quizId}` side-doc convention. List fields
 * (lastQuizTitle/lastSharedBy/lastShareAt) are denormalized so the convo
 * list renders without extra reads.
 */
export interface ConvoDocument {
  id?: string;
  /** Exactly 2 uids, lexicographically sorted (same order as the doc id). */
  participants: string[];
  createdAt: Timestamp;
  lastShareAt: Timestamp;
  lastQuizTitle: string;
  lastSharedBy: string;
  shareCount: number;
}

/**
 * convos/{convoId}/shares/{shareId} — one shared quiz, the "message" of the
 * convo. quizTitle/topic are denormalized so bubbles still render after the
 * quiz document is deleted.
 */
export interface ShareDocument {
  id?: string;
  quizId: string;
  quizTitle: string;
  topic: string;
  sharedBy: string;
  sharedAt: Timestamp;
}

/** Both members of a pair must compute the same id; sort() makes it order-independent. */
export function buildConvoId(uidA: string, uidB: string): string {
  return [uidA, uidB].sort().join('_');
}

/** The other member of the pair; falls back to myUid for malformed docs. */
export function getOtherParticipantId(convo: ConvoDocument, myUid: string): string {
  return convo.participants.find(uid => uid !== myUid) ?? myUid;
}

/**
 * The user's convo rows, newest activity first. `participants array-contains`
 * alone — the client-side sort avoids a composite index (project convention,
 * see quiz.ts getUserAttempts).
 */
export async function getUserConvos(userId: string, maxCount = 50): Promise<ConvoDocument[]> {
  const q = query(
    collection(db, 'convos'),
    where('participants', 'array-contains', userId),
    limit(maxCount)
  );
  const snapshot = await getDocsFromServer(q);
  const convos = snapshot.docs.map(d => ({ id: d.id, ...d.data() }) as ConvoDocument);
  return convos.sort(
    (a, b) => (b.lastShareAt?.toMillis?.() ?? 0) - (a.lastShareAt?.toMillis?.() ?? 0)
  );
}

/**
 * The shares inside one convo, unsorted — the caller orders them (the convo
 * page renders oldest-first, chat-style).
 */
export async function getConvoShares(convoId: string, maxCount = 50): Promise<ShareDocument[]> {
  const snapshot = await getDocs(
    query(collection(db, 'convos', convoId, 'shares'), limit(maxCount))
  );
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }) as ShareDocument);
}

/**
 * Shares a quiz into the recipient's personal convo:
 * 1. Ensures the parent convo exists — the shares create-rule get()s it, and
 *    within a batch that get() sees pre-batch state, so this must commit
 *    first. Existence-checked (not merge:true) so createdAt/shareCount are
 *    written exactly once, at creation.
 * 2. One atomic batch: the share doc, the convo's list stats (skipped when
 *    the convo was just created — its initial payload already carries them),
 *    and quizzes/{id}.sharedWith arrayUnion so the recipient passes the read
 *    rule and can play the quiz.
 */
export async function shareQuizToUser(
  quiz: QuizDocument,
  fromUid: string,
  toUid: string
): Promise<void> {
  if (!quiz.id) throw new Error('Cannot share a quiz without an id');
  if (fromUid === toUid) throw new Error('Cannot share a quiz with yourself');

  const convoId = buildConvoId(fromUid, toUid);
  const convoRef = doc(db, 'convos', convoId);

  const convoSnap = await getDoc(convoRef);
  const isNewConvo = !convoSnap.exists();
  if (isNewConvo) {
    await setDoc(convoRef, {
      participants: [fromUid, toUid].sort(),
      createdAt: serverTimestamp(),
      lastShareAt: serverTimestamp(),
      lastQuizTitle: quiz.title,
      lastSharedBy: fromUid,
      shareCount: 1,
    });
  }

  const shareRef = doc(collection(db, 'convos', convoId, 'shares')); // auto id, no write yet
  const batch = writeBatch(db);
  batch.set(shareRef, {
    quizId: quiz.id,
    quizTitle: quiz.title,
    topic: quiz.topic,
    sharedBy: fromUid,
    sharedAt: serverTimestamp(),
  });
  if (!isNewConvo) {
    batch.update(convoRef, {
      lastShareAt: serverTimestamp(),
      lastQuizTitle: quiz.title,
      lastSharedBy: fromUid,
      shareCount: increment(1),
    });
  }
  batch.update(doc(db, 'quizzes', quiz.id), { sharedWith: arrayUnion(toUid) });
  await batch.commit();
}
