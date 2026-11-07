import type { QuizQuestion } from '@/features/genai/schema';
import { checkEnumerationAnswer, checkIdentificationAnswer } from '@/features/genai/schema/quiz-response';

// Answer value stored per question id (mirrors QuizPage's answer map values)
export type AnswerValue = number | string | string[];

// One graded question, forwarded by ScorePage's calculateScore() via location.state
export interface ScoreDetail {
  questionId: string;
  isCorrect: boolean;
  userAnswer: AnswerValue;
  correctAnswer: AnswerValue;
  explanation: string;
}

/**
 * Reconstructs the correct answer value for a question, mirroring ScorePage's
 * calculateScore() so that review items can be rebuilt when persisted details
 * are unavailable (e.g. attempts saved before details were included).
 */
export function getCorrectAnswer(question: QuizQuestion): AnswerValue {
  switch (question.type) {
    case 'multiple_choice':
    case 'true_false':
      return question.correctAnswerIndex ?? -1;
    case 'identification':
      return question.correctAnswer || '';
    case 'enumeration':
      return question.correctAnswers || [];
    default:
      return '';
  }
}

/**
 * Determines whether a user's answer is correct for a given question, mirroring
 * ScorePage's calculateScore() logic.
 */
export function computeIsCorrect(question: QuizQuestion, userAnswer: AnswerValue | undefined): boolean {
  if (userAnswer === undefined) return false;

  switch (question.type) {
    case 'multiple_choice':
    case 'true_false': {
      const correctIndex = question.correctAnswerIndex ?? -1;
      return typeof userAnswer === 'number' && userAnswer === correctIndex;
    }
    case 'identification': {
      if (typeof userAnswer !== 'string' || userAnswer.trim().length === 0) return false;
      return checkIdentificationAnswer(userAnswer, question.correctAnswer || '', question.acceptableAnswers);
    }
    case 'enumeration': {
      if (!Array.isArray(userAnswer) || userAnswer.some(a => typeof a !== 'string' || a.trim().length === 0)) return false;
      const result = checkEnumerationAnswer(userAnswer, question.correctAnswers || [], question.minCorrect, question.enumerationOrdered ?? false);
      return result.passed;
    }
    default:
      return false;
  }
}
