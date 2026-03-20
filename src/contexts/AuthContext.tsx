import { useEffect, useState, useRef, createContext, useContext, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

type AppRole = "admin" | "member";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  membershipLoading: boolean;
  role: AppRole | null;
  membershipActive: boolean;
  mustChangePassword: boolean;
  onboardingCompleted: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  membershipLoading: true,
  role: null,
  membershipActive: false,
  mustChangePassword: false,
  onboardingCompleted: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

// ── Session-storage cache to survive tab discards / full reloads ──
const AUTH_CACHE_KEY = "auth_cache_v1";

interface CachedAuth {
  userId: string;
  role: AppRole | null;
  membershipActive: boolean;
  mustChangePassword: boolean;
  onboardingCompleted: boolean;
}

function readCache(): CachedAuth | null {
  try {
    const raw = sessionStorage.getItem(AUTH_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCache(d: CachedAuth) {
  try {
    sessionStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(d));
  } catch {}
}

function clearCache() {
  try {
    sessionStorage.removeItem(AUTH_CACHE_KEY);
  } catch {}
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const cached = useRef(readCache());

  // If we have cached auth data, start with loading=false so ProtectedRoute
  // never shows a spinner on reload / tab restore.
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(!cached.current);
  const [role, setRole] = useState<AppRole | null>(cached.current?.role ?? null);
  const [membershipLoading, setMembershipLoading] = useState(!cached.current);
  const [membershipActive, setMembershipActive] = useState(cached.current?.membershipActive ?? false);
  const [mustChangePassword, setMustChangePassword] = useState(cached.current?.mustChangePassword ?? false);
  const [onboardingCompleted, setOnboardingCompleted] = useState(cached.current?.onboardingCompleted ?? true);

  const initialLoadDone = useRef(!!cached.current);

  const applyUserData = useCallback(
    (
      r: AppRole | null,
      active: boolean,
      mustChange: boolean,
      onboarded: boolean,
      userId: string,
    ) => {
      setRole(r);
      setMembershipActive(active);
      setMustChangePassword(mustChange);
      setOnboardingCompleted(onboarded);
      setMembershipLoading(false);
      initialLoadDone.current = true;
      writeCache({
        userId,
        role: r,
        membershipActive: active,
        mustChangePassword: mustChange,
        onboardingCompleted: onboarded,
      });
    },
    [],
  );

  const fetchUserData = useCallback(
    async (userId: string, silent: boolean) => {
      // Only show loading spinner on very first load when there's no cache
      if (!silent && !initialLoadDone.current) {
        setMembershipLoading(true);
      }

      const [roleRes, membershipRes, profileRes] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
        supabase.from("memberships").select("status").eq("user_id", userId).eq("status", "active").maybeSingle(),
        supabase.from("profiles").select("must_change_password, onboarding_completed").eq("user_id", userId).maybeSingle(),
      ]);

      const r = roleRes.data?.role ?? "member";
      const isAdmin = roleRes.data?.role === "admin";
      const active = isAdmin || !!membershipRes.data;
      const mustChange = (profileRes.data as any)?.must_change_password ?? false;
      const onboarded = (profileRes.data as any)?.onboarding_completed ?? true;

      applyUserData(r, active, mustChange, onboarded, userId);
    },
    [applyUserData],
  );

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("must_change_password, onboarding_completed")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) {
      setMustChangePassword((data as any).must_change_password ?? false);
      setOnboardingCompleted((data as any).onboarding_completed ?? true);
      // Update cache too
      const c = readCache();
      if (c && c.userId === user.id) {
        writeCache({
          ...c,
          mustChangePassword: (data as any).must_change_password ?? false,
          onboardingCompleted: (data as any).onboarding_completed ?? true,
        });
      }
    }
  }, [user]);

  useEffect(() => {
    let isMounted = true;
    let currentUserId: string | null = cached.current?.userId ?? null;

    const applySession = async (nextSession: Session | null, event?: string) => {
      if (!isMounted) return;

      const nextUser = nextSession?.user ?? null;

      // Token refresh or initial_session after we already loaded — just update session ref
      if (nextUser?.id && nextUser.id === currentUserId && initialLoadDone.current) {
        setSession(nextSession);
        setUser(nextUser);
        // Silent background revalidation — no spinners
        fetchUserData(nextUser.id, true);
        return;
      }

      setSession(nextSession);
      setUser(nextUser);
      currentUserId = nextUser?.id ?? null;

      if (nextUser) {
        await fetchUserData(nextUser.id, false);
      } else {
        // No user — clear everything
        setRole(null);
        setMembershipActive(false);
        setMustChangePassword(false);
        setOnboardingCompleted(true);
        setMembershipLoading(false);
        initialLoadDone.current = true;
        clearCache();
      }

      if (isMounted) {
        setLoading(false);
      }
    };

    supabase.auth
      .getSession()
      .then(({ data }) => applySession(data.session, "initial"))
      .catch(() => {
        if (!isMounted) return;
        setMembershipLoading(false);
        setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      void applySession(nextSession, event);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const signOut = useCallback(async () => {
    clearCache();
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
    setMembershipActive(false);
    setMustChangePassword(false);
    setOnboardingCompleted(true);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        membershipLoading,
        role,
        membershipActive,
        mustChangePassword,
        onboardingCompleted,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
