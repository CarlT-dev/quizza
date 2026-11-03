import { doc, getDoc, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import type { UserStats } from '@/shared/utils/quizStats';

/** Public profile document (users/{uid}). createdAt is an ISO string (register flow). */
export interface UserProfile {
  uid: string;
  username: string;
  email?: string;
  displayName?: string;
  createdAt?: string;
  /** Denormalized first-attempt stats; written on first completions, read by other users. */
  stats?: UserStats;
}

/** Public per-doc read (users get-rule allows any authenticated read). */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  return { uid, ...snap.data() } as UserProfile;
}

/**
 * Resolves several profiles at once with parallel per-doc gets — the users
 * collection has no list permission for other users' docs, so an 'in' query
 * is not an option here.
 */
export async function getUsersByIds(uids: string[]): Promise<Map<string, UserProfile>> {
  const profiles = new Map<string, UserProfile>();
  if (uids.length === 0) return profiles;

  const results = await Promise.allSettled(
    uids.map(async (uid) => ({ uid, profile: await getUserProfile(uid) }))
  );
  results.forEach(result => {
    if (result.status === 'fulfilled' && result.value.profile) {
      profiles.set(result.value.uid, result.value.profile);
    }
  });
  return profiles;
}

/** Persists the denormalized stats copy that other users read on the profile page. */
export async function saveUserStats(userId: string, stats: UserStats): Promise<void> {
  await setDoc(doc(db, 'users', userId), { stats, updatedAt: new Date().toISOString() }, { merge: true });
}

export type RenameUsernameErrorCode = 'unauthenticated' | 'username-taken' | 'rename-failed';

export interface RenameUsernameResult {
  success: boolean;
  errorCode?: RenameUsernameErrorCode;
}

/**
 * Atomically renames a username: the usernames/ reverse-lookup doc is swapped
 * in one batch (set new + release old), then Auth displayName and
 * users/{uid}.username follow. Updating ONLY Auth (the old flow) left
 * users/{uid}.username stale and made the user unsearchable under the new
 * name while the old name stayed reserved.
 *
 * The current username is read from users/{uid}.username — the
 * login-relevant source of truth — not from Auth displayName, which is
 * exactly the value that drifts. A stale displayName must never release a
 * usernames/ reservation owned by someone else.
 *
 * Idempotent on retry: re-reserving a name already owned by the same uid is a
 * no-op set, and deleting the (already removed) old usernames doc needs the
 * null-guarded delete rule.
 */
export async function renameUsername(newUsername: string): Promise<RenameUsernameResult> {
  const user = auth.currentUser;
  if (!user) return { success: false, errorCode: 'unauthenticated' };

  const newLower = newUsername.toLowerCase();

  try {
    const profileSnap = await getDoc(doc(db, 'users', user.uid));
    const storedUsername = (profileSnap.data()?.username as string | undefined)?.toLowerCase() ?? '';
    if (storedUsername === newLower) return { success: true };

    const existing = await getDoc(doc(db, 'usernames', newLower));
    if (existing.exists() && existing.data().uid !== user.uid) {
      return { success: false, errorCode: 'username-taken' };
    }

    const batch = writeBatch(db);
    batch.set(doc(db, 'usernames', newLower), {
      uid: user.uid,
      email: user.email ?? '',
      createdAt: new Date().toISOString(),
    });

    // Release the old reservation only when it really belongs to this user.
    if (storedUsername) {
      const oldReservation = await getDoc(doc(db, 'usernames', storedUsername));
      if (oldReservation.exists() && oldReservation.data().uid === user.uid) {
        batch.delete(doc(db, 'usernames', storedUsername));
      }
    }

    await batch.commit();

    await updateProfile(user, { displayName: newLower });
    await updateDoc(doc(db, 'users', user.uid), {
      username: newLower,
      updatedAt: new Date().toISOString(),
    });

    return { success: true };
  } catch (err) {
    console.error('Failed to rename username:', err);
    return { success: false, errorCode: 'rename-failed' };
  }
}
