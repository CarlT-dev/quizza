import { useState, useEffect, useCallback } from 'react';
import { Search, X, Check, Loader2, Share2 } from 'lucide-react';
import { SlidePanel } from '@/shared/components/ui/SlidePanel';
import { useDebouncedValue } from '@/shared/hooks';
import { useAuth } from '@/features/auth';
import { searchUsernames, type UsernameSearchResult } from '@/features/search';
import { shareQuizToUser } from '../api/messages';
import type { QuizDocument } from '@/features/quiz/api/quiz';

const DEBOUNCE_MS = 250;
const MAX_PEOPLE_RESULTS = 10;

/** One person row's share outcome for the quiz being sent. */
type RowShareState = 'sharing' | 'sent' | 'error';

interface ShareQuizPanelProps {
  /** The quiz being shared; null keeps the panel closed. */
  quiz: QuizDocument | null;
  onClose: () => void;
}

/**
 * Person picker for sharing a quiz from a quiz card's ⋯ menu. The search is
 * the SearchPage pattern (debounced prefix query on the public usernames
 * collection). One quiz can be sent to several people while the panel stays
 * open; each row reports its own outcome and retries in place on failure.
 */
export function ShareQuizPanel({ quiz, onClose }: ShareQuizPanelProps) {
  return (
    <SlidePanel isOpen={quiz != null} onClose={onClose} title="Share quiz">
      {/* Keyed remount per open: picker state resets every time */}
      {quiz && <SharePicker key={quiz.id} quiz={quiz} />}
    </SlidePanel>
  );
}

function SharePicker({ quiz }: { quiz: QuizDocument }) {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, DEBOUNCE_MS);
  const [people, setPeople] = useState<UsernameSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareStates, setShareStates] = useState<Record<string, RowShareState>>({});

  // Debounced people search — same deferred pattern as SearchPage
  useEffect(() => {
    const trimmed = debouncedQuery.trim().toLowerCase();
    let cancelled = false;

    // Deferred so setIsSearching isn't a synchronous effect setState
    // (react(set-state-in-effect)) — same pattern as the quiz data hooks.
    void Promise.resolve().then(async () => {
      if (!trimmed) {
        setPeople([]);
        setError(null);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      try {
        const results = await searchUsernames(trimmed, MAX_PEOPLE_RESULTS);
        if (cancelled) return;
        setPeople(results);
        setError(null);
      } catch (err) {
        console.error('People search failed:', err);
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

  const handleShare = useCallback(async (person: UsernameSearchResult) => {
    if (!user) return;
    setShareStates(prev => ({ ...prev, [person.uid]: 'sharing' }));
    try {
      await shareQuizToUser(quiz, user.uid, person.uid);
      setShareStates(prev => ({ ...prev, [person.uid]: 'sent' }));
    } catch (err) {
      console.error('Failed to share quiz:', err);
      setShareStates(prev => ({ ...prev, [person.uid]: 'error' }));
    }
  }, [user, quiz]);

  // Never offer yourself as a share target
  const candidates = people.filter(person => person.uid !== user?.uid);
  const hasQuery = query.trim().length > 0;

  return (
    <div className="p-4 space-y-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Send <span className="font-medium text-gray-900 dark:text-gray-100">{quiz.title}</span> to someone.
      </p>

      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none"
          aria-hidden="true"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search username"
          aria-label="Search username to share with"
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

      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>
      ) : !hasQuery ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 py-6 text-center">
          Find a person by username to share this quiz with.
        </p>
      ) : candidates.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 py-6 text-center">
          {isSearching ? 'Searching…' : `No results for "${query}"`}
        </p>
      ) : (
        <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          {candidates.map((person) => {
            const state = shareStates[person.uid];
            const isSettled = state === 'sharing' || state === 'sent';
            return (
              <button
                key={person.uid}
                type="button"
                disabled={isSettled}
                onClick={() => handleShare(person)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors disabled:cursor-default disabled:hover:bg-transparent"
              >
                <span className="w-11 h-11 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 font-medium text-lg flex-shrink-0">
                  {person.username.charAt(0).toUpperCase()}
                </span>
                <span className="flex-1 min-w-0 font-bold text-sm text-gray-900 dark:text-gray-100 truncate">
                  @{person.username}
                </span>
                {state === 'sharing' && (
                  <Loader2 className="w-5 h-5 text-gray-400 animate-spin flex-shrink-0" aria-hidden="true" />
                )}
                {state === 'sent' && (
                  <span className="flex items-center gap-1 text-sm font-medium text-green-600 dark:text-green-400 flex-shrink-0">
                    <Check className="w-4 h-4" aria-hidden="true" />
                    Sent
                  </span>
                )}
                {state === 'error' && (
                  <span className="text-sm text-red-600 dark:text-red-400 flex-shrink-0" role="alert">
                    Failed — tap to retry
                  </span>
                )}
                {!state && (
                  <Share2 className="w-4 h-4 text-gray-400 flex-shrink-0" aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
