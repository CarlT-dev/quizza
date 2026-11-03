import { memo } from 'react';
import { ChevronRight } from 'lucide-react';
import type { QuizDocument, QuizProgress } from '@/features/quiz/api/quiz';
import { formatRelativeTime } from '@/shared/utils';

interface UnfinishedQuizCardProps {
  quiz: QuizDocument;
  /** The in-progress attempt backing this row. */
  progress: QuizProgress;
  onClick: (quizId: string) => void;
}

/**
 * Compact "continue where you left off" row for the Home page — deliberately
 * lighter than QuizCard (no swipe palette, no manage menu). Progress bar uses
 * QuizCard's exact default literal classes; QuizPage resumes the attempt at
 * the next unanswered question.
 */
export const UnfinishedQuizCard = memo(function UnfinishedQuizCard({
  quiz,
  progress,
  onClick,
}: UnfinishedQuizCardProps) {
  const quizId = quiz.id ?? '';
  const percent =
    progress.totalQuestions > 0
      ? Math.round((progress.answeredCount / progress.totalQuestions) * 100)
      : 0;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Resume quiz: ${quiz.title}`}
      onClick={() => onClick(quizId)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(quizId);
        }
      }}
      className="flex items-center gap-3 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm px-3 py-3 cursor-pointer transition-transform active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
    >
      {/* 44px gradient initial tile */}
      <span
        className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
        aria-hidden="true"
      >
        {quiz.title.charAt(0).toUpperCase()}
      </span>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-900 dark:text-gray-100 line-clamp-1">
          {quiz.title}
        </p>
        {/* QuizCard's exact default track/fill literals (Tailwind v4 needs
            literal class strings to generate the utilities) */}
        <div className="mt-1.5 flex items-center gap-2">
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            aria-label="Quiz progress"
            className="h-2 flex-1 rounded-full overflow-hidden bg-primary-100 dark:bg-primary-900/30"
          >
            <div
              className="h-full rounded-full bg-primary-500 progress-shimmer"
              style={{ width: `${percent}%` }}
            />
          </div>
          <span className="text-xs font-medium tabular-nums text-gray-500 dark:text-gray-400 flex-shrink-0">
            {percent}%
          </span>
        </div>
        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
          {progress.answeredCount}/{progress.totalQuestions} answered ·{' '}
          {formatRelativeTime(progress.lastAttemptAt)}
        </p>
      </div>

      <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" aria-hidden="true" />
    </div>
  );
});
