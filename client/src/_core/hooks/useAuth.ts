import { useCallback, useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath = "/auth" } = options ?? {};
  
  const [supabaseUser, setSupabaseUser] = useState<any>(null);
  const [localUser, setLocalUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Initialize Supabase auth state
  useEffect(() => {
    let mounted = true;

    async function syncUser(sessionUser: any) {
      if (!sessionUser) {
        setLocalUser(null);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('openId', sessionUser.id)
          .single();

        if (error && error.code !== 'PGRST116') throw error;

        if (data) {
          if (mounted) setLocalUser(data);
        } else {
          // Auto-create user record in DB
          const { data: newUser, error: insertError } = await supabase
            .from('users')
            .insert([{
              openId: sessionUser.id,
              email: sessionUser.email,
              loginMethod: 'supabase',
              lastSignedIn: new Date().toISOString()
            }])
            .select()
            .single();

          if (insertError) throw insertError;
          if (mounted) setLocalUser(newUser);
        }
      } catch (err: any) {
        if (mounted) setError(err);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSupabaseUser(session?.user ?? null);
      syncUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSupabaseUser(session?.user ?? null);
      syncUser(session?.user ?? null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const state = useMemo(() => {
    return {
      user: localUser,
      loading,
      error,
      isAuthenticated: Boolean(localUser),
    };
  }, [localUser, loading, error]);

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (loading) return;
    if (localUser) return;
    if (typeof window === "undefined") return;
    if (window.location.pathname === redirectPath) return;

    window.location.href = redirectPath;
  }, [redirectOnUnauthenticated, redirectPath, loading, localUser]);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    window.location.href = redirectPath;
  }, [redirectPath]);

  return {
    ...state,
    refresh: () => {}, // No op
    logout,
  };
}
