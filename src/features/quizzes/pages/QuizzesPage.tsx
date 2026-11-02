import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth';
import { getUserQuizzes, getUserQuizCount, getPublicQuizzes, updateQuizVisibility, deleteQuiz, saveQuizTitle, type QuizDocument } from '@/features/quiz';
import { useQuizProgress } from '@/features/quiz/hooks/useQuizProgress';
import { saveQuizColorPreference, type CardColorId } from '@/features/quiz/api/quiz';
import { QuizCard } from '../components/QuizCard';
import { QuizCardSkeleton } from '../components/QuizCardSkeleton';
import { Plus, AlertTriangle, Search, X } from 'lucide-react';
import { Button } from '@/shared/components/ui';

export function QuizzesPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [quizzes, setQuizzes] = useState<QuizDocument[]>([]);
  const [quizCount, setQuizCount] = useState(3);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Expanding search (replaces the old Settings button that navigated to a 404)
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Discover tab - lazy fetch of public quizzes
  const [activeTab, setActiveTab] = useState<'mine' | 'discover'>('mine');
  const [discoverQuizzes, setDiscoverQuizzes] = useState<QuizDocument[]>([]);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [discoverError, setDiscoverError] = useState<string | null>(null);
  const discoverLoadedRef = useRef(false);

  // Fetch user's quizzes
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
        // Fetch quizzes and count in parallel (count drives skeleton amount)
        const [userQuizzes, countResult] = await Promise.all([
          getUserQuizzes(user.uid, 50),
          getUserQuizCount(user.uid).catch(() => null),
        ]);
        if (!cancelled) {
          setQuizzes(userQuizzes);
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

  // Quiz IDs for progress/color fetching (Mine + Discover, deduped).
  // Fresh array each memo - useQuizProgress sorts its copy in place.
  const quizIds = useMemo(
    () => [
      ...new Set([
        ...quizzes.map(q => q.id!).filter(Boolean),
        ...discoverQuizzes.map(q => q.id!),
      ]),
    ],
    [quizzes, discoverQuizzes]
  );

  // Fetch progress and color preferences
  const { progressMap, colorPrefsMap, titlePrefsMap, refetch: refetchProgress, updateColorPref, updateTitle, isLoading: progressLoading } = useQuizProgress({
    quizIds,
    userId: user?.uid,
    enabled: !!user && quizIds.length > 0,
  });

  // Live filter by title/topic - applies to whichever tab's list is visible
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const matchesSearch = useCallback(
    (quiz: QuizDocument) =>
      quiz.title.toLowerCase().includes(normalizedQuery) ||
      quiz.topic.toLowerCase().includes(normalizedQuery),
    [normalizedQuery]
  );
  const filteredQuizzes = useMemo(
    () => (normalizedQuery ? quizzes.filter(matchesSearch) : quizzes),
    [quizzes, normalizedQuery, matchesSearch]
  );

  // Discover list without the user's own quizzes (they are already in Mine)
  const visibleDiscover = useMemo(
    () => discoverQuizzes.filter(q => q.createdBy !== user?.uid),
    [discoverQuizzes, user]
  );
  const filteredDiscover = useMemo(
    () => (normalizedQuery ? visibleDiscover.filter(matchesSearch) : visibleDiscover),
    [visibleDiscover, normalizedQuery, matchesSearch]
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

  const handleDeleteQuiz = useCallback(async (quizId: string) => {
    if (!user) return;
    const prev = quizzes;
    const prevCount = quizCount;
    setQuizzes(prevQuizzes => prevQuizzes.filter(q => q.id !== quizId));
    setQuizCount(c => Math.max(0, c - 1));
    try {
      await deleteQuiz(quizId, user.uid);
    } catch (err) {
      console.error('Failed to delete quiz:', err);
      setQuizzes(prev);
      setQuizCount(prevCount);
      alert('Failed to delete quiz. Please try again.');
    }
  }, [user, quizzes, quizCount]);

  // Discover: fetch public quizzes. First activation shows skeletons; later
  // activations refresh silently (stale-while-revalidate) so the old list
  // stays visible and no loading state can flash onto the Mine tab.
  const fetchDiscover = useCallback(async () => {
    try {
      const publicQuizzes = await getPublicQuizzes(20);
      setDiscoverQuizzes(publicQuizzes);
      setDiscoverError(null);
      discoverLoadedRef.current = true;
    } catch (err) {
      console.error('Failed to fetch public quizzes:', err);
      // Keep any previously loaded list visible; only surface the error when
      // there is no data to show (first activation / after a retry failure)
      if (!discoverLoadedRef.current) {
        setDiscoverError('Failed to load public quizzes. Please try again.');
      }
    }
  }, []);

  const activateDiscover = () => {
    if (!discoverLoadedRef.current) {
      setDiscoverLoading(true);
      fetchDiscover().finally(() => setDiscoverLoading(false));
    } else {
      fetchDiscover();
    }
  };

  const handleTabChange = (tab: 'mine' | 'discover') => {
    setActiveTab(tab);
    if (tab === 'discover') {
      activateDiscover();
    }
  };

  const handleQuizClick = (quizId: string) => {
    navigate(`/quiz/${quizId}`);
  };

  const handleCreateQuiz = () => {
    navigate('/create-quiz');
  };

  const handleRetry = () => {
    if (user) {
      setIsLoading(true);
      setError(null);
      Promise.all([
        getUserQuizzes(user.uid, 50),
        getUserQuizCount(user.uid).catch(() => null),
      ])
        .then(([data, countResult]) => {
          setQuizzes(data);
          if (countResult !== null) {
            setQuizCount(countResult);
          }
        })
        .catch(err => {
          console.error('Failed to fetch quizzes:', err);
          setError('Failed to load quizzes. Please try again.');
        })
        .finally(() => setIsLoading(false));
    }
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
        {activeTab === 'mine' ? 'My Quizzes' : 'Discover'}
      </h1>
      <div className="flex items-center shrink-0">
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

  // Single-return layout: the header (and later tabs/search) persists across
  // loading, error, empty and list states. Content classes match the previous
  // per-state returns exactly.
  const showSkeletons = authLoading || isLoading || progressLoading;

  const renderMineContent = () => {
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

    if (quizzes.length === 0) {
      return (
        <div className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mx-auto mb-4">
              <Plus className="w-8 h-8 text-primary-500 dark:text-primary-400" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">No Quizzes Yet</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              You haven't created any quizzes. Start building your first quiz now!
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

  // Shared card renderer for both tabs
  const renderQuizCards = (list: QuizDocument[]) =>
    list.map((quiz) => {
      const progress = quiz.id ? progressMap.get(quiz.id) || null : null;
      const colorId = quiz.id ? colorPrefsMap.get(quiz.id) || 'default' : 'default';
      const customTitle = quiz.id ? titlePrefsMap.get(quiz.id) || quiz.title : quiz.title;

      return (
        <QuizCard
          key={quiz.id}
          quiz={quiz}
          currentUserId={user?.uid}
          progress={progress}
          colorId={colorId}
          customTitle={customTitle}
          onClick={() => handleQuizClick(quiz.id!)}
          onColorChange={(newColorId) => handleColorChange(quiz.id!, newColorId)}
          onTitleChange={(newTitle) => handleTitleChange(quiz.id!, newTitle)}
          onToggleVisibility={() => handleToggleVisibility(quiz.id!)}
          onDelete={() => handleDeleteQuiz(quiz.id!)}
        />
      );
    });

  const renderDiscoverContent = () => {
    if (discoverLoading && discoverQuizzes.length === 0) {
      return (
        <div className="max-w-[500px] mx-auto px-4 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <QuizCardSkeleton key={i} />
          ))}
        </div>
      );
    }

    if (discoverError) {
      return (
        <div className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl border border-red-200 dark:border-red-800 p-8 text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Unable to Load Public Quizzes</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">{discoverError}</p>
            <Button onClick={activateDiscover} className="w-full">
              Try Again
            </Button>
          </div>
        </div>
      );
    }

    if (filteredDiscover.length === 0) {
      return (
        <div className="flex-1 flex items-center justify-center px-4 py-12">
          <p className="text-gray-500 dark:text-gray-400 text-center">
            {normalizedQuery
              ? `No quizzes match "${searchQuery}"`
              : 'No public quizzes yet. Check back soon!'}
          </p>
        </div>
      );
    }

    return (
      <div className="px-4">
        <div className="max-w-[500px] mx-auto space-y-4">
          {renderQuizCards(filteredDiscover)}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-primary-50/30 dark:bg-gray-900">
      {renderHeader()}

      {/* Content */}
      <main className="pb-20">
        {/* Tabs - persist across all content states */}
        <div className="max-w-[500px] mx-auto px-4" role="tablist" aria-label="Quiz lists">
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-gray-100 dark:bg-gray-800 p-1 mb-4">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'mine'}
              onClick={() => handleTabChange('mine')}
              className={`rounded-lg py-2 text-sm font-medium transition-colors motion-reduce:transition-none ${
                activeTab === 'mine'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              My Quizzes
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'discover'}
              onClick={() => handleTabChange('discover')}
              className={`rounded-lg py-2 text-sm font-medium transition-colors motion-reduce:transition-none ${
                activeTab === 'discover'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              Discover
            </button>
          </div>
        </div>

        {activeTab === 'mine' ? renderMineContent() : renderDiscoverContent()}
      </main>
    </div>
  );
}