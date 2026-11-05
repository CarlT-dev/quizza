import { Timestamp } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { AlertTriangle, ChevronLeft } from 'lucide-react';
import { Button } from '@/shared/components/ui';
import { formatRelativeTime } from '@/shared/utils';
import { useAuth } from '@/features/auth';
import { getQuizById, getQuizProgress } from '@/features/quiz';
import type { QuizDocument, QuizProgress } from '@/features/quiz/api/quiz';
import type { QuizQuestion } from '@/features/genai/schema';
import { getUserProfile } from '@/features/users/api/users';
import { computeIsCorrect, getCorrectAnswer, type ScoreDetail } from '../../utils/answerReview';
import { QuestionReviewCard } from '../../components/QuestionReviewCard';
import type { QuizResultRow, OwnerResultsLocationState } from './types';

type ReviewFilter = 'all' | 'correct' | 'incorrect';

interface ReviewItem {
  detail: ScoreDetail;
  question: QuizQuestion | undefined;
  index: number; // position in details == question order at grading time
}

/**
 * location.state survives a structured clone (React Router persists it in
 * window.history.state), which strips class prototypes — a Firestore Timestamp
 * arrives as a plain { seconds, nanoseconds } object with no toMillis(). Rows
 * rebuilt from getQuizProgress are unaffected (fresh SDK instances), so only
 * the forwarded row is rehydrated.
 */
function rehydrateTimestamp(value: Timestamp | { seconds: number; nanoseconds: number }): Timestamp {
  if (value instanceof Timestamp) return value;
  return new Timestamp(value.seconds, value.nanoseconds);
}

/**
 * Owner-only per-participant review: the same per-question rendering as the
 * taker's ResultPage, from the participant's perspective. The full attempt
 * doc usually arrives via location.state from the results list; a browser
 * refresh or deep link refetches it (the quizAttempts owner-read rule makes
 * the owner's getQuizProgress call legal).
 */
export function OwnerResultDetailPage() {
  const { quiz: quizId, uid: participantUid } = useParams<{ quiz: string; uid: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const state = location.state as OwnerResultsLocationState | undefined;

  const [quiz, setQuiz] = useState<QuizDocument | null>(null);
  const [row, setRow] = useState<QuizResultRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const [filter, setFilter] = useState<ReviewFilter>('all');
  const [barWidth, setBarWidth] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!quizId || !participantUid || !user) return;

    let cancelled = false;

    const load = async () => {
      try {
        setIsLoading(true);
        setError(null);
        setNotFound(false);
        setAccessDenied(false);
        setNoResults(false);

        // The quiz doc is always needed: owner guard + question text for the
        // legacy-doc re-grade fallback.
        const quizDoc = await getQuizById(quizId);
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
        setQuiz(quizDoc);

        // Fast path: the results list forwarded the full attempt doc, so no
        // attempt/profile reads are needed. The forwarded row crossed the
        // history.state serialization boundary, so its Timestamps lost their
        // prototype — rebuild both before anything reads them.
        if (state?.row) {
          const forwarded = state.row;
          setRow({
            ...forwarded,
            lastAttemptAt: rehydrateTimestamp(forwarded.lastAttemptAt),
            attempt: {
              ...forwarded.attempt,
              lastAttemptAt: rehydrateTimestamp(forwarded.attempt.lastAttemptAt),
            },
          });
          setIsLoading(false);
          return;
        }

        // Refresh / deep link: rebuild the same row shape from Firestore.
        // Rules allow the owner to read `${uid}_${quizId}`; a bogus uid reads
        // a non-existent doc (resource == null branch) and returns null.
        const [attemptData, profile] = await Promise.all([
          getQuizProgress(quizId, participantUid),
          getUserProfile(participantUid).catch(() => null),
        ]);
        if (cancelled) return;
        if (!attemptData || !attemptData.completed) {
          // Covers bogus uids and in-progress (not yet submitted) attempts
          setNoResults(true);
          setIsLoading(false);
          return;
        }

        const displayName =
          profile?.displayName || profile?.username || profile?.email?.split('@')[0] || 'Unknown';
        const score = attemptData.score ?? attemptData.firstScore ?? null;
        const percentage =
          score && score.total > 0
            ? Math.min(100, Math.max(0, Math.round((score.correct / score.total) * 100)))
            : null;

        setRow({
          userId: participantUid,
          displayName,
          score,
          firstScore: attemptData.firstScore ?? null,
          percentage,
          lastAttemptAt: attemptData.lastAttemptAt,
          // getQuizProgress types only QuizProgress, but the doc always
          // carries userId/quizId (saveQuizProgress writes them)
          attempt: attemptData as QuizProgress & { userId: string; quizId: string },
        });
        setIsLoading(false);
      } catch (err) {
        console.error('Failed to load participant results:', err);
        if (cancelled) return;
        if ((err as { code?: string })?.code === 'permission-denied') {
          // Non-owner deep link, or the owner-read rules not yet applied
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
  }, [quizId, participantUid, user, state?.row, refreshKey]);

  const displayName = row?.displayName ?? 'Participant Results';
  const score = row?.score ?? null;
  const total = score?.total ?? 0;
  const correctCount = score?.correct ?? 0;
  const percentage = row?.percentage ?? 0;
  const userInitial = displayName.charAt(0).toUpperCase();

  // Animate the bar from 0% to the final percentage once the page has data:
  // the bar first paints at width 0, then this re-render triggers the transition.
  useEffect(() => {
    if (!row) return;
    const raf = requestAnimationFrame(() => setBarWidth(percentage));
    return () => cancelAnimationFrame(raf);
  }, [row, percentage]);

  const questionById = useMemo(
    () => new Map((quiz?.questions ?? []).map((q): [string, QuizQuestion] => [q.id, q])),
    [quiz]
  );

  const reviewItems = useMemo<ReviewItem[]>(() => {
    if (!row) return [];
    const attempt = row.attempt;
    if (attempt.details) {
      return attempt.details.map((detail, index) => ({
        detail,
        question: questionById.get(detail.questionId),
        index,
      }));
    }
    // Reconstruct from quiz questions and attempt answers when details are
    // unavailable (attempts saved before details were persisted)
    if (quiz) {
      const answers = attempt.answers;
      if (!answers) return [];
      return quiz.questions.map((q, index) => ({
        detail: {
          questionId: q.id,
          isCorrect: computeIsCorrect(q, answers[q.id]),
          userAnswer: answers[q.id] ?? '',
          correctAnswer: getCorrectAnswer(q),
          explanation: q.explanation,
        },
        question: q,
        index,
      }));
    }
    return [];
  }, [row, quiz, questionById]);

  // Details whose question no longer exists (quiz edited since the attempt) are not renderable
  const renderableItems = useMemo(() => reviewItems.filter(item => item.question), [reviewItems]);
  const missingCount = reviewItems.length - renderableItems.length;
  const correctFilterCount = renderableItems.filter(item => item.detail.isCorrect).length;
  const incorrectFilterCount = renderableItems.length - correctFilterCount;

  const visibleItems = filter === 'all'
    ? renderableItems
    : renderableItems.filter(item => (filter === 'correct' ? item.detail.isCorrect : !item.detail.isCorrect));

  const filterPills: { id: ReviewFilter; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: renderableItems.length },
    { id: 'correct', label: 'Correct', count: correctFilterCount },
    { id: 'incorrect', label: 'Incorrect', count: incorrectFilterCount },
  ];

  const handleBack = () => navigate(`/quiz/${quizId}/results`);
  const handleBackToQuizzes = () => navigate('/quizzes');
  const handleRetry = () => setRefreshKey(key => key + 1);

  if (isLoading) {
    return (
      <div className="flex-1 bg-primary-50/30 dark:bg-gray-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 dark:text-gray-400">Loading results...</p>
        </div>
      </div>
    );
  }

  const renderStateCard = (
    heading: string,
    body: string,
    onBack: () => void,
    backLabel: string,
    onRetry?: () => void
  ) => (
    <div className="flex items-center justify-center py-12">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl border border-red-200 dark:border-red-800 p-8 text-center">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">{heading}</h2>
        <p className="text-gray-500 dark:text-gray-400 mb-6">{body}</p>
        <div className="space-y-3">
          {onRetry && (
            <Button onClick={onRetry} className="w-full">
              Try Again
            </Button>
          )}
          <Button onClick={onBack} className="w-full">
            {backLabel}
          </Button>
        </div>
      </div>
    </div>
  );

  if (notFound) {
    return (
      <div className="flex-1 bg-primary-50/30 dark:bg-gray-900">
        {renderStateCard('Quiz not found', 'This quiz may have been deleted.', handleBackToQuizzes, 'Back to My Quizzes')}
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="flex-1 bg-primary-50/30 dark:bg-gray-900">
        {renderStateCard('No Access', 'Only the quiz owner can view these results.', handleBackToQuizzes, 'Back to My Quizzes')}
      </div>
    );
  }

  if (noResults) {
    return (
      <div className="flex-1 bg-primary-50/30 dark:bg-gray-900">
        {renderStateCard(
          'Results not found for this participant',
          'This participant has not completed the quiz.',
          handleBack,
          'Back to Results'
        )}
      </div>
    );
  }

  if (error || !row) {
    return (
      <div className="flex-1 bg-primary-50/30 dark:bg-gray-900">
        {renderStateCard('Unable to Load Results', error ?? 'Could not load this attempt.', handleBack, 'Back to Results', handleRetry)}
      </div>
    );
  }

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
            aria-label="Back to results"
          >
            <ChevronLeft className="w-5 h-5" aria-hidden="true" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
              {displayName}
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {quiz?.title ?? ''}
            </p>
          </div>
        </div>
      </header>

      <main className="pb-20 px-4">
        <div className="w-full max-w-md mx-auto space-y-6">
          {/* Score Summary Card — mirrors the taker's ResultPage summary */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 border border-primary-50/80 rounded-full bg-primary-500 flex items-center justify-center text-white font-medium text-base shrink-0">
                {userInitial}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-base text-text-primary dark:text-gray-100 truncate">{displayName}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {correctCount} of {total} correct
                </p>
              </div>
              <p className="text-3xl font-bold text-primary-600 dark:text-primary-400 tabular-nums shrink-0">
                {percentage}%
              </p>
            </div>
            <div
              className="mt-4 h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden"
              role="progressbar"
              aria-valuenow={percentage}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Quiz score"
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary-500 to-primary-400 transition-all duration-700 motion-reduce:transition-none"
                style={{ width: `${barWidth}%` }}
              />
            </div>
            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400 text-center">
              {row.firstScore && score &&
                (row.firstScore.correct !== score.correct || row.firstScore.total !== score.total)
                ? `First try: ${row.firstScore.correct}/${row.firstScore.total} · `
                : ''}
              Completed {formatRelativeTime(row.lastAttemptAt)}
            </p>
          </div>

          {/* Answer Review */}
          <section className="space-y-4">
            {missingCount > 0 && renderableItems.length > 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                Some questions were removed or changed since this attempt, so they are not shown here.
              </p>
            )}

            {renderableItems.length > 0 && (
              <div role="group" aria-label="Filter questions" className="flex gap-2 flex-wrap">
                {filterPills.map(pill => (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => setFilter(pill.id)}
                    aria-pressed={filter === pill.id}
                    className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                      filter === pill.id
                        ? 'bg-primary-500 border-primary-500 text-white'
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    {pill.label} ({pill.count})
                  </button>
                ))}
              </div>
            )}

            {renderableItems.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No answer details are available for this attempt.
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  {visibleItems.map(item => {
                    const { detail, question, index } = item;

                    // Filtered upstream by renderableItems; keeps TypeScript sure below
                    if (!question) return null;

                    return (
                      <QuestionReviewCard
                        key={`${index}-${detail.questionId}`}
                        detail={detail}
                        question={question}
                        index={index}
                        perspective="owner"
                      />
                    );
                  })}
                </div>

                {visibleItems.length === 0 && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                    No questions in this view.
                  </p>
                )}
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
