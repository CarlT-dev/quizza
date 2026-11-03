import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, ChevronRight, SearchX } from 'lucide-react';
import { useDebouncedValue } from '@/shared/hooks';
import { useUsernames } from '@/features/users';
import type { QuizDocument } from '@/features/quiz';
import { PublicQuizCard } from '@/features/quizzes/components/PublicQuizCard';
import { searchUsernames, getCachedPublicQuizzes, type UsernameSearchResult } from '../api/search';

const DEBOUNCE_MS = 250;
const MAX_QUIZ_RESULTS = 20;
const MAX_PEOPLE_RESULTS = 10;

export function SearchPage() {
  const navigate = useNavigate();

  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, DEBOUNCE_MS);

  const [people, setPeople] = useState<UsernameSearchResult[]>([]);
  const [quizResults, setQuizResults] = useState<QuizDocument[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resolved creator names for the quiz result cards
  const ownerUids = [...new Set(quizResults.map(q => q.createdBy))];
  const ownerNames = useUsernames(ownerUids);

  useEffect(() => {
    const trimmed = debouncedQuery.trim().toLowerCase();
    let cancelled = false;

    // Deferred so setIsSearching isn't a synchronous effect setState
    // (react(set-state-in-effect)) — same pattern as the quiz data hooks.
    void Promise.resolve().then(async () => {
      if (!trimmed) {
        setPeople([]);
        setQuizResults([]);
        setError(null);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      try {
        // People come from a prefix query; quiz matches are filtered
        // client-side over the cached public feed
        const [nameResults, publicQuizzes] = await Promise.all([
          searchUsernames(trimmed, MAX_PEOPLE_RESULTS),
          getCachedPublicQuizzes(),
        ]);
        if (cancelled) return;
        setPeople(nameResults);
        setQuizResults(
          publicQuizzes
            .filter(
              q =>
                q.title.toLowerCase().includes(trimmed) ||
                q.topic.toLowerCase().includes(trimmed)
            )
            .slice(0, MAX_QUIZ_RESULTS)
        );
        setError(null);
      } catch (err) {
        console.error('Search failed:', err);
        if (!cancelled) {
          setError('Search failed. Please try again.');
        }
      } finally {
        if (!cancelled) {
          setIsSearching(false);
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  const hasQuery = query.trim().length > 0;
  const hasResults = people.length > 0 || quizResults.length > 0;

  return (
    <div className="flex-1 bg-primary-50/30 dark:bg-gray-900">
      {/* Sticky search header — full-width input, Search icon absolutely
          positioned left. autoFocus + PageTransition remounting per pathname
          refocuses the input on every tab tap. */}
      <header className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people and quizzes"
            aria-label="Search people and quizzes"
            autoFocus
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
      </header>

      <main className="pb-20">
        {!hasQuery ? (
          <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
            <Search className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-4" aria-hidden="true" />
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">Search Quizza</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs">
              Find people by username, or quizzes by title and topic.
            </p>
          </div>
        ) : error ? (
          <div className="px-4 py-12 text-center">
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>
          </div>
        ) : !hasResults ? (
          <div className="px-4 py-12 text-center">
            {isSearching ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Searching…</p>
            ) : (
              <>
                <SearchX className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" aria-hidden="true" />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No results for "{query}"
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="max-w-[500px] mx-auto px-4 py-4 space-y-6">
            {people.length > 0 && (
              <section aria-label="People">
                <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                  People
                </h2>
                <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
                  {people.map((person) => (
                    <button
                      key={person.uid}
                      type="button"
                      onClick={() => navigate(`/user/${person.uid}`)}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <span className="w-11 h-11 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 font-medium text-lg flex-shrink-0">
                        {person.username.charAt(0).toUpperCase()}
                      </span>
                      <span className="flex-1 min-w-0 font-bold text-sm text-gray-900 dark:text-gray-100 truncate">
                        @{person.username}
                      </span>
                      <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              </section>
            )}

            {quizResults.length > 0 && (
              <section aria-label="Quizzes">
                <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                  Quizzes
                </h2>
                <div className="space-y-3">
                  {quizResults.map((quiz) => (
                    <PublicQuizCard
                      key={quiz.id}
                      quiz={quiz}
                      ownerName={ownerNames.get(quiz.createdBy)}
                      onClick={(quizId) => navigate(`/quiz/${quizId}`)}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
