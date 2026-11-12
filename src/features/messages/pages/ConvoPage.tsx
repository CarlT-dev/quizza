import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, MessageCircle, Share2, Check, Loader2, MoreVertical, Search, Edit, Trash2, UserX, X } from 'lucide-react';
import { useAuth } from '@/features/auth';
import { useUserProfile } from '@/features/users';
import { getCardColor, getQuizzesColorPreferences, getUserQuizzes, type CardColorId, type QuizDocument } from '@/features/quiz/api/quiz';
import { formatRelativeTime } from '@/shared/utils';
import { BottomSheet, Button, ConfirmDialog, SlidePanel, Input } from '@/shared/components/ui';
import { DeleteShareSheet } from '../components/DeleteShareSheet';
import { buildConvoId, subscribeToConvoShares, shareQuizToUser, deleteShareForMe, deleteShareForEveryone, type ShareDocument, type DeleteShareMode } from '../api/messages';
import { removeFriend } from '@/features/friends';
import { useLongPress } from '@/shared/hooks';
import { useMessageScroll } from '../hooks/useMessageScroll';

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

  // Conversation menu panel
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Search within conversation
  const [searchQuery, setSearchQuery] = useState('');

  // Nickname for this conversation (stored locally)
  const [nickname, setNickname] = useState<string>(() => {
    if (typeof window !== 'undefined' && otherUid && user) {
      const convoId = buildConvoId(user.uid, otherUid);
      return localStorage.getItem(`convo_nickname_${convoId}`) ?? '';
    }
    return '';
  });

  // Delete conversation confirmation
  const [isDeleteConvoConfirmOpen, setIsDeleteConvoConfirmOpen] = useState(false);
  const [isDeleteConvoLoading, setIsDeleteConvoLoading] = useState(false);
  const [deleteConvoError, setDeleteConvoError] = useState<string | null>(null);

  // Unfriend confirmation
  const [isUnfriendConfirmOpen, setIsUnfriendConfirmOpen] = useState(false);
  const [isUnfriendLoading, setIsUnfriendLoading] = useState(false);
  const [unfriendError, setUnfriendError] = useState<string | null>(null);

  // Nickname editing state
  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [nicknameInput, setNicknameInput] = useState('');

  // Search conversation state
  const [showSearch, setShowSearch] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const isSelf = Boolean(user && otherUid === user.uid);
  // Freshest first: the loaded profile (also corrects renames), then the
  // username the previous screen handed over in navigation state (renders
  // on the first frame, no fetch), then a uid slice for direct URL entry.
  const stateUsername = (location.state as { username?: string } | null)?.username;
  const baseDisplayName =
    profile?.name ?? profile?.username ?? stateUsername ?? (otherUid ? otherUid.slice(0, 8) : '?');
  // Use nickname if set, otherwise fall back to base display name
  const displayName = nickname || baseDisplayName;

  // Scroll management for Messenger-like behavior
  const {
    containerRef: messagesContainerRef,
    handleScroll,
  } = useMessageScroll({
    threshold: 100,
    triggerDeps: shares ?? [],
    conversationKey: otherUid,
  });

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

  // Menu panel handlers
  const handleOpenMenu = () => setIsMenuOpen(true);
  const handleCloseMenu = () => {
    setIsMenuOpen(false);
    setIsEditingNickname(false);
    setNicknameInput('');
    setShowSearch(false);
    setSearchQuery('');
  };

  // Search conversation
  const handleSearchConversation = () => {
    setIsMenuOpen(false);
    setShowSearch(true);
    setSearchQuery('');
    // Focus the input after the transition starts
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);
  };

  const handleClearSearch = () => {
    setShowSearch(false);
    setSearchQuery('');
  };

  // Nickname handling
  const handleSetNickname = () => {
    setNicknameInput(nickname);
    setIsEditingNickname(true);
  };

  const handleSaveNickname = () => {
    const trimmed = nicknameInput.trim();
    setNickname(trimmed);
    if (user && otherUid) {
      const convoId = buildConvoId(user.uid, otherUid);
      if (trimmed) {
        localStorage.setItem(`convo_nickname_${convoId}`, trimmed);
      } else {
        localStorage.removeItem(`convo_nickname_${convoId}`);
      }
    }
    setIsEditingNickname(false);
    setNicknameInput('');
    setIsMenuOpen(false);
  };

  const handleCancelNickname = () => {
    setIsEditingNickname(false);
    setNicknameInput('');
  };

  // Delete conversation (delete all shares for me)
  const handleDeleteConvo = () => {
    setIsMenuOpen(false);
    setIsDeleteConvoConfirmOpen(true);
    setDeleteConvoError(null);
  };

  const handleDeleteConvoConfirm = async () => {
    if (!user || !otherUid) return;
    setIsDeleteConvoLoading(true);
    setDeleteConvoError(null);
    try {
      const convoId = buildConvoId(user.uid, otherUid);
      const allShares = shares ?? [];
      // Delete all shares for me
      for (const share of allShares) {
        if (share.id) {
          await deleteShareForMe(convoId, share.id, user.uid);
        }
      }
      setIsDeleteConvoConfirmOpen(false);
      navigate('/messages');
    } catch (err) {
      console.error('Failed to delete conversation:', err);
      setDeleteConvoError('Failed to delete conversation. Please try again.');
    } finally {
      setIsDeleteConvoLoading(false);
    }
  };

  const handleDeleteConvoCancel = () => {
    setIsDeleteConvoConfirmOpen(false);
    setDeleteConvoError(null);
  };

  // Unfriend
  const handleUnfriend = () => {
    setIsMenuOpen(false);
    setIsUnfriendConfirmOpen(true);
    setUnfriendError(null);
  };

  const handleUnfriendConfirm = async () => {
    if (!user || !otherUid) return;
    setIsUnfriendLoading(true);
    setUnfriendError(null);
    try {
      // First unfriend
      const unfriendResult = await removeFriend(otherUid);
      if (!unfriendResult) {
        throw new Error('Failed to unfriend');
      }
      // Then delete all shares for me
      const convoId = buildConvoId(user.uid, otherUid);
      const allShares = shares ?? [];
      for (const share of allShares) {
        if (share.id) {
          await deleteShareForMe(convoId, share.id, user.uid);
        }
      }
      setIsUnfriendConfirmOpen(false);
      navigate('/messages');
    } catch (err) {
      console.error('Failed to unfriend:', err);
      setUnfriendError('Failed to unfriend. Please try again.');
    } finally {
      setIsUnfriendLoading(false);
    }
  };

  const handleUnfriendCancel = () => {
    setIsUnfriendConfirmOpen(false);
    setUnfriendError(null);
  };

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

    const baseList = [
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
    ];

    // Apply search filter if query exists
    const filteredList = searchQuery
      ? baseList.filter((share) =>
          share.quizTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (share.topic?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
        )
      : baseList;

    const renderList = filteredList.sort(
      (a, b) => (a.sharedAt?.toMillis?.() ?? 0) - (b.sharedAt?.toMillis?.() ?? 0)
    );

    return (
      <div className="max-w-[500px] mx-auto px-4 py-4 pb-20 w-full flex flex-col gap-2">
        {renderList.length === 0 && searchQuery && (
          <div className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
            No conversations match "{searchQuery}"
          </div>
        )}

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
    <div className="flex flex-col h-screen bg-primary-50/30 dark:bg-gray-900">
      {/* Header with back button — no footer nav on conversation pages */}
      <header className="sticky top-0 z-20 flex items-center gap-2 px-4 py-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={() => navigate('/messages')}
          className="p-1.5 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Back to messages"
        >
          <ArrowLeft className="w-5 h-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => otherUid && navigate(`/user/${otherUid}`)}
          className="flex items-center gap-2 flex-1 min-w-0 text-left hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg p-1.5 transition-colors"
          aria-label={`View ${displayName}'s profile`}
        >
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
        </button>
        {/* Menu button (three dots) */}
        {!isSelf && !error && (
          <button
            type="button"
            onClick={handleOpenMenu}
            className="p-1.5 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Conversation options"
            aria-expanded={isMenuOpen}
            aria-haspopup="dialog"
          >
            <MoreVertical className="w-5 h-5" aria-hidden="true" />
          </button>
        )}
      </header>

      {/* Search bar - expands from header bottom with smooth transition */}
      {!isSelf && !error && (
        <div
          className="sticky top-16 z-20 overflow-hidden transition-all duration-300 ease-out"
          style={{
            maxHeight: showSearch ? '80px' : '0',
            opacity: showSearch ? 1 : 0,
            paddingTop: showSearch ? '0' : '0',
            paddingBottom: showSearch ? '0' : '0',
          }}
        >
          <div className="max-w-[500px] mx-auto">
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-primary-900/20 rounded-b-xl border border-gray-200 dark:border-primary-800">
              <Input
                ref={searchInputRef}
                focus='none'
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') handleClearSearch();
                }}
                placeholder="Search quizzes in this conversation..."
                className="flex-1 bg-transparent placeholder:text-gray-300 dark:placeholder:text-gray-500"
                aria-label="Search conversation"
              />
              <button
                type="button"
                onClick={handleClearSearch}
                className="p-1 text-gray-500 hover:bg-primary-100 dark:hover:bg-primary-800 rounded-lg transition-colors"
                aria-label="Close search"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      )}

      <main ref={messagesContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto">
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
          className="fixed bottom-6 right-4 z-30 w-14 h-14 rounded-full border border-white/40 bg-primary-500 hover:bg-primary-600 text-white shadow-lg flex items-center justify-center transition-transform active:scale-95"
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

      {/* Conversation Menu Slide Panel */}
      <SlidePanel
        isOpen={isMenuOpen}
        onClose={handleCloseMenu}
        title="Conversation Options"
        width="w-full sm:w-[360px] lg:w-[400px]"
      >
        <div className="px-4 py-2 space-y-1">
          {/* Search Conversation */}
          <button
            type="button"
            onClick={handleSearchConversation}
            className="w-full flex items-center gap-3 px-3 py-3 text-left rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
              <Search className="w-5 h-5 text-primary-600 dark:text-primary-400" aria-hidden="true" />
            </div>
            <span className="font-medium text-gray-900 dark:text-gray-100">Search conversation</span>
          </button>

          {/* Add/Edit Nickname */}
          {!isEditingNickname ? (
            <button
              type="button"
              onClick={handleSetNickname}
              className="w-full flex items-center gap-3 px-3 py-3 text-left rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                <Edit className="w-5 h-5 text-blue-600 dark:text-blue-400" aria-hidden="true" />
              </div>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {nickname ? 'Edit nickname' : 'Add nickname'}
              </span>
            </button>
          ) : (
            <div className="space-y-3">
              <Input
                value={nicknameInput}
                onChange={(e) => setNicknameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveNickname();
                  if (e.key === 'Escape') handleCancelNickname();
                }}
                placeholder="Enter nickname"
                autoFocus
                className="w-full"
                aria-label="Conversation nickname"
              />
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={handleCancelNickname}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleSaveNickname}
                  disabled={!nicknameInput.trim() && !nickname}
                >
                  {nickname ? 'Save' : 'Add'}
                </Button>
              </div>
            </div>
          )}

          {/* Delete Conversation */}
          <button
            type="button"
            onClick={handleDeleteConvo}
            className="w-full flex items-center gap-3 px-3 py-3 text-left rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
              <Trash2 className="w-5 h-5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
            </div>
            <span className="font-medium text-gray-900 dark:text-gray-100">Delete conversation</span>
          </button>

          {/* Divider before Unfriend */}
          <div className="h-px bg-gray-200 dark:bg-gray-700 my-2" aria-hidden="true" />

          {/* Unfriend */}
          <button
            type="button"
            onClick={handleUnfriend}
            className="w-full flex items-center gap-3 px-3 py-3 text-left rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-red-600 dark:text-red-400"
          >
            <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
              <UserX className="w-5 h-5 text-red-600 dark:text-red-400" aria-hidden="true" />
            </div>
            <span className="font-medium text-red-600 dark:text-red-400">Unfriend</span>
          </button>
        </div>
      </SlidePanel>

      {/* Delete Conversation Confirmation */}
      <ConfirmDialog
        isOpen={isDeleteConvoConfirmOpen}
        title="Delete conversation?"
        message="This will remove all shared quizzes from your conversation. The other participant will still see them."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
        isLoading={isDeleteConvoLoading}
        error={deleteConvoError}
        onConfirm={handleDeleteConvoConfirm}
        onCancel={handleDeleteConvoCancel}
      />

      {/* Unfriend Confirmation */}
      <ConfirmDialog
        isOpen={isUnfriendConfirmOpen}
        title="Unfriend?"
        message="All conversation will be removed (for you). You will no longer be friends with this person."
        confirmLabel="Unfriend"
        cancelLabel="Cancel"
        destructive
        isLoading={isUnfriendLoading}
        error={unfriendError}
        onConfirm={handleUnfriendConfirm}
        onCancel={handleUnfriendCancel}
      />
    </div>
  );
}
