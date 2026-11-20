import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
  User as FirebaseUser,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  updateProfile,
  deleteUser,
  getAdditionalUserInfo,
} from 'firebase/auth';
import {
  auth,
  googleProvider,
  isDesignatedAdminEmail,
  isPrimarySakimAdminEmail,
} from '../lib/firebase';
import {
  syncUserOnAuth,
  subscribeToUserProfile,
  isDesignatedAdminUser,
  ensureBootstrappedAdminRecord,
  ensureAuthConfigExists,
  seedDefaultFlightsIfEmpty,
} from '../services/firestoreService';
import { UserProfile } from '../types/flight';

interface AuthContextType {
  user: FirebaseUser | null;
  userProfile: UserProfile | null;
  isAdmin: boolean;
  isApproved: boolean;
  isPendingApproval: boolean;
  isBlocked: boolean;
  isLoading: boolean;
  authNotice: string | null;
  clearAuthNotice: () => void;
  signIn: (email: string, password: string) => Promise<{ error: string | null; code?: string }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null; code?: string; pendingApproval?: boolean }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null; code?: string }>;
  signInWithGoogle: () => Promise<{ error: string | null; code?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [authNotice, setAuthNotice] = useState<string | null>(null);

  const isHandlingActionRef = useRef<boolean>(false);
  const profileUnsubRef = useRef<(() => void) | null>(null);
  const hadLoadedProfileRef = useRef<boolean>(false);

  const clearAuthNotice = useCallback(() => setAuthNotice(null), []);

  const attachProfileListener = useCallback((firebaseUser: FirebaseUser) => {
    if (profileUnsubRef.current) {
      profileUnsubRef.current();
      profileUnsubRef.current = null;
    }

    hadLoadedProfileRef.current = false;

    profileUnsubRef.current = subscribeToUserProfile(firebaseUser.uid, async (profile) => {
      if (profile) {
        hadLoadedProfileRef.current = true;
        if (profile.signupStatus === 'blocked' && !isDesignatedAdminUser(firebaseUser)) {
          setAuthNotice('Access denied. Your account has been blocked by an administrator.');
          await firebaseSignOut(auth);
          setUser(null);
          setUserProfile(null);
          setIsLoading(false);
          return;
        }
        setUserProfile(profile);
        setIsLoading(false);
        return;
      }

      // If profile existed previously and was deleted by Admin while user was active:
      if (hadLoadedProfileRef.current && !isHandlingActionRef.current) {
        setAuthNotice('Your user account was deleted by an administrator.');
        await firebaseSignOut(auth);
        setUser(null);
        setUserProfile(null);
        setIsLoading(false);
      }
    });
  }, []);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (profileUnsubRef.current) {
        profileUnsubRef.current();
        profileUnsubRef.current = null;
      }

      if (!firebaseUser) {
        setUser(null);
        setUserProfile(null);
        setIsLoading(false);
        return;
      }

      setUser(firebaseUser);

      // If signIn / signUp / signInWithGoogle is actively running, let it handle sync
      if (isHandlingActionRef.current) {
        return;
      }

      // Session restored on page reload
      try {
        const isGoogle = firebaseUser.providerData.some((p) => p.providerId === 'google.com');
        const { profile, blockedReason } = await syncUserOnAuth({
          firebaseUser,
          authProvider: isGoogle ? 'google' : 'password',
          mode: 'login',
        });

        if (blockedReason === 'signup_disabled') {
          setAuthNotice('New user signups are currently disabled by the Administrator.');
          await firebaseSignOut(auth);
          setUser(null);
          setUserProfile(null);
          setIsLoading(false);
          return;
        }

        if (blockedReason === 'blocked') {
          setAuthNotice('Access denied. Your account has been blocked by an administrator.');
          await firebaseSignOut(auth);
          setUser(null);
          setUserProfile(null);
          setIsLoading(false);
          return;
        }

        if (blockedReason === 'deleted') {
          setAuthNotice('Your account was removed by an administrator.');
          await firebaseSignOut(auth);
          setUser(null);
          setUserProfile(null);
          setIsLoading(false);
          return;
        }

        setUserProfile(profile);
        attachProfileListener(firebaseUser);
      } catch (err) {
        console.error('Session restore failed:', err);
        setAuthNotice(extractReadableError(err));
        try {
          await firebaseSignOut(auth);
        } catch {
          // Ignore signout error
        }
        setUser(null);
        setUserProfile(null);
        setIsLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (profileUnsubRef.current) {
        profileUnsubRef.current();
      }
    };
  }, [attachProfileListener]);

  const signIn = async (email: string, password: string): Promise<{ error: string | null; code?: string }> => {
    isHandlingActionRef.current = true;
    setAuthNotice(null);
    const trimmedEmail = email.trim();
    const normalizedEmail = trimmedEmail.toLowerCase();

    try {
      let cred;
      let wasAutoCreatedAdmin = false;

      try {
        cred = await signInWithEmailAndPassword(auth, trimmedEmail, password);
      } catch (signInErr: unknown) {
        const signInCode = getFirebaseErrorCode(signInErr);
        // Smart Admin Login Helper: auto-create sakim@gmail.com on first login if not yet registered
        if (
          isPrimarySakimAdminEmail(normalizedEmail) &&
          (signInCode === 'auth/user-not-found' || signInCode === 'auth/invalid-credential')
        ) {
          try {
            cred = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
            await updateProfile(cred.user, { displayName: 'Sakim' });
            wasAutoCreatedAdmin = true;
          } catch (createErr: unknown) {
            const createCode = getFirebaseErrorCode(createErr);
            if (createCode === 'auth/email-already-in-use') {
              // Account already exists — original sign-in failed due to wrong password
              throw signInErr;
            }
            throw createErr;
          }
        } else {
          throw signInErr;
        }
      }

      const { profile, blockedReason } = await syncUserOnAuth({
        firebaseUser: cred.user,
        authProvider: 'password',
        mode: wasAutoCreatedAdmin ? 'signup' : 'login',
        fullNameOverride: wasAutoCreatedAdmin ? 'Sakim' : undefined,
      });

      if (blockedReason === 'deleted') {
        await firebaseSignOut(auth);
        setUser(null);
        setUserProfile(null);
        return {
          error: 'This account has been deleted by the administrator. Sign up again if permitted or contact admin.',
        };
      }

      if (blockedReason === 'blocked') {
        await firebaseSignOut(auth);
        setUser(null);
        setUserProfile(null);
        return {
          error: 'Access denied. Your account has been blocked or suspended by an administrator.',
        };
      }

      if (blockedReason === 'signup_disabled') {
        await firebaseSignOut(auth);
        setUser(null);
        setUserProfile(null);
        return { error: 'New user signups are currently disabled by the Administrator.' };
      }

      setUser(cred.user);
      setUserProfile(profile);
      attachProfileListener(cred.user);
      setIsLoading(false);
      return { error: null };
    } catch (err: unknown) {
      if (auth.currentUser) {
        try {
          await firebaseSignOut(auth);
        } catch {
          // Ignore
        }
        setUser(null);
        setUserProfile(null);
      }
      return { error: mapFirebaseAuthError(err), code: getFirebaseErrorCode(err) };
    } finally {
      isHandlingActionRef.current = false;
    }
  };

  const signUp = async (
    email: string,
    password: string,
    fullName: string
  ): Promise<{ error: string | null; code?: string; pendingApproval?: boolean }> => {
    isHandlingActionRef.current = true;
    setAuthNotice(null);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await updateProfile(cred.user, { displayName: fullName.trim() });

      const { profile, blockedReason } = await syncUserOnAuth({
        firebaseUser: cred.user,
        authProvider: 'password',
        mode: 'signup',
        fullNameOverride: fullName.trim(),
      });

      if (blockedReason === 'signup_disabled') {
        try {
          await deleteUser(cred.user);
        } catch {
          await firebaseSignOut(auth);
        }
        setUser(null);
        setUserProfile(null);
        return { error: 'New user signups are currently disabled by the Administrator.' };
      }

      setUser(cred.user);
      setUserProfile(profile);
      attachProfileListener(cred.user);
      setIsLoading(false);
      return {
        error: null,
        pendingApproval: profile?.signupStatus === 'pending',
      };
    } catch (err: unknown) {
      if (auth.currentUser) {
        try {
          await firebaseSignOut(auth);
        } catch {
          // Ignore
        }
        setUser(null);
        setUserProfile(null);
      }
      return { error: mapFirebaseAuthError(err), code: getFirebaseErrorCode(err) };
    } finally {
      isHandlingActionRef.current = false;
    }
  };

  const signInWithGoogle = async (): Promise<{ error: string | null; code?: string }> => {
    isHandlingActionRef.current = true;
    setAuthNotice(null);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const extraInfo = getAdditionalUserInfo(cred);
      const mode = extraInfo?.isNewUser ? 'signup' : 'login';

      const { profile, blockedReason } = await syncUserOnAuth({
        firebaseUser: cred.user,
        authProvider: 'google',
        mode,
      });

      if (blockedReason === 'signup_disabled') {
        if (extraInfo?.isNewUser) {
          try {
            await deleteUser(cred.user);
          } catch {
            await firebaseSignOut(auth);
          }
        } else {
          await firebaseSignOut(auth);
        }
        setUser(null);
        setUserProfile(null);
        return { error: 'New user signups are currently disabled by the Administrator.' };
      }

      if (blockedReason === 'blocked') {
        await firebaseSignOut(auth);
        setUser(null);
        setUserProfile(null);
        return { error: 'Access denied. Your account has been blocked or suspended by an administrator.' };
      }

      if (isDesignatedAdminUser(cred.user)) {
        await ensureBootstrappedAdminRecord(cred.user);
        await ensureAuthConfigExists(cred.user.uid);
        await seedDefaultFlightsIfEmpty(cred.user.uid);
      }

      setUser(cred.user);
      setUserProfile(profile);
      attachProfileListener(cred.user);
      setIsLoading(false);
      return { error: null };
    } catch (err: unknown) {
      if (auth.currentUser) {
        try {
          await firebaseSignOut(auth);
        } catch {
          // Ignore
        }
        setUser(null);
        setUserProfile(null);
      }
      return { error: mapFirebaseAuthError(err), code: getFirebaseErrorCode(err) };
    } finally {
      isHandlingActionRef.current = false;
    }
  };

  const signOut = async () => {
    if (profileUnsubRef.current) {
      profileUnsubRef.current();
      profileUnsubRef.current = null;
    }
    hadLoadedProfileRef.current = false;
    await firebaseSignOut(auth);
    setUser(null);
    setUserProfile(null);
  };

  const resetPassword = async (email: string): Promise<{ error: string | null; code?: string }> => {
    try {
      await sendPasswordResetEmail(auth, email.trim());
      return { error: null };
    } catch (err: unknown) {
      return { error: mapFirebaseAuthError(err), code: getFirebaseErrorCode(err) };
    }
  };

  // Unconditional Admin Rule: sakim@gmail.com is ALWAYS Admin without email verification;
  // every other email is strictly USER (read-only).
  const isDesignatedAdmin = isDesignatedAdminEmail(user?.email);
  const isAdmin = isDesignatedAdmin;
  const isPendingApproval = !isAdmin && userProfile?.signupStatus === 'pending';
  const isBlocked = !isAdmin && userProfile?.signupStatus === 'blocked';
  const isApproved = isAdmin || userProfile?.signupStatus === 'approved';

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        isAdmin,
        isApproved,
        isPendingApproval,
        isBlocked,
        isLoading,
        authNotice,
        clearAuthNotice,
        signIn,
        signUp,
        signOut,
        resetPassword,
        signInWithGoogle,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

function getFirebaseErrorCode(err: unknown): string {
  return (err as { code?: string })?.code || '';
}

function extractReadableError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.error === 'string') {
      return `Database sync error: ${parsed.error}`;
    }
  } catch {
    // Plain error message
  }
  return raw || 'Authentication failed.';
}

export function mapFirebaseAuthError(err: unknown): string {
  const code = getFirebaseErrorCode(err);

  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'Invalid email or password. Please verify your credentials and try again.';
    case 'auth/email-already-in-use':
      return 'An account with this email address already exists. Please sign in instead.';
    case 'auth/weak-password':
      return 'Password is too weak. Please use at least 8 characters with a number and symbol.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/operation-not-allowed':
      return 'Email/Password sign-in is not yet enabled in Firebase Console (Authentication → Sign-in method). Use Continue with Google below or enable Email/Password in Firebase Console.';
    case 'auth/popup-closed-by-user':
      return 'Google Sign-In popup was closed before completion.';
    case 'auth/popup-blocked':
      return 'Sign-in popup was blocked by your browser. Please allow popups and try again.';
    case 'auth/too-many-requests':
      return 'Too many attempts detected. Please wait a moment and try again.';
    case 'auth/network-request-failed':
      return 'Network connection failed. Please check your internet connection.';
    default:
      return extractReadableError(err);
  }
}
