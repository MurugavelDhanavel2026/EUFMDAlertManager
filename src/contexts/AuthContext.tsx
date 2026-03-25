import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../config/supabase';
import type { UserProfile } from '../types/auth';
import type { AppRole } from '../config/constants';

interface AuthContextType {
  session: Session | null;
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (roles: AppRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Cache profile to avoid redundant fetches
const profileCache = new Map<string, UserProfile>();

async function fetchProfile(userId: string): Promise<UserProfile | null> {
  const cached = profileCache.get(userId);
  if (cached) return cached;

  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !data) {
      console.error('Failed to fetch user profile:', error);
      return null;
    }
    profileCache.set(userId, data as UserProfile);
    return data as UserProfile;
  } catch (err) {
    console.error('Profile fetch error:', err);
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    // Timeout to prevent infinite loading if Supabase is unreachable
    const timeout = setTimeout(() => {
      setIsLoading(false);
    }, 5000);

    // Set up auth state listener FIRST (recommended by Supabase docs)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, s) => {
        setSession(s);
        if (s?.user) {
          const profile = await fetchProfile(s.user.id);
          setUser(profile);
        } else {
          setUser(null);
        }
        setIsLoading(false);
        clearTimeout(timeout);
      }
    );

    // Then check for existing session
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      if (s?.user) {
        setSession(s);
        const profile = await fetchProfile(s.user.id);
        setUser(profile);
      }
      setIsLoading(false);
      clearTimeout(timeout);
    }).catch(() => {
      setIsLoading(false);
      clearTimeout(timeout);
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const logout = async () => {
    profileCache.clear();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setUser(null);
    setSession(null);
  };

  const hasRole = (roles: AppRole[]) => {
    if (!user) return false;
    return roles.includes(user.role);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        isLoading,
        isAuthenticated: !!session && !!user,
        login,
        logout,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
