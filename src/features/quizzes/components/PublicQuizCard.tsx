import { memo } from 'react';
import { Bookmark, BookmarkCheck, Check, User } from 'lucide-react';
import type { QuizDocument, QuizProgress } from '@/features/quiz/api/quiz';

interface PublicQuizCardProps {
  quiz: QuizDocument;
  /** Resolved creator username; falls back to a uid slice. */
  ownerName?: string;
  /** Viewer's progress — a completed attempt renders a score chip. */
  progress?: QuizProgress | null;
  /** Save-bookmark state (top-right). Rendered only when showSave is set. */
  isSaved?: boolean;
  showSave?: boolean;
  onToggleSave?: (quizId: string) => void;
  onClick: (quizId: string) => void;
}

/**
 * Lightweight browse-card for public quizzes (Home feed, Search, Profile).
 * Deliberately NOT QuizCard: no swipe color palette (writes per-user color
 * prefs) and no owner manage menu — wrong weight for a feed. Tap opens the
 * quiz; the optional bookmark saves it to the viewer's Quizzes page.
 */
export const PublicQuizCard = memo(function PublicQuizCard({
  quiz,
  ownerName,
  progress,
  isSaved = false,
  showSave = false,
  onToggleSave,
  onClick,
}: PublicQuizCardProps) {
  const quizId = quiz.id ?? '';

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Open quiz: ${quiz.title}`}
      onClick={() => onClick(quizId)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(quizId);
        }
      }}
      className="rounded-2xl overflow-hidden bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm cursor-pointer transition-transform active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
    >
      {/* Gradient header (HomePage CTA idiom) */}
      <div className="relative bg-gradient-to-r from-primary-400 to-primary-600 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-white truncate">{quiz.title}</h3>
            <p className="text-xs text-white/80 mt-0.5">
              {quiz.metadata.totalQuestions} Questions
            </p>
          </div>
          {showSave && onToggleSave && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleSave(quizId);
              }}
              className="p-1.5 rounded-lg text-white hover:bg-white/20 transition-colors flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              aria-pressed={isSaved}
              aria-label={isSaved ? 'Remove from saved quizzes' : 'Save quiz'}
            >
              {isSaved ? (
                <BookmarkCheck className="w-5 h-5" aria-hidden="true" />
              ) : (
                <Bookmark className="w-5 h-5" aria-hidden="true" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Footer: creator + viewer's completed score (QuizCard chip idiom) */}
      <div className="flex items-center justify-between gap-3 px-4 py-2.5">
        <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 min-w-0">
          <User className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
          <span className="truncate">{ownerName ?? `${quiz.createdBy.slice(0, 8)}...`}</span>
        </span>
        {progress?.completed && progress.score && (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full border bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800 flex-shrink-0">
            <Check className="w-3 h-3" aria-hidden="true" />
            {progress.score.correct}/{progress.score.total}
          </span>
        )}
      </div>
    </div>
  );
});
