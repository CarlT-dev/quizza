import { useCallback, useEffect, useState } from 'react';
import { getUserProfile, type UserProfile } from '../api/users';

interface UseUserProfileResult {
  profile: UserProfile | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Loads one public profile document (users/{uid}) for the ProfilePage.
 * null profile after a settled load means the user doesn't exist.
 */
export function useUserProfile(uid: string | undefined): UseUserProfileResult {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    // Deferred so setIsLoading isn't a synchronous effect setState
    // (react/set-state-in-effect).
    void Promise.resolve().then(async () => {
      if (!uid) {
        setProfile(null);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const loaded = await getUserProfile(uid);
        if (cancelled) return;
        setProfile(loaded);
        setError(null);
      } catch (err) {
        console.error('Failed to load profile:', err);
        if (!cancelled) setError('Failed to load profile. Please try again.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [uid, reloadToken]);

  const refetch = useCallback(() => setReloadToken(token => token + 1), []);

  return { profile, isLoading, error, refetch };
}
