import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, MessageCircle } from 'lucide-react';
import { useAuth } from '@/features/auth';
import { useUserProfile } from '@/features/users';
import { formatRelativeTime } from '@/shared/utils';
import { Button } from '@/shared/components/ui';
import { buildConvoId, getConvoShares, type ShareDocument } from '../api/messages';

export function ConvoPage() {
  const navigate = useNavigate();
  const { uid: otherUid } = useParams<{ uid: string }>();
  const { user, loading: authLoading } = useAuth();
  const { profile } = useUserProfile(otherUid);

  const [shares, setShares] = useState<ShareDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const isSelf = Boolean(user && otherUid === user.uid);
  // Resolves once the profile loads; until then (or if the account is gone)
  // the uid slice stands in.
  const displayName = profile?.username ?? (otherUid ? otherUid.slice(0, 8) : '?');

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;

    // Deferred so setIsLoading isn't a synchronous effect setState
    // (react(set-state-in-effect)) — same pattern as the quiz data hooks.
    void Promise.resolve().then(async () => {
      if (!user || !otherUid) {
        setError('Please log in to view conversations.');
        setIsLoading(false);
        return;
      }
      if (otherUid === user.uid) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        const data = await getConvoShares(buildConvoId(user.uid, otherUid));
        if (cancelled) return;
        // Chat order: oldest at top, newest at bottom (user's pick)
        setShares(
          [...data].sort(
            (a, b) => (a.sharedAt?.toMillis?.() ?? 0) - (b.sharedAt?.toMillis?.() ?? 0)
          )
        );
      } catch (err) {
        console.error('Failed to fetch shares:', err);
        if (!cancelled) setError('Failed to load this conversation. Please try again.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [user, otherUid, authLoading, reloadToken]);

  const handleRetry = () => setReloadToken(token => token + 1);

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="max-w-[500px] mx-auto px-4 py-4 w-full flex flex-col gap-2" aria-hidden="true">
          <div className="w-2/3 h-20 rounded-2xl skeleton skeleton-rounded self-start" />
          <div className="w-1/2 h-16 rounded-2xl skeleton skeleton-rounded ml-auto" />
          <div className="w-3/5 h-16 rounded-2xl skeleton skeleton-rounded self-start" />
        </div>
      );
    }

    if (error) {
      return (
        <div className="max-w-[500px] mx-auto flex items-center justify-center py-12">
          <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl border border-red-200 dark:border-red-800 p-8 text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Unable to Load Conversation</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">{error}</p>
            <Button onClick={handleRetry} className="w-full">
              Try Again
            </Button>
          </div>
        </div>
      );
    }

    if (isSelf) {
      return (
        <div className="max-w-[500px] mx-auto px-4 py-12">
          <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 text-center">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">You can't message yourself</h2>
            <p className="text-gray-500 dark:text-gray-400">
              A conversation holds the quizzes two different people share with each other.
            </p>
          </div>
        </div>
      );
    }

    if (shares.length === 0) {
      return (
        <div className="max-w-[500px] mx-auto px-4 py-12">
          <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mx-auto mb-4">
              <MessageCircle className="w-8 h-8 text-primary-500 dark:text-primary-400" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">No Quizzes Shared Yet</h2>
            <p className="text-gray-500 dark:text-gray-400">
              Share a quiz with @{displayName} from any quiz card.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="max-w-[500px] mx-auto px-4 py-4 w-full flex flex-col gap-2">
        {shares.map((share, index) => {
          const isMine = share.sharedBy === user?.uid;
          return (
            <button
              key={share.id ?? `share-${index}`}
              type="button"
              onClick={() => navigate(`/quiz/${share.quizId}`)}
              className={`w-fit max-w-[85%] text-left rounded-2xl border p-3 transition-colors ${
                isMine
                  ? 'ml-auto bg-primary-500 border-primary-500 text-white hover:bg-primary-600'
                  : 'mr-auto bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700/50'
              }`}
            >
              <span className="block font-bold text-sm truncate">{share.quizTitle}</span>
              {share.topic && (
                <span className="block text-xs opacity-80 truncate">{share.topic}</span>
              )}
              <span className="block text-xs mt-1 opacity-70">
                {isMine ? 'You' : `@${displayName}`} · {formatRelativeTime(share.sharedAt)} · Tap to play
              </span>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex-1 bg-primary-50/30 dark:bg-gray-900">
      {/* Header with back button — no footer nav on conversation pages */}
      <header className="flex items-center gap-2 px-4 py-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={() => navigate('/messages')}
          className="p-1.5 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Back to messages"
        >
          <ArrowLeft className="w-5 h-5" aria-hidden="true" />
        </button>
        <span className="w-9 h-9 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 font-medium flex-shrink-0">
          {displayName.charAt(0).toUpperCase()}
        </span>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 min-w-0 truncate">
          @{displayName}
        </h1>
      </header>

      <main className="pb-8">
        {renderContent()}
      </main>
    </div>
  );
}
