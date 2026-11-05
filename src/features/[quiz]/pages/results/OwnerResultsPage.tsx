import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ChevronLeft, Users } from 'lucide-react';
import { Button } from '@/shared/components/ui';
import { formatRelativeTime } from '@/shared/utils';
import { useAuth } from '@/features/auth';
import { getQuizById, getQuizAttempts, getQuizTitle } from '@/features/quiz';
import type { QuizDocument } from '@/features/quiz/api/quiz';
import { getUserProfile } from '@/features/users/api/users';
import type { QuizResultRow } from './types';

/**
 * Owner-only results list: every completed attempt for one quiz, newest first.
 * Authorization is enforced by the quizAttempts read rule's quiz-owner branch
 * (this page's checks are UX only); a non-owner deep link is denied by rules
 * and lands on the no-access card.
 */
export function OwnerResultsPage() {
  const { quiz: quizId } = useParams<{ quiz: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [quiz, setQuiz] = useState<QuizDocument | null>(null);
  const [customTitle, setCustomTitle] = useState<string | null>(null);
  const [rows, setRows] = useState<QuizResultRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!quizId || !user) return;

    let cancelled = false;

    const load = async () => {
      try {
        setIsLoading(true);
        setError(null);
        setNotFound(false);
        setAccessDenied(false);

        // Owner's custom card title is a per-user pref; a failure must not
        // block the page, so it falls back to quiz.title at render time.
        const [quizDoc, attempts, title] = await Promise.all([
          getQuizById(quizId),
          getQuizAttempts(quizId),
          getQuizTitle(quizId, user.uid).catch(() => null),
        ]);

        if (cancelled) return;

        if (!quizDoc) {
          setNotFound(true);
          setIsLoading(false);
          return;
        }
        if (quizDoc.createdBy !== user.uid) {
          setAccessDenied(true);
          setIsLoading(false);
          return;
        }

        // Completed attempts only (in-progress takers have no saved score yet),
        // newest first — client-side sort, no composite index needed.
        const completed = attempts
          .filter(a => a.completed)
          .sort((a, b) => b.lastAttemptAt.toMillis() - a.lastAttemptAt.toMillis());

        // Resolve display names from public profiles; a missing profile
        // degrades to 'Unknown' instead of failing the page.
        const uniqueUids = Array.from(new Set(completed.map(a => a.userId)));
        const profiles = await Promise.all(
          uniqueUids.map(uid => getUserProfile(uid).catch(() => null))
        );
        const profileByUid = new Map<string, (typeof profiles)[number]>();
        profiles.forEach(profile => {
          if (profile) profileByUid.set(profile.uid, profile);
        });

        if (cancelled) return;

        const builtRows: QuizResultRow[] = completed.map(attempt => {
          const profile = profileByUid.get(attempt.userId) ?? null;
          const displayName =
            profile?.displayName || profile?.username || profile?.email?.split('@')[0] || 'Unknown';
          // Legacy docs completed before firstScore existed may lack both;
          // score itself is optional on the schema.
          const score = attempt.score ?? attempt.firstScore ?? null;
          const percentage =
            score && score.total > 0
              ? Math.min(100, Math.max(0, Math.round((score.correct / score.total) * 100)))
              : null;
          return {
            userId: attempt.userId,
            displayName,
            score,
            firstScore: attempt.firstScore ?? null,
            percentage,
            lastAttemptAt: attempt.lastAttemptAt,
            attempt,
          };
        });

        setQuiz(quizDoc);
        setCustomTitle(title);
        setRows(builtRows);
        setIsLoading(false);
      } catch (err) {
        console.error('Failed to load quiz results:', err);
        if (cancelled) return;
        if ((err as { code?: string })?.code === 'permission-denied') {
          // Non-owner deep link, or the owner-read rules not yet applied.
          setAccessDenied(true);
        } else {
          setError('Failed to load results. Please try again.');
        }
        setIsLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [quizId, user, refreshKey]);

  const handleBack = () => navigate('/quizzes');
  const handleRetry = () => setRefreshKey(key => key + 1);

  const openRow = (row: QuizResultRow) => {
    if (!quizId) return;
    // Full attempt doc rides in location.state so the detail page renders
    // without refetching; the detail page refetches on refresh/deep link.
    navigate(`/quiz/${quizId}/results/${row.userId}`, { state: { row } });
  };

  const title = customTitle ?? quiz?.title ?? 'Quiz';
  const takerCount = rows.length;

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-500 dark:text-gray-400">Loading results...</p>
          </div>
        </div>
      );
    }

    if (notFound) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl border border-red-200 dark:border-red-800 p-8 text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Quiz not found</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              This quiz may have been deleted.
            </p>
            <Button onClick={handleBack} className="w-full">
              Back to My Quizzes
            </Button>
          </div>
        </div>
      );
    }

    if (accessDenied) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl border border-red-200 dark:border-red-800 p-8 text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">No Access</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Only the quiz owner can view these results.
            </p>
            <Button onClick={handleBack} className="w-full">
              Back to My Quizzes
            </Button>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl border border-red-200 dark:border-red-800 p-8 text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Unable to Load Results</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">{error}</p>
            <Button onClick={handleRetry} className="w-full">
              Try Again
            </Button>
          </div>
        </div>
      );
    }

    if (rows.length === 0) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-primary-500 dark:text-primary-400" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">No Results Yet</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Nobody has completed this quiz yet.
            </p>
            <Button onClick={handleBack} className="w-full">
              Back to My Quizzes
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden divide-y divide-gray-100 dark:divide-gray-700">
        {rows.map(row => {
          const initial = row.displayName.charAt(0).toUpperCase();
          // First-try line only adds information when it differs from the latest
          const firstTry =
            row.firstScore && row.score &&
            (row.firstScore.correct !== row.score.correct ||
              row.firstScore.total !== row.score.total)
              ? row.firstScore
              : null;

          return (
            <button
              key={row.userId}
              type="button"
              onClick={() => openRow(row)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <div className="w-9 h-9 rounded-full bg-primary-500 flex items-center justify-center text-white font-medium text-sm shrink-0">
                {initial}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">
                  {row.displayName}
                </p>
                {firstTry && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 tabular-nums">
                    First try: {firstTry.correct}/{firstTry.total}
                  </p>
                )}
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {formatRelativeTime(row.lastAttemptAt)}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-primary-600 dark:text-primary-400 tabular-nums">
                  {row.score ? `${row.score.correct}/${row.score.total}` : '—'}
                </p>
                {row.percentage !== null && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 tabular-nums">
                    {row.percentage}%
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex-1 bg-primary-50/30 dark:bg-gray-900">
      {/* Page-rendered header (Layout's title prop is inert without showHeader) */}
      <header className="px-4 py-3 mb-4 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="p-1.5 -ml-1.5 shrink-0"
            onClick={handleBack}
            aria-label="Back to My Quizzes"
          >
            <ChevronLeft className="w-5 h-5" aria-hidden="true" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
              {title}
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {takerCount} {takerCount === 1 ? 'taker' : 'takers'}
            </p>
          </div>
        </div>
      </header>

      <main className="pb-20 px-4">
        <div className="max-w-[500px] mx-auto">{renderContent()}</div>
      </main>
    </div>
  );
}
