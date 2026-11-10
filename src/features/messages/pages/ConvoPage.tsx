import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, MessageCircle, Share2, Check, Loader2 } from 'lucide-react';
import { useAuth } from '@/features/auth';
import { useUserProfile } from '@/features/users';
import { getCardColor, getQuizzesColorPreferences, getUserQuizzes, type CardColorId, type QuizDocument } from '@/features/quiz/api/quiz';
import { formatRelativeTime } from '@/shared/utils';
import { BottomSheet, Button, ConfirmDialog } from '@/shared/components/ui';
import { DeleteShareSheet } from '../components/DeleteShareSheet';
import { buildConvoId, subscribeToConvoShares, shareQuizToUser, deleteShareForMe, deleteShareForEveryone, type ShareDocument, type DeleteShareMode } from '../api/messages';
import { useLongPress } from '@/shared/hooks';

export function ConvoPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { uid: otherUid } = useParams<{ uid: string }>();
  const { user, loading: authLoading } = useAuth();
  const { profile, isLoading: profileLoading } = useUserProfile(otherUid);

  const [shares, setShares] = useState<ShareDocument[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  // Deletion Flow State (Step 10)
  const [exiting, setExiting] = useState<Map<string, ShareDocument>>(new Map());
  const [held, setHeld] = useState<Map<string, ShareDocument>>(new Map());
  const [inFlightForMe, setInFlightForMe] = useState<Set<string>>(new Set());
  const [_inFlightEveryone, setInFlightEveryone] = useState<Set<string>>(new Set());
  const [confirmedDeleted, setConfirmedDeleted] = useState<Set<string>>(new Set());
  const [selectedShare, setSelectedShare] = useState<ShareDocument | null>(null);

  // Delete confirmation dialog state
  const [deleteConfirmMode, setDeleteConfirmMode] = useState<DeleteShareMode | null>(null);
  const [deleteConfirmShare, setDeleteConfirmShare] = useState<ShareDocument | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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
    profile?.name ?? profile?.username ?? stateUsername ?? (otherUid ? otherUid.slice(0, 8) : '?');

  useEffect(() => {
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

    const unsubscribe = subscribeToConvoShares(buildConvoId(user.uid, otherUid),
      (shares) => {
        // serverTimestamps:'estimate' is handled in the API, client reverses
        setShares(shares.reverse());
        setIsLoading(false);
      },
      (err) => {
        console.error('Failed to subscribe to shares:', err);
        setError('Failed to load this conversation. Please try again.');
        setIsLoading(false);
      }
    );

    return () => {
      unsubscribe();
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
  const {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerLeave,
    onPointerCancel,
    onContextMenu,
    onClickCapture,
  } = useLongPress((target) => {
    const shareId = target.dataset.shareId;
    if (!shareId) {
      // Floating share button long-press → open share sheet
      setIsShareOpen(true);
      return;
    }
    // Message bubble long-press → open deletion sheet
    const share = (shares ?? []).find((s) => s.id === shareId);
    if (!share) return;
    setSelectedShare(share);
    setHeld((prev) => {
      const next = new Map(prev);
      next.set(shareId, share);
      return next;
    });
  }, 450);

  const handleDeleteShare = async (share: ShareDocument, mode: DeleteShareMode) => {
    if (!user || !otherUid) return;
    if (mode === 'me') {
      setInFlightForMe(prev => new Set(prev).add(share.id ?? ''));
      try {
        await deleteShareForMe(buildConvoId(user.uid, otherUid), share.id ?? '', user.uid);
        // On success, handleDeleted will run
        handleDeleted(share, mode);
      } catch (err) {
        console.error('Failed to delete for me:', err);
        setInFlightForMe(prev => {
          const newSet = new Set(prev);
          newSet.delete(share.id ?? '');
          return newSet;
        });
        throw err;
      }
    } else { // 'everyone'
      setInFlightEveryone(prev => new Set(prev).add(share.id ?? ''));
      try {
        const allShares = shares ?? [];
        await deleteShareForEveryone(buildConvoId(user.uid, otherUid), share, allShares);
        // On success, handleDeleted will run
        handleDeleted(share, mode);
      } catch (err) {
        console.error('Failed to delete for everyone:', err);
        setInFlightEveryone(prev => {
          const newSet = new Set(prev);
          newSet.delete(share.id ?? '');
          return newSet;
        });
        throw err;
      }
    }
  };

  const handleDeleted = (share: ShareDocument, _mode: DeleteShareMode) => {
    // One React flush is needed here to guarantee state consistency
    setConfirmedDeleted(prev => new Set(prev).add(share.id ?? ''));
    setExiting(prev => {
      const newMap = new Map(prev);
      newMap.set(share.id ?? '', share);
      return newMap;
    });
    setInFlightEveryone(prev => {
      const newSet = new Set(prev);
      newSet.delete(share.id ?? '');
      return newSet;
    });
    setInFlightForMe(prev => {
      const newSet = new Set(prev);
      newSet.delete(share.id ?? '');
      return newSet;
    });
    setSelectedShare(null);
    setHeld((prev) => {
      const next = new Map(prev);
      next.delete(share.id ?? '');
      return next;
    });

    // Schedule removal-diff animation (~260ms)
    setTimeout(() => {
      setExiting(prev => {
        const newMap = new Map(prev);
        if (newMap.has(share.id ?? '')) {
          newMap.delete(share.id ?? '');
          return newMap;
        }
        return prev; // Idempotent against snapshot removal-diff
      });
    }, 260);
  };

  // Delete confirmation handlers
  const handleDeleteActionSelect = useCallback((mode: DeleteShareMode) => {
    if (!selectedShare) return;
    setDeleteConfirmMode(mode);
    setDeleteConfirmShare(selectedShare);
    setDeleteError(null);
    setSelectedShare(null); // Close the sheet first, then confirm dialog opens
  }, [selectedShare]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteConfirmShare || !deleteConfirmMode) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await handleDeleteShare(deleteConfirmShare, deleteConfirmMode);
      // handleDeleted will be called by handleDeleteShare on success
    } catch (err) {
      console.error('Failed to delete share:', err);
      setDeleteError('Deletion failed. Please try again.');
    } finally {
      setIsDeleting(false);
      // Only reset confirm state on success; on error keep dialog open for retry
      if (!deleteError) {
        setDeleteConfirmMode(null);
        setDeleteConfirmShare(null);
      }
    }
  }, [deleteConfirmShare, deleteConfirmMode, deleteError, handleDeleteShare]);

  const handleDeleteCancel = useCallback(() => {
    setDeleteConfirmMode(null);
    setDeleteConfirmShare(null);
    setDeleteError(null);
  }, []);

  const handleShareSheetRetry = () => setShareSheetToken(token => token + 1);

  const handleShareSelected = async () => {
    if (selectedQuizIds.size === 0 || isSharing || !user || !otherUid) return;
    setIsSharing(true);
    setShareSheetError(null);
    try {
      for (const quizId of selectedQuizIds) {
        const quiz = myQuizzes.find(q => q.id === quizId);
        if (quiz) {
          await shareQuizToUser(quiz, user.uid, otherUid);
        }
      }
      setIsShareOpen(false);
      setSelectedQuizIds(new Set());
    } catch (err) {
      console.error('Failed to share quiz:', err);
      setShareSheetError('Failed to share quiz. Please try again.');
    } finally {
      setIsSharing(false);
    }
  };

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
          <div className="w-full max-w-md dark:bg-gray-800 p-8 text-center">
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

    if ((shares?.length ?? 0) === 0) {
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

    // Render list using all states
    const myUid = user?.uid ?? '';

    const renderList = [
      ...(shares ?? []).filter(s => {
        const id = s.id ?? '';
        if (exiting.has(id)) return false;
        if (confirmedDeleted.has(id)) return false;
        if (held.has(id)) return false;
        if ((s.deletedBy ?? []).includes(myUid) && !inFlightForMe.has(id)) return false;
        return true;
      }),
      ...held.values(),
      ...exiting.values(),
    ].sort((a, b) => (a.sharedAt?.toMillis?.() ?? 0) - (b.sharedAt?.toMillis?.() ?? 0));

    return (
      <div className="max-w-[500px] mx-auto px-4 py-4 w-full flex flex-col gap-2">
        {renderList.map((share) => {
          const isMine = share.sharedBy === user?.uid;
          return (
            <button
              key={share.id ?? `share-${share.quizTitle}`}
              type="button"
              data-share-id={share.id ?? ''}
              onClick={() => navigate(`/quiz/${share.quizId}`)}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={onPointerLeave}
              onPointerCancel={onPointerCancel}
              onContextMenu={onContextMenu}
              onClickCapture={onClickCapture}
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
                {isMine ? 'You' : displayName} · {formatRelativeTime(share.sharedAt)} · Tap to play
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
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 min-w-0 truncate">
            {displayName}
          </h1>
          {profile?.name && (
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              @{profile.username}
            </p>
          )}
        </div>
      </header>

      <main className="pb-8">
        {renderContent()}
      </main>

      {/* Floating share button — opens the bottom sheet */}
      {!isSelf && !error && (
        <button
          type="button"
          onClick={() => setIsShareOpen(true)}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerLeave}
          onPointerCancel={onPointerCancel}
          onContextMenu={onContextMenu}
          onClickCapture={onClickCapture}
          aria-label="Share a quiz"
          className="fixed bottom-6 right-4 z-30 w-14 h-14 rounded-full bg-primary-500 hover:bg-primary-600 text-white shadow-lg flex items-center justify-center transition-transform active:scale-95"
        >
          <Share2 className="w-6 h-6" aria-hidden="true" />
        </button>
      )}

      <BottomSheet
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        title={`Share with ${displayName}`}
      >
        {renderShareSheetContent()}
      </BottomSheet>

      <DeleteShareSheet
        share={selectedShare}
        currentUserId={user?.uid ?? null}
        onClose={() => {
          setSelectedShare(null);
          setHeld((prev) => {
            const next = new Map(prev);
            if (selectedShare?.id) next.delete(selectedShare.id);
            return next;
          });
        }}
        onActionSelect={handleDeleteActionSelect}
      />

      {/* Delete Confirmation Dialog — at page level, outside any BottomSheet */}
      <ConfirmDialog
        isOpen={deleteConfirmMode != null}
        title={deleteConfirmMode === 'me' ? 'Delete for you?' : 'Delete for everyone?'}
        message={
          deleteConfirmMode === 'me'
            ? 'This shared quiz will only be removed from your conversation. The other participant can still see it.'
            : 'This shared quiz will be removed from the conversation for both participants.'
        }
        confirmLabel="Confirm"
        cancelLabel="Cancel"
        destructive={deleteConfirmMode === 'everyone'}
        isLoading={isDeleting}
        error={deleteError}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </div>
  );
}
