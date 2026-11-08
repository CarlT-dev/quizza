import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, Check, AlertTriangle, UserPlus } from 'lucide-react';
import { BottomSheet, Button } from '@/shared/components/ui';
import { useAuth } from '@/features/auth';
import { getUserProfile } from '@/features/users';
import { getOtherParticipantUid, useFriendships } from '@/features/friends';
import { shareQuizToUser } from '../api/messages';
import type { QuizDocument } from '@/features/quiz/api/quiz';

/** One friend's share outcome for the quiz being sent. */
type FriendShareState = 'sent' | 'failed';

interface ShareQuizSheetProps {
  /** The quiz being shared; null keeps the sheet closed. */
  quiz: QuizDocument | null;
  onClose: () => void;
}

/**
 * Friends quick-pick for sharing a quiz from a quiz card's ⋯ menu, hosted in
 * the global BottomSheet (the same slide-up panel the convo page uses for its
 * share sheet). Friends-only by design: the strip shows accepted friends and
 * the search bar filters them client-side. Multi-select, then one Share
 * fan-out — succeeded friends are deselected, failed ones stay selected, so
 * a retry never double-sends to someone who already got the quiz.
 */
export function ShareQuizSheet({ quiz, onClose }: ShareQuizSheetProps) {
  // Hold the last non-null quiz while the sheet animates out, so its content
  // doesn't vanish mid close-animation (React's "adjust state when a prop
  // changes" pattern — a guarded setState during render, not an effect).
  const [shownQuiz, setShownQuiz] = useState(quiz);
  if (quiz !== null && quiz !== shownQuiz) {
    setShownQuiz(quiz);
  }

  return (
    <BottomSheet isOpen={quiz != null} onClose={onClose} title="Share quiz">
      {/* Keyed remount per open: picker state resets every time */}
      {shownQuiz && (
        <ShareSheetContent key={shownQuiz.id} quiz={shownQuiz} onDone={onClose} />
      )}
    </BottomSheet>
  );
}

function ShareSheetContent({ quiz, onDone }: { quiz: QuizDocument; onDone: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const {
    friendships,
    isLoading: friendsLoading,
    error: friendsError,
    refetch: refetchFriendships,
  } = useFriendships();

  const [query, setQuery] = useState('');
  // Friend uid → current username, resolved fresh per open so renames show up.
  const [names, setNames] = useState<Record<string, string>>({});
  const [namesLoading, setNamesLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [outcomes, setOutcomes] = useState<Record<string, FriendShareState>>({});
  const [isSharing, setIsSharing] = useState(false);

  // Accepted friends as uids. Render uses a uid fallback until names land.
  const friendUids =
    user && friendships
      ? friendships.friends.map(f => getOtherParticipantUid(f, user.uid))
      : [];
  const sortedFriendUids = [...friendUids].sort((a, b) =>
    (names[a] ?? a.slice(0, 8)).localeCompare(names[b] ?? b.slice(0, 8))
  );

  // Resolve each friend's current username — same per-uid getUserProfile
  // pattern as MessagesPage, keyed on [user, friendships] (the only inputs
  // the uid list can change on).
  useEffect(() => {
    if (!user || !friendships || friendships.friends.length === 0) return;
    let cancelled = false;

    // Deferred so setNamesLoading isn't a synchronous effect setState
    // (react(set-state-in-effect)) — same pattern as the data hooks.
    void Promise.resolve().then(async () => {
      setNamesLoading(true);
      const uids = friendships.friends.map(f => getOtherParticipantUid(f, user.uid));
      const resolved = await Promise.all(
        uids.map(async uid => {
          try {
            const profile = await getUserProfile(uid);
            return [uid, profile?.name ?? profile?.username ?? uid.slice(0, 8)] as const;
          } catch (err) {
            console.error('Failed to load profile:', err);
            return [uid, uid.slice(0, 8)] as const;
          }
        })
      );
      if (!cancelled) {
        setNames(Object.fromEntries(resolved));
        setNamesLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [user, friendships]);

  const toggleFriend = useCallback((uid: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(uid)) {
        next.delete(uid);
      } else {
        next.add(uid);
      }
      return next;
    });
  }, []);

  const handleShare = useCallback(async () => {
    if (!user || selected.size === 0) return;
    setIsSharing(true);
    const selectedUids = [...selected];
    const results = await Promise.allSettled(
      selectedUids.map(uid => shareQuizToUser(quiz, user.uid, uid))
    );

    const failedUids = selectedUids.filter((_, i) => results[i].status === 'rejected');
    setOutcomes(prev => {
      const next = { ...prev };
      selectedUids.forEach((uid, i) => {
        next[uid] = results[i].status === 'fulfilled' ? 'sent' : 'failed';
      });
      return next;
    });
    // Succeeded friends drop out of the selection; failed ones stay so the
    // next Share press retries only what didn't land.
    setSelected(new Set(failedUids));
    results.forEach(result => {
      if (result.status === 'rejected') {
        console.error('Failed to share quiz:', result.reason);
      }
    });
    setIsSharing(false);
    if (failedUids.length === 0) {
      onDone();
    }
  }, [user, quiz, selected, onDone]);

  const trimmedQuery = query.trim().toLowerCase();
  const visibleFriends = trimmedQuery
    ? sortedFriendUids.filter(uid => (names[uid] ?? '').toLowerCase().includes(trimmedQuery))
    : sortedFriendUids;
  const failedCount = [...selected].filter(uid => outcomes[uid] === 'failed').length;
  const allSelectedFailed = selected.size > 0 && failedCount === selected.size;
  const hasFriends = friendUids.length > 0;

  const renderStrip = () => {
    if (friendsLoading || namesLoading) {
      // One skeleton circle per friend — the strip width matches the real one.
      const skeletonCount = friendUids.length > 0 ? friendUids.length : 3;
      return (
        <div className="flex gap-3 overflow-x-auto" aria-hidden="true">
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5 shrink-0">
              <div className="w-14 h-14 rounded-full skeleton" />
              <div className="h-3 w-12 skeleton skeleton-rounded" />
            </div>
          ))}
        </div>
      );
    }

    if (friendsError) {
      return (
        <div className="py-6 text-center">
          <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{friendsError}</p>
          <Button size="sm" onClick={refetchFriendships}>
            Try Again
          </Button>
        </div>
      );
    }

    if (!user) {
      return (
        <p className="text-sm text-gray-500 dark:text-gray-400 py-6 text-center">
          Please log in to share quizzes.
        </p>
      );
    }

    if (!hasFriends) {
      return (
        <div className="py-6 text-center">
          <div className="w-14 h-14 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mx-auto mb-3">
            <UserPlus className="w-7 h-7 text-primary-500 dark:text-primary-400" aria-hidden="true" />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            No friends yet. Add friends from your profile to share quizzes with them.
          </p>
          <Button size="sm" onClick={() => navigate(`/user/${user.uid}`)}>
            Go to profile
          </Button>
        </div>
      );
    }

    if (visibleFriends.length === 0) {
      return (
        <p className="text-sm text-gray-500 dark:text-gray-400 py-6 text-center">
          No friends matching "{query.trim()}"
        </p>
      );
    }

    return (
      <div className="flex gap-3 overflow-x-auto snap-x pb-1">
        {visibleFriends.map(uid => {
          const isSelected = selected.has(uid);
          const outcome = outcomes[uid];
          const isSent = outcome === 'sent';
          const isFailed = outcome === 'failed';
          const profileName = names[uid] ?? uid.slice(0, 8);

          return (
            <button
              key={uid}
              type="button"
              onClick={() => toggleFriend(uid)}
              disabled={isSent || isSharing}
              aria-pressed={isSelected}
              aria-label={`Share with ${profileName}`}
              className="w-16 flex flex-col items-center gap-1.5 shrink-0 snap-start rounded-xl p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:cursor-default"
            >
              <span
                className={`relative w-14 h-14 rounded-full flex items-center justify-center font-medium text-lg transition-transform active:scale-95 ${
                  isFailed
                    ? 'bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400 ring-2 ring-red-500'
                    : 'bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400'
                } ${
                  isSelected && !isFailed
                    ? 'ring-2 ring-offset-2 ring-primary-500 ring-offset-white dark:ring-offset-gray-800'
                    : ''
                }`}
              >
                {profileName.charAt(0).toUpperCase()}
                {(isSelected || isSent) && !isFailed && (
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full border-2 border-white dark:border-gray-800 flex items-center justify-center ${
                      isSent ? 'bg-green-500' : 'bg-primary-500'
                    }`}
                  >
                    <Check className="w-3 h-3 text-white" aria-hidden="true" />
                  </span>
                )}
              </span>
              <span
                className={`w-full text-xs text-center truncate ${
                  isSent
                    ? 'text-green-600 dark:text-green-400'
                    : isFailed
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-gray-700 dark:text-gray-300'
                }`}
              >
                {profileName}
              </span>
            </button>
          );
        })}
      </div>
    );
  };

  // The search bar only makes sense once there are friends to filter.
  const showSearch =
    !friendsError && (friendsLoading || namesLoading || hasFriends);

  return (
    <div className="px-4 py-4 space-y-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Send{' '}
        <span className="font-medium text-gray-900 dark:text-gray-100">{quiz.title}</span> to
        your friends.
      </p>

      {showSearch && (
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search friends"
            aria-label="Search friends"
            autoComplete="off"
            className="w-full bg-gray-100 dark:bg-gray-800 rounded-xl pl-10 pr-10 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-full text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      {renderStrip()}

      {failedCount > 0 && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          Couldn't share to {failedCount} friend{failedCount === 1 ? '' : 's'} — tap Share
          to retry.
        </p>
      )}

      <Button
        onClick={handleShare}
        disabled={selected.size === 0}
        isLoading={isSharing}
        className="w-full"
      >
        {isSharing
          ? 'Sharing…'
          : allSelectedFailed
            ? `Retry failed (${selected.size})`
            : selected.size > 0
              ? `Share (${selected.size})`
              : 'Share quiz'}
      </Button>
    </div>
  );
}
