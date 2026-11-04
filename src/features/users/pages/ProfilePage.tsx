import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, UserX } from 'lucide-react';
import { useUserProfile } from '../hooks/useUserProfile';
import { StatTile, Button } from '@/shared/components/ui';

/** Module-scope helper: keeps `new Date` out of the component render (oxlint purity). */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

export function ProfilePage() {
  const navigate = useNavigate();
  const { uid } = useParams<{ uid: string }>();
  const { profile, isLoading, error, refetch } = useUserProfile(uid);

  return (
    <div className="flex-1 bg-primary-50/30 dark:bg-gray-900">
      {/* Header with back button — no footer nav on profile pages */}
      <header className="flex items-center gap-2 px-4 py-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-1.5 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5" aria-hidden="true" />
        </button>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Profile</h1>
      </header>

      <main className="px-4 pb-8">
        {isLoading ? (
          <div className="max-w-[500px] mx-auto" aria-hidden="true">
            <div className="flex flex-col items-center py-6">
              <div className="w-20 h-20 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
              <div className="h-5 w-32 rounded bg-gray-200 dark:bg-gray-700 animate-pulse mt-3" />
            </div>
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="h-20 rounded-xl bg-gray-200 dark:bg-gray-700 animate-pulse" />
              <div className="h-20 rounded-xl bg-gray-200 dark:bg-gray-700 animate-pulse" />
              <div className="h-20 rounded-xl bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>
            <div className="h-24 rounded-2xl bg-gray-200 dark:bg-gray-700 animate-pulse" />
          </div>
        ) : error ? (
          <div className="max-w-[500px] mx-auto flex items-center justify-center py-12">
            <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl border border-red-200 dark:border-red-800 p-8 text-center">
              <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Unable to Load Profile</h2>
              <p className="text-gray-500 dark:text-gray-400 mb-6">{error}</p>
              <Button onClick={refetch} className="w-full">
                Try Again
              </Button>
            </div>
          </div>
        ) : !profile ? (
          <div className="max-w-[500px] mx-auto flex items-center justify-center py-12">
            <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mx-auto mb-4">
                <UserX className="w-8 h-8 text-gray-400" aria-hidden="true" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">User not found</h2>
              <p className="text-gray-500 dark:text-gray-400">
                This account doesn't exist or is no longer available.
              </p>
            </div>
          </div>
        ) : (
          <div className="max-w-[500px] mx-auto">
            <div className="flex flex-col items-center py-6">
              <div className="w-20 h-20 rounded-full bg-primary-500 flex items-center justify-center text-white font-medium text-3xl">
                {profile.username.charAt(0).toUpperCase()}
              </div>
              <h2 className="mt-3 text-lg font-bold text-gray-900 dark:text-gray-100">
                @{profile.username}
              </h2>
              {profile.createdAt && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Member since {formatDate(profile.createdAt)}
                </p>
              )}
            </div>

            {/* First-attempt stats ('—' for legacy users until their next first
                completion writes the denormalized stats copy) */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <StatTile value={profile.stats ? profile.stats.iq : '—'} label="IQ" />
              <StatTile value={profile.stats ? `${profile.stats.avgAccuracy}%` : '—'} label="Avg accuracy" tone="green" />
              <StatTile value={profile.stats ? profile.stats.quizzesTaken : '—'} label="Quizzes taken" />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
