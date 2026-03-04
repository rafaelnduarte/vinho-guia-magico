import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAnalytics } from "@/hooks/useAnalytics";
import { useEffect, useRef, useState, useMemo } from "react";
import {
  Home,
  Wine,
  Handshake,
  Award,
  Settings,
  LogOut,
  Menu,
  X,
  Sparkles,
  User,
  Trophy,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import MemberBadge from "@/components/MemberBadge";
import logoJovem from "@/assets/logo-jovem-do-vinho.png";
import { supabase } from "@/integrations/supabase/client";

const memberLinks = [
  { to: "/", label: "Home", icon: Home },
  { to: "/curadoria", label: "Curadoria", icon: Wine },
  { to: "/ranking", label: "Ranking", icon: Trophy },
  { to: "/sommelier", label: "Jovem AI", icon: Sparkles },
  { to: "/parceiros", label: "Parceiros", icon: Handshake },
  { to: "/selos", label: "Selos", icon: Award },
];

function getBadgeType(role: string | null, membershipType: string | null): "admin" | "radar" | "comunidade" {
  if (role === "admin") return "admin";
  return membershipType === "radar" ? "radar" : "comunidade";
}

function StatusIcon({ membershipType }: { membershipType: string | null }) {
  const Icon = membershipType === "radar" ? Target : Wine;
  return <Icon className="h-5 w-5 text-accent" />;
}

export default function AppLayout() {
  const { signOut, role, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { trackPageView } = useAnalytics();
  const lastTrackedPath = useRef("");

  // User widget data
  const [profileName, setProfileName] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [membershipType, setMembershipType] = useState<string | null>(null);
  const [rankPosition, setRankPosition] = useState<number | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    const fetchData = async () => {
      const [profileRes, membershipRes, rankingRes] = await Promise.all([
        supabase.from("profiles").select("full_name, avatar_url").eq("user_id", user.id).maybeSingle(),
        supabase.from("memberships").select("membership_type").eq("user_id", user.id).eq("status", "active").maybeSingle(),
        supabase.rpc("get_rankings", { period: "month" }),
      ]);
      setProfileName(profileRes.data?.full_name ?? null);
      setAvatarUrl(profileRes.data?.avatar_url ?? null);
      setMembershipType(membershipRes.data?.membership_type ?? "comunidade");
      if (rankingRes.data) {
        const idx = (rankingRes.data as any[]).findIndex((r) => r.user_id === user.id);
        setRankPosition(idx >= 0 ? idx + 1 : null);
      }
    };
    fetchData();
  }, [user?.id]);

  // Track page views on route change
  useEffect(() => {
    if (location.pathname !== lastTrackedPath.current) {
      lastTrackedPath.current = location.pathname;
      trackPageView(location.pathname);

      if (user?.id) {
        import("@/integrations/supabase/client").then(({ supabase }) => {
          supabase
            .from("profiles")
            .update({ last_seen_at: new Date().toISOString() })
            .eq("user_id", user.id)
            .then(() => {});
        });
      }
    }
  }, [location.pathname, trackPageView, user?.id]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const firstName = profileName?.split(" ")[0] || user?.email?.split("@")[0] || "";
  const badgeType = getBadgeType(role, membershipType);

  // ─── User widget (sidebar top + mobile header) ───
  const UserWidget = ({ compact = false }: { compact?: boolean }) => (
    <div className={cn("flex items-center gap-3", compact ? "" : "px-4 py-4")}>
      <Avatar className={cn(compact ? "h-8 w-8" : "h-11 w-11")}>
        <AvatarImage src={avatarUrl || undefined} />
        <AvatarFallback className="bg-accent/20 border border-accent/40">
          <StatusIcon membershipType={membershipType} />
        </AvatarFallback>
      </Avatar>
      {!compact && (
        <div className="flex flex-col min-w-0 flex-1">
          <span className="font-display text-sm truncate">{firstName}</span>
          <div className="flex items-center gap-2 mt-0.5">
            <MemberBadge type={badgeType} className="text-[10px] px-1.5 py-0" />
            {rankPosition != null && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                <Trophy className="h-3 w-3 text-accent" />
                #{rankPosition}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col min-h-[100dvh] bg-background">
      {/* Global header */}
      <header className="sticky top-0 z-40 flex items-center justify-center px-4 h-16 bg-primary text-primary-foreground shrink-0 relative">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-white/90 p-0.5 flex items-center justify-center shrink-0">
            <img src={logoJovem} alt="Jovem do Vinho" className="h-full w-full object-contain" />
          </div>
          <span className="font-display text-xl tracking-wide">Radar do Jovem</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Mobile: compact user avatar */}
          <div className="md:hidden">
            <UserWidget compact />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden text-primary-foreground hover:bg-primary-foreground/10"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </header>

      <div className="flex flex-1 min-w-0">
        {/* Sidebar - desktop */}
        <aside className="hidden md:flex md:w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
          {/* User widget at sidebar top */}
          <div className="border-b border-sidebar-border">
            <UserWidget />
          </div>

          <nav className="flex-1 px-3 py-4 space-y-1">
            {memberLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === "/"}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-primary"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )
                }
              >
                <link.icon className="h-4 w-4" />
                {link.label}
              </NavLink>
            ))}

            {role === "admin" && (
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-primary"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )
                }
              >
                <Settings className="h-4 w-4" />
                Admin
              </NavLink>
            )}
          </nav>

          <div className="px-3 py-4 border-t border-sidebar-border">
            <NavLink
              to="/minha-conta"
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )
              }
            >
              <User className="h-4 w-4" />
              Minha Conta
            </NavLink>
            <div className="px-3 py-2 text-xs text-sidebar-foreground/50 truncate mb-2">
              {user?.email}
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors w-full"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>
          </div>
        </aside>

        {/* Mobile nav overlay */}
        {mobileOpen && (
          <div className="md:hidden fixed inset-0 z-50 bg-background/95 backdrop-blur-sm pt-12">
            <nav className="px-6 py-4 space-y-2">
              {memberLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.to === "/"}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-colors",
                      isActive ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"
                    )
                  }
                >
                  <link.icon className="h-5 w-5" />
                  {link.label}
                </NavLink>
              ))}
              {role === "admin" && (
                <NavLink
                  to="/admin"
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-colors",
                      isActive ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"
                    )
                  }
                >
                  <Settings className="h-5 w-5" />
                  Admin
                </NavLink>
              )}
              <NavLink
                to="/minha-conta"
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-colors",
                    isActive ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"
                  )
                }
              >
                <User className="h-5 w-5" />
                Minha Conta
              </NavLink>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium text-foreground hover:bg-muted w-full mt-4"
              >
                <LogOut className="h-5 w-5" />
                Sair
              </button>
            </nav>
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
