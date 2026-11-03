/**
 * Pure statistics for the Status page.
 *
 * All computations count ONLY the first time a quiz was taken. A retake
 * overwrites the single quizAttempts document, so the first attempt's score
 * is captured exactly once as `firstScore` at first completion; legacy
 * attempt docs (completed before firstScore existed) fall back to their
 * existing `score`. Attempts that were never completed contribute nothing.
 *
 * Shapes are structural (not the QuizDocument types) so this module stays a
 * shared utility with no dependency on feature-layer types.
 */

/** A first-attempt score, as stored on quizAttempts (`firstScore` / legacy `score`). */
export interface AttemptScore {
  correct: number;
  total: number;
}

/** The parts of a quizAttempts document that feed the stats. */
export interface FirstAttemptSource {
  completed?: boolean;
  /** Set once on the first completion; retakes never overwrite it. */
  firstScore?: AttemptScore;
  /** Fallback for legacy attempt docs completed before firstScore existed. */
  score?: AttemptScore;
}

/** Denormalized copy stored on users/{uid}.stats (publicly readable). */
export interface UserStats {
  /** 100 + (avg first-attempt accuracy% − 60), rounded. */
  iq: number;
  /** Average first-attempt accuracy across first takes, 0–100, rounded. */
  avgAccuracy: number;
  /** Number of quizzes whose first attempt is counted. */
  quizzesTaken: number;
  /** Best first-attempt accuracy%, 0–100. */
  bestAccuracy: number;
  updatedAt: string;
}

/** IQ formula: 60% average accuracy ⇒ 100 IQ; 100% ⇒ 140. */
export function computeIq(avgAccuracy: number): number {
  return Math.round(100 + (avgAccuracy - 60));
}

/** The first-attempt score for an attempt doc, or null if it contributes nothing. */
export function firstAttemptOf(attempt: FirstAttemptSource): AttemptScore | null {
  if (attempt.firstScore) return attempt.firstScore;
  if (attempt.completed && attempt.score) return attempt.score; // legacy fallback
  return null;
}

function accuracyPercent(score: AttemptScore): number {
  if (score.total <= 0) return 0;
  return Math.round((score.correct / score.total) * 100);
}

/**
 * Full recompute from a fresh attempts read — self-healing, never
 * incremental. Returns null when no first takes exist, so callers can show
 * a real zero-state instead of a fabricated IQ.
 */
export function computeUserStats(attempts: FirstAttemptSource[]): UserStats | null {
  const firsts = attempts
    .map(firstAttemptOf)
    .filter((score): score is AttemptScore => score !== null);

  if (firsts.length === 0) return null;

  const percents = firsts.map(accuracyPercent);
  const avgAccuracy = Math.round(percents.reduce((sum, p) => sum + p, 0) / percents.length);

  return {
    iq: computeIq(avgAccuracy),
    avgAccuracy,
    quizzesTaken: firsts.length,
    bestAccuracy: Math.max(...percents),
    updatedAt: new Date().toISOString(),
  };
}
