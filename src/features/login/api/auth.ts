import { signInWithEmailAndPassword, type UserCredential } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { doc, getDoc, query, collection, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface LoginCredentials {
  identifier: string; // Can be email or username
  password: string;
}

export interface LoginResult {
  success: boolean;
  user?: UserCredential['user'];
  error?: {
    code: string;
    message: string;
    field?: 'identifier' | 'password';
  };
}

/**
 * Looks up user's email by username in Firestore
 * First tries the usernames collection (direct document read),
 * then falls back to querying users collection
 */
async function getEmailByUsername(username: string): Promise<string | null> {
  const normalizedUsername = username.toLowerCase();

  // Strategy 1: Try usernames collection (direct document read by ID)
  // This is more likely to work with security rules than a query
  try {
    const usernameRef = doc(db, 'usernames', normalizedUsername);
    const usernameSnap = await getDoc(usernameRef);


    if (usernameSnap.exists()) {
      const data = usernameSnap.data();
      // If email is stored in usernames collection, return it
      if (data.email) {
        return data.email;
      }

      // Otherwise, try to get email from users collection using the UID
      if (data.uid) {
        try {
          const userRef = doc(db, 'users', data.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            return userSnap.data().email || null;
          }
        } catch (innerError) {
          console.error('Failed to get user by UID:', innerError);
        }
      }
    }
  } catch (error) {
    console.warn('Failed to look up email via usernames collection:', error);
  }

  // Strategy 2: Fallback to querying users collection
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('username', '==', normalizedUsername));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const userData = snapshot.docs[0].data();
      return userData.email || null;
    }
    return null;
  } catch (error) {
    console.warn('Failed to look up email by username via users query:', error);
    return null;
  }
}

/**
 * Determines if the identifier is an email or username
 */
function isEmail(identifier: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
}

/**
 * Validates if user exists in Firestore users collection
 * This provides an additional layer of validation beyond Firebase Auth
 */
async function validateUserInDatabase(uid: string): Promise<boolean> {
  try {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    return userSnap.exists();
  } catch {
    // If Firestore check fails, we still allow login (Firebase Auth is source of truth)
    // but log for monitoring
    console.warn('Firestore user validation failed, relying on Firebase Auth');
    return true;
  }
}

/**
 * Authenticates user with Firebase Auth and validates against Firestore
 * Accepts either email or username as identifier
 */
export async function loginUser(credentials: LoginCredentials): Promise<LoginResult> {
  // Determine if identifier is email or username (needed in catch block)
  const usedUsernameLookup = !isEmail(credentials.identifier);

  try {
    // Get the email for Firebase Auth
    let email = credentials.identifier;

    if (usedUsernameLookup) {
      // Look up email by username
      const foundEmail = await getEmailByUsername(credentials.identifier);
      if (!foundEmail) {
        return {
          success: false,
          error: {
            code: 'auth/user-not-found',
            message: 'No account found with this username',
            field: 'identifier',
          },
        };
      }
      email = foundEmail;
    }

    // Sign in with Firebase Auth using the email
    const userCredential = await signInWithEmailAndPassword(
      auth,
      email,
      credentials.password
    );

    // Validate user exists in our database (Firestore)
    const isValidUser = await validateUserInDatabase(userCredential.user.uid);

    if (!isValidUser) {
      // User exists in Auth but not in our database - this shouldn't happen normally
      return {
        success: false,
        error: {
          code: 'auth/user-not-in-database',
          message: 'Account not fully set up. Please contact support.',
          field: 'identifier',
        },
      };
    }

    return {
      success: true,
      user: userCredential.user,
    };
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };

    // Map Firebase Auth errors to our standardized format
    if (err.code === 'auth/user-not-found') {
      // Different message depending on whether we used username lookup
      const message = usedUsernameLookup
        ? 'Account data inconsistency - username exists but email not in authentication system. Please contact support.'
        : 'No account found with this email';
      return {
        success: false,
        error: {
          code: err.code,
          message,
          field: 'identifier',
        },
      };
    }

    if (err.code === 'auth/wrong-password') {
      return {
        success: false,
        error: {
          code: err.code,
          message: 'Incorrect password',
          field: 'password',
        },
      };
    }

    // Handle new generic invalid-credential error (covers both wrong password and user not found)
    if (err.code === 'auth/invalid-credential') {
      // If we used username lookup and got here, the email was found but password is wrong
      // If we used email directly, it could be either wrong email or wrong password
      const message = usedUsernameLookup
        ? 'Incorrect password'
        : 'Invalid email or password. Please check your credentials.';
      return {
        success: false,
        error: {
          code: err.code,
          message,
          field: usedUsernameLookup ? 'password' : 'identifier',
        },
      };
    }

    if (err.code === 'auth/invalid-email') {
      return {
        success: false,
        error: {
          code: err.code,
          message: 'Invalid email format',
          field: 'identifier',
        },
      };
    }

    if (err.code === 'auth/too-many-requests') {
      return {
        success: false,
        error: {
          code: err.code,
          message: 'Too many attempts. Please try again later.',
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

    // Generic error for unhandled cases
    return {
      success: false,
      error: {
        code: err.code || 'auth/unknown',
        message: err.message || 'Login failed. Please try again.',
      },
    };
  }
}