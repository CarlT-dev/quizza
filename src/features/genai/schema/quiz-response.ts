/**
 * Quiz Generation Response Schema
 * Defines the structured response from GenAI
 */

export interface QuizQuestion {
  /** Unique identifier for the question */
  id: string;
  /** The question text */
  question: string;
  /** Array of answer options (for multiple choice) */
  options: string[];
  /** Index of the correct answer in options array */
  correctAnswerIndex: number;
  /** Explanation for the correct answer */
  explanation: string;
  /** Question difficulty */
  difficulty: 'easy' | 'medium' | 'hard';
  /** Question type */
  type: 'multiple_choice' | 'true_false';
}

export interface QuizMetadata {
  /** Topic the quiz was generated from */
  topic: string;
  /** Total number of questions */
  totalQuestions: number;
  /** Question type used */
  questionType: 'multiple_choice' | 'true_false';
  /** Difficulty level */
  difficulty: 'easy' | 'medium' | 'hard';
  /** Generation timestamp */
  generatedAt: string;
  /** Model used for generation */
  model: string;
}

export interface QuizResponse {
  /** Generated quiz questions */
  questions: QuizQuestion[];
  /** Metadata about the generation */
  metadata: QuizMetadata;
}

/**
 * Validates that the response matches expected schema
 */
export function validateQuizResponse(data: unknown): data is QuizResponse {
  if (!data || typeof data !== 'object') return false;

  const response = data as Record<string, unknown>;

  if (!Array.isArray(response.questions)) return false;
  if (!response.metadata || typeof response.metadata !== 'object') return false;

  const metadata = response.metadata as Record<string, unknown>;
  if (typeof metadata.topic !== 'string') return false;
  if (typeof metadata.totalQuestions !== 'number') return false;
  if (typeof metadata.questionType !== 'string') return false;
  if (typeof metadata.difficulty !== 'string') return false;
  if (typeof metadata.generatedAt !== 'string') return false;
  if (typeof metadata.model !== 'string') return false;

  // Validate each question
  for (const question of response.questions) {
    if (!validateQuizQuestion(question)) return false;
  }

  return true;
}

function validateQuizQuestion(question: unknown): question is QuizQuestion {
  if (!question || typeof question !== 'object') return false;

  const q = question as Record<string, unknown>;

  if (typeof q.id !== 'string') return false;
  if (typeof q.question !== 'string') return false;
  if (!Array.isArray(q.options)) return false;
  if (typeof q.correctAnswerIndex !== 'number') return false;
  if (typeof q.explanation !== 'string') return false;
  if (typeof q.difficulty !== 'string') return false;
  if (typeof q.type !== 'string') return false;

  // Validate options array
  if (q.options.length < 2) return false;
  for (const opt of q.options) {
    if (typeof opt !== 'string') return false;
  }

  // Validate correctAnswerIndex is within bounds
  if (q.correctAnswerIndex < 0 || q.correctAnswerIndex >= q.options.length) return false;

  // Validate difficulty
  if (!['easy', 'medium', 'hard'].includes(q.difficulty)) return false;

  // Validate type
  if (!['multiple_choice', 'true_false'].includes(q.type)) return false;

  return true;
}