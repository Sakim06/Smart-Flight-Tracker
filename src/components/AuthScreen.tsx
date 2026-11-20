import React, { useState, useEffect } from 'react';
import {
  Plane,
  Eye,
  EyeOff,
  Mail,
  Lock,
  User as UserIcon,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { PasswordStrengthMeter, evaluatePassword } from './PasswordStrengthMeter';

export const AuthScreen: React.FC = () => {
  const { signIn, signUp, resetPassword, signInWithGoogle, authNotice, clearAuthNotice } = useAuth();

  const [activeTab, setActiveTab] = useState<'signin' | 'signup' | 'forgot'>('signin');

  // Sign In State
  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [showSignInPassword, setShowSignInPassword] = useState(false);

  // Sign Up State
  const [signUpName, setSignUpName] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [signUpConfirmPassword, setSignUpConfirmPassword] = useState('');
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // Forgot Password State
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);

  // Status & Feedback States
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [operationNotAllowed, setOperationNotAllowed] = useState(false);
  const [registrationNotice, setRegistrationNotice] = useState<string | null>(null);
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (authNotice) {
      setServerError(authNotice);
      clearAuthNotice();
    }
  }, [authNotice, clearAuthNotice]);

  const validateEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  };

  const handleSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setOperationNotAllowed(false);
    setRegistrationNotice(null);
    const errors: Record<string, string> = {};

    if (!signInEmail.trim()) {
      errors.signInEmail = 'Please enter your email address.';
    } else if (!validateEmail(signInEmail)) {
      errors.signInEmail = 'Please enter a valid email address.';
    }

    if (!signInPassword) {
      errors.signInPassword = 'Password is required.';
    }

    if (Object.keys(errors).length > 0) {
      setClientErrors(errors);
      return;
    }

    setClientErrors({});
    setIsLoading(true);

    try {
      const { error, code } = await signIn(signInEmail.trim(), signInPassword);
      if (error) {
        if (code === 'auth/operation-not-allowed') {
          setOperationNotAllowed(true);
        } else {
          setServerError(error);
        }
      } else {
        setSignInPassword('');
      }
    } catch {
      setServerError('An unexpected sign-in error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setOperationNotAllowed(false);
    setRegistrationNotice(null);
    const errors: Record<string, string> = {};

    if (!signUpName.trim()) {
      errors.signUpName = 'Full name is required.';
    }

    if (!signUpEmail.trim()) {
      errors.signUpEmail = 'Email address is required.';
    } else if (!validateEmail(signUpEmail)) {
      errors.signUpEmail = 'Please enter a valid email address.';
    }

    const { hasMinLength, hasNumber, hasSpecialChar } = evaluatePassword(signUpPassword);
    if (!signUpPassword) {
      errors.signUpPassword = 'Password is required.';
    } else if (!hasMinLength || !hasNumber || !hasSpecialChar) {
      errors.signUpPassword = 'Password must meet all 3 strength requirements.';
    }

    if (!signUpConfirmPassword) {
      errors.signUpConfirmPassword = 'Please confirm your password.';
    } else if (signUpPassword !== signUpConfirmPassword) {
      errors.signUpConfirmPassword = 'Passwords do not match.';
    }

    if (!agreedToTerms) {
      errors.agreedToTerms = 'You must agree to the Terms of Service & Privacy Policy.';
    }

    if (Object.keys(errors).length > 0) {
      setClientErrors(errors);
      return;
    }

    setClientErrors({});
    setIsLoading(true);

    try {
      const { error, code, pendingApproval } = await signUp(
        signUpEmail.trim(),
        signUpPassword,
        signUpName.trim()
      );

      if (error) {
        if (code === 'auth/operation-not-allowed') {
          setOperationNotAllowed(true);
        } else {
          setServerError(error);
        }
      } else {
        setSignUpPassword('');
        setSignUpConfirmPassword('');
        if (pendingApproval) {
          setRegistrationNotice('Account created and queued for administrator approval.');
        }
      }
    } catch {
      setServerError('An unexpected registration error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setOperationNotAllowed(false);

    if (!forgotEmail.trim() || !validateEmail(forgotEmail)) {
      setClientErrors({ forgotEmail: 'Please enter a valid email address.' });
      return;
    }

    setClientErrors({});
    setIsLoading(true);

    try {
      const { error, code } = await resetPassword(forgotEmail.trim());
      if (error) {
        if (code === 'auth/operation-not-allowed') {
          setOperationNotAllowed(true);
        } else {
          setServerError(error);
        }
      } else {
        setForgotSent(true);
      }
    } catch {
      setServerError('Unable to send password reset email right now.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setServerError(null);
    setOperationNotAllowed(false);
    setRegistrationNotice(null);
    setIsLoading(true);
    try {
      const { error } = await signInWithGoogle();
      if (error) {
        setServerError(error);
      }
    } catch {
      setServerError('Google sign-in failed unexpectedly. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4 sm:p-6 selection:bg-blue-200 selection:text-blue-900">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-10 animate-fadeIn">
        {/* Header Bar */}
        <div className="bg-slate-950 text-white p-6 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shrink-0">
              <Plane className="w-6 h-6 transform -rotate-45" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-white">
                Smart Flight Tracker
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Authentication Required · Cloud Firestore Database
              </p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
              <span>Firebase Auth &amp; Role-Based Access</span>
            </span>
            <span className="font-mono text-2xs text-emerald-400 font-semibold">
              Firestore Connected
            </span>
          </div>
        </div>

        {/* Guided Banner when Email/Password provider is not enabled yet */}
        {operationNotAllowed && (
          <div
            role="alert"
            className="mx-6 mt-4 p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-amber-950 space-y-2 text-xs animate-fadeIn"
          >
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">Email/Password Provider Not Enabled Yet</div>
                <p className="mt-0.5 text-amber-900 leading-relaxed">
                  Enable <strong>Email/Password</strong> in Firebase Console (<em>Authentication → Sign-in method</em>), or sign in right now with Google.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isLoading}
              className="w-full py-2 px-3 bg-white hover:bg-amber-100/70 border border-amber-300 rounded-lg font-bold text-amber-950 transition-colors"
            >
              Continue with Google Instead
            </button>
          </div>
        )}

        {/* Global Server Error Banner */}
        {serverError && (
          <div
            role="alert"
            className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 flex items-start gap-2.5 text-xs sm:text-sm animate-fadeIn"
          >
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium leading-relaxed">{serverError}</div>
          </div>
        )}

        {/* Success Registration Notice Banner */}
        {registrationNotice && (
          <div
            role="status"
            className="mx-6 mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 flex items-start gap-2.5 text-xs sm:text-sm animate-fadeIn"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="flex-1 font-medium leading-relaxed">{registrationNotice}</div>
          </div>
        )}

        {/* Tab Selector (Sign In vs Sign Up) */}
        {activeTab !== 'forgot' && (
          <div className="px-6 pt-5">
            <div className="flex p-1 bg-slate-100 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('signin');
                  setServerError(null);
                  setRegistrationNotice(null);
                  setClientErrors({});
                }}
                className={`flex-1 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                  activeTab === 'signin'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                aria-selected={activeTab === 'signin'}
                role="tab"
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('signup');
                  setServerError(null);
                  setRegistrationNotice(null);
                  setClientErrors({});
                }}
                className={`flex-1 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                  activeTab === 'signup'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                aria-selected={activeTab === 'signup'}
                role="tab"
              >
                Sign Up
              </button>
            </div>
          </div>
        )}

        {/* Form Body */}
        <div className="p-6">
          {/* Google Sign-In Primary Option */}
          {activeTab !== 'forgot' && (
            <div className="mb-5">
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isLoading}
                className="w-full py-2.5 px-4 text-xs sm:text-sm font-semibold text-slate-800 hover:text-slate-950 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl shadow-2xs transition-colors flex items-center justify-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-50"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>

              <div className="relative my-4 text-center">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white px-3 text-slate-400 font-medium">Or with email &amp; password</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 1: SIGN IN VIEW */}
          {activeTab === 'signin' && (
            <form onSubmit={handleSignInSubmit} noValidate className="space-y-4">
              <div>
                <label htmlFor="auth-signin-email" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    id="auth-signin-email"
                    type="email"
                    value={signInEmail}
                    onChange={(e) => {
                      setSignInEmail(e.target.value);
                      if (clientErrors.signInEmail) {
                        setClientErrors((prev) => ({ ...prev, signInEmail: '' }));
                      }
                    }}
                    placeholder="name@example.com"
                    autoComplete="email"
                    disabled={isLoading}
                    className={`w-full pl-10 pr-3.5 py-2.5 text-sm bg-slate-50 border rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none transition-colors ${
                      clientErrors.signInEmail
                        ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-100'
                        : 'border-slate-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-100'
                    }`}
                    aria-invalid={clientErrors.signInEmail ? 'true' : 'false'}
                  />
                </div>
                {clientErrors.signInEmail && (
                  <p className="mt-1 text-xs text-rose-600 font-medium">{clientErrors.signInEmail}</p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="auth-signin-password" className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('forgot');
                      setForgotEmail(signInEmail);
                      setServerError(null);
                      setClientErrors({});
                    }}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="auth-signin-password"
                    type={showSignInPassword ? 'text' : 'password'}
                    value={signInPassword}
                    onChange={(e) => {
                      setSignInPassword(e.target.value);
                      if (clientErrors.signInPassword) {
                        setClientErrors((prev) => ({ ...prev, signInPassword: '' }));
                      }
                    }}
                    placeholder="••••••••••••"
                    autoComplete="current-password"
                    disabled={isLoading}
                    className={`w-full pl-10 pr-10 py-2.5 text-sm bg-slate-50 border rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none transition-colors ${
                      clientErrors.signInPassword
                        ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-100'
                        : 'border-slate-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-100'
                    }`}
                    aria-invalid={clientErrors.signInPassword ? 'true' : 'false'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowSignInPassword(!showSignInPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                    aria-label={showSignInPassword ? 'Hide password' : 'Show password'}
                  >
                    {showSignInPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {clientErrors.signInPassword && (
                  <p className="mt-1 text-xs text-rose-600 font-medium">{clientErrors.signInPassword}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3 px-4 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                {isLoading ? 'Authenticating...' : 'Sign In'}
              </button>

              <div className="pt-2 text-center text-xs text-slate-500">
                Don&apos;t have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('signup');
                    setServerError(null);
                    setClientErrors({});
                  }}
                  className="font-bold text-blue-600 hover:text-blue-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded"
                >
                  Sign Up
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: SIGN UP VIEW */}
          {activeTab === 'signup' && (
            <form onSubmit={handleSignUpSubmit} noValidate className="space-y-4">
              <div>
                <label htmlFor="auth-signup-name" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                    <UserIcon className="w-4 h-4" />
                  </div>
                  <input
                    id="auth-signup-name"
                    type="text"
                    value={signUpName}
                    onChange={(e) => {
                      setSignUpName(e.target.value);
                      if (clientErrors.signUpName) {
                        setClientErrors((prev) => ({ ...prev, signUpName: '' }));
                      }
                    }}
                    placeholder="Alex Vance"
                    autoComplete="name"
                    disabled={isLoading}
                    className={`w-full pl-10 pr-3.5 py-2.5 text-sm bg-slate-50 border rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none transition-colors ${
                      clientErrors.signUpName
                        ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-100'
                        : 'border-slate-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-100'
                    }`}
                  />
                </div>
                {clientErrors.signUpName && (
                  <p className="mt-1 text-xs text-rose-600 font-medium">{clientErrors.signUpName}</p>
                )}
              </div>

              <div>
                <label htmlFor="auth-signup-email" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    id="auth-signup-email"
                    type="email"
                    value={signUpEmail}
                    onChange={(e) => {
                      setSignUpEmail(e.target.value);
                      if (clientErrors.signUpEmail) {
                        setClientErrors((prev) => ({ ...prev, signUpEmail: '' }));
                      }
                    }}
                    placeholder="name@example.com"
                    autoComplete="email"
                    disabled={isLoading}
                    className={`w-full pl-10 pr-3.5 py-2.5 text-sm bg-slate-50 border rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none transition-colors ${
                      clientErrors.signUpEmail
                        ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-100'
                        : 'border-slate-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-100'
                    }`}
                  />
                </div>
                {clientErrors.signUpEmail && (
                  <p className="mt-1 text-xs text-rose-600 font-medium">{clientErrors.signUpEmail}</p>
                )}
              </div>

              <div>
                <label htmlFor="auth-signup-password" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="auth-signup-password"
                    type={showSignUpPassword ? 'text' : 'password'}
                    value={signUpPassword}
                    onChange={(e) => {
                      setSignUpPassword(e.target.value);
                      if (clientErrors.signUpPassword) {
                        setClientErrors((prev) => ({ ...prev, signUpPassword: '' }));
                      }
                    }}
                    placeholder="Minimum 8 characters, number, symbol"
                    autoComplete="new-password"
                    disabled={isLoading}
                    className={`w-full pl-10 pr-10 py-2.5 text-sm bg-slate-50 border rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none transition-colors ${
                      clientErrors.signUpPassword
                        ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-100'
                        : 'border-slate-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-100'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowSignUpPassword(!showSignUpPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                    aria-label={showSignUpPassword ? 'Hide password' : 'Show password'}
                  >
                    {showSignUpPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <PasswordStrengthMeter password={signUpPassword} />
                {clientErrors.signUpPassword && (
                  <p className="mt-1 text-xs text-rose-600 font-medium">{clientErrors.signUpPassword}</p>
                )}
              </div>

              <div>
                <label htmlFor="auth-signup-confirm" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="auth-signup-confirm"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={signUpConfirmPassword}
                    onChange={(e) => {
                      setSignUpConfirmPassword(e.target.value);
                      if (clientErrors.signUpConfirmPassword) {
                        setClientErrors((prev) => ({ ...prev, signUpConfirmPassword: '' }));
                      }
                    }}
                    placeholder="Re-enter your password"
                    autoComplete="new-password"
                    disabled={isLoading}
                    className={`w-full pl-10 pr-10 py-2.5 text-sm bg-slate-50 border rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none transition-colors ${
                      clientErrors.signUpConfirmPassword
                        ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-100'
                        : 'border-slate-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-100'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                    aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {signUpConfirmPassword && (
                  <div className="mt-1 flex items-center gap-1.5 text-xs">
                    {signUpPassword === signUpConfirmPassword ? (
                      <span className="text-emerald-600 flex items-center gap-1 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Passwords match
                      </span>
                    ) : (
                      <span className="text-rose-600 flex items-center gap-1 font-medium">
                        <AlertCircle className="w-3.5 h-3.5" /> Passwords do not match
                      </span>
                    )}
                  </div>
                )}
                {clientErrors.signUpConfirmPassword && (
                  <p className="mt-1 text-xs text-rose-600 font-medium">{clientErrors.signUpConfirmPassword}</p>
                )}
              </div>

              <div>
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(e) => {
                      setAgreedToTerms(e.target.checked);
                      if (clientErrors.agreedToTerms) {
                        setClientErrors((prev) => ({ ...prev, agreedToTerms: '' }));
                      }
                    }}
                    className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs text-slate-600 leading-snug">
                    I agree to the <span className="font-semibold text-slate-900 underline">Terms of Service</span> and{' '}
                    <span className="font-semibold text-slate-900 underline">Privacy Policy</span>.
                  </span>
                </label>
                {clientErrors.agreedToTerms && (
                  <p className="mt-1 text-xs text-rose-600 font-medium">{clientErrors.agreedToTerms}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3 px-4 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2"
              >
                {isLoading ? 'Creating Account...' : 'Create Account'}
              </button>

              <div className="pt-2 text-center text-xs text-slate-500">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('signin');
                    setServerError(null);
                    setClientErrors({});
                  }}
                  className="font-bold text-blue-600 hover:text-blue-800 hover:underline"
                >
                  Sign In
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: FORGOT PASSWORD VIEW */}
          {activeTab === 'forgot' && (
            <div className="space-y-4">
              {forgotSent ? (
                <div className="text-center py-4 space-y-3">
                  <div className="w-12 h-12 mx-auto bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900">Check Your Email</h3>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    We sent password reset instructions to{' '}
                    <strong className="text-slate-900">{forgotEmail}</strong>.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('signin');
                      setForgotSent(false);
                    }}
                    className="mt-4 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                  >
                    Return to Sign In
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgotSubmit} noValidate className="space-y-4">
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Enter the email associated with your account to receive a password reset link.
                  </p>

                  <div>
                    <label htmlFor="auth-forgot-email" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Account Email
                    </label>
                    <div className="relative">
                      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input
                        id="auth-forgot-email"
                        type="email"
                        value={forgotEmail}
                        onChange={(e) => {
                          setForgotEmail(e.target.value);
                          if (clientErrors.forgotEmail) setClientErrors({});
                        }}
                        placeholder="name@example.com"
                        disabled={isLoading}
                        className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none"
                      />
                    </div>
                    {clientErrors.forgotEmail && (
                      <p className="mt-1 text-xs text-rose-600 font-medium">{clientErrors.forgotEmail}</p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3 px-4 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2"
                  >
                    {isLoading ? 'Sending Link...' : 'Send Reset Link'}
                  </button>

                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('signin');
                        setServerError(null);
                        setClientErrors({});
                      }}
                      className="text-xs font-semibold text-slate-600 hover:text-slate-900 underline"
                    >
                      Back to Sign In
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
