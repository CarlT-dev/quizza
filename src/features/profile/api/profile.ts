import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  limit,
  writeBatch,
  getCountFromServer,
} from 'firebase/firestore';
import type { QuizDocument } from '@/features/quiz';
import { getUserQuizzes, getQuizAttempts } from '@/features/quiz';

export interface CurrentUserProfile {
  uid: string;
  username: string;
  displayName?: string;
  name?: string;          // User's display name
  createdAt?: string;
  bio?: string;
  quizzesCreated: number;
  quizzesTaken: number;
  bestAccuracy?: number;
  mostAnsweredQuizzes: QuizDocument[];
}

/**
 * Fetches the current user's profile with stats and most answered quizzes.
 */
export async function getCurrentUserProfile(userId: string): Promise<CurrentUserProfile | null> {
  // Fetch profile, quiz count, and first-attempt stats in parallel
  const [profileSnap, quizCountSnap, attempts] = await Promise.all([
    getDoc(doc(db, 'users', userId)),
    getCountFromServer(query(collection(db, 'quizzes'), where('createdBy', '==', userId))),
    getQuizAttemptsByUser(userId),
  ]);

  if (!profileSnap.exists()) return null;

  const profileData = profileSnap.data();
  const quizzesCreated = quizCountSnap.data().count;

  // Compute first-attempt stats from attempts
  const stats = computeFirstAttemptStats(attempts);

  // Fetch most answered quizzes (top 5 by attempt count)
  const mostAnsweredQuizzes = await getMostAnsweredQuizzes(userId, 5);

  return {
    uid: userId,
    username: profileData.username,
    displayName: profileData.displayName,
    name: profileData.name,
    createdAt: profileData.createdAt,
    bio: profileData.bio,
    quizzesCreated,
    quizzesTaken: stats?.quizzesTaken ?? 0,
    bestAccuracy: stats?.bestAccuracy,
    mostAnsweredQuizzes,
  };
}

/**
 * Fetches all attempt docs for a user (for stats computation).
 */
async function getQuizAttemptsByUser(userId: string): Promise<Array<{ quizId: string; completed?: boolean; firstScore?: { correct: number; total: number }; score?: { correct: number; total: number } }>> {
  const q = query(
    collection(db, 'quizAttempts'),
    where('userId', '==', userId),
    limit(200)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ quizId: d.data().quizId, ...d.data() } as any));
}

/**
 * Computes first-attempt stats from raw attempts (same logic as quizStats.ts).
 */
function computeFirstAttemptStats(attempts: Array<{ quizId: string; completed?: boolean; firstScore?: { correct: number; total: number }; score?: { correct: number; total: number } }>): { quizzesTaken: number; avgAccuracy: number; bestAccuracy: number } | null {
  const firstScores = attempts
    .map(a => {
      if (a.firstScore) return a.firstScore;
      if (a.completed && a.score) return a.score; // legacy fallback
      return null;
    })
    .filter((s): s is { correct: number; total: number } => s !== null);

  if (firstScores.length === 0) return null;

  const accuracies = firstScores.map(s => s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0);
  const avgAccuracy = Math.round(accuracies.reduce((sum, a) => sum + a, 0) / accuracies.length);
  const bestAccuracy = Math.max(...accuracies);

  return {
    quizzesTaken: firstScores.length,
    avgAccuracy,
    bestAccuracy,
  };
}

/**
 * Updates the user's bio on both users/{uid} and usernames/{username} documents.
 */
export async function updateBio(userId: string, bio: string): Promise<void> {
  const trimmedBio = bio.trim().slice(0, 160); // Max 160 characters

  // Get current username to update the usernames collection
  const profileSnap = await getDoc(doc(db, 'users', userId));
  const username = (profileSnap.data()?.username as string | undefined)?.toLowerCase() ?? '';

  const batch = writeBatch(db);

  // Update users/{uid}
  batch.update(doc(db, 'users', userId), {
    bio: trimmedBio,
    updatedAt: new Date().toISOString(),
  });

  // Update usernames/{username} for search results
  if (username) {
    batch.update(doc(db, 'usernames', username), {
      bio: trimmedBio,
      updatedAt: new Date().toISOString(),
    });
  }

  await batch.commit();
}

/**
 * Gets the user's quizzes with attempt counts, sorted by most answered.
 * Returns top N quizzes by attempt count (plays by other users).
 */
export async function getMostAnsweredQuizzes(userId: string, maxCount: number): Promise<QuizDocument[]> {
  // Get all quizzes created by the user
  const userQuizzes = await getUserQuizzes(userId, 100); // Fetch up to 100 to sort

  if (userQuizzes.length === 0) return [];

  // For each quiz, count attempts (plays by others)
  const quizzesWithCounts = await Promise.all(
    userQuizzes.map(async (quiz) => {
      if (!quiz.id) return { quiz, attemptCount: 0 };
      const attempts = await getQuizAttempts(quiz.id, 200);
      return { quiz, attemptCount: attempts.length };
    })
  );

  // Sort by attempt count descending, take top N
  return quizzesWithCounts
    .sort((a, b) => b.attemptCount - a.attemptCount)
    .slice(0, maxCount)
    .map(item => item.quiz);
}