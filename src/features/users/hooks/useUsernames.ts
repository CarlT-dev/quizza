import { useEffect, useReducer } from 'react';
import { getUsersByIds } from '../api/users';

/** Module-level cache (uid → username) shared across Home/Quizzes/Profile/Search. */
const usernameCache = new Map<string, string>();

/**
 * Resolves uids to usernames through the shared cache. Uids not yet cached
 * are fetched once (parallel per-doc gets) and cached for every consumer.
 * Cached entries are read during render so an already-known name appears
 * immediately; a completed fetch bumps a version counter to re-render once.
 */
export function useUsernames(uids: string[]): Map<string, string> {
  const [, bumpVersion] = useReducer((v: number) => v + 1, 0);
  const uidsKey = uids.slice().sort().join(',');

  useEffect(() => {
    const ids = uidsKey === '' ? [] : uidsKey.split(',');
    const missing = ids.filter(uid => !usernameCache.has(uid));
    if (missing.length === 0) return;
    let cancelled = false;

    getUsersByIds(missing)
      .then(profiles => {
        profiles.forEach((profile, uid) => {
          if (profile.username) usernameCache.set(uid, profile.username);
        });
        if (!cancelled) bumpVersion();
      })
      .catch(err => console.error('Failed to fetch usernames:', err));

    return () => { cancelled = true; };
  }, [uidsKey]);

  const names = new Map<string, string>();
  uids.forEach(uid => {
    const cached = usernameCache.get(uid);
    if (cached) names.set(uid, cached);
  });
  return names;
}
