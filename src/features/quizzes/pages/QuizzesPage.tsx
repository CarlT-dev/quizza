import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth';
import {
  getUserQuizzes,
  getUserQuizCount,
  deleteQuiz,
  saveQuizTitle,
  type QuizDocument,
} from '@/features/quiz';
import { useQuizProgress } from '@/features/quiz/hooks/useQuizProgress';
import { useQuizFavorites } from '@/features/quiz/hooks/useQuizFavorites';
import { saveQuizColorPreference, type CardColorId } from '@/features/quiz/api/quiz';
import { QuizCardItem } from '../components/QuizCardItem';
import { QuizCardSkeleton } from '../components/QuizCardSkeleton';
import { Plus, AlertTriangle, Search, X, Star } from 'lucide-react';
import { Button } from '@/shared/components/ui';
import { ShareQuizSheet } from '@/features/messages';

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

  // Favorites view: reveals the favorites-only section
  const [isFavoritesView, setIsFavoritesView] = useState(false);

  // Quiz currently targeted by the share panel (null = closed)
  const [shareQuiz, setShareQuiz] = useState<QuizDocument | null>(null);

  // Favorite stars (quizFavorites side-documents)
  const { favoriteIds, toggleFavorite } = useQuizFavorites(user?.uid);

  // Fetch the user's quizzes
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
        // Fetch quizzes and count (drives skeleton amount) in parallel
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

  // Quiz IDs for progress/color fetching.
  // Fresh array each memo - useQuizProgress sorts its copy in place.
  const quizIds = useMemo(
    () => [...new Set(quizzes.map(q => q.id!).filter(Boolean))],
    [quizzes]
  );

  // Fetch progress and color preferences
  const { progressMap, colorPrefsMap, titlePrefsMap, refetch: refetchProgress, updateColorPref, updateTitle, isLoading: progressLoading } = useQuizProgress({
    quizIds,
    userId: user?.uid,
    enabled: !!user && quizIds.length > 0,
  });

  // Live filter by title/topic
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

  // Starred quizzes for their own section (still search-filtered); while the
  // view is shown the main list omits them so nothing appears twice.
  const favoriteQuizzes = useMemo(
    () => filteredQuizzes.filter(q => favoriteIds.has(q.id ?? '')),
    [filteredQuizzes, favoriteIds]
  );
  const mainQuizzes = useMemo(
    () => (isFavoritesView
      ? filteredQuizzes.filter(q => !favoriteIds.has(q.id ?? ''))
      : filteredQuizzes),
    [filteredQuizzes, isFavoritesView, favoriteIds]
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

  const handleQuizClick = useCallback((quizId: string) => {
    navigate(`/quiz/${quizId}`);
  }, [navigate]);

  const handleShareQuiz = useCallback((quizId: string) => {
    setShareQuiz(quizzes.find(q => q.id === quizId) ?? null);
  }, [quizzes]);

  const handleViewResults = useCallback((quizId: string) => {
    navigate(`/quiz/${quizId}/results`);
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
        {/* Favorites view toggle - reveals the favorites-only section */}
        <Button
          variant="ghost"
          size="sm"
          className="p-1.5"
          onClick={() => setIsFavoritesView(open => !open)}
          aria-pressed={isFavoritesView}
          aria-label={isFavoritesView ? 'Hide favorites section' : 'Show favorites section'}
          title={isFavoritesView ? 'Favorites shown' : 'Favorites'}
        >
          <Star
            className={`w-5 h-5 ${isFavoritesView ? 'fill-yellow-400' : 'text-gray-600 dark:text-gray-300'}`}
            aria-hidden="true"
          />
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
          <div className="w-full max-w-md dark:bg-gray-800 p-8 text-center">
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
              You haven't created any quizzes yet. Create your first quiz!
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
            <>
              {isFavoritesView && (
                <section aria-label="Favorite quizzes" className="space-y-4">
                  <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                    Favorites ({favoriteQuizzes.length})
                  </h2>
                  {favoriteQuizzes.length === 0 ? (
                    <p className="text-center text-gray-500 dark:text-gray-400 py-6">
                      No favorites yet — tap the star on a quiz card.
                    </p>
                  ) : (
                    renderQuizCards(favoriteQuizzes)
                  )}
                </section>
              )}
              {mainQuizzes.length > 0 && (
                <section aria-label="All quizzes" className="space-y-4">
                  {isFavoritesView && (
                    <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                      All Quizzes
                    </h2>
                  )}
                  {renderQuizCards(mainQuizzes)}
                </section>
              )}
            </>
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
          isFavorite={favoriteIds.has(quizId)}
          onQuizClick={handleQuizClick}
          onColorChange={handleColorChange}
          onTitleChange={handleTitleChange}
          onDelete={handleDeleteQuiz}
          onToggleFavorite={toggleFavorite}
          onShare={handleShareQuiz}
          onViewResults={handleViewResults}
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

      {/* Share flow: friends picker for the quiz targeted from a card's ⋯ menu */}
      <ShareQuizSheet quiz={shareQuiz} onClose={() => setShareQuiz(null)} />
    </div>
  );
}
