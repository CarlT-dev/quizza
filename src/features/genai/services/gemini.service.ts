/**
 * Gemini API Service
 *
 * Direct REST client (no SDK) with:
 *  - a key pool that rotates on ANY retryable failure (least-errors pick,
 *    20s cooldown on 429, kill on 401/403),
 *  - a model fallback chain driven by VITE_GEMINI_MODEL_CHAIN (advance on 404),
 *  - a real abort per attempt (timeout) plus a user-triggered cancel,
 *  - a total generation budget so failures surface in <= ~90 seconds
 *    instead of minutes of silent retries.
 *
 * Failures are classified by HTTP status code / error kind — never by
 * substring-matching error messages (the old approach mislabeled 503s as
 * "network errors" because the SDK's message contained the word "fetch").
 */

import type { QuizRequest, QuizResponse } from '../schema';
import { validateQuizResponse } from '../schema/quiz-response';
import { buildCompletePrompt } from '../utils/prompt-builder';

// ===== Configuration (read once from env) =====

const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
// Optional override for local failure testing (see Verification in the plan).
const BASE_URL =
  (import.meta.env.VITE_GEMINI_BASE_URL as string | undefined)?.replace(/\/+$/, '') ||
  DEFAULT_BASE_URL;

// Comma-separated fallback chain. Precedence: chain env > single model env > built-in default.
const MODEL_CHAIN: string[] = (
  (import.meta.env.VITE_GEMINI_MODEL_CHAIN as string | undefined) ||
  (import.meta.env.VITE_GEMINI_MODEL as string | undefined) ||
  'gemini-3.8-flash,gemini-flash-latest,gemini-3.5-flash'
)
  .split(',')
  .map((model) => model.trim())
  .filter(Boolean);

const MAX_ATTEMPTS = 5;
const ATTEMPT_TIMEOUT_MS = 45_000;
const TOTAL_BUDGET_MS = 85_000;
// Backoff before attempts 2..5 (attempt 1 starts immediately). Kept small so
// the total budget stays under ~90 seconds even in the worst case.
const BACKOFF_MS = [0, 1_000, 3_000, 5_000];
const KEY_COOLDOWN_MS = 20_000;
const MAX_OUTPUT_TOKENS = Number(import.meta.env.VITE_GEMINI_MAX_OUTPUT_TOKENS) || 8192;

// ===== Key pool =====

interface KeyEntry {
  key: string;
  errorCount: number;
  lastUsedAt: number;
  cooldownUntil: number;
  dead: boolean;
}

class KeyPool {
  private entries: KeyEntry[];

  constructor() {
    const envKeys = [
      import.meta.env.VITE_GEMINI_API_KEY_1,
      import.meta.env.VITE_GEMINI_API_KEY_2,
      import.meta.env.VITE_GEMINI_API_KEY_3,
      // Fallback to single key for backward compatibility
      import.meta.env.VITE_GEMINI_API_KEY,
    ].filter((key): key is string => Boolean(key));

    this.entries = envKeys.map((key) => ({
      key,
      errorCount: 0,
      lastUsedAt: 0,
      cooldownUntil: 0,
      dead: false,
    }));
  }

  get configured(): boolean {
    return this.entries.length > 0;
  }

  /** True if at least one key is not permanently killed. */
  get hasUsableKeys(): boolean {
    return this.entries.some((entry) => !entry.dead);
  }

  /**
   * Least-recently-failed, least-recently-used alive key. Spreads load across
   * the pool (the old code only ever used key 1 unless it hit a 429).
   */
  pick(): KeyEntry | null {
    const now = Date.now();
    const alive = this.entries.filter(
      (entry) => !entry.dead && entry.cooldownUntil <= now,
    );
    if (alive.length === 0) return null;
    alive.sort(
      (a, b) => a.errorCount - b.errorCount || a.lastUsedAt - b.lastUsedAt,
    );
    return alive[0];
  }

  recordError(entry: KeyEntry): void {
    entry.errorCount++;
    entry.lastUsedAt = Date.now();
  }

  recordSuccess(entry: KeyEntry): void {
    entry.errorCount = 0;
    entry.lastUsedAt = Date.now();
  }

  /** Temporary penalty after a 429 so the pool rotates away from this key. */
  cool(entry: KeyEntry): void {
    entry.cooldownUntil = Date.now() + KEY_COOLDOWN_MS;
  }

  /** Permanent kill for 401/403 (invalid key) so the pool stops using it. */
  kill(entry: KeyEntry): void {
    entry.dead = true;
  }

  status(): string {
    const now = Date.now();
    return this.entries
      .map((entry, i) => {
        if (entry.dead) return `Key ${i + 1}: dead`;
        if (entry.cooldownUntil > now) {
          return `Key ${i + 1}: cooling ${Math.ceil((entry.cooldownUntil - now) / 1000)}s`;
        }
        return `Key ${i + 1}: ${entry.errorCount} error(s)`;
      })
      .join(' | ');
  }
}

let pool: KeyPool | null = null;
function getPool(): KeyPool {
  if (!pool) pool = new KeyPool();
  return pool;
}

// ===== Per-attempt fetch =====

type AttemptFailure = {
  kind: 'http' | 'timeout' | 'network' | 'blocked' | 'parse' | 'invalid' | 'cancelled';
  status?: number;
};

type AttemptOutcome =
  | { ok: true; text: string; finishReason: string }
  | ({ ok: false } & AttemptFailure);

/**
 * One generateContent call with a real abort: `timeoutMs` from a timer, or an
 * abort of the caller's `signal` (user cancel) — whichever fires first —
 * cancels the in-flight request.
 */
async function generateAttempt(params: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  temperature: number;
  timeoutMs: number;
  signal: AbortSignal;
}): Promise<AttemptOutcome> {
  const { apiKey, model, systemPrompt, userPrompt, temperature, timeoutMs, signal } = params;

  if (signal.aborted) return { ok: false, kind: 'cancelled' };

  const controller = new AbortController();
  const onExternalAbort = () => controller.abort(signal.reason);
  signal.addEventListener('abort', onExternalAbort, { once: true });

  const timer = setTimeout(() => {
    controller.abort(new DOMException(`Attempt timed out after ${Math.round(timeoutMs / 1000)}s`, 'TimeoutError'));
  }, timeoutMs);

  try {
    const response = await fetch(
      `${BASE_URL}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          generationConfig: {
            temperature,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: MAX_OUTPUT_TOKENS,
            responseMimeType: 'application/json',
          },
        }),
      },
    );

    if (!response.ok) {
      const status = response.status;
      // Log the body for debugging only — never shown to users.
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
      console.error(`[Gemini] HTTP ${status} on ${model}${detail ? `: ${detail}` : ''}`);
      return { ok: false, kind: 'http', status };
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      return { ok: false, kind: 'parse' };
    }

    const payload2 = payload as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
      promptFeedback?: { blockReason?: string };
    };
    const candidate = payload2.candidates?.[0];
    const parts = candidate?.content?.parts;

    // No candidate / no parts → blocked by safety filtering or empty output.
    if (!candidate || !Array.isArray(parts)) {
      const blockReason = payload2.promptFeedback?.blockReason ?? candidate?.finishReason ?? 'NO_CANDIDATE';
      console.warn(`[Gemini] No usable candidate (finishReason/blockReason: ${blockReason})`);
      return { ok: false, kind: 'blocked' };
    }

    const text = parts.map((part) => part.text ?? '').join('');
    if (!text.trim()) {
      return { ok: false, kind: 'blocked' };
    }

    const finishReason = typeof candidate.finishReason === 'string' ? candidate.finishReason : 'STOP';
    return { ok: true, text, finishReason };
  } catch (error) {
    // User cancel: surface as cancelled, never as a network problem.
    if (signal.aborted) return { ok: false, kind: 'cancelled' };
    // Timeout abort rejects with our TimeoutError (or a plain AbortError on
    // browsers that discard the abort reason).
    if (error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      return { ok: false, kind: 'timeout' };
    }
    // TypeError from fetch: DNS failure, offline, CORS, connection reset.
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

export interface GenerationResult {
  success: boolean;
  data?: QuizResponse;
  error?: string;
  /** True when the generation was cancelled by the user (not an error for the UI). */
  cancelled?: boolean;
}

/** Aborts the in-flight generation, if any (used by the generation hook's cancel()). */
export function cancelActiveGeneration(): void {
  activeGeneration?.abort();
}

let activeGeneration: AbortController | null = null;

const CANCELLED_MESSAGE = 'Generation cancelled.';

/** Resolves after `ms`. Returns true if the signal aborted while waiting. */
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
 * Generates a quiz using Gemini with key rotation, model fallback, per-attempt
 * timeouts, and an overall time budget. Never throws: failures come back as
 * `{ success: false, error }`.
 */
export async function generateQuiz(request: QuizRequest): Promise<GenerationResult> {
  const keyPool = getPool();
  if (!keyPool.configured) {
    console.error('[Gemini] No API keys configured (VITE_GEMINI_API_KEY_1..3 / VITE_GEMINI_API_KEY).');
    return {
      success: false,
      error: 'Quiz generation is not configured. (Setup issue — no Gemini API keys found.)',
    };
  }

  const { systemPrompt, userPrompt } = buildCompletePrompt(request);

  const generation = new AbortController();
  activeGeneration = generation;

  const start = Date.now();
  let modelIndex = 0;
  let lastFailure: AttemptFailure | null = null;

  try {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      if (generation.signal.aborted) {
        return { success: false, error: CANCELLED_MESSAGE, cancelled: true };
      }

      // Stop once the total budget is nearly spent — fail fast instead of
      // leaving the user on the loading screen for minutes.
      const remaining = TOTAL_BUDGET_MS - (Date.now() - start);
      if (remaining < 5_000) {
        lastFailure ??= { kind: 'timeout' };
        break;
      }

      const backoff = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)];
      if (backoff > 0 && (await sleep(backoff, generation.signal))) {
        return { success: false, error: CANCELLED_MESSAGE, cancelled: true };
      }

      const keyEntry = keyPool.pick();
      if (!keyEntry) {
        // Every key is cooling down or dead — nothing left to try this round.
        lastFailure ??= keyPool.hasUsableKeys
          ? { kind: 'http', status: 429 }
          : { kind: 'http', status: 401 };
        break;
      }

      const model = MODEL_CHAIN[Math.min(modelIndex, MODEL_CHAIN.length - 1)];
      // Slightly raise temperature per attempt so malformed-JSON retries vary.
      const temperature = 0.3 + 0.1 * attempt;

      console.log(`[Gemini] Attempt ${attempt + 1}/${MAX_ATTEMPTS} — model ${model}, ${keyPool.status()}`);

      const outcome = await generateAttempt({
        apiKey: keyEntry.key,
        model,
        systemPrompt,
        userPrompt,
        temperature,
        timeoutMs: Math.min(ATTEMPT_TIMEOUT_MS, remaining),
        signal: generation.signal,
      });

      if (outcome.ok) {
        const parsed = parseQuizResponse(outcome.text);
        if (parsed.kind === 'ok') {
          keyPool.recordSuccess(keyEntry);
          parsed.data.metadata.model = model; // record the model that actually answered
          console.log(`[Gemini] Success on attempt ${attempt + 1} with ${model}`);
          return { success: true, data: parsed.data };
        }
        keyPool.recordError(keyEntry);
        lastFailure = { kind: parsed.kind };
        console.warn(
          `[Gemini] Attempt ${attempt + 1}: response was not valid quiz JSON (${parsed.kind}, finishReason ${outcome.finishReason})`,
        );
        continue;
      }

      lastFailure = outcome;
      keyPool.recordError(keyEntry);

      switch (outcome.kind) {
        case 'cancelled':
          return { success: false, error: CANCELLED_MESSAGE, cancelled: true };

        case 'http': {
          const status = outcome.status ?? 0;
          if (status === 429) {
            keyPool.cool(keyEntry);
          } else if (status === 401 || status === 403) {
            keyPool.kill(keyEntry);
          } else if (status === 404) {
            // Model unavailable → advance the fallback chain; if the chain is
            // exhausted, stop retrying.
            modelIndex++;
            if (modelIndex >= MODEL_CHAIN.length) {
              console.error('[Gemini] All models in the chain returned 404.');
              attempt = MAX_ATTEMPTS;
              break;
            }
          } else if (status < 500 && status !== 0) {
            // Other client errors (400 etc.) are request/config problems —
            // retrying the same request cannot help.
            attempt = MAX_ATTEMPTS;
            break;
          }
          // 429 / 401 / 403 / 404-mid-chain / 5xx fall through to retry:
          // pick() rotates to another key (or the same one after cooldown).
          break;
        }

        case 'blocked':
          // Safety filtering — retrying the same prompt will not change it.
          attempt = MAX_ATTEMPTS;
          break;

        case 'timeout':
        case 'network':
        case 'parse':
        case 'invalid':
          // Retryable — loop continues (next key/model/backoff).
          break;
      }
    }
  } finally {
    if (activeGeneration === generation) activeGeneration = null;
  }

  console.error('[Gemini] Generation failed.', lastFailure, keyPool.status());
  return { success: false, error: describeFailure(lastFailure) };
}

/** Maps the final failure to a user-facing message (Step 1.5). */
function describeFailure(failure: AttemptFailure | null): string {
  if (!failure) {
    return 'Failed to generate quiz. Please try again.';
  }

  switch (failure.kind) {
    case 'http': {
      const status = failure.status ?? 0;
      if (status === 429) {
        return 'All API keys are rate-limited. Wait a minute, then retry.';
      }
      if (status === 401 || status === 403) {
        return 'Quiz generation is not configured. (Setup issue — an API key was rejected.)';
      }
      if (status === 404) {
        return 'The configured AI model is unavailable. (Setup issue — check VITE_GEMINI_MODEL_CHAIN.)';
      }
      if (status >= 500) {
        return 'The AI service is under high demand right now. Tap Retry — it usually works within a minute.';
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
