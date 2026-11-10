import { AlertTriangle, UserX } from 'lucide-react';
import { useCurrentUserProfile } from '../hooks/useCurrentUserProfile';
import { ProfileHeader } from '../components/ProfileHeader';
import { CreatedQuizzes } from '../components/CreatedQuizzes';
import { Button } from '@/shared/components/ui';

/** Module-scope helper: keeps `new Date` out of the component render (oxlint purity). */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

export function ProfilePage() {
  const { profile, isLoading, error, refetch, updateBio } = useCurrentUserProfile();

  return (
    <div className="relative flex-1 bg-primary-50/50 dark:bg-gray-900">
      <main className="pb-8">
        {isLoading ? (
          <div className="max-w-[500px] mx-auto px-4" aria-hidden="true">
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
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Profile not found</h2>
              <p className="text-gray-500 dark:text-gray-400">
                Unable to load your profile data.
              </p>
            </div>
          </div>
        ) : (
          <div className="max-w-[500px] mx-auto">
            <ProfileHeader
              username={profile.username}
              name={profile.name}
              displayName={profile.displayName}
              bio={profile.bio}
              createdAt={profile.createdAt}
              onUpdateBio={updateBio}
              quizzesCreated={profile.quizzesCreated}
              quizzesTaken={profile.quizzesTaken}
              bestAccuracy={profile.bestAccuracy}
              onBack={() => window.history.back()}
              title="Profile"
            />

            <div className='px-4 mb-2 mt-6'>
              <span className='tracking-wider text-gray-500 dark:text-gray-100 font-semibold'>
                Created Quiz
              </span>
            </div>
            <CreatedQuizzes
              quizzes={profile.mostAnsweredQuizzes}
            />
            <div className="group w-full flex items-center gap-4 p-4"></div>
          </div>
        )}
      </main>
    </div>
  );
}