import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth';
import {
  getUserQuizzes,
  getUserQuizCount,
  getSavedQuizzes,
  getQuizzesByIds,
  unsaveQuiz,
  updateQuizVisibility,
  deleteQuiz,
  saveQuizTitle,
  type QuizDocument,
  type SavedQuiz,
} from '@/features/quiz';
import { useQuizProgress } from '@/features/quiz/hooks/useQuizProgress';
import { useQuizFavorites } from '@/features/quiz/hooks/useQuizFavorites';
import { useUsernames } from '@/features/users';
import { saveQuizColorPreference, type CardColorId } from '@/features/quiz/api/quiz';
import { QuizCardItem } from '../components/QuizCardItem';
import { QuizCardSkeleton } from '../components/QuizCardSkeleton';
import { Plus, AlertTriangle, Search, X, ArrowDownUp } from 'lucide-react';
import { Button } from '@/shared/components/ui';

export function QuizzesPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [quizzes, setQuizzes] = useState<QuizDocument[]>([]);
  const [savedQuizDocs, setSavedQuizDocs] = useState<QuizDocument[]>([]);
  const [quizCount, setQuizCount] = useState(3);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Expanding search (replaces the old Settings button that navigated to a 404)
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Sort order: favorites first (default) or pure recency
  const [sortMode, setSortMode] = useState<'favorites' | 'recent'>('favorites');

  // Favorite stars (quizFavorites side-documents)
  const { favoriteIds, toggleFavorite } = useQuizFavorites(user?.uid);

  // Fetch the user's quizzes plus the quizzes saved from the For You feed.
  // The saved section is additive: a savedQuizzes failure (e.g. rules not yet
  // deployed) degrades to the own-quizzes list instead of an error page.
  useEffect(() => {
    if (authLoading) return;

    let cancelled = false;

    if (!user) {
      setError('Please log in to view your quizzes');
      setIsLoading(false);
      return;
    }

    const fetchQuizzes = async () => {
      try {
        setIsLoading(true);
        setError(null);
        // Fetch quizzes, count (drives skeleton amount) and saved rows in parallel
        const [userQuizzes, countResult, savedRows] = await Promise.all([
          getUserQuizzes(user.uid, 50),
          getUserQuizCount(user.uid).catch(() => null),
          getSavedQuizzes(user.uid).catch(err => {
            console.error('Failed to fetch saved quizzes:', err);
            return [] as SavedQuiz[];
          }),
        ]);
        // Saved rows -> quiz docs; ids already in the own list are skipped
        const ownIds = new Set(userQuizzes.map(q => q.id));
        const savedOnlyIds = savedRows.map(row => row.quizId).filter(id => !ownIds.has(id));
        const savedDocs = savedOnlyIds.length > 0 ? await getQuizzesByIds(savedOnlyIds) : [];
        if (!cancelled) {
          setQuizzes(userQuizzes);
          setSavedQuizDocs(savedDocs);
          if (countResult !== null) {
            setQuizCount(countResult);
          }
        }
      } catch (err) {
        console.error('Failed to fetch quizzes:', err);
        if (!cancelled) {
          setError('Failed to load quizzes. Please try again.');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchQuizzes();

    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  // Focus the search input once it becomes visible - visibility:hidden elements
  // cannot be focused, so this can't happen in the click handler itself
  useEffect(() => {
    if (isSearchOpen) {
      searchInputRef.current?.focus();
    }
  }, [isSearchOpen]);

  // Merged list: own quizzes + saved public quizzes, deduped by id (own wins)
  const mergedQuizzes = useMemo(() => {
    const byId = new Map<string, QuizDocument>();
    for (const quiz of [...quizzes, ...savedQuizDocs]) {
      if (quiz.id && !byId.has(quiz.id)) byId.set(quiz.id, quiz);
    }
    return [...byId.values()];
  }, [quizzes, savedQuizDocs]);

  // Quiz IDs for progress/color fetching (own + saved, deduped).
  // Fresh array each memo - useQuizProgress sorts its copy in place.
  const quizIds = useMemo(
    () => [...new Set(mergedQuizzes.map(q => q.id!).filter(Boolean))],
    [mergedQuizzes]
  );

  // Fetch progress and color preferences
  const { progressMap, colorPrefsMap, titlePrefsMap, refetch: refetchProgress, updateColorPref, updateTitle, isLoading: progressLoading } = useQuizProgress({
    quizIds,
    userId: user?.uid,
    enabled: !!user && quizIds.length > 0,
  });

  // Usernames for non-owner cards (saved quizzes show the creator's name)
  const ownerUids = useMemo(
    () => [...new Set(mergedQuizzes.filter(q => q.createdBy !== user?.uid).map(q => q.createdBy))],
    [mergedQuizzes, user]
  );
  const ownerNames = useUsernames(ownerUids);

  // Sort: favorites first (favorites by createdAt desc, then the rest), or
  // pure recency. Client-side sort - no composite index needed.
  const sortedQuizzes = useMemo(() => {
    const createdMs = (quiz: QuizDocument) => quiz.createdAt?.toMillis?.() ?? 0;
    return [...mergedQuizzes].sort((a, b) => {
      if (sortMode === 'favorites') {
        const af = favoriteIds.has(a.id ?? '') ? 1 : 0;
        const bf = favoriteIds.has(b.id ?? '') ? 1 : 0;
        if (af !== bf) return bf - af;
      }
      return createdMs(b) - createdMs(a);
    });
  }, [mergedQuizzes, sortMode, favoriteIds]);

  // Live filter by title/topic over the merged, sorted list
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const matchesSearch = useCallback(
    (quiz: QuizDocument) =>
      quiz.title.toLowerCase().includes(normalizedQuery) ||
      quiz.topic.toLowerCase().includes(normalizedQuery),
    [normalizedQuery]
  );
  const filteredQuizzes = useMemo(
    () => (normalizedQuery ? sortedQuizzes.filter(matchesSearch) : sortedQuizzes),
    [sortedQuizzes, normalizedQuery, matchesSearch]
  );

  // Handle color change
  const handleColorChange = useCallback(async (quizId: string, colorId: CardColorId) => {
    if (!user) return;

    // Optimistic update
    updateColorPref(quizId, colorId);

    try {
      await saveQuizColorPreference(quizId, user.uid, colorId);
    } catch (err) {
      console.error('Failed to save color preference:', err);
      // Rollback on error
      refetchProgress();
    }
  }, [user, refetchProgress, updateColorPref]);

  // Handle title change (rename) - optimistic update with rollback on failure
  const handleTitleChange = useCallback(async (quizId: string, newTitle: string) => {
    if (!user) return;

    // Optimistic update
    updateTitle(quizId, newTitle);

    try {
      await saveQuizTitle(quizId, user.uid, newTitle);
    } catch (err) {
      console.error('Failed to save quiz title:', err);
      // Rollback on error
      refetchProgress();
    }
  }, [user, refetchProgress, updateTitle]);

  // Quiz management: optimistic update with rollback on failure
  const handleToggleVisibility = useCallback(async (quizId: string) => {
    if (!user) return;
    const prev = quizzes;
    const target = prev.find(q => q.id === quizId);
    if (!target) return;
    const newVisibility = target.visibility === 'public' ? 'private' : 'public';
    setQuizzes(prevQuizzes =>
      prevQuizzes.map(q => (q.id === quizId ? { ...q, visibility: newVisibility } : q))
    );
    try {
      await updateQuizVisibility(quizId, newVisibility);
    } catch (err) {
      console.error('Failed to update visibility:', err);
      setQuizzes(prev);
      alert('Failed to update visibility. Please try again.');
    }
  }, [user, quizzes]);

  // Deleting an own quiz that was also saved: the API cleans up the saved row
  // server-side, so the local saved copy must go too or it lingers as a ghost.
  const handleDeleteQuiz = useCallback(async (quizId: string) => {
    if (!user) return;
    const prev = quizzes;
    const prevSaved = savedQuizDocs;
    const prevCount = quizCount;
    setQuizzes(prevQuizzes => prevQuizzes.filter(q => q.id !== quizId));
    setSavedQuizDocs(prevDocs => prevDocs.filter(q => q.id !== quizId));
    setQuizCount(c => Math.max(0, c - 1));
    try {
      await deleteQuiz(quizId, user.uid);
    } catch (err) {
      console.error('Failed to delete quiz:', err);
      setQuizzes(prev);
      setSavedQuizDocs(prevSaved);
      setQuizCount(prevCount);
      alert('Failed to delete quiz. Please try again.');
    }
  }, [user, quizzes, savedQuizDocs, quizCount]);

  // Unsave: remove a saved (non-owned) quiz from the merged list - optimistic
  // with rollback on failure
  const handleUnsave = useCallback(async (quizId: string) => {
    if (!user) return;
    const prev = savedQuizDocs;
    setSavedQuizDocs(prevDocs => prevDocs.filter(q => q.id !== quizId));
    try {
      await unsaveQuiz(quizId, user.uid);
    } catch (err) {
      console.error('Failed to remove saved quiz:', err);
      setSavedQuizDocs(prev);
      alert('Failed to remove saved quiz. Please try again.');
    }
  }, [user, savedQuizDocs]);

  const handleQuizClick = useCallback((quizId: string) => {
    navigate(`/quiz/${quizId}`);
  }, [navigate]);

  const handleCreateQuiz = useCallback(() => {
    navigate('/create-quiz');
  }, [navigate]);

  const handleRetry = () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    Promise.all([
      getUserQuizzes(user.uid, 50),
      getUserQuizCount(user.uid).catch(() => null),
      getSavedQuizzes(user.uid).catch(err => {
        console.error('Failed to fetch saved quizzes:', err);
        return [] as SavedQuiz[];
      }),
    ])
      .then(async ([data, countResult, savedRows]) => {
        const ownIds = new Set(data.map(q => q.id));
        const savedOnlyIds = savedRows.map(row => row.quizId).filter(id => !ownIds.has(id));
        const savedDocs = savedOnlyIds.length > 0 ? await getQuizzesByIds(savedOnlyIds) : [];
        setQuizzes(data);
        setSavedQuizDocs(savedDocs);
        if (countResult !== null) {
          setQuizCount(countResult);
        }
      })
      .catch(err => {
        console.error('Failed to fetch quizzes:', err);
        setError('Failed to load quizzes. Please try again.');
      })
      .finally(() => setIsLoading(false));
  };

  // Shared header for all states - search replaces the old (404) settings button
  const closeSearch = () => {
    setSearchQuery('');
    setIsSearchOpen(false);
    searchInputRef.current?.blur();
  };

  const renderHeader = () => (
    <header className="flex items-center justify-between px-4 py-3 mb-4 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex-1 min-w-0 truncate">
        My Quizzes
      </h1>
      <div className="flex items-center shrink-0">
        {/* Sort control - cycles favorites-first (default) / recent */}
        <Button
          variant="ghost"
          size="sm"
          className="p-1.5"
          onClick={() => setSortMode(mode => (mode === 'favorites' ? 'recent' : 'favorites'))}
          aria-label={
            sortMode === 'favorites'
              ? 'Sorted favorites first. Switch to recent'
              : 'Sorted by recent. Switch to favorites first'
          }
          title={sortMode === 'favorites' ? 'Favorites first' : 'Recent'}
        >
          <ArrowDownUp className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        </Button>
        {/* Always mounted so the width can animate; invisible keeps it out of tab order while closed */}
        <div
          className={`flex items-center overflow-hidden transition-all duration-300 motion-reduce:transition-none ${
            isSearchOpen ? 'max-w-[180px] opacity-100 ml-2 visible' : 'max-w-0 opacity-0 invisible'
          }`}
        >
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') closeSearch();
            }}
            placeholder="Search quizzes..."
            aria-label="Search quizzes"
            className="w-full min-w-0 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 rounded-lg px-2 py-1 text-sm focus:outline-none"
          />
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="p-1.5"
          onClick={() => {
            if (isSearchOpen) {
              closeSearch();
            } else {
              setIsSearchOpen(true);
            }
          }}
          aria-label={isSearchOpen ? 'Close search' : 'Search quizzes'}
        >
          {isSearchOpen ? (
            <X className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          ) : (
            <Search className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          )}
        </Button>
      </div>
    </header>
  );

  // Single-return layout: the header persists across loading, error, empty and
  // list states. Content classes match the previous per-state returns exactly.
  const showSkeletons = authLoading || isLoading || progressLoading;

  const renderContent = () => {
    if (showSkeletons) {
      return (
        <div className="max-w-[500px] mx-auto px-4 space-y-4">
          {/* Skeleton cards - count matches the user's quiz count (1-3) */}
          {Array.from({ length: Math.min(Math.max(quizCount, 1), 3) }).map((_, i) => (
            <QuizCardSkeleton key={i} />
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl border border-red-200 dark:border-red-800 p-8 text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Unable to Load Quizzes</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">{error}</p>
            <Button onClick={handleRetry} className="w-full">
              Try Again
            </Button>
          </div>
        </div>
      );
    }

    if (mergedQuizzes.length === 0) {
      return (
        <div className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mx-auto mb-4">
              <Plus className="w-8 h-8 text-primary-500 dark:text-primary-400" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">No Quizzes Yet</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              You haven't created any quizzes. Create your first quiz, or save public quizzes from the For You feed!
            </p>
            <Button onClick={handleCreateQuiz} className="w-full" size="lg">
              <Plus className="w-5 h-5 mr-2" aria-hidden="true" />
              Create Your First Quiz
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="px-4">
        <div className="max-w-[500px] mx-auto space-y-4">
          {filteredQuizzes.length === 0 ? (
            <p className="text-center text-gray-500 dark:text-gray-400 py-8">
              No quizzes match "{searchQuery}"
            </p>
          ) : (
            renderQuizCards(filteredQuizzes)
          )}
        </div>
      </div>
    );
  };

  const renderQuizCards = (list: QuizDocument[]) =>
    list.map((quiz) => {
      const quizId = quiz.id ?? '';
      const progress = quiz.id ? progressMap.get(quiz.id) || null : null;
      const colorId = quiz.id ? colorPrefsMap.get(quiz.id) || 'default' : 'default';
      const customTitle = quiz.id ? titlePrefsMap.get(quiz.id) || quiz.title : quiz.title;

      return (
        <QuizCardItem
          key={quiz.id}
          quiz={quiz}
          currentUserId={user?.uid}
          progress={progress}
          colorId={colorId}
          customTitle={customTitle}
          ownerName={quiz.createdBy !== user?.uid ? ownerNames.get(quiz.createdBy) : undefined}
          isFavorite={favoriteIds.has(quizId)}
          onQuizClick={handleQuizClick}
          onColorChange={handleColorChange}
          onTitleChange={handleTitleChange}
          onToggleVisibility={handleToggleVisibility}
          onDelete={handleDeleteQuiz}
          onToggleFavorite={toggleFavorite}
          onUnsave={quiz.createdBy !== user?.uid ? handleUnsave : undefined}
        />
      );
    });

  return (
    <div className="flex-1 bg-primary-50/30 dark:bg-gray-900">
      {renderHeader()}

      {/* Content */}
      <main className="pb-20">
        {renderContent()}
      </main>
    </div>
  );
}
