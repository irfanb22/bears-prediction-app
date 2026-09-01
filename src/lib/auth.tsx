import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { User, AuthError, AuthResponse, Provider } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { authDebugger } from './authDebug';
import { identifyAnalyticsUser, resetAnalyticsUser } from './analytics';
import { GAME_PICK_DRAFT_STORAGE_KEY } from './utils';

// Define the shape of our auth context
interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string, redirectPath?: string) => Promise<AuthResponse>;
  signUp: (email: string, password: string) => Promise<AuthResponse>;
  signInWithProvider: (provider: Provider, redirectPath?: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
  getRedirectPath: () => string | null;
  clearRedirectPath: () => void;
}

// Create the auth context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Storage key for redirect path
const REDIRECT_PATH_KEY = 'auth_redirect_path';

// Custom hook to access auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Auth provider component
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize auth state
  useEffect(() => {
    authDebugger.log('Initializing auth state');
    
    // Get initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        authDebugger.logError('Error getting initial session', error);
      } else {
        authDebugger.log('Initial session retrieved', { session });
        setUser(session?.user ?? null);
        if (session?.user) {
          identifyAnalyticsUser(session.user);
        } else {
          resetAnalyticsUser();
        }
      }
      setLoading(false);
    });

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      authDebugger.log('Auth state changed', { event: _event, session });
      setUser(session?.user ?? null);
      authDebugger.logAuthState(session?.user ?? null);
      if (session?.user) {
        identifyAnalyticsUser(session.user);
      } else if (_event === 'SIGNED_OUT') {
        resetAnalyticsUser();
      }
    });

    return () => {
      authDebugger.log('Cleaning up auth subscriptions');
      subscription.unsubscribe();
    };
  }, []);

  // Store redirect path
  const setRedirectPath = (path: string) => {
    try {
      localStorage.setItem(REDIRECT_PATH_KEY, path);
      authDebugger.log('Stored redirect path', { path });
    } catch (error) {
      authDebugger.logError('Error storing redirect path', error);
    }
  };

  // Get stored redirect path
  const getRedirectPath = useCallback(() => {
    try {
      return localStorage.getItem(REDIRECT_PATH_KEY);
    } catch (error) {
      authDebugger.logError('Error getting redirect path', error);
      return null;
    }
  }, []);

  // Clear stored redirect path
  const clearRedirectPath = useCallback(() => {
    try {
      localStorage.removeItem(REDIRECT_PATH_KEY);
      authDebugger.log('Cleared redirect path');
    } catch (error) {
      authDebugger.logError('Error clearing redirect path', error);
    }
  }, []);

  // Sign in with email and password
  const signIn = async (email: string, password: string, redirectPath?: string) => {
    authDebugger.log('Attempting sign in', { email });
    
    // Store redirect path if provided
    if (redirectPath) {
      setRedirectPath(redirectPath);
    }
    
    try {
      const response = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (response.error) {
        authDebugger.logError('Sign in failed', response.error);
      } else {
        authDebugger.log('Sign in successful', { 
          user: response.data.user,
          session: response.data.session?.access_token ? 'present' : 'missing'
        });
      }

      return response;
    } catch (error) {
      authDebugger.logError('Unexpected error during sign in', error);
      throw error;
    }
  };

  // Sign up with email and password
  const signUp = async (email: string, password: string) => {
    authDebugger.log('Attempting sign up', { email });
    
    const redirectTo = `${window.location.origin}/auth/callback`;
    authDebugger.log('Redirect URL configured', { redirectTo });
    
    try {
      // First check if user exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single();

      if (existingUser) {
        authDebugger.log('User already exists', { email });
        return {
          data: { user: null, session: null },
          error: {
            name: 'UserExistsError',
            message: 'User already registered',
            status: 400
          } as AuthError
        };
      }

      const response = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectTo,
          data: {
            created_at: new Date().toISOString(),
          }
        },
      });

      if (response.error) {
        authDebugger.logError('Sign up failed', response.error);
      } else {
        authDebugger.log('Sign up successful', {
          user: response.data.user,
          session: response.data.session
        });
      }

      return response;
    } catch (error) {
      authDebugger.logError('Unexpected error during sign up', error);
      throw error;
    }
  };

  // Sign in with a third-party provider (Google today; Apple can be added by
  // passing 'apple' once the provider is configured in Supabase).
  const signInWithProvider = async (provider: Provider, redirectPath?: string) => {
    authDebugger.log('Attempting OAuth sign in', { provider, redirectPath });

    // The browser leaves the app entirely, so the post-login destination has to
    // survive in storage rather than component state.
    if (redirectPath) {
      setRedirectPath(redirectPath);
    }

    const redirectTo = `${window.location.origin}/auth/callback?provider=${provider}`;

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo },
      });

      if (error) {
        authDebugger.logError('OAuth sign in failed', error);
      } else {
        authDebugger.log('OAuth redirect initiated', { provider, redirectTo });
      }

      return { error };
    } catch (error) {
      authDebugger.logError('Unexpected error during OAuth sign in', error);
      throw error;
    }
  };

  // Sign out
  const signOut = async () => {
    authDebugger.log('Starting sign out process');
    
    try {
      // First, clear all Supabase-related items from localStorage
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('sb-') || key.includes('supabase'))) {
          keysToRemove.push(key);
        }
      }
      
      authDebugger.log('Clearing localStorage items', { keys: keysToRemove });
      keysToRemove.forEach(key => localStorage.removeItem(key));

      // The game pick draft is not a Supabase key, so it survived sign-out and
      // stayed visible to the next person using the browser.
      localStorage.removeItem(GAME_PICK_DRAFT_STORAGE_KEY);

      // Get current session state
      const { data: { session } } = await supabase.auth.getSession();
      authDebugger.log('Current session state', { 
        hasSession: !!session,
        sessionId: session?.access_token 
      });

      // Always attempt to sign out, even if no session is found
      const { error } = await supabase.auth.signOut();
      if (error) {
        authDebugger.logError('Error during sign out', error);
        throw error;
      }

      authDebugger.log('Supabase sign out successful');

      // Clear any stored redirect paths
      clearRedirectPath();

      // Force clear the user state
      setUser(null);

      // Force a page reload to ensure clean state
      authDebugger.log('Forcing page reload for clean state');
      window.location.reload();

    } catch (error) {
      authDebugger.logError('Error during sign out process', error);
      
      // Even if there's an error, try to clean up the state
      setUser(null);
      clearRedirectPath();
      
      // Force reload even on error to ensure clean state
      window.location.reload();
      
      throw error;
    }
  };

  // Reset password
  const resetPassword = async (email: string) => {
    authDebugger.log('Attempting password reset', { email });
    
    const redirectTo = `${window.location.origin}/auth/callback?type=recovery`;
    authDebugger.log('Reset password redirect URL configured', { redirectTo });
    
    try {
      const response = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });

      if (response.error) {
        authDebugger.logError('Password reset request failed', response.error);
      } else {
        authDebugger.log('Password reset email sent successfully');
      }

      return response;
    } catch (error) {
      authDebugger.logError('Unexpected error during password reset', error);
      throw error;
    }
  };

  // Refresh session
  const refreshSession = async () => {
    authDebugger.log('Attempting session refresh');
    
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        authDebugger.logError('Error getting current session', sessionError);
        throw sessionError;
      }

      if (session) {
        const { data, error } = await supabase.auth.refreshSession();
        if (error) {
          authDebugger.logError('Session refresh failed', error);
          throw error;
        }
        authDebugger.log('Session refreshed successfully', { user: data.user });
        setUser(data.user);
      } else {
        authDebugger.log('No active session to refresh');
      }
    } catch (error) {
      authDebugger.logError('Unexpected error during session refresh', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signIn,
        signUp,
        signInWithProvider,
        signOut,
        refreshSession,
        resetPassword,
        getRedirectPath,
        clearRedirectPath,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
