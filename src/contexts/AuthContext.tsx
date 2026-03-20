import { useEffect, useState, useRef, createContext, useContext } from "react";
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<AppRole | null>(null);
  const [membershipLoading, setMembershipLoading] = useState(true);
  const [membershipActive, setMembershipActive] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [onboardingCompleted, setOnboardingCompleted] = useState(true);
  const initialLoadDone = useRef(false);

  const fetchUserData = async (userId: string) => {
    // Only show loading spinner on very first load — never after that
    if (!initialLoadDone.current) {
      setMembershipLoading(true);
    }
    const [roleRes, membershipRes, profileRes] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
      supabase.from("memberships").select("status").eq("user_id", userId).eq("status", "active").maybeSingle(),
      supabase.from("profiles").select("must_change_password, onboarding_completed").eq("user_id", userId).maybeSingle(),
    ]);
    setRole(roleRes.data?.role ?? "member");
    const isAdmin = roleRes.data?.role === "admin";
    setMembershipActive(isAdmin || !!membershipRes.data);
    setMustChangePassword((profileRes.data as any)?.must_change_password ?? false);
    setOnboardingCompleted((profileRes.data as any)?.onboarding_completed ?? true);
    setMembershipLoading(false);
    initialLoadDone.current = true;
  };

  const refreshProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("must_change_password, onboarding_completed")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) {
      setMustChangePassword((data as any).must_change_password ?? false);
      setOnboardingCompleted((data as any).onboarding_completed ?? true);
    }
  };

  useEffect(() => {
    let isMounted = true;
    let currentUserId: string | null = null;

    const applySession = async (nextSession: Session | null, event?: string) => {
      if (!isMounted) return;

      const nextUser = nextSession?.user ?? null;

      // Token refresh or initial_session after we already loaded — just update session ref
      if (nextUser?.id && nextUser.id === currentUserId && initialLoadDone.current) {
        setSession(nextSession);
        return;
      }

      setSession(nextSession);
      setUser(nextUser);
      currentUserId = nextUser?.id ?? null;

      if (nextUser) {
        await fetchUserData(nextUser.id);
      } else {
        setRole(null);
        setMembershipActive(false);
        setMustChangePassword(false);
        setOnboardingCompleted(true);
        setMembershipLoading(false);
        initialLoadDone.current = true;
      }

      if (isMounted) {
        setLoading(false);
      }
    };

    supabase.auth.getSession()
      .then(({ data }) => applySession(data.session, "initial"))
      .catch(() => {
        if (!isMounted) return;
        setMembershipLoading(false);
        setLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, nextSession) => {
        // TOKEN_REFRESHED is the main event that fires on tab switch — skip heavy work
        const isTokenRefresh = event === "TOKEN_REFRESHED";
        void applySession(nextSession, isTokenRefresh);
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
    setMembershipActive(false);
    setMustChangePassword(false);
    setOnboardingCompleted(true);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, membershipLoading, role, membershipActive, mustChangePassword, onboardingCompleted, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
