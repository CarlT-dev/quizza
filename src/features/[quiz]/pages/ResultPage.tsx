import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { AlertTriangle, Check, ChevronLeft, Home, RotateCcw, X } from 'lucide-react';
import { Button } from '@/shared/components/ui';
import { useAuth } from '@/features/auth/context/AuthContext';
import { getQuizById } from '@/features/quiz';
import type { QuizDocument } from '@/features/quiz/api/quiz';
import type { QuizQuestion } from '@/features/genai/schema';
import { checkEnumerationAnswer } from '@/features/genai/schema/quiz-response';

// Answer value stored per question id (mirrors QuizPage's answer map values)
type AnswerValue = number | string | string[];

// One graded question, forwarded by ScorePage's calculateScore() via location.state
interface ScoreDetail {
  questionId: string;
  isCorrect: boolean;
  userAnswer: AnswerValue;
  correctAnswer: AnswerValue;
  explanation: string;
}

interface ResultLocationState {
  answers?: Record<string, AnswerValue>; // forwarded by ScorePage; unused here
  score?: { correct: number; total: number; details?: ScoreDetail[] };
}

type ReviewFilter = 'all' | 'correct' | 'incorrect';

interface ReviewItem {
  detail: ScoreDetail;
  question: QuizQuestion | undefined;
  index: number; // position in details == question order at grading time
}

function mapQuizDocToQuiz(quizDoc: QuizDocument) {
  return {
    id: quizDoc.id || '',
    title: quizDoc.title,
    topic: quizDoc.topic,
    questions: quizDoc.questions,
  };
}

const TYPE_LABELS: Record<QuizQuestion['type'], string> = {
  multiple_choice: 'Multiple choice',
  true_false: 'True / False',
  identification: 'Identification',
  enumeration: 'Enumeration',
};

// Shared green/red families (same palette ScorePage uses for pass/fail)
const GREEN_ROW = 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20';
const RED_ROW = 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20';
const PLAIN_ROW = 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800';
const GREEN_ICON = 'text-green-600 dark:text-green-400';
const RED_ICON = 'text-red-600 dark:text-red-400';

export function ResultPage() {
  const { quiz: quizId } = useParams<{ quiz: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const state = location.state as ResultLocationState | undefined;

  const [quizData, setQuizData] = useState<ReturnType<typeof mapQuizDocToQuiz> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ReviewFilter>('all');
  const [barWidth, setBarWidth] = useState(0);

  const score = state?.score ?? null;

  // Fetch the quiz doc so review rows can show question text, options and type.
  // Skipped entirely when there is no score (direct refresh): the !score guard
  // below renders the error card without a spinner or a wasted Firestore read.
  useEffect(() => {
    if (!quizId || !score) return;

    let cancelled = false;

    const fetchQuiz = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const doc = await getQuizById(quizId);

        if (cancelled) return;

        if (doc) {
          setQuizData(mapQuizDocToQuiz(doc));
        } else {
          setError('Quiz not found');
        }
      } catch (err) {
        console.error('Failed to fetch quiz:', err);
        if (!cancelled) setError('Failed to load quiz');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchQuiz();

    return () => {
      cancelled = true;
    };
  }, [quizId, score]);

  const username = user?.displayName || user?.email?.split('@')[0] || 'User';
  const userInitial = username.charAt(0).toUpperCase();

  const total = score?.total ?? 0;
  const correctCount = score?.correct ?? 0;
  const percentage = total > 0
    ? Math.min(100, Math.max(0, Math.round((correctCount / total) * 100)))
    : 0;

  // Animate the bar from 0% to the final percentage once the page has data:
  // the bar first paints at width 0, then this re-render triggers the transition.
  useEffect(() => {
    if (!quizData) return;
    const raf = requestAnimationFrame(() => setBarWidth(percentage));
    return () => cancelAnimationFrame(raf);
  }, [quizData, percentage]);

  const questionById = useMemo(
    () => new Map((quizData?.questions ?? []).map((q): [string, QuizQuestion] => [q.id, q])),
    [quizData]
  );

  const reviewItems = useMemo<ReviewItem[]>(
    () => (score?.details ?? []).map((detail, index) => ({
      detail,
      question: questionById.get(detail.questionId),
      index,
    })),
    [score, questionById]
  );

  // Details whose question no longer exists (quiz edited since the attempt) are not renderable
  const renderableItems = useMemo(() => reviewItems.filter(item => item.question), [reviewItems]);
  const missingCount = reviewItems.length - renderableItems.length;
  const correctFilterCount = renderableItems.filter(item => item.detail.isCorrect).length;
  const incorrectFilterCount = renderableItems.length - correctFilterCount;

  const visibleItems = filter === 'all'
    ? renderableItems
    : renderableItems.filter(item => (filter === 'correct' ? item.detail.isCorrect : !item.detail.isCorrect));

  const handleRetake = () => {
    if (quizId) navigate(`/quiz/${quizId}`);
  };

  const handleBackHome = () => {
    navigate('/');
  };

  // Guard: no score in location.state (direct refresh / stale deep link)
  if (!score) {
    return (
      <div className="min-h-screen bg-primary-50/10 dark:bg-gray-900 flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl border border-red-200 dark:border-red-800 p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Results not found</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">Please complete the quiz to see your results.</p>
          <button
            onClick={handleBackHome}
            className="px-6 py-2 bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-primary-50/10 dark:bg-gray-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 dark:text-gray-400">Loading results...</p>
        </div>
      </div>
    );
  }

  if (error || !quizData) {
    return (
      <div className="min-h-screen bg-primary-50/10 dark:bg-gray-900 flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl border border-red-200 dark:border-red-800 p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Unable to Load Results</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">{error ?? 'Could not load this quiz.'}</p>
          <button
            onClick={handleBackHome}
            className="px-6 py-2 bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  const filterPills: { id: ReviewFilter; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: renderableItems.length },
    { id: 'correct', label: 'Correct', count: correctFilterCount },
    { id: 'incorrect', label: 'Incorrect', count: incorrectFilterCount },
  ];

  return (
    <div className="min-h-screen bg-primary-50/10 dark:bg-gray-900 flex flex-col">
      {/* Header with back chevron */}
      <header className="fixed inset-x-0 top-0 z-10 max-w-[500px] mx-auto bg-gradient-to-r from-primary-500 to-primary-600 rounded-b-3xl px-4 pb-4">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleBackHome}
          className="absolute top-6 left-4 p-2 text-white hover:bg-white/20"
          aria-label="Back to home"
        >
          <ChevronLeft className="w-7 h-7" aria-hidden="true" />
        </Button>
        <div className="pt-4 ml-15">
          <h1 className="text-3xl font-bold text-white">Quizza</h1>
          <p className="mt-0 text-white/80 text-lg">Detailed Results</p>
        </div>
      </header>

      {/* Content */}
      <main className="pt-1 pb-20 px-4 mt-23 flex-1">
        <div className="w-full max-w-md mx-auto space-y-6">
          {/* Score Summary Card */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 border border-primary-50/80 rounded-full bg-primary-500 flex items-center justify-center text-white font-medium text-base shrink-0">
                {userInitial}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-base text-text-primary dark:text-gray-100 truncate">{username}</p>
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
                      <div
                        key={`${index}-${detail.questionId}`}
                        className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 space-y-4"
                      >
                        {/* Question header */}
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-primary-600 dark:text-primary-400">
                              Question {index + 1}
                            </span>
                            <span className="px-2 py-0.5 text-xs font-medium rounded-lg bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300">
                              {TYPE_LABELS[question.type]}
                            </span>
                          </div>
                          <span className={`inline-flex items-center gap-1 text-xs font-semibold ${detail.isCorrect ? GREEN_ICON : RED_ICON}`}>
                            {detail.isCorrect ? (
                              <Check className="w-4 h-4" aria-hidden="true" />
                            ) : (
                              <X className="w-4 h-4" aria-hidden="true" />
                            )}
                            {detail.isCorrect ? 'Correct' : 'Incorrect'}
                          </span>
                        </div>

                        {/* Question text */}
                        <p className="text-base font-medium text-gray-900 dark:text-gray-100 leading-relaxed">
                          {question.question}
                        </p>

                        {/* Answer body per question type */}
                        {(() => {
                          switch (question.type) {
                            case 'multiple_choice':
                            case 'true_false': {
                              // Unanswered MC/TF arrives as '' (not undefined) from calculateScore
                              const userIndex = typeof detail.userAnswer === 'number' ? detail.userAnswer : null;
                              const correctIndex = typeof detail.correctAnswer === 'number' && detail.correctAnswer >= 0
                                ? detail.correctAnswer
                                : null;
                              const showLetters = question.type === 'multiple_choice';

                              if (correctIndex === null) {
                                return (
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Answer key unavailable for this question.
                                  </p>
                                );
                              }

                              return (
                                <>
                                  <ul className="space-y-2">
                                    {question.options.map((option, optionIndex) => {
                                      const isCorrectRow = optionIndex === correctIndex;
                                      const isUserRow = optionIndex === userIndex;
                                      const rowClass = isCorrectRow ? GREEN_ROW : isUserRow ? RED_ROW : PLAIN_ROW;
                                      const iconClass = isCorrectRow ? GREEN_ICON : RED_ICON;

                                      return (
                                        <li key={optionIndex} className={`flex items-center gap-3 p-3 rounded-xl border-2 ${rowClass}`}>
                                          {showLetters && optionIndex < 26 && (
                                            <span className={`text-xs font-bold shrink-0 ${isCorrectRow || isUserRow ? iconClass : 'text-gray-400 dark:text-gray-500'}`}>
                                              {String.fromCharCode(65 + optionIndex)}
                                            </span>
                                          )}
                                          <span className="flex-1 text-sm text-gray-900 dark:text-gray-100">{option}</span>
                                          {isUserRow && (
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-primary-500 text-white shrink-0">
                                              Yours
                                            </span>
                                          )}
                                          {isCorrectRow ? (
                                            <Check className={`w-5 h-5 shrink-0 ${iconClass}`} aria-hidden="true" />
                                          ) : isUserRow ? (
                                            <X className={`w-5 h-5 shrink-0 ${iconClass}`} aria-hidden="true" />
                                          ) : null}
                                        </li>
                                      );
                                    })}
                                  </ul>
                                  {userIndex === null && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                      You did not answer this question.
                                    </p>
                                  )}
                                </>
                              );
                            }

                            case 'identification': {
                              const userText = typeof detail.userAnswer === 'string' ? detail.userAnswer : '';
                              const isBlank = userText.trim().length === 0;
                              const correctText = typeof detail.correctAnswer === 'string' ? detail.correctAnswer : '';
                              const alternatives = (question.acceptableAnswers ?? [])
                                .filter(ans => ans.trim().toLowerCase() !== correctText.trim().toLowerCase());

                              return (
                                <div className="space-y-2">
                                  <div className={`p-3 rounded-xl border ${isBlank ? PLAIN_ROW : detail.isCorrect ? GREEN_ROW : RED_ROW}`}>
                                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Your answer</p>
                                    <p className={`text-sm ${isBlank ? 'text-gray-400 dark:text-gray-500 italic' : 'font-medium text-gray-900 dark:text-gray-100'}`}>
                                      {isBlank ? 'Not answered' : userText}
                                    </p>
                                  </div>
                                  <div className={`p-3 rounded-xl border ${GREEN_ROW}`}>
                                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Correct answer</p>
                                    <p className="text-sm font-medium text-green-700 dark:text-green-300">{correctText}</p>
                                  </div>
                                  {alternatives.length > 0 && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                      Also accepted: {alternatives.join(', ')}
                                    </p>
                                  )}
                                </div>
                              );
                            }

                            case 'enumeration': {
                              // userAnswer is '' (not an array) when the whole question was skipped,
                              // and can contain holes when only some items were filled in
                              const items = Array.isArray(detail.userAnswer) ? detail.userAnswer : [];
                              const keyList = question.correctAnswers ?? (Array.isArray(detail.correctAnswer) ? detail.correctAnswer : []);
                              const result = keyList.length > 0 ? checkEnumerationAnswer(items, keyList, question.minCorrect) : null;

                              return (
                                <div className="space-y-2">
                                  <ul className="space-y-2">
                                    {keyList.map((correctItem, itemIndex) => {
                                      const userItem = typeof items[itemIndex] === 'string' ? items[itemIndex] : '';
                                      const isBlank = userItem.trim().length === 0;
                                      const isMatch = !isBlank && userItem.trim().toLowerCase() === correctItem.trim().toLowerCase();

                                      return (
                                        <li key={itemIndex} className={`p-3 rounded-xl border ${isMatch ? GREEN_ROW : isBlank ? PLAIN_ROW : RED_ROW}`}>
                                          <div className="flex items-center justify-between gap-2">
                                            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                                              Item {itemIndex + 1}
                                            </span>
                                            {isMatch ? (
                                              <Check className={`w-4 h-4 shrink-0 ${GREEN_ICON}`} aria-hidden="true" />
                                            ) : (
                                              <X className={`w-4 h-4 shrink-0 ${isBlank ? 'text-gray-400 dark:text-gray-500' : RED_ICON}`} aria-hidden="true" />
                                            )}
                                          </div>
                                          <p className={`text-sm ${isBlank ? 'text-gray-400 dark:text-gray-500 italic' : 'font-medium text-gray-900 dark:text-gray-100'}`}>
                                            {isBlank ? 'Not answered' : userItem}
                                          </p>
                                          {!isMatch && (
                                            <p className="mt-1 text-xs text-green-700 dark:text-green-300">
                                              Correct: {correctItem}
                                            </p>
                                          )}
                                        </li>
                                      );
                                    })}
                                  </ul>
                                  {result && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                      Matched {result.correct} of {result.total} items
                                      {question.minCorrect != null && question.minCorrect < result.total
                                        ? ` (needs ${question.minCorrect} to pass)`
                                        : ''}.
                                    </p>
                                  )}
                                </div>
                              );
                            }

                            default:
                              return null;
                          }
                        })()}

                        {/* Explanation */}
                        {detail.explanation.trim().length > 0 && (
                          <div className="p-4 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-xl">
                            <p className="text-xs font-semibold text-primary-700 dark:text-primary-300 mb-1">Explanation</p>
                            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                              {detail.explanation}
                            </p>
                          </div>
                        )}
                      </div>
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

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={handleRetake}
              className="w-full py-4 px-6 bg-primary-500 text-white font-semibold rounded-xl hover:bg-primary-600 transition-colors text-lg flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-5 h-5" aria-hidden="true" />
              <span>Retake Quiz</span>
            </button>
            <button
              onClick={handleBackHome}
              className="w-full py-4 px-6 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-semibold rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-lg flex items-center justify-center gap-2"
            >
              <Home className="w-5 h-5" aria-hidden="true" />
              <span>Back to Home</span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
