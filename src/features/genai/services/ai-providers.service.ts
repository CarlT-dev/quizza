/**
 * AI Providers Orchestrator
 *
 * Tries each configured AI provider in priority order and returns the first
 * successful generation. User cancellation short-circuits — no fallback is
 * attempted when the user cancels.
 *
 * Extensibility: to add a new provider, create one service file exporting
 * `generateQuiz(request)` and `cancelActiveGeneration()`, then add one entry
 * to the `PROVIDERS` list below (highest priority first).
 */

import type { QuizRequest, QuizQuestion } from '../schema';
import type { GenerationResult } from './gemini.service';

export type { GenerationResult } from './gemini.service';
import { generateQuiz as generateQuizGroq, cancelActiveGeneration as cancelGroq } from './groq.service';
import { generateQuiz as generateQuizOpenRouter, cancelActiveGeneration as cancelOpenRouter } from './openrouter.service';
import { generateQuiz as generateQuizGemini, cancelActiveGeneration as cancelGemini } from './gemini.service';
import {
  QUESTION_TYPE_PRIORITY,
  allocateQuestionCounts,
  countQuestionsByType,
  sortQuestionsByType,
} from '../utils/question-distribution';

export interface AiProvider {
  name: string;
  generateQuiz: (request: QuizRequest) => Promise<GenerationResult>;
  cancelActiveGeneration: () => void;
}

const PROVIDERS: AiProvider[] = [
  {
    name: 'groq',
    generateQuiz: generateQuizGroq,
    cancelActiveGeneration: cancelGroq,
  },
  {
    name: 'openrouter',
    generateQuiz: generateQuizOpenRouter,
    cancelActiveGeneration: cancelOpenRouter,
  },
  {
    name: 'gemini',
    generateQuiz: generateQuizGemini,
    cancelActiveGeneration: cancelGemini,
  },
];

/**
 * Tries providers in priority order. Returns the first success.
 * Skips fallback when the user cancelled the generation.
 */
export async function generateQuiz(request: QuizRequest): Promise<GenerationResult> {
  let lastError: string | undefined;

  for (const provider of PROVIDERS) {
    console.log(`[AI Providers] Trying provider: ${provider.name}`);

    const result = await provider.generateQuiz(request);

    if (result.success && result.data) {
      console.log(`[AI Providers] Success with provider: ${provider.name}`);

      // Enforce grouped presentation order (multiple_choice → true_false →
      // identification → enumeration) regardless of the order the model
      // emitted. Copy, never mutate: the result also lands in React state.
      const questions = sortQuestionsByType(result.data.questions);
      if (import.meta.env.DEV) {
        warnOnDistributionDrift(request, questions);
      }
      return { ...result, data: { ...result.data, questions } };
    }

    // User cancellation short-circuits — don't fall back to another provider.
    if (result.cancelled) {
      return result;
    }

    lastError = result.error;
    console.warn(`[AI Providers] Provider ${provider.name} failed: ${result.error}`);
  }

  return {
    success: false,
    error: lastError || 'All AI providers failed. Please try again.',
  };
}

/**
 * Aborts the in-flight generation across all providers.
 */
export function cancelActiveGeneration(): void {
  for (const provider of PROVIDERS) {
    provider.cancelActiveGeneration();
  }
}

/**
 * Dev-only diagnostic: warns when the validated LLM response deviates from the
 * rank-weighted allocation (the model ignored the distribution guide). Grouping
 * order is enforced in code; counts stay advisory — no retry, no trimming.
 */
function warnOnDistributionDrift(request: QuizRequest, questions: QuizQuestion[]): void {
  const expected = allocateQuestionCounts(request.itemCount, request.questionTypes);
  const actual = countQuestionsByType(questions);
  const expectedFor = (type: QuizQuestion['type']): number =>
    expected.find(allocation => allocation.type === type)?.count ?? 0;

  const drifted = QUESTION_TYPE_PRIORITY.filter(
    type => (actual[type] ?? 0) !== expectedFor(type),
  );
  const totalMismatch = questions.length !== request.itemCount;
  if (drifted.length === 0 && !totalMismatch) return;

  const got =
    QUESTION_TYPE_PRIORITY.filter(type => (actual[type] ?? 0) > 0)
      .map(type => `${type}=${actual[type] ?? 0}`)
      .join(', ') || 'none';
  console.warn(
    `[AI Providers] Distribution drift:` +
      ` expected ${expected.map(a => `${a.type}=${a.count}`).join(', ')}` +
      ` | got ${got}` +
      (totalMismatch ? ` | total ${questions.length} != ${request.itemCount}` : ''),
  );
}
