import { useNavigate } from 'react-router-dom';
import { Play, BookOpen, ChevronRight } from 'lucide-react';
import type { QuizDocument } from '@/features/quiz';

interface CreatedQuizzesProps {
  quizzes: QuizDocument[];
}

export function CreatedQuizzes({ quizzes }: CreatedQuizzesProps) {
  const navigate = useNavigate();

  if (quizzes.length === 0) {
    return (
      <div className="px-4 py-8 text-center mb-20">
        <BookOpen className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" aria-hidden="true" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">No quizzes created yet</h3>
        <p className="text-gray-500 dark:text-gray-400 mb-4">Start creating quizzes to see them here</p>
        <button
          type="button"
          onClick={() => navigate('/create-quiz')}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-500 rounded-lg hover:bg-primary-600 transition-colors"
        >
          <Play className="w-4 h-4" aria-hidden="true" />
          Create Your First Quiz
        </button>
      </div>
    );
  }

  return (
    <section aria-label="Most played quizzes">
      <div>
        {quizzes.map((quiz) => {
          const quizId = quiz.id ?? '';
          const questionCount = quiz.questions?.length ?? 0;

          return (
            <button
              key={quiz.id}
              type="button"
              onClick={() => navigate(`/quiz/${quizId}`)}
              className="group w-full flex items-center gap-4 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-700 hover:bg-primary-50/50 dark:hover:bg-primary-900/10 transition-all duration-200"
            >
              {/* Quiz icon / color indicator */}
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center text-white flex-shrink-0 group-hover:scale-105 transition-transform">
                <BookOpen className="w-6 h-6" aria-hidden="true" />
              </div>

              {/* Quiz info */}
              <div className="flex-1 min-w-0 text-left">
                <span className="flex items-center gap-1">
                    {quiz.title}
                  </span>
                <div className="mt-1 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                  <span className="flex items-center gap-1">
                    {questionCount} questions
                  </span>
                  
                </div>
              </div>

              {/* Arrow indicator */}
              <ChevronRight
                className="w-5 h-5 text-gray-300 dark:text-gray-600 group-hover:text-primary-500 dark:group-hover:text-primary-400 transition-colors translate-x-0 group-hover:translate-x-1"
                aria-hidden="true"
              />
            </button>
          );
        })}
      </div>
    </section>
  );
}