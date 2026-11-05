import type { Timestamp } from 'firebase/firestore';
import type { QuizProgress } from '@/features/quiz/api/quiz';

/** One participant row on the owner's results list. */
export interface QuizResultRow {
  userId: string;
  /** Resolved profile name; falls back to 'Unknown' when the profile is missing. */
  displayName: string;
  /** Latest attempt's score (legacy docs fall back to firstScore). */
  score: { correct: number; total: number } | null;
  /** Score from the participant's very first completion; absent on legacy docs. */
  firstScore: { correct: number; total: number } | null;
  percentage: number | null;
  lastAttemptAt: Timestamp;
  /** Full attempt doc, forwarded to the detail page via location.state. */
  attempt: QuizProgress & { userId: string; quizId: string };
}

/** Cross-page state passed from the results list to a participant's detail page. */
export interface OwnerResultsLocationState {
  row: QuizResultRow;
}
