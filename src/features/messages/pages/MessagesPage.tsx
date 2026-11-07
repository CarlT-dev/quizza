import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, AlertTriangle, MessageCircle } from 'lucide-react';
import { useAuth } from '@/features/auth';
import { getUserProfile } from '@/features/users';
import { formatRelativeTime } from '@/shared/utils';
import { getOtherParticipantUid, useFriendships } from '@/features/friends';
import { getOtherParticipantId, getUserConvos, type ConvoDocument } from '../api/messages';

export function MessagesPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { friendships, isLoading: friendsLoading } = useFriendships();

  const [convos, setConvos] = useState<ConvoDocument[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  // True while the names effect is resolving usernames — rows stay as
  // skeletons until it settles, so a uid slice never renders.
  const [namesLoading, setNamesLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;

    // Deferred so setIsLoading isn't a synchronous effect setState
    // (react(set-state-in-effect)) — same pattern as the quiz data hooks.
    void Promise.resolve().then(async () => {
      if (!user) {
        setError('Please log in to view your messages');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        const data = await getUserConvos(user.uid);
        if (cancelled) return;
        setConvos(data);
      } catch (err) {
        console.error('Failed to fetch conversations:', err);
        if (!cancelled) setError('Failed to load conversations. Please try again.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [user, authLoading, reloadToken]);

  // Resolve each unique other participant's current username — conversations
  // AND friends — fetched fresh every visit, so renames show up. Falls back
  // to a uid slice.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    void Promise.resolve().then(async () => {
      setNamesLoading(true);
      const otherUids = [
        ...new Set([
          ...convos.map(convo => getOtherParticipantId(convo, user.uid)),
          ...(friendships
            ? friendships.friends.map(f => getOtherParticipantUid(f, user.uid))
            : []),
        ]),
      ];
      const resolved = await Promise.all(
        otherUids.map(async uid => {
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
  }, [user, convos, friendships]);

  const handleRetry = () => setReloadToken(token => token + 1);

  // Friends with no conversation yet appear as rows too, so a first share is
  // one tap away (they open into the empty convo page).
  const friendOnlyUids =
    user && friendships
      ? friendships.friends
          .map(f => getOtherParticipantUid(f, user.uid))
          .filter(uid => !convos.some(c => getOtherParticipantId(c, user.uid) === uid))
      : [];
  const sortedFriendOnlyUids = [...friendOnlyUids].sort((a, b) =>
    (names[a] ?? a.slice(0, 8)).localeCompare(names[b] ?? b.slice(0, 8))
  );

  const renderContent = () => {
    if (authLoading || isLoading || friendsLoading || namesLoading) {
      return (
        <div className="max-w-[500px] mx-auto px-4 py-4" aria-hidden="true">
          <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <div className="w-11 h-11 rounded-full skeleton" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-28 skeleton skeleton-rounded" />
                  <div className="h-3 w-44 skeleton skeleton-rounded" />
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl border border-red-200 dark:border-red-800 p-8 text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Unable to Load Messages</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">{error}</p>
            <button
              type="button"
              onClick={handleRetry}
              className="w-full px-4 py-2.5 rounded-xl bg-primary-500 hover:bg-primary-600 text-white font-medium transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }

    if (convos.length === 0 && sortedFriendOnlyUids.length === 0) {
      return (
        <div className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-md dark:bg-gray-800 p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mx-auto">
              <MessageCircle className="w-8 h-8 text-primary-500 dark:text-primary-400" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">No Conversations Yet</h2>
            <p className="text-gray-500 dark:text-gray-400">
              Share a quiz from any quiz card to start one.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="max-w-[500px] mx-auto px-4 py-4">
        <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          {convos.map((convo) => {
            const otherUid = user ? getOtherParticipantId(convo, user.uid) : '';
            const name = names[otherUid] ?? otherUid.slice(0, 8);
            return (
              <button
                key={convo.id ?? otherUid}
                type="button"
                onClick={() => navigate(`/messages/${otherUid}`, { state: { username: name } })}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <span className="w-11 h-11 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 font-medium text-lg flex-shrink-0">
                  {name.charAt(0).toUpperCase()}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-bold text-sm text-gray-900 dark:text-gray-100 truncate">
                    {name}
                  </span>
                  <span className="block text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                    @{name} · {convo.lastQuizTitle} · {formatRelativeTime(convo.lastShareAt)}
                  </span>
                </span>
                <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" aria-hidden="true" />
              </button>
            );
          })}
          {sortedFriendOnlyUids.map((uid) => {
            const name = names[uid] ?? uid.slice(0, 8);
            return (
              <button
                key={`friend-${uid}`}
                type="button"
                onClick={() => navigate(`/messages/${uid}`, { state: { username: name } })}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <span className="w-11 h-11 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 font-medium text-lg flex-shrink-0">
                  {name.charAt(0).toUpperCase()}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block font-bold text-sm text-gray-900 dark:text-gray-100 truncate">
                    {name}
                  </span>
                  <span className="block text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                    @{name} · No shared quizzes yet
                  </span>
                </span>
                <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 bg-primary-50/30 dark:bg-gray-900">
      <header className="flex items-center px-4 py-3 mb-4 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Messages</h1>
      </header>

      <main className="pb-20">
        {renderContent()}
      </main>
    </div>
  );
}
