import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/features/auth';
import { getCurrentUserProfile, updateBio, type CurrentUserProfile } from '../api';

interface UseCurrentUserProfileResult {
  profile: CurrentUserProfile | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  updateBio: (bio: string) => Promise<void>;
  isUpdating: boolean;
}

/**
 * Hook for loading the current user's profile with stats and most answered quizzes.
 * Provides an updateBio function with optimistic updates.
 */
export function useCurrentUserProfile(): UseCurrentUserProfileResult {
  const { user } = useAuth();
  const [profile, setProfile] = useState<CurrentUserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const fetchProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const loaded = await getCurrentUserProfile(user.uid);
      setProfile(loaded);
    } catch (err) {
      console.error('Failed to load profile:', err);
      setError('Failed to load profile. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile, reloadToken]);

  const refetch = useCallback(() => setReloadToken(t => t + 1), []);

  const handleUpdateBio = useCallback(async (bio: string) => {
    if (!user) return;

    setIsUpdating(true);
    // Optimistic update
    setProfile(prev => prev ? { ...prev, bio: bio.trim().slice(0, 160) } : null);

    try {
      await updateBio(user.uid, bio);
    } catch (err) {
      console.error('Failed to update bio:', err);
      // Rollback on error
      fetchProfile();
      throw err;
    } finally {
      setIsUpdating(false);
    }
  }, [user, fetchProfile]);

  return { profile, isLoading, error, refetch, updateBio: handleUpdateBio, isUpdating };
}