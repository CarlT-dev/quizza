import { memo } from 'react';
import { QuizCard } from './QuizCard';
import type { CardColorId, QuizDocument, QuizProgress } from '@/features/quiz/api/quiz';

interface QuizCardItemProps {
  quiz: QuizDocument;
  currentUserId: string | null | undefined;
  progress: QuizProgress | null;
  colorId: CardColorId;
  customTitle: string;
  ownerName?: string;
  isFavorite: boolean;
  onQuizClick: (quizId: string) => void;
  onColorChange: (quizId: string, colorId: CardColorId) => void;
  onTitleChange: (quizId: string, title: string) => void;
  onToggleVisibility: (quizId: string) => void;
  onDelete: (quizId: string) => void;
  onToggleFavorite: (quizId: string) => void;
  onUnsave?: (quizId: string) => void;
}

/**
 * Memoized per-card wrapper: turns stable quizId-taking handlers into the
 * per-card closures QuizCard expects. With stable handler identities and
 * primitive-ish props, toggling one star re-renders exactly one card.
 */
export const QuizCardItem = memo(function QuizCardItem({
  quiz,
  currentUserId,
  progress,
  colorId,
  customTitle,
  ownerName,
  isFavorite,
  onQuizClick,
  onColorChange,
  onTitleChange,
  onToggleVisibility,
  onDelete,
  onToggleFavorite,
  onUnsave,
}: QuizCardItemProps) {
  const quizId = quiz.id ?? '';

  return (
    <QuizCard
      quiz={quiz}
      currentUserId={currentUserId}
      progress={progress}
      colorId={colorId}
      customTitle={customTitle}
      ownerName={ownerName}
      isFavorite={isFavorite}
      onClick={() => onQuizClick(quizId)}
      onColorChange={(newColorId) => onColorChange(quizId, newColorId)}
      onTitleChange={(newTitle) => onTitleChange(quizId, newTitle)}
      onToggleVisibility={() => onToggleVisibility(quizId)}
      onDelete={() => onDelete(quizId)}
      onToggleFavorite={() => onToggleFavorite(quizId)}
      onUnsave={onUnsave ? () => onUnsave(quizId) : undefined}
    />
  );
});
