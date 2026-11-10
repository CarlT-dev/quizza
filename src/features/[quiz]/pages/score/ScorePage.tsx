import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, Award, ArrowRight, Home, AlertTriangle, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/shared/components/ui';
import { getQuizById, saveQuizProgress, recordFirstCompletion, updateUserStatsFromAttempts } from '@/features/quiz';
import { useAuth } from '@/features/auth';
import type { QuizDocument } from '@/features/quiz/api/quiz';
import type { QuizQuestion } from '@/features/genai/schema';
import { checkIdentificationAnswer, checkEnumerationAnswer } from '@/features/genai/schema/quiz-response';

interface AnswerMap {
  [questionId: string]: number | string | string[];
}

function mapQuizDocToQuiz(quizDoc: QuizDocument) {
  return {
    id: quizDoc.id || '',
    title: quizDoc.title,
    topic: quizDoc.topic,
    questions: quizDoc.questions,
  };
}

function calculateScore(questions: QuizQuestion[], answers: AnswerMap): { correct: number; total: number; details: Array<{ questionId: string; isCorrect: boolean; userAnswer: number | string | string[]; correctAnswer: number | string | string[]; explanation: string }> } {
  let correct = 0;
  const details: Array<{ questionId: string; isCorrect: boolean; userAnswer: number | string | string[]; correctAnswer: number | string | string[]; explanation: string }> = [];

  for (const question of questions) {
    const userAnswer = answers[question.id];
    let isCorrect = false;
    let correctAnswer: number | string | string[] = [];

    switch (question.type) {
      case 'multiple_choice':
      case 'true_false': {
        correctAnswer = question.correctAnswerIndex ?? -1;
        if (typeof userAnswer === 'number' && userAnswer === correctAnswer) {
          isCorrect = true;
          correct++;
        }
        break;
      }
      case 'identification': {
        correctAnswer = question.correctAnswer || '';
        if (typeof userAnswer === 'string' && userAnswer.trim().length > 0) {
          isCorrect = checkIdentificationAnswer(userAnswer, question.correctAnswer || '', question.acceptableAnswers);
          if (isCorrect) correct++;
        }
        break;
      }
      case 'enumeration': {
        correctAnswer = question.correctAnswers || [];
        if (Array.isArray(userAnswer) && userAnswer.some(a => a.trim().length > 0)) {
          const result = checkEnumerationAnswer(userAnswer, question.correctAnswers || [], question.minCorrect, question.enumerationOrdered ?? false);
          isCorrect = result.passed;
          if (isCorrect) correct++;
        }
        break;
      }
    }

    details.push({
      questionId: question.id,
      isCorrect,
      userAnswer: userAnswer ?? '',
      correctAnswer,
      explanation: question.explanation,
    });
  }

  return { correct, total: questions.length, details };
}

export function ScorePage() {
  const { quiz: quizId } = useParams<{ quiz: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const state = location.state as { answers?: AnswerMap } | undefined;

  const [quizData, setQuizData] = useState<ReturnType<typeof mapQuizDocToQuiz> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scoreData, setScoreData] = useState<ReturnType<typeof calculateScore> | null>(null);

  useEffect(() => {
    if (!quizId) {
      setError('No quiz ID provided');
      setIsLoading(false);
      return;
    }

    if (!state?.answers) {
      setError('No answers found. Please take the quiz first.');
      setIsLoading(false);
      return;
    }

    const answers = state.answers;

    const fetchQuiz = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const doc = await getQuizById(quizId);

        if (doc) {
          const quiz = mapQuizDocToQuiz(doc);
          setQuizData(quiz);
          const score = calculateScore(quiz.questions, answers);
          setScoreData(score);

          // Persist the completed attempt so the quizzes list shows the full
          // strip, completed dot and score chip. Refresh visits never reach this
          // point (the !state?.answers guard above routes them to the error card),
          // and StrictMode's double-run is idempotent (merge with identical payload).
          if (user) {
            const firstScore = { correct: score.correct, total: score.total };
            const progressPayload = {
              answeredCount: quiz.questions.length,
              totalQuestions: quiz.questions.length,
              completed: true,
              score: firstScore,
              answers: state.answers,
              details: score.details,
            };

            // Capture the first-take score in a transaction BEFORE the completed
            // save merges completed:true — once that lands, retakes and legacy
            // docs would be indistinguishable. The progress save must survive a
            // stats-layer failure, hence the fallback in the catch.
            recordFirstCompletion(quizId, user.uid, firstScore)
              .then(isFirst => {
                saveQuizProgress(quizId, user.uid, progressPayload)
                  .catch(err => console.error('Failed to save progress:', err));
                if (isFirst) {
                  updateUserStatsFromAttempts(user.uid)
                    .catch(err => console.error('Failed to update user stats:', err));
                }
              })
              .catch(err => {
                console.error('Failed to record first completion:', err);
                saveQuizProgress(quizId, user.uid, progressPayload)
                  .catch(saveErr => console.error('Failed to save progress:', saveErr));
              });
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
  }, [quizId, state?.answers, user]);

  const handleViewResults = () => {
    navigate(`/quiz/${quizId}/result`, { state: { answers: state?.answers, score: scoreData } });
  };

  const handleBackHome = () => {
    navigate('/');
  };

  if (isLoading) {
    return (
      <div className="flex-1 bg-primary-50/10 dark:bg-gray-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 dark:text-gray-400">Calculating your score...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 bg-primary-50/10 dark:bg-gray-900 flex items-center justify-center px-4">
        <div className="w-full max-w-md dark:bg-gray-800 p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Unable to Load Results</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">{error}</p>
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

  if (!quizData || !scoreData) {
    return (
      <div className="flex-1 bg-primary-50/10 dark:bg-gray-900 flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl border border-red-200 dark:border-red-800 p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Score Not Available</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">Could not calculate score.</p>
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

  const percentage = Math.round((scoreData.correct / scoreData.total) * 100);
  const isPassing = percentage >= 60;

  return (
    <div className="flex-1 bg-primary-50/10 dark:bg-gray-900 flex flex-col">
      {/* Header */}
      <header className="fixed inset-x-0 top-0 z-10 max-w-[500px] mx-auto bg-gradient-to-r from-primary-500 to-primary-600 rounded-b-3xl px-4 pb-4">
        <button
          type="button"
          onClick={handleBackHome}
          className="absolute top-6 left-4 p-2 text-white hover:bg-white/20 rounded-lg"
          aria-label="Back to home"
        >
          <ChevronLeft className="w-7 h-7" aria-hidden="true" />
        </button>
        <div className="pt-4 ml-15">
          <h1 className="text-3xl font-bold text-white">Quizza</h1>
          <p className="mt-0 text-white/80 text-lg">Quiz Results</p>
        </div>
      </header>

      {/* Content */}
      <main className="pt-1 pb-20 px-4 mt-23 flex-1">
        <div className="w-full max-w-md mx-auto space-y-6">
          {/* Score Summary Card */}
          <Card className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className={`p-8 text-center ${isPassing ? 'bg-green-50 dark:bg-green-900/20 border-b border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800'}`}>
              <div className="relative inline-flex items-center justify-center w-28 h-28 rounded-full mb-4">
                <div className={`absolute inset-0 rounded-full border-8 border-current opacity-20 ${isPassing ? 'text-green-500' : 'text-red-500'}`} />
                <div className={`relative w-20 h-20 rounded-full flex items-center justify-center ${isPassing ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                  <Award className={`w-10 h-10 ${isPassing ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`} aria-hidden="true" />
                </div>
                <span className={`absolute bottom-0 right-0 w-7 h-7 rounded-full border-4 border-white dark:border-gray-900 flex items-center justify-center text-sm font-bold ${isPassing ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                  {percentage}%
                </span>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {isPassing ? 'Great Job!' : 'Keep Practicing!'}
              </h2>
              <p className="mt-1 text-gray-500 dark:text-gray-400">
                You scored <span className="font-semibold">{scoreData.correct}</span> out of <span className="font-semibold">{scoreData.total}</span>
              </p>
            </div>

            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">{scoreData.correct}</div>
                  <div className="text-xs text-green-700 dark:text-green-300">Correct</div>
                </div>
                <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">{scoreData.total - scoreData.correct}</div>
                  <div className="text-xs text-red-700 dark:text-red-300">Incorrect</div>
                </div>
                <div className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-xl border border-primary-200 dark:border-primary-800">
                  <div className="text-2xl font-bold text-primary-600 dark:text-primary-400">{percentage}%</div>
                  <div className="text-xs text-primary-700 dark:text-primary-300">Score</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Performance Message Card */}
          <Card className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700">
            <CardContent className="p-6 text-center">
              <Sparkles className={`w-8 h-8 mx-auto mb-3 ${isPassing ? 'text-yellow-500' : 'text-primary-500'}`} aria-hidden="true" />
              <p className="text-gray-700 dark:text-gray-300 text-base leading-relaxed">
                {isPassing
                  ? 'Excellent work! You\'ve demonstrated a solid understanding of this topic. Ready for the next challenge?'
                  : 'Good effort! Review the topics you missed and try again. Every attempt makes you better.'}
              </p>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={handleViewResults}
              className="w-full py-4 px-6 bg-primary-500 text-white font-semibold rounded-xl hover:bg-primary-600 transition-colors text-lg flex items-center justify-center gap-2"
            >
              <span>View Detailed Results</span>
              <ArrowRight className="w-5 h-5" aria-hidden="true" />
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