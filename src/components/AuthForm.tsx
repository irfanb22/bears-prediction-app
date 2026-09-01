import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Loader2, Mail, AlertCircle, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { authDebugger } from '../lib/authDebug';
import { ANALYTICS_EVENTS, captureEvent } from '../lib/analytics';

interface AuthFormProps {
  mode: 'login' | 'register';
  isModal?: boolean;
  source?: string;
  onClose?: () => void;
  onSwitchMode?: () => void;
  onForgotPassword?: () => void;
}

interface LocationState {
  message?: string;
  status?: 'success' | 'error';
  from?: string;
}

function getAuthErrorType(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '');

  if (/invalid login credentials/i.test(message)) return 'invalid_credentials';
  if (/email not confirmed/i.test(message)) return 'email_not_confirmed';
  if (/already registered|user already registered/i.test(message)) return 'already_registered';
  return 'unknown';
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

export function AuthForm({ mode, isModal, source = 'unknown', onClose, onSwitchMode, onForgotPassword }: AuthFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | React.ReactNode | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [messageType, setMessageType] = useState<'success' | 'error' | null>(null);
  
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { signIn, signUp, signInWithProvider } = useAuth();

  // Get state from location
  const state = location.state as LocationState;
  const returnPath = state?.from;
  const redirectPathParam = searchParams.get('redirect');

  useEffect(() => {
    // Check for verification success in URL params
    const verified = searchParams.get('verified');
    if (verified === 'true' && mode === 'login') {
      setStatusMessage('Email verified successfully! Please sign in with your credentials.');
      setMessageType('success');
    }
    // Check for message in location state
    else if (state?.message) {
      setStatusMessage(state.message);
      setMessageType(state.status || 'error');
    }
  }, [mode, searchParams, state]);

  const handleGoogleSignIn = async () => {
    setError(null);
    setGoogleLoading(true);

    const redirectPath = returnPath || redirectPathParam || undefined;

    captureEvent(ANALYTICS_EVENTS.oauthSignInStarted, {
      provider: 'google',
      mode,
      source,
      is_modal: Boolean(isModal),
    });

    try {
      const { error: oauthError } = await signInWithProvider('google', redirectPath);
      if (oauthError) throw oauthError;
      // On success the browser is redirected to Google, so the loading state
      // intentionally stays on until the page unloads.
    } catch (err) {
      authDebugger.logError('Google sign in error', err);
      captureEvent(ANALYTICS_EVENTS.oauthSignInFailed, {
        provider: 'google',
        mode,
        source,
        is_modal: Boolean(isModal),
      });
      setError('Could not connect to Google. Please try again or use your email address.');
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    authDebugger.log(`${mode} form submission started`, { email });
    setError(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        captureEvent(ANALYTICS_EVENTS.loginSubmitted, {
          source,
          is_modal: Boolean(isModal),
        });
        authDebugger.log('Attempting sign in');
        const { error: signInError, data } = await signIn(email, password);
        if (signInError) throw signInError;
        
        authDebugger.log('Sign in successful', { 
          user: data.user?.id,
          session: data.session?.access_token ? 'present' : 'missing'
        });
        
        // Close modal if in modal mode
        if (isModal && onClose) {
          onClose();
        }

        // Navigate to the return path or dashboard
        const redirectPath = returnPath || redirectPathParam || '/dashboard';
        captureEvent(ANALYTICS_EVENTS.loginSucceeded, {
          source,
          redirect_path: redirectPath,
          is_modal: Boolean(isModal),
        });
        navigate(redirectPath, { replace: true });
      } else {
        captureEvent(ANALYTICS_EVENTS.signupSubmitted, {
          source,
          is_modal: Boolean(isModal),
        });
        authDebugger.log('Attempting sign up');
        const { error: signUpError, data } = await signUp(email, password);
        if (signUpError) throw signUpError;
        
        authDebugger.log('Sign up successful', {
          user: data.user?.id,
          confirmationSent: data.user?.confirmation_sent_at ? 'yes' : 'no'
        });
        
        setSuccess(true);
        captureEvent(ANALYTICS_EVENTS.signupSucceeded, {
          source,
          is_modal: Boolean(isModal),
        });
      }
    } catch (err) {
      authDebugger.logError(`${mode} error`, err);
      captureEvent(mode === 'login' ? ANALYTICS_EVENTS.loginFailed : ANALYTICS_EVENTS.signupFailed, {
        source,
        error_type: getAuthErrorType(err),
        is_modal: Boolean(isModal),
      });
      if (err instanceof Error) {
        // Handle specific error messages
        if (err.message.includes('Invalid login credentials')) {
          setError('Invalid email or password. Please try again.');
        } else if (err.message.includes('Email not confirmed')) {
          setError('Please verify your email address before signing in.');
        } else if (err.message === 'User already registered') {
          setError(
            <div className="space-y-2">
              <p>An account with this email already exists.</p>
              <button
                onClick={onSwitchMode}
                className="text-bears-orange hover:text-bears-orange/90 underline"
              >
                Click here to sign in instead
              </button>
            </div>
          );
        } else {
          setError(err.message);
        }
      } else {
        setError('An unexpected error occurred');
      }
    } finally {
      setLoading(false);
    }
  };

  const formContent = (
    <>
      <div className="mt-8">
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={googleLoading || loading}
          className="w-full flex items-center justify-center gap-3 py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-bears-orange disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {googleLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              <GoogleIcon />
              {mode === 'login' ? 'Sign in with Google' : 'Sign up with Google'}
            </>
          )}
        </button>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-gray-200" />
        <span className="text-xs uppercase tracking-wide text-gray-500">or</span>
        <div className="h-px flex-1 bg-gray-200" />
      </div>

      <form className="mt-6 space-y-6" onSubmit={handleSubmit}>
      <div className="rounded-md shadow-sm -space-y-px">
        <div>
          <label htmlFor="email" className="sr-only">
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-bears-orange focus:border-bears-orange focus:z-10 sm:text-sm"
            placeholder="Email address"
          />
        </div>
        <div>
          <label htmlFor="password" className="sr-only">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-bears-orange focus:border-bears-orange focus:z-10 sm:text-sm"
            placeholder="Password"
          />
        </div>
      </div>

      {mode === 'login' && (
        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={() => {
              captureEvent(ANALYTICS_EVENTS.passwordResetRequested, {
                source,
                surface: isModal ? 'modal' : 'page',
              });
              onForgotPassword?.();
            }}
            className="text-sm text-bears-navy hover:text-bears-orange transition-colors"
          >
            Forgot your password?
          </button>
        </div>
      )}

      <div>
        <button
          type="submit"
          disabled={loading}
          className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-bears-orange hover:bg-bears-orange/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-bears-orange disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            mode === 'login' ? 'Sign in' : 'Create account'
          )}
        </button>
      </div>

      <div className="text-center">
        <button
          type="button"
          onClick={() => {
            captureEvent(ANALYTICS_EVENTS.authSwitchClicked, {
              from_mode: mode,
              to_mode: mode === 'login' ? 'register' : 'login',
              source,
            });
            onSwitchMode?.();
          }}
          className="text-sm text-bears-navy hover:text-bears-orange"
        >
          {mode === 'login'
            ? "Don't have an account? Sign up"
            : 'Already have an account? Sign in'}
        </button>
      </div>
      </form>
    </>
  );

  if (success) {
    return (
      <div className={`${isModal ? '' : 'min-h-screen flex items-center justify-center bg-gray-50 px-4'}`}>
        <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-lg">
          <div className="text-center">
            <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
            <h2 className="mt-6 text-3xl font-bold text-gray-900">Check Your Email</h2>
            <p className="mt-2 text-sm text-gray-600">
              We've sent a confirmation link to {email}. Click the link to complete your registration.
            </p>
          </div>
          <div className="mt-6">
            <button
              onClick={() => {
                if (isModal && onClose) {
                  onClose();
                } else {
                  navigate('/', { replace: true });
                }
              }}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-bears-navy hover:bg-bears-navy/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-bears-navy"
            >
              Return to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isModal) {
    return (
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-auto p-8">
        <div>
          <Mail className="mx-auto h-12 w-12 text-bears-orange" />
          <h2 className="mt-6 text-center text-3xl font-bold text-gray-900">
            {mode === 'login' ? 'Sign in to your account' : 'Create your account'}
          </h2>
        </div>

        <AnimatePresence>
          {statusMessage && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`mt-4 rounded-md ${
                messageType === 'success' ? 'bg-green-50' : 'bg-red-50'
              } p-4`}
            >
              <div className="flex">
                {messageType === 'success' ? (
                  <CheckCircle className="h-5 w-5 text-green-400" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-400" />
                )}
                <div className="ml-3">
                  <h3 className={`text-sm font-medium ${
                    messageType === 'success' ? 'text-green-800' : 'text-red-800'
                  }`}>
                    {statusMessage}
                  </h3>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-4 rounded-md bg-red-50 p-4"
          >
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">{error}</h3>
              </div>
            </div>
          </motion.div>
        )}

        {formContent}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-xl shadow-lg">
        <div>
          <Mail className="mx-auto h-12 w-12 text-bears-orange" />
          <h2 className="mt-6 text-center text-3xl font-bold text-gray-900">
            {mode === 'login' ? 'Sign in to your account' : 'Create your account'}
          </h2>
        </div>

        <AnimatePresence>
          {statusMessage && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`rounded-md ${
                messageType === 'success' ? 'bg-green-50' : 'bg-red-50'
              } p-4`}
            >
              <div className="flex">
                {messageType === 'success' ? (
                  <CheckCircle className="h-5 w-5 text-green-400" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-400" />
                )}
                <div className="ml-3">
                  <h3 className={`text-sm font-medium ${
                    messageType === 'success' ? 'text-green-800' : 'text-red-800'
                  }`}>
                    {statusMessage}
                  </h3>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-md bg-red-50 p-4"
          >
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">{error}</h3>
              </div>
            </div>
          </motion.div>
        )}

        {formContent}
      </div>
    </div>
  );
}
