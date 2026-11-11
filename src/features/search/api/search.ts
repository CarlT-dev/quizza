import { collection, documentId, getDocs, limit, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface UsernameSearchResult {
  username: string;
  uid: string;
  name?: string;
  bio?: string;
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
    .map(d => ({
      username: d.id,
      uid: (d.data().uid as string | undefined) ?? '',
      name: (d.data().name as string | undefined) ?? undefined,
      bio: (d.data().bio as string | undefined) ?? undefined
    }))
    .filter(r => Boolean(r.uid));
}

/**
 * Prefix search over the public usernames collection by the `name` field.
 * Uses a range query on the `name` field — Firestore automatically indexes
 * single fields, so no composite index is required.
 * The  sentinel ensures we match all strings starting with the prefix.
 */
export async function searchNames(prefix: string, maxCount = 10): Promise<UsernameSearchResult[]> {
  const lower = prefix.toLowerCase();
  if (!lower) return [];

  const q = query(
    collection(db, 'usernames'),
    where('name', '>=', lower),
    where('name', '<=', lower + ''),
    limit(maxCount)
  );
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({
      username: d.id,
      uid: (d.data().uid as string | undefined) ?? '',
      name: (d.data().name as string | undefined) ?? undefined,
      bio: (d.data().bio as string | undefined) ?? undefined
    }))
    .filter(r => Boolean(r.uid));
}
