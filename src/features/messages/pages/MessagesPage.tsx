import { useNavigate } from 'react-router-dom';
import { ChevronRight, AlertTriangle, MessageCircle } from 'lucide-react';
import { useAuth } from '@/features/auth';
import { formatRelativeTime } from '@/shared/utils';
import { getOtherParticipantUid, useFriendships } from '@/features/friends';
import { getOtherParticipantId } from '../api/messages';
import { useUserConvos, useUserProfiles } from '../hooks/useMessageQueries';
import { MessagesPageSkeleton } from '../components/MessagesPageSkeleton';

export function MessagesPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { friendships } = useFriendships();

  // React Query hooks for automatic caching and background refetching
  const { data: convos = [], isLoading: convosLoading, error: convosError, refetch: refetchConvos } = useUserConvos(user?.uid);
  const allOtherUids = user
    ? [
        ...new Set([
          ...convos.map(convo => getOtherParticipantId(convo, user.uid)),
          ...(friendships
            ? friendships.friends.map(f => getOtherParticipantUid(f, user.uid))
            : []),
        ]),
      ]
    : [];
  const { data: names = {} } = useUserProfiles(allOtherUids);

  const handleRetry = () => refetchConvos();

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
    // Only show skeleton on INITIAL load of main convos data.
    // Background refetches of names/friends (isFetching) should not show skeleton.
    if (authLoading || (convos.length === 0 && convosLoading)) {
      return <MessagesPageSkeleton />;
    }

    if (convosError) {
      return (
        <div className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-md dark:bg-gray-800 p-8 text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Unable to Load Messages</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">{convosError.message}</p>
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
      <div className="max-w-[500px] mx-auto">
        <div className="bg-white dark:bg-gray-900 overflow-hidden">
          {convos.map((convo) => {
            const otherUid = user ? getOtherParticipantId(convo, user.uid) : '';
            const name = names[otherUid] ?? otherUid.slice(0, 8);
            return (
              <button
                key={convo.id ?? otherUid}
                type="button"
                onClick={() => navigate(`/messages/${otherUid}`, { state: { username: name } })}
                className="w-full flex items-center gap-3 px-4 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
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
      <header className="flex items-center px-4 py-3 mb-1 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <h1 className="text-xl font-semibold text-primary-900 dark:text-gray-100">Messages</h1>
      </header>

      <main className="pb-20">
        {renderContent()}
      </main>
    </div>
  );
}
