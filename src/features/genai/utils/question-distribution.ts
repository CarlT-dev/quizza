import type { QuestionType, QuizQuestion } from '../schema';

/**
 * Question distribution and ordering by type priority.
 *
 * Presentation priority: all Multiple Choice questions come first, then all
 * True/False, then Identification, then Enumeration. The same order is used
 * to weight the item counts ("paunti nang paunti": earlier types get more).
 */

/** Presentation priority for question types (highest first). */
export const QUESTION_TYPE_PRIORITY: readonly QuestionType[] = [
  'multiple_choice',
  'true_false',
  'identification',
  'enumeration',
];

/** One selected question type and its exact allocated question count. */
export interface TypeAllocation {
  type: QuestionType;
  count: number;
}

/**
 * Rank-weighted allocation of `itemCount` questions across `selectedTypes`.
 *
 * The k selected types (ranked by QUESTION_TYPE_PRIORITY, deduped) get
 * weights [k, k-1, ..., 1]. Counts are rounded with the largest-remainder
 * method so they are exact and always sum to itemCount; remainder seats go
 * to the largest fractional remainder, and ties go to the higher-priority
 * type. All arithmetic is integer-based, so the tie comparison is exact.
 */
export function allocateQuestionCounts(
  itemCount: number,
  selectedTypes: readonly QuestionType[],
): TypeAllocation[] {
  const ranked = QUESTION_TYPE_PRIORITY.filter(type => selectedTypes.includes(type));
  const k = ranked.length;
  if (k === 0 || itemCount <= 0) {
    return ranked.map(type => ({ type, count: 0 }));
  }

  const weightSum = (k * (k + 1)) / 2;
  const allocations = ranked.map((type, i) => {
    const weight = k - i;
    return {
      type,
      count: Math.floor((itemCount * weight) / weightSum),
      rem: (itemCount * weight) % weightSum,
    };
  });

  const deficit = itemCount - allocations.reduce((sum, a) => sum + a.count, 0);

  // Largest remainder first; exact ties (equal rem) go to the higher-priority
  // type. deficit < k always (it is the sum of k fractional parts that is an
  // integer), so every seat is assignable; Math.min is defensive only.
  const priorityIndex = new Map(ranked.map((type, i) => [type, i] as const));
  const seatOrder = [...allocations].sort(
    (a, b) =>
      b.rem - a.rem ||
      (priorityIndex.get(a.type) ?? 0) - (priorityIndex.get(b.type) ?? 0),
  );
  for (let i = 0; i < Math.min(deficit, seatOrder.length); i++) {
    seatOrder[i].count += 1;
  }

  return allocations.map(({ type, count }) => ({ type, count }));
}

/**
 * Returns a NEW array of questions stable-sorted by type priority
 * (multiple_choice → true_false → identification → enumeration).
 *
 * Within a type group the original relative order is preserved (decorate
 * with the original index, sort by rank then index, undecorate). Unknown
 * types — normally rejected by validation — sort last. The input array is
 * never mutated.
 */
export function sortQuestionsByType(questions: readonly QuizQuestion[]): QuizQuestion[] {
  const rankOf = (type: QuizQuestion['type']): number => {
    const index = QUESTION_TYPE_PRIORITY.indexOf(type);
    return index === -1 ? QUESTION_TYPE_PRIORITY.length : index;
  };
  return questions
    .map((question, index) => ({ question, index, rank: rankOf(question.type) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(entry => entry.question);
}

/**
 * Actual per-type question counts of a question list.
 * Used for dev diagnostics when comparing against allocateQuestionCounts.
 */
export function countQuestionsByType(
  questions: readonly QuizQuestion[],
): Partial<Record<QuestionType, number>> {
  const counts: Partial<Record<QuestionType, number>> = {};
  for (const question of questions) {
    counts[question.type] = (counts[question.type] ?? 0) + 1;
  }
  return counts;
}
