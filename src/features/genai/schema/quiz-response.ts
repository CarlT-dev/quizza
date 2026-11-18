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
  /** Index of the correct answer in options array (for multiple choice/true_false) */
  correctAnswerIndex?: number;
  /** Correct answer string (for identification) */
  correctAnswer?: string;
  /** Acceptable alternative answers (for identification) - case-insensitive matching */
  acceptableAnswers?: string[];
  /** Correct answers array in order (for enumeration) */
  correctAnswers?: string[];
  /** Minimum correct items for partial credit (for enumeration) */
  minCorrect?: number;
  /** Whether enumeration answers must be in order (true) or can be any order (false). Optional — only set true when order matters. Defaults to false (unordered) when absent. */
  enumerationOrdered?: boolean;
  /** Explanation for the correct answer */
  explanation: string;
  /** Question difficulty */
  difficulty: 'easy' | 'medium' | 'hard';
  /** Question type */
  type: 'multiple_choice' | 'true_false' | 'identification' | 'enumeration';
}

export interface QuizMetadata {
  /** Topic the quiz was generated from */
  topic: string;
  /** AI-generated title for the quiz */
  title?: string;
  /** Total number of questions */
  totalQuestions: number;
  /** Question types used (can be multiple) - NEW */
  questionTypes?: ('multiple_choice' | 'true_false' | 'identification' | 'enumeration')[];
  /** Difficulty levels used (can be multiple) - NEW */
  difficulties?: ('easy' | 'medium' | 'hard')[];
  /** @deprecated Use questionTypes instead - OLD single value for backward compat */
  questionType?: 'multiple_choice' | 'true_false' | 'identification' | 'enumeration';
  /** @deprecated Use difficulties instead - OLD single value for backward compat */
  difficulty?: 'easy' | 'medium' | 'hard';
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
  if (metadata.title !== undefined && (typeof metadata.title !== 'string' || metadata.title.trim().length === 0)) return false;
  if (typeof metadata.totalQuestions !== 'number') return false;
  // Accept new array format OR old single-value format
  const hasQuestionTypes = Array.isArray(metadata.questionTypes) && metadata.questionTypes.length > 0;
  const hasDifficulties = Array.isArray(metadata.difficulties) && metadata.difficulties.length > 0;
  const hasOldQuestionType = typeof metadata.questionType === 'string';
  const hasOldDifficulty = typeof metadata.difficulty === 'string';
  if (!hasQuestionTypes && !hasOldQuestionType) return false;
  if (!hasDifficulties && !hasOldDifficulty) return false;
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
  if (typeof q.explanation !== 'string') return false;
  if (typeof q.difficulty !== 'string') return false;
  if (typeof q.type !== 'string') return false;

  // Validate options array (can be empty for identification/enumeration)
  for (const opt of q.options) {
    if (typeof opt !== 'string') return false;
  }

  // Validate difficulty
  if (!['easy', 'medium', 'hard'].includes(q.difficulty)) return false;

  // Validate type
  if (!['multiple_choice', 'true_false', 'identification', 'enumeration'].includes(q.type)) return false;

  // Type-specific validation
  const type = q.type as QuizQuestion['type'];

  if (type === 'multiple_choice' || type === 'true_false') {
    if (typeof q.correctAnswerIndex !== 'number') return false;
    if (q.correctAnswerIndex < 0 || q.correctAnswerIndex >= q.options.length) return false;
    if (q.options.length < 2) return false;
  }

  if (type === 'identification') {
    if (typeof q.correctAnswer !== 'string' || q.correctAnswer.trim().length === 0) return false;
    if (q.acceptableAnswers !== undefined) {
      if (!Array.isArray(q.acceptableAnswers)) return false;
      for (const ans of q.acceptableAnswers) {
        if (typeof ans !== 'string') return false;
      }
    }
    // Options can be empty or contain hints
  }

  if (type === 'enumeration') {
    if (!Array.isArray(q.correctAnswers) || q.correctAnswers.length === 0) return false;
    for (const ans of q.correctAnswers) {
      if (typeof ans !== 'string' || ans.trim().length === 0) return false;
    }
    if (q.minCorrect !== undefined && (typeof q.minCorrect !== 'number' || q.minCorrect < 1)) return false;
    if (q.enumerationOrdered !== undefined && typeof q.enumerationOrdered !== 'boolean') return false;
    // Options can be empty or contain hints
  }

  return true;
}

/**
 * Generates singular/plural variants of an answer for flexible matching.
 * Returns the normalized (trimmed, lowercased) form plus:
 * - If it ends with 's' (length > 1), also the form with trailing 's' removed (singular variant)
 * - If it doesn't end with 's', also the form with 's' appended (plural variant)
 */
export function answerVariants(text: string): string[] {
  if (!text || text.trim().length === 0) return [''];
  const normalized = text.trim().toLowerCase();
  const variants = new Set([normalized]);
  if (normalized.endsWith('s') && normalized.length > 1) {
    variants.add(normalized.slice(0, -1));
  } else {
    variants.add(normalized + 's');
  }
  return Array.from(variants);
}

/**
 * Case-insensitive answer comparison for identification questions.
 * Accepts singular/plural forms (e.g. "apple" matches "apples").
 */
export function checkIdentificationAnswer(userAnswer: string, correctAnswer: string, acceptableAnswers?: string[]): boolean {
  const userVariants = answerVariants(userAnswer);
  const correctVariants = answerVariants(correctAnswer);

  if (userVariants.some(v => correctVariants.includes(v))) return true;

  if (acceptableAnswers) {
    return acceptableAnswers.some(ans =>
      userVariants.some(v => answerVariants(ans).includes(v))
    );
  }

  return false;
}

/**
 * Case-insensitive answer comparison for enumeration questions.
 * Returns { correct: number, total: number, passed: boolean }
 * When ordered is true, answers must match by position. When false (default),
 * order does not matter — each correct answer is counted if it appears anywhere
 * in the user's answers.
 * Accepts singular/plural forms (e.g. "apple" matches "apples").
 */
export function checkEnumerationAnswer(
  userAnswers: string[],
  correctAnswers: string[],
  minCorrect?: number,
  ordered: boolean = false
): { correct: number; total: number; passed: boolean } {
  const normalizedUser = userAnswers.map(a => (a ? a.trim().toLowerCase() : ''));
  const normalizedCorrect = correctAnswers.map(a => a.trim().toLowerCase());

  let correct = 0;
  if (ordered) {
    // Positional comparison — answers must match by index
    for (let i = 0; i < normalizedCorrect.length; i++) {
      if (!normalizedUser[i]) continue; // user didn't answer this position
      const userVariants = answerVariants(normalizedUser[i]);
      const correctVariants = answerVariants(normalizedCorrect[i]);
      if (userVariants.some(v => correctVariants.includes(v))) {
        correct++;
      }
    }
  } else {
    // Set-based matching — order does not matter
    const userVariantSet = new Set(
      normalizedUser
        .filter(a => a.length > 0)
        .flatMap(a => answerVariants(a))
    );
    for (const ans of normalizedCorrect) {
      const correctVariants = answerVariants(ans);
      if (correctVariants.some(v => userVariantSet.has(v))) {
        correct++;
      }
    }
  }

  const threshold = minCorrect ?? normalizedCorrect.length;
  return {
    correct,
    total: normalizedCorrect.length,
    passed: correct >= threshold,
  };
}