import { Check, X } from 'lucide-react';
import type { QuizQuestion } from '@/features/genai/schema';
import { checkEnumerationAnswer } from '@/features/genai/schema/quiz-response';
import type { ScoreDetail } from '../utils/answerReview';

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

/**
 * 'self' renders the taker's own review (ResultPage); 'owner' renders the
 * quiz owner's view of a participant's attempt. Only the person wording
 * changes — grading, layout and colors are identical.
 */
const LABELS = {
  self: {
    badge: 'Yours',
    answer: 'Your answer',
    missingItem: 'Not included in your answers',
    unanswered: 'You did not answer this question.',
  },
  owner: {
    badge: 'Theirs',
    answer: 'Their answer',
    missingItem: 'Not included in their answers',
    unanswered: 'No answer given.',
  },
} as const;

interface QuestionReviewCardProps {
  detail: ScoreDetail;
  question: QuizQuestion;
  index: number;
  perspective?: 'self' | 'owner';
}

/**
 * One graded question as a review card: header (number, type, verdict),
 * question text, the answer body for the question's type, and explanation.
 * Shared by ResultPage (self) and the owner's per-participant detail page.
 */
export function QuestionReviewCard({ detail, question, index, perspective = 'self' }: QuestionReviewCardProps) {
  const labels = LABELS[perspective];

  return (
    <div
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
                            {labels.badge}
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
                    {labels.unanswered}
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
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{labels.answer}</p>
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
            const result = keyList.length > 0 ? checkEnumerationAnswer(items, keyList, question.minCorrect, question.enumerationOrdered ?? false) : null;

            return (
              <div className="space-y-2">
                <ul className="space-y-2">
                  {keyList.map((correctItem, itemIndex) => {
                    const normalizedCorrect = correctItem.trim().toLowerCase();
                    const isOrdered = question.enumerationOrdered === true;

                    if (isOrdered) {
                      // Positional display — user's answer at this position vs correct answer at this position
                      const userItem = typeof items[itemIndex] === 'string' ? items[itemIndex] : '';
                      const isBlank = userItem.trim().length === 0;
                      const isMatch = !isBlank && userItem.trim().toLowerCase() === normalizedCorrect;

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
                          {!isMatch && !isBlank && (
                            <p className="mt-1 text-xs text-green-700 dark:text-green-300">
                              Correct: {correctItem}
                            </p>
                          )}
                        </li>
                      );
                    }

                    // Unordered display — set-based membership, position doesn't matter
                    const userSet = new Set(items.map(a => a.trim().toLowerCase()).filter(a => a.length > 0));
                    const isMatch = userSet.has(normalizedCorrect);

                    return (
                      <li key={itemIndex} className={`p-3 rounded-xl border ${isMatch ? GREEN_ROW : RED_ROW}`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                            Item {itemIndex + 1}
                          </span>
                          {isMatch ? (
                            <Check className={`w-4 h-4 shrink-0 ${GREEN_ICON}`} aria-hidden="true" />
                          ) : (
                            <X className={`w-4 h-4 shrink-0 ${RED_ICON}`} aria-hidden="true" />
                          )}
                        </div>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {correctItem}
                        </p>
                        {!isMatch && (
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            {labels.missingItem}
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
}
