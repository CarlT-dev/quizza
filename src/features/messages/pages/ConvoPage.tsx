import { useState, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, MessageCircle, Share2, Check, Loader2 } from 'lucide-react';
import { useAuth } from '@/features/auth';
import { useUserProfile } from '@/features/users';
import { getCardColor, getQuizzesColorPreferences, getUserQuizzes, type CardColorId, type QuizDocument } from '@/features/quiz/api/quiz';
import { formatRelativeTime } from '@/shared/utils';
import { BottomSheet, Button } from '@/shared/components/ui';
import { buildConvoId, getConvoShares, shareQuizToUser, type ShareDocument } from '../api/messages';

export function ConvoPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { uid: otherUid } = useParams<{ uid: string }>();
  const { user, loading: authLoading } = useAuth();
  const { profile, isLoading: profileLoading } = useUserProfile(otherUid);

  const [shares, setShares] = useState<ShareDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  // Share sheet: my quizzes + their user-set card colors, multi-select.
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [myQuizzes, setMyQuizzes] = useState<QuizDocument[]>([]);
  const [quizColors, setQuizColors] = useState<Map<string, CardColorId>>(new Map());
  const [shareSheetLoading, setShareSheetLoading] = useState(false);
  const [shareSheetError, setShareSheetError] = useState<string | null>(null);
  const [selectedQuizIds, setSelectedQuizIds] = useState<Set<string>>(new Set());
  const [isSharing, setIsSharing] = useState(false);
  const [shareSheetToken, setShareSheetToken] = useState(0);

  const isSelf = Boolean(user && otherUid === user.uid);
  // Freshest first: the loaded profile (also corrects renames), then the
  // username the previous screen handed over in navigation state (renders
  // on the first frame, no fetch), then a uid slice for direct URL entry.
  const stateUsername = (location.state as { username?: string } | null)?.username;
  const displayName =
    profile?.username ?? stateUsername ?? (otherUid ? otherUid.slice(0, 8) : '?');

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

  // Load my quizzes + their color preferences while the share sheet is open
  // (fresh per open, so a just-created quiz shows up).
  useEffect(() => {
    if (!isShareOpen || !user) return;
    let cancelled = false;

    void Promise.resolve().then(async () => {
      setShareSheetLoading(true);
      setShareSheetError(null);
      try {
        const quizzes = await getUserQuizzes(user.uid, 20);
        if (cancelled) return;
        setMyQuizzes(quizzes);
        const colors = await getQuizzesColorPreferences(
          quizzes.map(q => q.id).filter((id): id is string => Boolean(id)),
          user.uid
        );
        if (!cancelled) setQuizColors(colors);
      } catch (err) {
        console.error('Failed to load your quizzes:', err);
        if (!cancelled) setShareSheetError('Failed to load your quizzes. Please try again.');
      } finally {
        if (!cancelled) setShareSheetLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isShareOpen, user, shareSheetToken]);

  const toggleQuizSelection = (quizId: string) => {
    setSelectedQuizIds(prev => {
      const next = new Set(prev);
      if (next.has(quizId)) {
        next.delete(quizId);
      } else {
        next.add(quizId);
      }
      return next;
    });
  };

  // Sequential, not Promise.all: shareQuizToUser creates the convo doc when
  // it doesn't exist yet — parallel calls would race that creation and
  // clobber the convo's shareCount.
  const handleShareSelected = async () => {
    if (!user || !otherUid || selectedQuizIds.size === 0 || isSharing) return;
    setIsSharing(true);
    try {
      for (const quiz of myQuizzes) {
        const quizId = quiz.id;
        if (!quizId || !selectedQuizIds.has(quizId)) continue;
        await shareQuizToUser(quiz, user.uid, otherUid);
        // Drop each quiz from the selection as it lands, so a retry after a
        // mid-loop failure only shares the ones that didn't make it.
        setSelectedQuizIds(prev => {
          const next = new Set(prev);
          next.delete(quizId);
          return next;
        });
      }
      setIsShareOpen(false);
      setSelectedQuizIds(new Set());
      setReloadToken(token => token + 1);
    } catch (err) {
      console.error('Failed to share quiz:', err);
      setShareSheetError('Failed to share. Please try again.');
    } finally {
      setIsSharing(false);
    }
  };

  const handleShareSheetRetry = () => setShareSheetToken(token => token + 1);

  const renderContent = () => {
    if (isLoading || profileLoading) {
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

  const renderShareSheetContent = () => {
    if (shareSheetLoading) {
      return (
        <div className="flex gap-2 overflow-x-auto px-4 py-3" aria-hidden="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="w-20 h-24 rounded-xl skeleton skeleton-rounded shrink-0" />
          ))}
        </div>
      );
    }

    if (shareSheetError) {
      return (
        <div className="px-4 py-6 text-center">
          <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{shareSheetError}</p>
          <Button size="sm" onClick={handleShareSheetRetry}>
            Try Again
          </Button>
        </div>
      );
    }

    if (myQuizzes.length === 0) {
      return (
        <div className="px-4 py-8 text-center">
          <MessageCircle className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            You haven't created any quizzes yet.
          </p>
        </div>
      );
    }

    return (
      <>
        {/* Tiny colored tiles, horizontal scroll — tap to select, multi-select */}
        <div className='px-4 pb-3'>
          <div className="flex gap-2 overflow-x-auto px-4 py-3 snap-x">
            {myQuizzes.map(quiz => {
              const quizId = quiz.id;
              if (!quizId) return null;
              const isSelected = selectedQuizIds.has(quizId);
              const color = getCardColor(quizColors.get(quizId) ?? 'default');
              const isDefaultColor = color.id === 'default';
              return (
                <button
                  key={quizId}
                  type="button"
                  onClick={() => toggleQuizSelection(quizId)}
                  aria-pressed={isSelected}
                  className={`w-20 h-24 shrink-0 snap-start rounded-xl p-2 text-left flex flex-col justify-between transition-transform active:scale-95 ${
                    isDefaultColor
                      ? 'bg-gray-100 dark:bg-gray-700'
                      : `bg-gradient-to-br ${color.gradient}`
                  } ${isSelected ? 'ring-2 ring-offset-2 ring-primary-500 ring-offset-white dark:ring-offset-gray-800' : ''}`}
                >
                  <span
                    className={`text-[11px] font-bold leading-tight line-clamp-3 ${
                      isDefaultColor ? 'text-gray-900 dark:text-gray-100' : 'text-white'
                    }`}
                  >
                    {quiz.title}
                  </span>
                  {isSelected && (
                    <span className="w-4 h-4 rounded-full bg-white flex items-center justify-center self-end">
                      <Check className="w-3 h-3 text-primary-600" aria-hidden="true" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
        <div className="px-4 pb-4">
          <Button
            onClick={handleShareSelected}
            disabled={selectedQuizIds.size === 0 || isSharing}
            className="w-full"
          >
            {isSharing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                Sharing…
              </>
            ) : (
              `Share${selectedQuizIds.size > 0 ? ` (${selectedQuizIds.size})` : ''}`
            )}
          </Button>
        </div>
      </>
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

      {/* Floating share button — opens the bottom sheet */}
      {!isSelf && !error && (
        <button
          type="button"
          onClick={() => setIsShareOpen(true)}
          aria-label="Share a quiz"
          className="fixed bottom-6 right-4 z-30 w-14 h-14 rounded-full bg-primary-500 hover:bg-primary-600 text-white shadow-lg flex items-center justify-center transition-transform active:scale-95"
        >
          <Share2 className="w-6 h-6" aria-hidden="true" />
        </button>
      )}

      <BottomSheet
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        title={`Share with @${displayName}`}
      >
        {renderShareSheetContent()}
      </BottomSheet>
    </div>
  );
}
