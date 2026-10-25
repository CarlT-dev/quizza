import {
  createUserWithEmailAndPassword,
  updateProfile,
  type UserCredential,
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';

export interface RegisterData {
  email: string;
  password: string;
  username: string;
}

export interface RegisterResult {
  success: boolean;
  user?: UserCredential['user'];
  error?: {
    code: string;
    message: string;
    field?: 'email' | 'password' | 'username';
  };
}

/**
 * Checks if username is already taken in Firestore
 */
async function isUsernameTaken(username: string): Promise<boolean> {
  try {
    // Query users collection for username
    // For simplicity, we'll check by creating a username lookup document
    // In production, you might use a separate 'usernames' collection or query
    const usernameRef = doc(db, 'usernames', username.toLowerCase());
    const usernameSnap = await getDoc(usernameRef);
    return usernameSnap.exists();
  } catch {
    // If check fails, assume not taken (allow registration, handle conflict later)
    console.warn('Username availability check failed');
    return false;
  }
}

/**
 * Reserves username in Firestore
 */
async function reserveUsername(username: string, uid: string, email: string): Promise<void> {
  const usernameRef = doc(db, 'usernames', username.toLowerCase());
  await setDoc(usernameRef, { uid, email, createdAt: new Date().toISOString() });
}

/**
 * Creates user profile in Firestore
 */
async function createUserProfile(
  uid: string,
  data: RegisterData
): Promise<void> {
  const userRef = doc(db, 'users', uid);
  await setDoc(userRef, {
    email: data.email,
    username: data.username,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Registers new user with Firebase Auth and creates profile in Firestore
 */
export async function registerUser(data: RegisterData): Promise<RegisterResult> {
  try {
    // Check if username is available
    const usernameTaken = await isUsernameTaken(data.username);
    if (usernameTaken) {
      return {
        success: false,
        error: {
          code: 'auth/username-taken',
          message: 'This username is already taken',
          field: 'username',
        },
      };
    }

    // Create user in Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      data.email,
      data.password
    );

    // Update Firebase Auth profile with username
    await updateProfile(userCredential.user, {
      displayName: data.username,
    });

    // Reserve username in Firestore (with email for login lookup)
    await reserveUsername(data.username, userCredential.user.uid, data.email);

    // Create user profile in Firestore
    await createUserProfile(userCredential.user.uid, data);

    return {
      success: true,
      user: userCredential.user,
    };
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };

    // Map Firebase Auth errors to our standardized format
    if (err.code === 'auth/email-already-in-use') {
      return {
        success: false,
        error: {
          code: err.code,
          message: 'An account with this email already exists',
          field: 'email',
        },
      };
    }

    if (err.code === 'auth/invalid-email') {
      return {
        success: false,
        error: {
          code: err.code,
          message: 'Invalid email format',
          field: 'email',
        },
      };
    }

    if (err.code === 'auth/weak-password') {
      return {
        success: false,
        error: {
          code: err.code,
          message: 'Password should be at least 6 characters',
          field: 'password',
        },
      };
    }

    if (err.code === 'auth/network-request-failed') {
      return {
        success: false,
        error: {
          code: err.code,
          message: 'Network error. Please check your connection.',
        },
      };
    }

    // Firestore-specific errors
    if (err.code === 'permission-denied') {
      return {
        success: false,
        error: {
          code: err.code,
          message: 'Permission denied. Please check your database rules.',
        },
      };
    }

    // Generic error for unhandled cases
    return {
      success: false,
      error: {
        code: err.code || 'auth/unknown',
        message: err.message || 'Registration failed. Please try again.',
      },
    };
  }
}