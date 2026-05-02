'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';
import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import { getBrowserSupabase, hasBrowserSupabaseEnv } from '@/lib/auth/client';
import {
  bootstrapProfile,
  getProfile,
  UserProfile
} from '@/lib/client/api';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  refreshProfile: () => Promise<UserProfile | null>;
  syncProfileFromSession: () => Promise<UserProfile | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const hydrateProfile = useCallback(
    async (nextSession: Session | null) => {
      setSession(nextSession);

      if (!nextSession?.user) {
        setProfile(null);
        return;
      }

      const displayName =
        readString(nextSession.user.user_metadata?.display_name) ??
        readString(nextSession.user.user_metadata?.name) ??
        nextSession.user.email?.split('@')[0] ??
        '冒险者';

      await bootstrapProfile({
        userId: nextSession.user.id,
        displayName,
        metadata: {
          authProvider: nextSession.user.app_metadata?.provider ?? 'email',
          email: nextSession.user.email ?? null
        }
      });

      const nextProfile = await getProfile(nextSession.user.id);
      setProfile(nextProfile);
    },
    []
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!hasBrowserSupabaseEnv()) {
      console.warn('[auth] 未配置浏览器端 Supabase 环境变量，认证能力不可用');
      setLoading(false);
      return;
    }

    try {
      setSupabase(getBrowserSupabase());
    } catch (err) {
      console.warn('[auth] 浏览器端 Supabase 客户端初始化失败:', err);
      setLoading(false);
    }
  }, []);

  const refreshProfile = useCallback(async (): Promise<UserProfile | null> => {
    const currentUserId = session?.user.id;
    if (!currentUserId) {
      setProfile(null);
      return null;
    }

    const nextProfile = await getProfile(currentUserId);
    setProfile(nextProfile);
    return nextProfile;
  }, [session?.user.id]);

  const syncProfileFromSession = useCallback(async (): Promise<UserProfile | null> => {
    const currentUser = session?.user;
    if (!currentUser) {
      setProfile(null);
      return null;
    }

    const displayName =
      readString(currentUser.user_metadata?.display_name) ??
      readString(currentUser.user_metadata?.name) ??
      currentUser.email?.split('@')[0] ??
      '冒险者';

    await bootstrapProfile({
      userId: currentUser.id,
      displayName,
      metadata: {
        authProvider: currentUser.app_metadata?.provider ?? 'email',
        email: currentUser.email ?? null
      }
    });

    const nextProfile = await getProfile(currentUser.id);
    setProfile(nextProfile);
    return nextProfile;
  }, [session?.user]);

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;
    const watchdog = window.setTimeout(() => {
      if (!mounted) return;
      console.warn('[auth] 初始化超时，使用无阻塞兜底状态继续渲染');
      setLoading(false);
    }, 4000);

    const initialize = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!mounted) return;

        if (error) {
          console.warn('[auth] getSession 失败:', error);
        }

        await hydrateProfile(data.session ?? null);
      } catch (err) {
        console.warn('[auth] 初始化失败，降级为空会话:', err);
        if (mounted) {
          setSession(null);
          setProfile(null);
        }
      } finally {
        window.clearTimeout(watchdog);
        if (mounted) setLoading(false);
      }
    };

    void initialize();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (!mounted) return;
      try {
        await hydrateProfile(nextSession);
      } catch (err) {
        console.warn('[auth] onAuthStateChange 同步失败:', err);
        if (mounted && !nextSession) {
          setProfile(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    });

    return () => {
      mounted = false;
      window.clearTimeout(watchdog);
      subscription.unsubscribe();
    };
  }, [supabase, hydrateProfile]);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }
    setProfile(null);
    setSession(null);
  }, [supabase]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      refreshProfile,
      syncProfileFromSession,
      signOut
    }),
    [session, profile, loading, refreshProfile, syncProfileFromSession, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('[auth] useAuth 必须在 AuthProvider 内使用');
  }
  return context;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
