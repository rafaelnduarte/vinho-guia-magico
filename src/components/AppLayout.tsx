import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAnalytics } from "@/hooks/useAnalytics";
import { useEffect, useRef } from "react";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";
import logoJovem from "@/assets/logo-jovem-do-vinho.png";

const memberLinks = [
  { to: "/", label: "Home", icon: Home },
  { to: "/curadoria", label: "Curadoria", icon: Wine },
  { to: "/sommelier", label: "Jovem AI", icon: Sparkles },
  { to: "/parceiros", label: "Parceiros", icon: Handshake },
  { to: "/selos", label: "Selos", icon: Award },
];

export default function AppLayout() {
  const { signOut, role, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { trackPageView } = useAnalytics();
  const lastTrackedPath = useRef("");

  // Track page views on route change
  useEffect(() => {
    if (location.pathname !== lastTrackedPath.current) {
      lastTrackedPath.current = location.pathname;
      trackPageView(location.pathname);

      // Update last_seen_at for current user
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

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar - desktop */}
      <aside className="hidden md:flex md:w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        <div className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border">
          <img src={logoJovem} alt="Jovem do Vinho" className="h-8 w-8" />
          <span className="font-display text-lg">Radar do Jovem</span>
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

      {/* Mobile header */}
      <div className="flex flex-col flex-1">
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-card">
          <div className="flex items-center gap-2">
            <img src={logoJovem} alt="Jovem do Vinho" className="h-7 w-7" />
            <span className="font-display text-base">Radar do Jovem</span>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </header>

        {/* Mobile nav overlay */}
        {mobileOpen && (
          <div className="md:hidden absolute inset-0 z-50 bg-background/95 backdrop-blur-sm pt-16">
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
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
