/**
 * Quiz Generation Request Schema
 * Maps UI form values to the GenAI API request
 */

export type QuestionType = 'multiple_choice' | 'true_false';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type ItemCount = 10 | 15 | 20 | 30;
export type Visibility = 'public' | 'private';

export interface QuizRequest {
  /** The topic or source text for quiz generation */
  topic: string;
  /** Type of questions to generate */
  questionType: QuestionType;
  /** Difficulty level of questions */
  difficulty: Difficulty;
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
  questionType: 'single' | 'multiple'; // UI uses 'single' for multiple choice, 'multiple' for true/false
  difficulty: 'easy' | 'medium' | 'hard';
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

  // Map UI question type to API question type
  const questionTypeMap: Record<'single' | 'multiple', QuestionType> = {
    single: 'multiple_choice',
    multiple: 'true_false',
  };

  return {
    topic: params.topic.trim(),
    questionType: questionTypeMap[params.questionType],
    difficulty: params.difficulty,
    itemCount: params.itemCount as ItemCount,
    visibility: params.isPublic ? 'public' : 'private',
    additionalContext: params.additionalContext?.trim(),
  };
}