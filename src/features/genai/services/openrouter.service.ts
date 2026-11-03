/**
 * OpenRouter API Service
 *
 * Direct REST client (no SDK) with:
 *  - a single API key from VITE_OPENROUTER_API_KEY
 *  - per-attempt timeout plus a user-triggered cancel
 *  - a total generation budget so failures surface in <= ~90 seconds
 *
 * OpenRouter exposes an OpenAI-compatible chat completions API:
 *   POST https://openrouter.ai/api/v1/chat/completions
 *   Authorization: Bearer <api-key>
 */

import type { QuizRequest, QuizResponse } from '../schema';
import { validateQuizResponse } from '../schema/quiz-response';
import { buildCompletePrompt } from '../utils/prompt-builder';
import type { GenerationResult } from './gemini.service';

// ===== Configuration (read once from env) =====

const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';
const BASE_URL =
  (import.meta.env.VITE_OPENROUTER_BASE_URL as string | undefined)?.replace(/\/+$/, '') ||
  DEFAULT_BASE_URL;

const MODEL =
  (import.meta.env.VITE_OPENROUTER_MODEL as string | undefined) || 'openai/gpt-oss-120b';

const MAX_ATTEMPTS = 5;
const ATTEMPT_TIMEOUT_MS = 45_000;
const TOTAL_BUDGET_MS = 85_000;
const BACKOFF_MS = [0, 1_000, 3_000, 5_000];
const MAX_OUTPUT_TOKENS = Number(import.meta.env.VITE_OPENROUTER_MAX_OUTPUT_TOKENS) || 8192;

const API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;

// ===== Per-attempt fetch =====

type AttemptFailure = {
  kind: 'http' | 'timeout' | 'network' | 'blocked' | 'parse' | 'invalid' | 'cancelled';
  status?: number;
};

type AttemptOutcome =
  | { ok: true; text: string; finishReason: string }
  | ({ ok: false } & AttemptFailure);

async function generateAttempt(params: {
  systemPrompt: string;
  userPrompt: string;
  timeoutMs: number;
  signal: AbortSignal;
}): Promise<AttemptOutcome> {
  const { systemPrompt, userPrompt, timeoutMs, signal } = params;

  if (signal.aborted) return { ok: false, kind: 'cancelled' };

  const controller = new AbortController();
  const onExternalAbort = () => controller.abort(signal.reason);
  signal.addEventListener('abort', onExternalAbort, { once: true });

  const timer = setTimeout(() => {
    controller.abort(new DOMException(`Attempt timed out after ${Math.round(timeoutMs / 1000)}s`, 'TimeoutError'));
  }, timeoutMs);

  try {
    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'Quizza',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: MAX_OUTPUT_TOKENS,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      let detail = '';
      try {
        const body = await response.json();
        if (body && typeof body === 'object' && 'error' in body) {
          const message = (body as { error?: { message?: unknown } }).error?.message;
          if (typeof message === 'string') detail = message;
        }
      } catch {
        // Body was not JSON; nothing more to log.
      }
      console.error(`[OpenRouter] HTTP ${status}${detail ? `: ${detail}` : ''}`);
      return { ok: false, kind: 'http', status };
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      return { ok: false, kind: 'parse' };
    }

    const payload2 = payload as {
      choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
    };
    const choice = payload2.choices?.[0];
    const content = choice?.message?.content;

    if (!content || !content.trim()) {
      const finishReason = choice?.finish_reason ?? 'NO_CANDIDATE';
      console.warn(`[OpenRouter] No usable content (finish_reason: ${finishReason})`);
      return { ok: false, kind: 'blocked' };
    }

    const finishReason = typeof choice.finish_reason === 'string' ? choice.finish_reason : 'STOP';
    return { ok: true, text: content, finishReason };
  } catch (error) {
    if (signal.aborted) return { ok: false, kind: 'cancelled' };
    if (error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      return { ok: false, kind: 'timeout' };
    }
    return { ok: false, kind: 'network' };
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', onExternalAbort);
  }
}

// ===== Response parsing =====

function parseQuizResponse(text: string): { kind: 'ok'; data: QuizResponse } | { kind: 'parse' } | { kind: 'invalid' } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { kind: 'parse' };
  }
  return validateQuizResponse(parsed) ? { kind: 'ok', data: parsed } : { kind: 'invalid' };
}

// ===== Generation =====

export function cancelActiveGeneration(): void {
  activeGeneration?.abort();
}

let activeGeneration: AbortController | null = null;

const CANCELLED_MESSAGE = 'Generation cancelled.';

function sleep(ms: number, signal: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve(true);
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      resolve(true);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve(false);
    }, ms);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Generates a quiz using OpenRouter with per-attempt timeouts and an overall time
 * budget. Never throws: failures come back as `{ success: false, error }`.
 */
export async function generateQuiz(request: QuizRequest): Promise<GenerationResult> {
  if (!API_KEY) {
    console.error('[OpenRouter] No API key configured (VITE_OPENROUTER_API_KEY).');
    return {
      success: false,
      error: 'Quiz generation is not configured. (Setup issue — no OpenRouter API key found.)',
    };
  }

  const { systemPrompt, userPrompt } = buildCompletePrompt(request);

  const generation = new AbortController();
  activeGeneration = generation;

  const start = Date.now();
  let lastFailure: AttemptFailure | null = null;

  try {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      if (generation.signal.aborted) {
        return { success: false, error: CANCELLED_MESSAGE, cancelled: true };
      }

      const remaining = TOTAL_BUDGET_MS - (Date.now() - start);
      if (remaining < 5_000) {
        lastFailure ??= { kind: 'timeout' };
        break;
      }

      const backoff = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)];
      if (backoff > 0 && (await sleep(backoff, generation.signal))) {
        return { success: false, error: CANCELLED_MESSAGE, cancelled: true };
      }

      console.log(`[OpenRouter] Attempt ${attempt + 1}/${MAX_ATTEMPTS} — model ${MODEL}`);

      const outcome = await generateAttempt({
        systemPrompt,
        userPrompt,
        timeoutMs: Math.min(ATTEMPT_TIMEOUT_MS, remaining),
        signal: generation.signal,
      });

      if (outcome.ok) {
        const parsed = parseQuizResponse(outcome.text);
        if (parsed.kind === 'ok') {
          parsed.data.metadata.model = MODEL;
          console.log(`[OpenRouter] Success on attempt ${attempt + 1} with ${MODEL}`);
          return { success: true, data: parsed.data };
        }
        lastFailure = { kind: parsed.kind };
        console.warn(
          `[OpenRouter] Attempt ${attempt + 1}: response was not valid quiz JSON (${parsed.kind}, finishReason ${outcome.finishReason})`,
        );
        continue;
      }

      lastFailure = outcome;

      switch (outcome.kind) {
        case 'cancelled':
          return { success: false, error: CANCELLED_MESSAGE, cancelled: true };

        case 'http': {
          const status = outcome.status ?? 0;
          if (status === 429 || status >= 500) {
            break;
          }
          attempt = MAX_ATTEMPTS;
          break;
        }

        case 'blocked':
          attempt = MAX_ATTEMPTS;
          break;

        case 'timeout':
        case 'network':
        case 'parse':
        case 'invalid':
          break;
      }
    }
  } finally {
    if (activeGeneration === generation) activeGeneration = null;
  }

  console.error('[OpenRouter] Generation failed.', lastFailure);
  return { success: false, error: describeFailure(lastFailure) };
}

function describeFailure(failure: AttemptFailure | null): string {
  if (!failure) {
    return 'Failed to generate quiz. Please try again.';
  }

  switch (failure.kind) {
    case 'http': {
      const status = failure.status ?? 0;
      if (status === 429) {
        return 'OpenRouter API is rate-limited. Tap Retry — it usually works within a minute.';
      }
      if (status >= 500) {
        return 'The OpenRouter service is under high demand right now. Tap Retry.';
      }
      if (status === 401 || status === 403) {
        return 'Quiz generation is not configured. (Setup issue — OpenRouter API key was rejected.)';
      }
      if (status === 404) {
        return 'The configured OpenRouter model is unavailable. (Setup issue — check VITE_OPENROUTER_MODEL.)';
      }
      return 'The AI rejected this request. Please retry; if it keeps failing, it is a setup issue.';
    }
    case 'timeout':
      return 'Generation hit the ~90-second limit. Retry, or try fewer questions.';
    case 'network':
      return 'Connection problem. Check your internet, then retry.';
    case 'parse':
    case 'invalid':
      return 'The AI returned a malformed quiz. Tap Retry.';
    case 'blocked':
      return 'The AI refused this topic due to content filtering. Try rephrasing your topic.';
    case 'cancelled':
      return CANCELLED_MESSAGE;
  }
}
