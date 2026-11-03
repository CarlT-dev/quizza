import { collection, documentId, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getPublicQuizzes, type QuizDocument } from '@/features/quiz';

export interface UsernameSearchResult {
  username: string;
  uid: string;
}

/**
 * Prefix search over the public usernames collection via a documentId range
 * query — Firestore has no substring search, so this matches
 * username-starts-with only. The doc id IS the lowercase username, and each
 * doc carries the owner's uid for the profile link.
 */
export async function searchUsernames(prefix: string, maxCount = 10): Promise<UsernameSearchResult[]> {
  const lower = prefix.toLowerCase();
  if (!lower) return [];

  const q = query(
    collection(db, 'usernames'),
    where(documentId(), '>=', lower),
    where(documentId(), '<=', lower + ''),
    limit(maxCount)
  );
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ username: d.id, uid: (d.data().uid as string | undefined) ?? '' }))
    .filter(r => Boolean(r.uid));
}

/**
 * Per-session cache of the public quiz feed: Search filters it client-side on
 * every keystroke, so the (up to 50) newest public quizzes are fetched once
 * and reused. A failed fetch leaves the cache empty and retries next call.
 */
let publicQuizzesCache: QuizDocument[] | null = null;

export async function getCachedPublicQuizzes(): Promise<QuizDocument[]> {
  if (!publicQuizzesCache) {
    publicQuizzesCache = await getPublicQuizzes(50);
  }
  return publicQuizzesCache;
}
