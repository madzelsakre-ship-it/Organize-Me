import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/api/supabaseClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    let mounted = true;

    // Récupérer la session actuelle
    supabase.auth.getSession()
      .then(({ data, error }) => {
        if (!mounted) return;

        if (error) {
          throw error;
        }

        setUser(data?.session?.user || null);
      })
      .catch((error) => {
        if (mounted) {
          setAuthError({
            type: 'unknown',
            message: error.message,
          });
        }
      })
      .finally(() => {
        if (mounted) {
          setIsLoadingAuth(false);
        }
      });

    // Écouter les changements de connexion
    const {
      data: listener,
    } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!mounted) return;

        setUser(session?.user || null);
        setIsLoadingAuth(false);
      }
    );

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  // =========================
  // INSCRIPTION
  // =========================
  const signUp = async (email, password) => {
    setAuthError(null);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setAuthError({
        type: 'unknown',
        message: error.message,
      });

      throw error;
    }

    return data;
  };

  // =========================
  // CONNEXION
  // =========================
  const login = async (email, password) => {
    setAuthError(null);

    const { data, error } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (error) {
      setAuthError({
        type: 'unknown',
        message: error.message,
      });

      throw error;
    }

    setUser(data.user);

    return data;
  };

  // =========================
  // GOOGLE
  // =========================
  const loginWithGoogle = async () => {
    setAuthError(null);

    const { error } =
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });

    if (error) {
      setAuthError({
        type: 'unknown',
        message: error.message,
      });

      throw error;
    }
  };

  // =========================
  // DÉCONNEXION
  // =========================
  const logout = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw error;
    }

    setUser(null);
  };

  const value = {
    user,
    currentUser: user,

    isAuthenticated: Boolean(user),

    isLoadingAuth,
    isLoadingPublicSettings: false,

    authError,

    signUp,
    login,
    loginWithGoogle,
    logout,

    navigateToLogin: loginWithGoogle,

    checkAppState: () =>
      supabase.auth.getUser(),
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      'useAuth doit être utilisé dans AuthProvider.'
    );
  }

  return context;
}