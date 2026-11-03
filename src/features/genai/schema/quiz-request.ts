/**
 * Quiz Generation Request Schema
 * Maps UI form values to the GenAI API request
 */

export type QuestionType = 'multiple_choice' | 'true_false' | 'identification' | 'enumeration';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type ItemCount = 10 | 15 | 20 | 30;
export type Visibility = 'public' | 'private';

export interface QuizRequest {
  /** The topic or source text for quiz generation */
  topic: string;
  /** Types of questions to generate (can select multiple) */
  questionTypes: QuestionType[];
  /** Difficulty levels of questions (can select multiple) */
  difficulties: Difficulty[];
  /** Number of questions to generate */
  itemCount: ItemCount;
  /** Visibility of the generated quiz */
  visibility: Visibility;
  /** Optional: Additional context or instructions */
  additionalContext?: string;
}

/**
 * Maps UI state values to QuizRequest
 */
export function createQuizRequest(params: {
  topic: string;
  questionTypes: Array<'single' | 'multiple' | 'identification' | 'enumeration'>;
  difficulties: Array<'easy' | 'medium' | 'hard'>;
  itemCount: number | null;
  isPublic: boolean;
  additionalContext?: string;
}): QuizRequest | null {
  if (!params.topic.trim()) {
    return null;
  }
  if (!params.itemCount) {
    return null;
  }
  if (!params.questionTypes.length) {
    return null;
  }
  if (!params.difficulties.length) {
    return null;
  }

  // Map UI question types to API question types
  const questionTypeMap: Record<'single' | 'multiple' | 'identification' | 'enumeration', QuestionType> = {
    single: 'multiple_choice',
    multiple: 'true_false',
    identification: 'identification',
    enumeration: 'enumeration',
  };

  return {
    topic: params.topic.trim(),
    questionTypes: params.questionTypes.map(qt => questionTypeMap[qt]),
    difficulties: params.difficulties,
    itemCount: params.itemCount as ItemCount,
    visibility: params.isPublic ? 'public' : 'private',
    additionalContext: params.additionalContext?.trim(),
  };
}