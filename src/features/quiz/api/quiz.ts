import { db } from '@/lib/firebase';
import {
  collection,
  addDoc,
  getDoc,
  getDocs,
  getDocsFromServer,
  doc,
  serverTimestamp,
  Timestamp,
  query,
  where,
  orderBy,
  limit,
  setDoc,
  updateDoc,
  deleteDoc,
  getCountFromServer
} from 'firebase/firestore';
import type { QuizResponse } from '@/features/genai/schema';

export interface QuizDocument {
  id?: string;
  title: string;
  topic: string;
  questions: QuizResponse['questions'];
  metadata: QuizResponse['metadata'];
  visibility: 'public' | 'private';
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  progress?: QuizProgress;
}

export interface QuizProgress {
  answeredCount: number;
  totalQuestions: number;
  lastAttemptAt: Timestamp;
  completed: boolean;
  score?: {
    correct: number;
    total: number;
  };
  answers?: Record<string, number | string | string[]>;
  details?: Array<{
    questionId: string;
    isCorrect: boolean;
    userAnswer: number | string | string[];
    correctAnswer: number | string | string[];
    explanation: string;
  }>;
}

export interface QuizColorPreference {
  userId: string;
  quizId: string;
  colorId: string;
  updatedAt: Timestamp;
}

export interface QuizTitle {
  userId: string;
  quizId: string;
  title: string;
  updatedAt: Timestamp;
}

// Color palette options
export const CARD_COLORS = [
  { id: 'default', name: 'Default', gradient: '', textClass: 'text-gray-900 dark:text-gray-100', bgClass: 'bg-white dark:bg-gray-800' },
  { id: 'primary', name: 'Primary', gradient: 'from-primary-500 to-primary-600', textClass: 'text-white', bgClass: 'bg-gradient-to-r from-primary-500 to-primary-600' },
  { id: 'blue', name: 'Ocean', gradient: 'from-blue-500 to-blue-600', textClass: 'text-white', bgClass: 'bg-gradient-to-r from-blue-500 to-blue-600' },
  { id: 'green', name: 'Forest', gradient: 'from-green-500 to-green-600', textClass: 'text-white', bgClass: 'bg-gradient-to-r from-green-500 to-green-600' },
  { id: 'purple', name: 'Violet', gradient: 'from-purple-500 to-purple-600', textClass: 'text-white', bgClass: 'bg-gradient-to-r from-purple-500 to-purple-600' },
  { id: 'orange', name: 'Sunset', gradient: 'from-orange-500 to-orange-600', textClass: 'text-white', bgClass: 'bg-gradient-to-r from-orange-500 to-orange-600' },
  { id: 'pink', name: 'Rose', gradient: 'from-pink-500 to-pink-600', textClass: 'text-white', bgClass: 'bg-gradient-to-r from-pink-500 to-pink-600' },
  { id: 'teal', name: 'Teal', gradient: 'from-teal-500 to-teal-600', textClass: 'text-white', bgClass: 'bg-gradient-to-r from-teal-500 to-teal-600' },
  { id: 'indigo', name: 'Indigo', gradient: 'from-indigo-500 to-indigo-600', textClass: 'text-white', bgClass: 'bg-gradient-to-r from-indigo-500 to-indigo-600' },
] as const;

export type CardColorId = typeof CARD_COLORS[number]['id'];

export function getCardColor(colorId: CardColorId) {
  return CARD_COLORS.find(c => c.id === colorId) || CARD_COLORS[0];
}

/**
 * Saves a generated quiz to Firestore
 */
export async function saveQuiz(
  quizData: QuizResponse,
  userId: string,
  visibility: 'public' | 'private'
): Promise<string> {
  const quizDoc: Omit<QuizDocument, 'id'> = {
    title: quizData.metadata.title ?? quizData.metadata.topic,
    topic: quizData.metadata.topic,
    questions: quizData.questions,
    metadata: quizData.metadata,
    visibility,
    createdBy: userId,
    createdAt: serverTimestamp() as Timestamp,
    updatedAt: serverTimestamp() as Timestamp,
  };

  const docRef = await addDoc(collection(db, 'quizzes'), quizDoc);

  // Set default color to 'primary' (blue) for the quiz creator
  await saveQuizColorPreference(docRef.id, userId, 'primary');

  return docRef.id;
}

/**
 * Updates a quiz's visibility (owner only - enforced by Firestore rules)
 */
export async function updateQuizVisibility(
  quizId: string,
  visibility: 'public' | 'private'
): Promise<void> {
  const quizRef = doc(db, 'quizzes', quizId);
  await updateDoc(quizRef, {
    visibility,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Deletes a quiz and the owner's own progress/color-preference docs.
 * The quiz document delete is authoritative (throws on failure so callers
 * can roll back); side-document cleanup is best-effort and never fails
 * the deletion. Other users' attempt docs become unreachable, not broken.
 */
export async function deleteQuiz(quizId: string, userId: string): Promise<void> {
  await deleteDoc(doc(db, 'quizzes', quizId));

  const cleanups = await Promise.allSettled([
    deleteDoc(doc(db, 'quizAttempts', `${userId}_${quizId}`)),
    deleteDoc(doc(db, 'quizPreferences', `${userId}_${quizId}`)),
    deleteDoc(doc(db, 'quizTitles', `${userId}_${quizId}`)),
  ]);
  cleanups.forEach(result => {
    if (result.status === 'rejected') {
      console.error('Failed to clean up quiz side-document:', result.reason);
    }
  });
}

/**
 * Fetches a quiz by its document ID
 */
export async function getQuizById(quizId: string): Promise<QuizDocument | null> {
  const docRef = doc(db, 'quizzes', quizId);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return null;
  }

  return {
    id: docSnap.id,
    ...docSnap.data()
  } as QuizDocument;
}

/**
 * Fetches quizzes created by a specific user
 */
export async function getUserQuizzes(userId: string, maxCount = 20): Promise<QuizDocument[]> {
  const q = query(
    collection(db, 'quizzes'),
    where('createdBy', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(maxCount)
  );

  const querySnapshot = await getDocsFromServer(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as QuizDocument));
}

/**
 * Fetches the count of quizzes created by a specific user
 * Uses Firestore's aggregate count query (cheap - no document downloads)
 */
export async function getUserQuizCount(userId: string): Promise<number> {
  const q = query(collection(db, 'quizzes'), where('createdBy', '==', userId));
  const snapshot = await getCountFromServer(q);
  return snapshot.data().count;
}

/**
 * Fetches public quizzes (for discovery)
 */
export async function getPublicQuizzes(maxCount = 20): Promise<QuizDocument[]> {
  const q = query(
    collection(db, 'quizzes'),
    where('visibility', '==', 'public'),
    orderBy('createdAt', 'desc'),
    limit(maxCount)
  );

  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as QuizDocument));
}

/**
 * Saves or updates quiz progress for a user
 */
export async function saveQuizProgress(
  quizId: string,
  userId: string,
  progress: Omit<QuizProgress, 'lastAttemptAt'>
): Promise<void> {
  const attemptRef = doc(db, 'quizAttempts', `${userId}_${quizId}`);
  await setDoc(attemptRef, {
    userId,
    quizId,
    ...progress,
    lastAttemptAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

/**
 * Gets quiz progress for a user
 */
export async function getQuizProgress(quizId: string, userId: string): Promise<QuizProgress | null> {
  const attemptRef = doc(db, 'quizAttempts', `${userId}_${quizId}`);
  const docSnap = await getDoc(attemptRef);

  if (!docSnap.exists()) {
    return null;
  }

  return docSnap.data() as QuizProgress;
}

/**
 * Gets progress for multiple quizzes at once
 */
export async function getQuizzesProgress(quizIds: string[], userId: string): Promise<Map<string, QuizProgress>> {
  if (quizIds.length === 0) return new Map();

  const progressMap = new Map<string, QuizProgress>();

  // Fetch in batches of 10 (Firestore 'in' query limit)
  for (let i = 0; i < quizIds.length; i += 10) {
    const batch = quizIds.slice(i, i + 10);
    const q = query(
      collection(db, 'quizAttempts'),
      where('userId', '==', userId),
      where('quizId', 'in', batch)
    );

    const querySnapshot = await getDocs(q);
    querySnapshot.docs.forEach(doc => {
      const data = doc.data() as QuizProgress & { quizId: string };
      progressMap.set(data.quizId, data);
    });
  }

  return progressMap;
}

/**
 * Gets user's color preference for a quiz
 */
export async function getQuizColorPreference(quizId: string, userId: string): Promise<CardColorId> {
  const prefRef = doc(db, 'quizPreferences', `${userId}_${quizId}`);
  const docSnap = await getDoc(prefRef);

  if (!docSnap.exists()) {
    return 'default';
  }

  const data = docSnap.data() as QuizColorPreference;
  return data.colorId as CardColorId;
}

/**
 * Saves user's color preference for a quiz
 */
export async function saveQuizColorPreference(quizId: string, userId: string, colorId: CardColorId): Promise<void> {
  const prefRef = doc(db, 'quizPreferences', `${userId}_${quizId}`);
  await setDoc(prefRef, {
    userId,
    quizId,
    colorId,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Saves a user's custom title for a quiz.
 * Stored in a user-scoped side document so each user can have their own
 * display title for a quiz without changing the shared quiz title.
 */
export async function saveQuizTitle(
  quizId: string,
  userId: string,
  title: string
): Promise<void> {
  const titleRef = doc(db, 'quizTitles', `${userId}_${quizId}`);
  await setDoc(titleRef, {
    userId,
    quizId,
    title,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Gets a user's custom title for a quiz.
 * Returns null when the user has no custom title for this quiz.
 */
export async function getQuizTitle(
  quizId: string,
  userId: string
): Promise<string | null> {
  const titleRef = doc(db, 'quizTitles', `${userId}_${quizId}`);
  const docSnap = await getDoc(titleRef);

  if (!docSnap.exists()) {
    return null;
  }

  const data = docSnap.data() as QuizTitle;
  return data.title;
}

/**
 * Gets custom titles for multiple quizzes at once.
 * Returns a Map keyed by quizId with the user's custom title for each.
 */
export async function getQuizzesTitles(
  quizIds: string[],
  userId: string
): Promise<Map<string, string>> {
  const titlesMap = new Map<string, string>();

  if (quizIds.length === 0) return titlesMap;

  // Fetch in batches of 10 (Firestore 'in' query limit)
  for (let i = 0; i < quizIds.length; i += 10) {
    const batch = quizIds.slice(i, i + 10);
    const q = query(
      collection(db, 'quizTitles'),
      where('userId', '==', userId),
      where('quizId', 'in', batch)
    );

    const querySnapshot = await getDocs(q);
    querySnapshot.docs.forEach((doc) => {
      const data = doc.data() as QuizTitle;
      titlesMap.set(data.quizId, data.title);
    });
  }

  return titlesMap;
}

/**
 * Gets color preferences for multiple quizzes at once
 */
export async function getQuizzesColorPreferences(quizIds: string[], userId: string): Promise<Map<string, CardColorId>> {
  if (quizIds.length === 0) return new Map();

  const prefsMap = new Map<string, CardColorId>();

  for (let i = 0; i < quizIds.length; i += 10) {
    const batch = quizIds.slice(i, i + 10);
    const q = query(
      collection(db, 'quizPreferences'),
      where('userId', '==', userId),
      where('quizId', 'in', batch)
    );

    const querySnapshot = await getDocs(q);
    querySnapshot.docs.forEach(doc => {
      const data = doc.data() as QuizColorPreference;
      prefsMap.set(data.quizId, data.colorId as CardColorId);
    });
  }

  return prefsMap;
}