import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { ResetPasswordForm } from './ResetPasswordForm';
import { authDebugger } from '../lib/authDebug';
import { useAuth } from '../lib/auth';
import { ANALYTICS_EVENTS, captureEvent } from '../lib/analytics';

export function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [verified, setVerified] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [isPasswordReset, setIsPasswordReset] = useState(false);
  const { getRedirectPath, clearRedirectPath } = useAuth();

  useEffect(() => {
    let countdownInterval: NodeJS.Timeout;

    if (verified) {
      countdownInterval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            navigate('/', { replace: true });
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (countdownInterval) {
        clearInterval(countdownInterval);
      }
    };
  }, [verified, navigate]);

  useEffect(() => {
    async function handleAuthCallback() {
      try {
        // Get the full URL and create URL object for parsing
        const currentUrl = window.location.href;
        const url = new URL(currentUrl);
        
        authDebugger.log('Processing auth callback', {
          url: currentUrl,
          params: Object.fromEntries(url.searchParams.entries()),
          hash: url.hash,
          pathname: url.pathname
        });

        // First, check for any error parameters
        const errorDescription = url.searchParams.get('error_description') || 
                               new URLSearchParams(url.hash.substring(1)).get('error_description');
        
        if (errorDescription) {
          authDebugger.logError('Error in callback URL', errorDescription);
          throw new Error(errorDescription);
        }

        // Check for password reset flow in multiple locations
        const type = url.searchParams.get('type') || 
                    new URLSearchParams(url.hash.substring(1)).get('type');
        const isRecovery = type === 'recovery' || url.pathname.includes('recovery');
        
        authDebugger.log('Checking callback type', { type, isRecovery, pathname: url.pathname });

        if (isRecovery) {
          authDebugger.log('Password reset flow detected');
          setIsPasswordReset(true);
          setLoading(false);
          return;
        }

        // OAuth returns here with ?provider=<name> appended to the redirect URL.
        // The client already parses the session out of the URL via
        // detectSessionInUrl, so we just wait for it and route the user on.
        const provider = url.searchParams.get('provider');
        if (provider) {
          authDebugger.log('OAuth callback detected', { provider });

          let session = null;
          for (let attempt = 0; attempt < 3 && !session; attempt += 1) {
            const { data, error: oauthSessionError } = await supabase.auth.getSession();
            if (oauthSessionError) {
              authDebugger.logError('Error reading OAuth session', oauthSessionError);
              throw oauthSessionError;
            }
            session = data.session;
            if (!session) {
              await new Promise((resolve) => setTimeout(resolve, 250));
            }
          }

          if (!session) {
            throw new Error('Could not complete sign in');
          }

          authDebugger.log('OAuth session established', { user: session.user.id, provider });

          // New accounts have no display name yet, so send them to the home page
          // where the onboarding prompt lives. Returning users go where they
          // were headed before signing in.
          const { data: profile } = await supabase
            .from('users')
            .select('display_name')
            .eq('id', session.user.id)
            .maybeSingle();

          const hasDisplayName = Boolean((profile?.display_name || '').trim());
          const storedRedirectPath = getRedirectPath();
          clearRedirectPath();

          const destination = hasDisplayName ? storedRedirectPath || '/dashboard' : '/';

          captureEvent(ANALYTICS_EVENTS.loginSucceeded, {
            source: 'oauth_callback',
            method: provider,
            redirect_path: destination,
            is_modal: false,
          });

          navigate(destination, { replace: true });
          return;
        }

        // Try to get the auth code from multiple possible locations
        const searchParams = new URLSearchParams(url.search);
        const hashParams = new URLSearchParams(url.hash.substring(1));
        const pathSegments = url.pathname.split('/');

        const code = searchParams.get('code') || // URL parameters
                    hashParams.get('code') ||    // Hash fragment
                    pathSegments[pathSegments.length - 1]; // Last path segment

        authDebugger.log('Auth code detection', { 
          fromParams: searchParams.get('code'),
          fromHash: hashParams.get('code'),
          fromPath: pathSegments[pathSegments.length - 1],
          finalCode: code
        });

        if (!code) {
          // If no code found, check for an existing session
          authDebugger.log('No code found, checking for existing session');
          const { data: { session }, error: sessionError } = await supabase.auth.getSession();
          
          if (sessionError) {
            authDebugger.logError('Error checking existing session', sessionError);
            throw sessionError;
          }

          if (session) {
            authDebugger.log('Existing session found', { 
              user: session.user.id,
              expiresAt: session.expires_at
            });
            setVerified(true);
            setLoading(false);
            return;
          }

          throw new Error('No verification code found in URL');
        }

        // Exchange the code for a session
        authDebugger.log('Exchanging code for session', { code });
        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        
        if (exchangeError) {
          authDebugger.logError('Code exchange failed', exchangeError);
          
          // Check if we still have a valid session despite the exchange error
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            authDebugger.log('Fallback to existing session successful', {
              user: session.user.id,
              expiresAt: session.expires_at
            });
            setVerified(true);
            setLoading(false);
            return;
          }
          
          throw exchangeError;
        }

        authDebugger.log('Auth callback completed successfully', {
          user: data.user?.id,
          session: data.session ? 'present' : 'missing'
        });

        setVerified(true);
        setLoading(false);

      } catch (err) {
        authDebugger.logError('Auth callback error', err);
        const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
        
        // Provide more user-friendly error messages
        const friendlyMessage = errorMessage.includes('No verification code') 
          ? 'Unable to verify your email. Please try clicking the verification link again or contact support.'
          : errorMessage.includes('Invalid auth code') 
            ? 'The verification link has expired. Please request a new verification email.'
            : errorMessage.includes('Email link is invalid or has expired') 
              ? 'The email link is no longer valid. Please request a new verification email.'
              : 'There was a problem verifying your email. Please try again or contact support.';
        
        setError(friendlyMessage);
        setLoading(false);
      }
    }

    handleAuthCallback();
  }, [navigate, getRedirectPath, clearRedirectPath]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <Loader2 className="mx-auto h-12 w-12 text-bears-orange animate-spin" />
          <h2 className="mt-4 text-lg font-medium text-gray-900">Verifying your account...</h2>
        </motion.div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white p-8 rounded-xl shadow-lg"
        >
          <div className="text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
            <h2 className="mt-4 text-xl font-bold text-gray-900">Verification Failed</h2>
            <p className="mt-2 text-sm text-gray-600">{error}</p>
            <div className="mt-6 space-y-3">
              <button
                onClick={() => navigate('/login')}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-bears-navy hover:bg-bears-navy/90"
              >
                Try Logging In
              </button>
              <button
                onClick={() => window.location.reload()}
                className="w-full flex justify-center py-2 px-4 border border-bears-navy rounded-md shadow-sm text-sm font-medium text-bears-navy bg-white hover:bg-gray-50"
              >
                Try Again
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  if (isPasswordReset) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <ResetPasswordForm />
      </div>
    );
  }

  if (verified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white p-8 rounded-xl shadow-lg"
        >
          <div className="text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 10 }}
            >
              <CheckCircle className="mx-auto h-16 w-16 text-green-500" />
            </motion.div>
            <h2 className="mt-6 text-2xl font-bold text-gray-900">Your account has been verified!</h2>
            <p className="mt-2 text-gray-600">
              Taking you to the predictions page in {countdown} seconds...
            </p>
            <div className="mt-8 h-2 bg-gray-100 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: "100%" }}
                animate={{ width: "0%" }}
                transition={{ duration: 3, ease: "linear" }}
                className="h-full bg-green-500"
              />
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return null;
}