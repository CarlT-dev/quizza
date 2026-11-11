import { useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, UserX, Loader2, Calendar } from 'lucide-react';
import { useUserProfile } from '../hooks/useUserProfile';
import { Button } from '@/shared/components/ui';
import { useAuth } from '@/features/auth';
import {
  acceptFriendRequest,
  cancelFriendRequest,
  declineFriendRequest,
  getOtherParticipantUid,
  removeFriend,
  sendFriendRequest,
  useFriendships,
  type FriendshipsData,
  type FriendshipDocument,
} from '@/features/friends';

/** Module-scope helper: keeps `new Date` out of the component render (oxlint purity). */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

type ProfileRelation = 'friends' | 'requested' | 'incoming' | 'none';

/** Relationship to the profile's user, from the current friendship buckets —
 * derived from live data on every render, never from cached action results,
 * so the button always reflects what is actually true in Firestore. */
function relationTo(
  friendships: FriendshipsData | null,
  myUid: string,
  otherUid: string
): ProfileRelation {
  if (!friendships) return 'none';
  const isOther = (f: FriendshipDocument) => getOtherParticipantUid(f, myUid) === otherUid;
  if (friendships.friends.some(isOther)) return 'friends';
  if (friendships.outgoing.some(isOther)) return 'requested';
  if (friendships.incoming.some(isOther)) return 'incoming';
  return 'none';
}

export function ProfilePage() {
  const { uid } = useParams<{ uid: string }>();
  const { user } = useAuth();
  const { profile, isLoading, error, refetch } = useUserProfile(uid);
  const { friendships, refetch: refetchFriendships } = useFriendships();

  // Relationship UI state derives from the CURRENT friendship buckets, never
  // from cached action results — a request accepted elsewhere disappears from
  // this page on the next load.
  const isSelf = !!user && user.uid === uid;
  const relation = relationTo(friendships, user?.uid ?? '', uid ?? '');
  const [isBusy, setIsBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  /** Accept / decline / cancel / remove — boolean APIs, one shape. */
  const runFriendAction = useCallback(async (action: () => Promise<boolean>) => {
    if (isBusy) return;
    setIsBusy(true);
    setFailed(false);
    let ok = false;
    try {
      ok = await action();
    } finally {
      setIsBusy(false);
    }
    // Refetch either way: a settled-but-false result (the request changed
    // elsewhere) still needs current data; only a genuine failure keeps the
    // inline note.
    refetchFriendships();
    if (!ok) setFailed(true);
  }, [isBusy, refetchFriendships]);

  const handleAddFriend = useCallback(async () => {
    if (!profile || isBusy) return;
    setIsBusy(true);
    setFailed(false);
    try {
      const result = await sendFriendRequest(profile.username);
      // Already-friends / pending-either-way are settled states the refetch
      // below renders correctly; only real failures show the note.
      if (
        !result.success &&
        result.errorCode !== 'already-friends' &&
        result.errorCode !== 'request-already-pending' &&
        result.errorCode !== 'request-already-incoming'
      ) {
        setFailed(true);
      }
    } finally {
      setIsBusy(false);
      refetchFriendships();
    }
  }, [profile, isBusy, refetchFriendships]);

  const initial = profile?.username?.charAt(0).toUpperCase() ?? '?';
  const hasBio = profile?.bio && profile.bio.trim().length > 0;

  return (
    <div className="flex-1 bg-primary-50/50 dark:bg-gray-900">
      <main className="pb-8">
        {isLoading ? (
          <div className="max-w-[500px] mx-auto px-4" aria-hidden="true">
            {/* Gradient avatar skeleton */}
            <div className="flex flex-col items-center py-6">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary-400/50 to-primary-500/50 animate-pulse" />
              <div className="h-6 w-40 rounded bg-gray-200 dark:bg-gray-700 animate-pulse mt-3" />
            </div>
            {/* Stats skeletons */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="h-20 rounded-xl bg-gray-200 dark:bg-gray-700 animate-pulse" />
              <div className="h-20 rounded-xl bg-gray-200 dark:bg-gray-700 animate-pulse" />
              <div className="h-20 rounded-xl bg-gray-200 dark:bg-gray-700 animate-pulse" />
            </div>
            {/* Friend action skeleton */}
            <div className="h-12 rounded-xl bg-gray-200 dark:bg-gray-700 animate-pulse" />
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
            {/* Profile Header with Gradient Background */}
           <div className="relative overflow-hidden pb-4 mb-4">
              {/* Gradient background overlay - transparent base */}
              <div className="absolute inset-0 bg-gradient-to-b from-primary-100/60 via-primary-50/30 to-white/60 dark:from-primary-100/60 dark:via-primary-300/20 dark:to-primary-900/20" aria-hidden="true" />

              {/* Header overlay: back button + title positioned over the gradient background */}
              <div className="absolute top-0 left-0 right-0 px-4 py-3 flex items-center justify-between z-10">
                <button
                  type="button"
                  onClick={() => window.history.back()}
                  className="p-1.5 rounded-lg dark:text-white"
                  aria-label="Go back"
                >
                  <ArrowLeft className="w-5 h-5" aria-hidden="true" />
                </button>
              </div>

              <div className="relative flex flex-col items-center px-6 pt-16 pb-0 text-center">
                {/* Avatar */}
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white font-bold text-4xl shadow-lg shadow-primary-500/30">
                  {initial}
                </div>

                {/* Username & Display Name */}
                <div className="mt-4">
                  {profile.name ? (
                    <>
                      <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                        {profile.name}
                      </h2>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">@{profile.username}</p>
                    </>
                  ) : (
                    <>
                      <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                        @{profile.username}
                      </h2>
                      {profile.displayName && profile.displayName !== profile.username && (
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{profile.displayName}</p>
                      )}
                    </>
                  )}
                </div>

                {/* Bio - centered, static display */}
                <div className="w-full max-w-xl px-4">
                  <div className="w-full">
                    {hasBio ? (
                      <p
                        className="text-sm text-gray-400 dark:text-gray-300 leading-relaxed whitespace-pre-wrap text-center"
                      >
                        {profile.bio}
                      </p>
                    ) : (
                      <p className="w-full text-center text-base text-gray-400 dark:text-gray-500 py-4">
                        No bio yet
                      </p>
                    )}
                  </div>
                </div>

                {/* Member since */}
                {profile.createdAt && (
                  <p className="mt-1 flex items-center justify-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                    <Calendar className="w-3 h-3 shrink-0" aria-hidden="true" />
                    Member since {formatDate(profile.createdAt)}
                  </p>
                )}

                {/* Stats - inline with transparent background */}
                <div className="w-full max-w-xl px-4">
                  <div className="flex justify-center">
                    <div className="flex backdrop-blur-sm overflow-hidden">
                      <StatItem
                        value={profile.stats?.iq ?? '—'}
                        label="IQ"
                        isFirst
                        hasDivider
                      />
                      <StatItem
                        value={profile.stats?.avgAccuracy !== undefined ? `${profile.stats.avgAccuracy}%` : '—'}
                        label="Avg Accuracy"
                        hasDivider
                      />
                      <StatItem
                        value={profile.stats?.quizzesTaken ?? '—'}
                        label="Quizzes Taken"
                        isLast
                      />
                    </div>
                  </div>
                </div>

                {/* Friend Actions */}
                {!isSelf && uid && friendships && (
                  <div className="mt-4 flex flex-col items-center w-full max-w-xl px-4">
                    {isBusy ? (
                      <Loader2 className="w-5 h-5 text-gray-400 animate-spin" aria-hidden="true" />
                    ) : relation === 'incoming' ? (
                      <div className="flex items-center gap-2 w-full">
                        <Button
                          size="md"
                          className="flex-1 py-4 font-semibold"
                          onClick={() => runFriendAction(() => acceptFriendRequest(uid!))}
                        >
                          Accept
                        </Button>
                        <Button
                          size="md"
                          variant="secondary"
                          className="flex-1 py-4 font-semibold"
                          onClick={() => runFriendAction(() => declineFriendRequest(uid!))}
                        >
                          Decline
                        </Button>
                      </div>
                    ) : relation === 'friends' ? (
                      <Button
                        size="md"
                        variant="ghost"
                        className="text-red-600 dark:text-red-400 w-full py-4 font-semibold"
                        onClick={() => runFriendAction(() => removeFriend(uid!))}
                      >
                        Remove Friend
                      </Button>
                    ) : relation === 'requested' ? (
                      <Button
                        size="md"
                        variant="secondary"
                        className="w-full py-4 font-semibold"
                        onClick={() => runFriendAction(() => cancelFriendRequest(uid!))}
                      >
                        Cancel request
                      </Button>
                    ) : (
                      <Button size="md" className="w-full py-4 font-semibold" onClick={handleAddFriend}>
                        Add Friend
                      </Button>
                    )}
                    {failed && (
                      <p className="mt-2 text-sm py-4 text-red-600 dark:text-red-400 text-center" role="alert">
                        Something went wrong — try again.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Spacer at bottom */}
            <div className="group w-full flex items-center gap-4 p-4"></div>
          </div>
        )}
      </main>
    </div>
  );
}

interface StatItemProps {
  value: string | number;
  label: string;
  isFirst?: boolean;
  isLast?: boolean;
  hasDivider?: boolean;
}

function StatItem({ value, label, isFirst, isLast, hasDivider }: StatItemProps) {
  return (
    <div
      className={`flex-1 flex flex-col items-center py-4 px-6 relative ${isFirst ? 'rounded-l-2xl' : ''} ${isLast ? 'rounded-r-2xl' : ''}`}
    >
      <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
        {value}
      </div>
      <div className="mt-1 text-xs text-center text-gray-500 dark:text-gray-400 uppercase tracking-wider">
        {label}
      </div>
      {hasDivider && (
        <div
          className="absolute right-0 top-3 bottom-3 w-px bg-gray-300/50 dark:bg-gray-600/50"
          aria-hidden="true"
        />
      )}
    </div>
  );
}