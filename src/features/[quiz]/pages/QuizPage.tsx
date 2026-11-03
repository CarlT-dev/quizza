import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronsLeft, ChevronsRight, Play, Loader2, AlertTriangle, RotateCcw, History } from 'lucide-react';
import { getQuizById, saveQuizProgress, getQuizProgress } from '@/features/quiz';
import { useAuth } from '@/features/auth';
import type { QuizDocument, QuizProgress } from '@/features/quiz/api/quiz';

function mapQuizDocToQuiz(quizDoc: QuizDocument) {
  return {
    id: quizDoc.id || '',
    title: quizDoc.title,
    topic: quizDoc.topic,
    questions: quizDoc.questions,
  };
}

export function QuizPage() {
  const { quiz: quizId } = useParams<{ quiz: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  // State for fetched quiz
  const [quizData, setQuizData] = useState<ReturnType<typeof mapQuizDocToQuiz> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Saved progress from Firestore — used to display correct progress on the
  // start page and to let the user resume where they left off.
  const [savedProgress, setSavedProgress] = useState<QuizProgress | null>(null);

  // Fetch quiz from Firestore
  useEffect(() => {
    if (!quizId) {
      setError('No quiz ID provided');
      setIsLoading(false);
      return;
    }

    const fetchQuiz = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const doc = await getQuizById(quizId);

        if (doc) {
          setQuizData(mapQuizDocToQuiz(doc));
          // Fetch saved progress for this quiz so the start page shows the
          // correct progress and the user can resume where they left off.
          if (user) {
            try {
              const progress = await getQuizProgress(quizId, user.uid);
              setSavedProgress(progress ?? null);
            } catch (err) {
              console.error('Failed to fetch progress:', err);
              setSavedProgress(null);
            }
          }
        } else {
          setError('Quiz not found');
        }
      } catch (err) {
        console.error('Failed to fetch quiz:', err);
        setError('Failed to load quiz');
      } finally {
        setIsLoading(false);
      }
    };

    fetchQuiz();
  }, [quizId]);

  // State persisted across both views
  const [view, setView] = useState<'start' | 'quiz'>('start');
  const [currentIndex, setCurrentIndex] = useState(0);
  // Track whether we've initialized currentIndex from saved progress (runs once).
  const initRef = useRef(false);
  // Answer can be: number (multiple_choice/true_false), string (identification), string[] (enumeration)
  const [answers, setAnswers] = useState<Map<string, number | string | string[]>>(new Map());

  // Initialize currentIndex from saved progress so the user can resume where
  // they left off. Runs once when savedProgress first becomes available.
  useEffect(() => {
    if (!initRef.current && savedProgress && savedProgress.answeredCount > 0) {
      setCurrentIndex(savedProgress.answeredCount);
      initRef.current = true;
    }
  }, [savedProgress]);

  // VIEW 1 derived constants (with null checks for start page)
  const totalQuestions = quizData?.questions.length ?? 0;
  const startPageProgress = `${currentIndex}/${totalQuestions}`;
  const isFirstQuestion = currentIndex === 0;
  const isLastQuestion = currentIndex === totalQuestions - 1;

  // Check if current question has an answer (VIEW 1 uses this for button state)
  const hasAnswer = answers.has(quizData?.questions[currentIndex]?.id || '');

  // Count answered questions (for progress)
  const answeredCount = Array.from(answers.values()).filter(v => {
    if (typeof v === 'string') return v.trim().length > 0;
    if (Array.isArray(v)) return v.some(item => item.trim().length > 0);
    return v !== undefined;
  }).length;

  // Persist progress so the quizzes list can show the strip and completed dot.
  // Debounced: answeredCount only changes when a question goes unanswered -> answered,
  // so identification/enumeration keystrokes do not retrigger the write.
  // Gap (accepted): no flush-on-unmount, so leaving within 800ms of an answer
  // loses that delta until the next write or submit.
  useEffect(() => {
    if (view !== 'quiz' || !quizData || !user || !quizId || answeredCount === 0) return;
    const timer = setTimeout(async () => {
      await saveQuizProgress(quizId, user.uid, {
        answeredCount,
        totalQuestions,
        completed: false,
      });
      try {
        const progress = await getQuizProgress(quizId, user.uid);
        setSavedProgress(progress ?? null);
      } catch (err) {
        console.error('Failed to refresh progress after save:', err);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [view, quizData, user, answeredCount, totalQuestions, quizId]);

  const handleSelectAnswer = (questionId: string, optionIndex: number) => {
    setAnswers(prev => new Map(prev).set(questionId, optionIndex));
  };

  const handleIdentificationAnswer = (questionId: string, value: string) => {
    setAnswers(prev => new Map(prev).set(questionId, value));
  };

  const handleEnumerationAnswer = (questionId: string, index: number, value: string) => {
    setAnswers(prev => {
      const newMap = new Map(prev);
      const current = newMap.get(questionId) as string[] || [];
      const updated = [...current];
      updated[index] = value;
      newMap.set(questionId, updated);
      return newMap;
    });
  };

  const handleNext = () => {
    if (isLastQuestion) {
      // Submit quiz - navigate to score page with answers
      const answersObj: Record<string, number | string | string[]> = {};
      answers.forEach((value, key) => {
        answersObj[key] = value;
      });
      navigate(`/quiz/${quizId}/score`, { state: { answers: answersObj } });
    } else {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (!isFirstQuestion) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const handleStartQuiz = () => {
    setView('quiz');
  };

  const handleRetake = () => {
    setAnswers(new Map());
    setCurrentIndex(0);
    setView('quiz');
    initRef.current = false;
  };

  const handleBackToStart = async () => {
    // Flush any in-flight answered-count progress to Firestore before leaving
    // the quiz view, so the start page and quizzes list reflect the latest state.
    if (user && quizData && quizId && answeredCount > 0) {
      try {
        await saveQuizProgress(quizId, user.uid, {
          answeredCount,
          totalQuestions,
          completed: false,
        });
      } catch (err) {
        console.error('Failed to save progress before returning to start:', err);
      }
    }
    // Refresh savedProgress from Firestore so the start page shows current
    // retake progress instead of the stale completed state.
    if (user && quizId) {
      try {
        const progress = await getQuizProgress(quizId, user.uid);
        setSavedProgress(progress ?? null);
      } catch (err) {
        console.error('Failed to refresh progress on return to start:', err);
      }
    }
    setView('start');
  };

  // --- VIEW 1: START PAGE ---
  if (view === 'start') {
    const renderStartHeader = () => (
      <header className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          aria-label="Back to home"
        >
          <ChevronLeft className="w-6 h-6" aria-hidden="true" />
        </button>
        <div className="flex-1 text-center">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Quiz Overview</h1>
        </div>
        {savedProgress?.completed ? (
          <button
            type="button"
            onClick={() => navigate(`/quiz/${quizId}/result`)}
            className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            aria-label="View results"
          >
            <History className="w-6 h-6" aria-hidden="true" />
          </button>
        ) : (
          <div className="w-10" />
        )}
      </header>
    );

    if (isLoading) {
      return (
        <div className="flex-1 bg-primary-50/10 dark:bg-gray-900 flex flex-col">
          {renderStartHeader()}
          <main className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-10 h-10 text-primary-500 animate-spin" />
              <p className="text-gray-500 dark:text-gray-400">Loading quiz...</p>
            </div>
          </main>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex-1 bg-primary-50/10 dark:bg-gray-900 flex flex-col">
          {renderStartHeader()}
          <main className="flex-1 flex items-center justify-center px-4">
            <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl border border-red-200 dark:border-red-800 p-8 text-center">
              <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Unable to load quiz</h2>
              <p className="text-gray-500 dark:text-gray-400 mb-6">{error}</p>
              <p className="text-sm text-gray-400 dark:text-gray-500">Showing demo quiz instead.</p>
            </div>
          </main>
        </div>
      );
    }

    return (
      <div className="flex-1 bg-primary-50/10 dark:bg-gray-900 flex flex-col">
        {/* Header - HomePage style container */}
        <header className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            aria-label="Back to home"
          >
            <ChevronLeft className="w-6 h-6" aria-hidden="true" />
          </button>
          <div className="flex-1 text-center">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Quiz Overview</h1>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/quiz/${quizId}/result`)}
            className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            aria-label="View results"
          >
            <History className="w-6 h-6" aria-hidden="true" />
          </button>
        </header>

        {/* Content */}
        <main className="flex-1 flex items-center justify-center px-4 py-8">
          <div className="w-full max-w-md">
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8 space-y-6">
              {/* Quiz Title & Topic */}
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{quizData?.title ?? ''}</h2>
                <p className="text-gray-500 dark:text-gray-400">{quizData?.topic ?? ''}</p>
              </div>

              {/* Progress Display */}
              <div className="text-center">
                <div className="text-4xl font-bold text-primary-600 dark:text-primary-400 tabular-nums">
                  {savedProgress ? `${savedProgress.answeredCount}/${totalQuestions}` : startPageProgress}
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {savedProgress
                    ? savedProgress.answeredCount === 0
                      ? 'Not started yet'
                      : 'questions answered'
                    : currentIndex === 0
                    ? 'Not started yet'
                    : 'questions answered'}
                </p>
                {/* Thin progress bar */}
                <div className="mt-4 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary-500 transition-all duration-300"
                    style={{
                      width:
                        totalQuestions > 0
                          ? `${((savedProgress?.answeredCount ?? currentIndex) / totalQuestions) * 100}%`
                          : '0%',
                    }}
                  />
                </div>
              </div>


              {/* Start/Continue / Retake Button */}
              {savedProgress?.completed ? (
                <button
                  onClick={handleRetake}
                  className="w-full py-4 px-6 bg-primary-500 text-white font-semibold rounded-xl hover:bg-primary-600 transition-colors text-lg flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-5 h-5" aria-hidden="true" />
                  <span>Retake</span>
                </button>
              ) : (
                <button
                  onClick={handleStartQuiz}
                  className="w-full py-4 px-6 bg-primary-500 text-white font-semibold rounded-xl hover:bg-primary-600 transition-colors text-lg flex items-center justify-center gap-2"
                  disabled={currentIndex >= totalQuestions}
                >
                  <Play className="w-5 h-5" aria-hidden="true" />
                  {currentIndex === 0 ? 'Start Quiz' : 'Continue'}
                </button>
              )}

              {currentIndex > 0 && !savedProgress?.completed && (
                <p className="text-center text-xs text-gray-500 dark:text-gray-400">
                  Click Continue to resume from question {currentIndex + 1}
                </p>
              )}
            </div>
          </div>
        </main>
      </div>
    );
  }

  // --- VIEW 2: QUIZ PAGE (Question by Question) ---
  if (isLoading) {
    return (
      <div className="flex-1 bg-primary-50/10 dark:bg-gray-900 flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-primary-500 animate-spin" />
      </div>
    );
  }

  // Guard: no quiz data or no questions
  if (!quizData || quizData.questions.length === 0) {
    return (
      <div className="flex-1 bg-primary-50/10 dark:bg-gray-900 flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl border border-red-200 dark:border-red-800 p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Quiz Not Available</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">This quiz could not be loaded or has no questions.</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2 bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  // VIEW 2 derived constants (after guard - TypeScript knows they're defined)
  const currentQuestion = quizData.questions[currentIndex];
  const progress = ((currentIndex + 1) / quizData.questions.length) * 100;
  const selectedAnswer = answers.get(currentQuestion.id);

  return (
    <div className="flex-1 bg-primary-50/10 dark:bg-gray-900 flex flex-col">
      {/* Header with back chevron + progress bar */}
      <header className="py-4">
        {/* Back Chevron */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={handleBackToStart}
            className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            aria-label="Back to quiz overview"
          >
            <ChevronLeft className="w-6 h-6" aria-hidden="true" />
          </button>
          <span className="text-sm font-medium text-gray-500 dark:text-gray-400 flex-1 text-center truncate">
            {quizData?.title ?? ''}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="h-1 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden mt-3">
          <div
            className="h-full bg-primary-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-end px-4 pt-2 text-xs text-gray-500 dark:text-gray-400">
          <span>{answeredCount}/{totalQuestions} answered</span>
        </div>
      </header>

      {/* Question Content */}
      <main className="flex-1 flex flex-col pb-24 px-4 max-w-[500px] mx-auto w-full mb-30">
        <div className="flex-1 flex flex-col">
          {/* Question Number & Type Badge */}
            <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
              <span className="text-xs font-medium text-primary-600 dark:text-primary-400">
                Question {currentIndex + 1}
              </span>
            </div>

            {/* Question Text */}
            <p className="text-lg font-medium text-gray-900 dark:text-gray-100 leading-relaxed">
              {currentQuestion.question}
            </p>

            {/* Answer Input based on question type */}
            <div className="space-y-3 mt-8">
              {(() => {
                switch (currentQuestion.type) {
                  case 'multiple_choice':
                  case 'true_false': {
                    return (
                      <>
                        {currentQuestion.options.map((option, optionIndex) => {
                          const isSelected = selectedAnswer === optionIndex;
                          const letter = String.fromCharCode(65 + optionIndex);
                          return (
                            <button
                              key={optionIndex}
                              type="button"
                              onClick={() => handleSelectAnswer(currentQuestion.id, optionIndex)}
                              className={`
                                w-full text-left p-4 rounded-xl border-2 transition-all duration-200 cursor-pointer
                                ${isSelected
                                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                                  : 'border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-700'
                                }
                              `}
                              aria-pressed={isSelected}
                            >
                              <div className="flex items-center gap-3">
                                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${isSelected ? 'bg-primary-500 text-primary-100 dark:bg-primary-900 dark:text-primary-300' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                                  {letter}
                                </span>
                                <span className="flex-1 text-gray-900 dark:text-gray-100 text-sm">
                                  {option}
                                </span>
                                {isSelected && (
                                  <svg className="w-5 h-5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </>
                    );
                  }

                  case 'identification': {
                    const answerText = (typeof selectedAnswer === 'string' ? selectedAnswer : '') || '';
                    return (
                      <input
                        type="text"
                        value={answerText}
                        onChange={(e) => handleIdentificationAnswer(currentQuestion.id, e.target.value)}
                        placeholder="Type your answer here..."
                        className="w-full p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 text-base"
                        autoComplete="off"
                        autoFocus
                      />
                    );
                  }

                  case 'enumeration': {
                    const answerArray = (Array.isArray(selectedAnswer) ? selectedAnswer : []) || [];
                    const expectedCount = (currentQuestion as any).correctAnswers?.length || 0;
                    return (
                      <div className="space-y-3">
                        {Array.from({ length: expectedCount }, (_, i) => (
                          <input
                            key={i}
                            type="text"
                            value={answerArray[i] || ''}
                            onChange={(e) => handleEnumerationAnswer(currentQuestion.id, i, e.target.value)}
                            placeholder={`Item ${i + 1}`}
                            className="w-full p-4 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all duration-200 text-base"
                            autoComplete="off"
                          />
                        ))}
                        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                          Enter {expectedCount} items in order
                        </p>
                      </div>
                    );
                  }

                  default:
                    return null;
                }
              })()}
            </div>
        </div>

        {/* Navigation Footer - Sticky Bottom */}
        <div className="fixed bottom-0 left-0 right-0 max-w-[500px] mx-auto px-4 pb-6 pt-4 bg-gradient-to-t from-primary-50/90 dark:from-gray-900/90 to-transparent z-10">
          <div className="flex items-center justify-between gap-4">
            {/* Previous Button */}
            <button
              onClick={handlePrevious}
              disabled={isFirstQuestion}
              className="flex items-center justify-center gap-2 w-14 h-14 rounded-full border-2 transition-all duration-200
                ${!isFirstQuestion
                  ? 'border-primary-500 bg-primary-500 active:border-primary active:text-primary hover:text-primary hover:border-primary hover:bg-primary-600'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                }"
              aria-label="Previous question"
              aria-disabled={isFirstQuestion}
            >
              <ChevronsLeft className="w-5 h-5" aria-hidden="true" />
            </button>

            {/* Next / Submit Button */}
            <button
              onClick={handleNext}
              disabled={!hasAnswer && !isLastQuestion}
              className={`
                flex-1 py-4 px-6 font-semibold rounded-xl transition-all duration-200
                flex items-center justify-center gap-2 text-lg
                ${hasAnswer || isLastQuestion
                  ? 'bg-primary-500 text-white hover:bg-primary-600 border-2 border-primary-500'
                  : 'bg-primary-200 dark:bg-gray-700 text-gray-200 dark:text-gray-500 border-2 border-gray-200 dark:border-gray-600 cursor-not-allowed'
                }
              `}
            >
              <span>{isLastQuestion ? 'Submit Quiz' : 'Next'}</span>
              {!isLastQuestion && (
                <ChevronsRight className="w-5 h-5" aria-hidden="true" />
              )}
              {isLastQuestion && (
                <Loader2 className="w-5 h-5" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}