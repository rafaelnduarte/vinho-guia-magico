import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart3, Eye, Filter, Wine, Users, Clock, Loader2,
  Search, ThumbsUp, ThumbsDown, MessageSquare, User, Download,
} from "lucide-react";
import { exportToCsv } from "@/lib/exportCsv";
import AdminConsumptionKPIs from "./AdminConsumptionKPIs";

type Period = "7d" | "30d" | "90d" | "mtd" | "all";

const PERIOD_LABELS: Record<Period, string> = {
  "7d": "7 dias",
  "30d": "30 dias",
  "90d": "90 dias",
  mtd: "Mês atual",
  all: "Todo período",
};

function getPeriodStart(period: Period): string | null {
  const now = new Date();
  switch (period) {
    case "7d": return new Date(now.getTime() - 7 * 86400000).toISOString();
    case "30d": return new Date(now.getTime() - 30 * 86400000).toISOString();
    case "90d": return new Date(now.getTime() - 90 * 86400000).toISOString();
    case "mtd": return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    case "all": return null;
  }
}

export default function AdminAnalytics() {
  const [period, setPeriod] = useState<Period>("30d");
  const [searchQuery, setSearchQuery] = useState("");
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("all");
  const [pageFilter, setPageFilter] = useState<string>("all");

  // --- Fetch admin user IDs to exclude from analytics ---
  const { data: adminRoles } = useQuery({
    queryKey: ["admin-analytics-admin-ids"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
      if (error) throw error;
      return data ?? [];
    },
  });
  const adminUserIds = useMemo(() => new Set(adminRoles?.map((r) => r.user_id) ?? []), [adminRoles]);

  // --- Fetch analytics events ---
  const { data: rawEvents, isLoading } = useQuery({
    queryKey: ["admin-analytics", period],
    queryFn: async () => {
      let query = supabase
        .from("analytics_events")
        .select("*")
        .order("created_at", { ascending: false });
      const start = getPeriodStart(period);
      if (start) query = query.gte("created_at", start);
      const { data, error } = await query.limit(1000);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Exclude admin events
  const events = useMemo(() =>
    (rawEvents ?? []).filter((e) => !e.user_id || !adminUserIds.has(e.user_id)),
    [rawEvents, adminUserIds]
  );

  // --- Fetch votes (all time, filtered client-side by period) ---
  const { data: votes } = useQuery({
    queryKey: ["admin-analytics-votes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wine_votes")
        .select("*, wines(name)");
      if (error) throw error;
      return data ?? [];
    },
  });

  // --- Fetch comments ---
  const { data: comments } = useQuery({
    queryKey: ["admin-analytics-comments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wine_comments")
        .select("*, wines(name)");
      if (error) throw error;
      return data ?? [];
    },
  });

  // --- Fetch profiles for user names ---
  const { data: profiles } = useQuery({
    queryKey: ["admin-analytics-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("user_id, full_name, last_seen_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const profileMap = useMemo(() => {
    const map: Record<string, string> = {};
    profiles?.forEach((p) => { map[p.user_id] = p.full_name || p.user_id.slice(0, 8); });
    return map;
  }, [profiles]);

  const lastAccesses = useMemo(() => {
    return (profiles ?? [])
      .filter((p) => p.last_seen_at && !adminUserIds.has(p.user_id))
      .sort((a, b) => new Date(b.last_seen_at!).getTime() - new Date(a.last_seen_at!).getTime())
      .slice(0, 20);
  }, [profiles, adminUserIds]);

  // --- Period-filtered votes & comments ---
  const periodStart = getPeriodStart(period);
  const filteredVotes = useMemo(() => {
    if (!votes) return [];
    let filtered = votes.filter((v) => !adminUserIds.has(v.user_id));
    if (periodStart) filtered = filtered.filter((v) => v.created_at >= periodStart);
    return filtered;
  }, [votes, periodStart, adminUserIds]);

  const filteredComments = useMemo(() => {
    if (!comments) return [];
    let filtered = comments.filter((c) => !adminUserIds.has(c.user_id));
    if (periodStart) filtered = filtered.filter((c) => c.created_at >= periodStart);
    return filtered;
  }, [comments, periodStart, adminUserIds]);

  // --- Filtered events (search + event type + page) ---
  const filteredEvents = useMemo(() => {
    if (!events) return [];
    return events.filter((e) => {
      if (eventTypeFilter !== "all" && e.event_type !== eventTypeFilter) return false;
      if (pageFilter !== "all" && e.page !== pageFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const meta = e.metadata as any;
        const matchPage = e.page?.toLowerCase().includes(q);
        const matchType = e.event_type.toLowerCase().includes(q);
        const matchMeta = meta && JSON.stringify(meta).toLowerCase().includes(q);
        if (!matchPage && !matchType && !matchMeta) return false;
      }
      return true;
    });
  }, [events, searchQuery, eventTypeFilter, pageFilter]);

  // --- Compute aggregation stats ---
  const stats = useMemo(() => {
    const ev = filteredEvents;
    const pageViews = ev.filter((e) => e.event_type === "page_view");
    const filterEvents = ev.filter((e) => e.event_type === "filter_used");
    const wineOpened = ev.filter((e) => e.event_type === "wine_opened");
    const uniqueUsers = new Set(ev.map((e) => e.user_id).filter(Boolean));

    // Top pages
    const pageCounts: Record<string, number> = {};
    pageViews.forEach((e) => { const p = e.page ?? "unknown"; pageCounts[p] = (pageCounts[p] || 0) + 1; });
    const topPages = Object.entries(pageCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);

    // Top filters
    const filterCounts: Record<string, number> = {};
    filterEvents.forEach((e) => {
      const meta = e.metadata as any;
      const key = `${meta?.filter_name}: ${meta?.filter_value}`;
      filterCounts[key] = (filterCounts[key] || 0) + 1;
    });
    const topFilters = Object.entries(filterCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);

    // Top wines opened
    const wineCounts: Record<string, { name: string; count: number }> = {};
    wineOpened.forEach((e) => {
      const meta = e.metadata as any;
      const id = meta?.wine_id ?? "unknown";
      if (!wineCounts[id]) wineCounts[id] = { name: meta?.wine_name ?? id, count: 0 };
      wineCounts[id].count++;
    });
    const topWinesOpened = Object.values(wineCounts).sort((a, b) => b.count - a.count).slice(0, 10);

    // Votes rankings
    const likeCounts: Record<string, { name: string; count: number }> = {};
    const dislikeCounts: Record<string, { name: string; count: number }> = {};
    filteredVotes.forEach((v) => {
      const wineName = (v.wines as any)?.name ?? v.wine_id.slice(0, 8);
      if (v.vote === "up") {
        if (!likeCounts[v.wine_id]) likeCounts[v.wine_id] = { name: wineName, count: 0 };
        likeCounts[v.wine_id].count++;
      } else if (v.vote === "down") {
        if (!dislikeCounts[v.wine_id]) dislikeCounts[v.wine_id] = { name: wineName, count: 0 };
        dislikeCounts[v.wine_id].count++;
      }
    });
    const topLikes = Object.values(likeCounts).sort((a, b) => b.count - a.count).slice(0, 10);
    const topDislikes = Object.values(dislikeCounts).sort((a, b) => b.count - a.count).slice(0, 10);

    // Comments per wine
    const commentCounts: Record<string, { name: string; count: number }> = {};
    filteredComments.forEach((c) => {
      const wineName = (c.wines as any)?.name ?? c.wine_id.slice(0, 8);
      if (!commentCounts[c.wine_id]) commentCounts[c.wine_id] = { name: wineName, count: 0 };
      commentCounts[c.wine_id].count++;
    });
    const topCommentedWines = Object.values(commentCounts).sort((a, b) => b.count - a.count).slice(0, 10);

    // Top users by activity (votes + comments)
    const userActivity: Record<string, number> = {};
    filteredVotes.forEach((v) => { userActivity[v.user_id] = (userActivity[v.user_id] || 0) + 1; });
    filteredComments.forEach((c) => { userActivity[c.user_id] = (userActivity[c.user_id] || 0) + 1; });
    const topUsers = Object.entries(userActivity)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([userId, count]) => ({ label: profileMap[userId] || userId.slice(0, 8), value: count }));

    return {
      pageViews: pageViews.length,
      filterEvents: filterEvents.length,
      wineOpened: wineOpened.length,
      uniqueUsers: uniqueUsers.size,
      totalVotes: filteredVotes.length,
      totalComments: filteredComments.length,
      topPages,
      topFilters,
      topWinesOpened,
      topLikes,
      topDislikes,
      topCommentedWines,
      topUsers,
    };
  }, [filteredEvents, filteredVotes, filteredComments, profileMap]);

  // Unique values for filter dropdowns
  const allEventTypes = useMemo(() =>
    [...new Set(events?.map((e) => e.event_type) ?? [])].sort(), [events]);
  const allPages = useMemo(() =>
    [...new Set(events?.map((e) => e.page).filter(Boolean) ?? [])].sort(), [events]);

  return (
    <div className="space-y-6">
      {/* Header + Period selector */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Analytics
        </h2>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => {
            const headers = ["Tipo de Evento", "Página", "User ID", "Data", "Metadata"];
            const rows = filteredEvents.map((e) => [
              formatEventType(e.event_type),
              e.page || "",
              e.user_id ? (profileMap[e.user_id] || e.user_id.slice(0, 8)) : "",
              new Date(e.created_at).toLocaleString("pt-BR"),
              e.metadata ? JSON.stringify(e.metadata) : "",
            ]);
            exportToCsv(`analytics-${period}-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
          }}>
            <Download className="h-4 w-4" /> Exportar
          </Button>
        </div>
      </div>
      <div className="flex gap-1 flex-wrap">
        {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
          <Button
            key={p}
            variant={period === p ? "default" : "outline"}
            size="sm"
            onClick={() => setPeriod(p)}
            className="text-xs"
          >
            {PERIOD_LABELS[p]}
          </Button>
        ))}
      </div>

      {/* Filters bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar em eventos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Tipo de evento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os eventos</SelectItem>
            {allEventTypes.map((t) => (
              <SelectItem key={t} value={t}>{formatEventType(t)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={pageFilter} onValueChange={setPageFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Página" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as páginas</SelectItem>
            {allPages.map((p) => (
              <SelectItem key={p!} value={p!}>{formatPageName(p!)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <KpiCard icon={Eye} label="Page Views" value={stats.pageViews} />
            <KpiCard icon={Filter} label="Filtros Usados" value={stats.filterEvents} />
            <KpiCard icon={Wine} label="Vinhos Abertos" value={stats.wineOpened} />
            <KpiCard icon={Users} label="Usuários Únicos" value={stats.uniqueUsers} />
            <KpiCard icon={ThumbsUp} label="Total Votos" value={stats.totalVotes} />
            <KpiCard icon={MessageSquare} label="Total Comentários" value={stats.totalComments} />
          </div>

          {/* Rankings Row 1 */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <RankingCard title="Páginas Mais Visitadas" icon={Eye}
              items={stats.topPages.map(([page, count]) => ({ label: formatPageName(page), value: count }))} />
            <RankingCard title="Filtros Mais Usados" icon={Filter}
              items={stats.topFilters.map(([filter, count]) => ({ label: filter, value: count }))} />
            <RankingCard title="Vinhos Mais Abertos" icon={Wine}
              items={stats.topWinesOpened.map((w) => ({ label: w.name, value: w.count }))} />
          </div>

          {/* Rankings Row 2 */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <RankingCard title="Mais Curtidos" icon={ThumbsUp}
              items={stats.topLikes.map((w) => ({ label: w.name, value: w.count }))} />
            <RankingCard title="Mais Dislikes" icon={ThumbsDown}
              items={stats.topDislikes.map((w) => ({ label: w.name, value: w.count }))} />
            <RankingCard title="Mais Comentados" icon={MessageSquare}
              items={stats.topCommentedWines.map((w) => ({ label: w.name, value: w.count }))} />
            <RankingCard title="Usuários Mais Ativos" icon={User}
              items={stats.topUsers} />
          </div>

          {/* Last Accesses */}
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="px-4 py-3 bg-muted/50 flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-medium text-foreground">Últimos Acessos</h3>
            </div>
            <ScrollArea className="max-h-[300px]">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-left">
                  <tr>
                    <th className="px-4 py-2 font-medium">Usuário</th>
                    <th className="px-4 py-2 font-medium">Último acesso</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {lastAccesses.map((u) => (
                    <tr key={u.user_id} className="hover:bg-muted/20">
                      <td className="px-4 py-2 text-foreground">{u.full_name || u.user_id.slice(0, 8)}</td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {u.last_seen_at ? formatRelativeTime(u.last_seen_at) : "—"}
                      </td>
                    </tr>
                  ))}
                  {lastAccesses.length === 0 && (
                    <tr>
                      <td colSpan={2} className="px-4 py-8 text-center text-muted-foreground">
                        Nenhum acesso registrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </ScrollArea>
          </div>
        </>
      )}
    </div>
  );
}

// --- Sub-components ---

function KpiCard({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-2">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold text-foreground">{value.toLocaleString("pt-BR")}</p>
    </div>
  );
}

function RankingCard({
  title, icon: Icon, items,
}: {
  title: string; icon: any; items: Array<{ label: string; value: number }>;
}) {
  const maxVal = items[0]?.value ?? 1;
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <div className="px-4 py-3 bg-muted/50 flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
      </div>
      <div className="p-3 space-y-2">
        {items.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">Sem dados ainda.</p>
        )}
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-5 text-right">{i + 1}.</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-xs text-foreground truncate">{item.label}</span>
                <Badge variant="secondary" className="text-xs ml-2 shrink-0">{item.value}</Badge>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${(item.value / maxVal) * 100}%` }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatPageName(path: string): string {
  const map: Record<string, string> = {
    "/": "Home", "/curadoria": "Curadoria", "/parceiros": "Parceiros",
    "/selos": "Selos", "/admin": "Admin", "/login": "Login",
  };
  if (map[path]) return map[path];
  if (path.startsWith("/curadoria/")) return "Detalhe Vinho";
  return path;
}

function formatEventType(type: string): string {
  const map: Record<string, string> = {
    page_view: "Page View",
    filter_used: "Filtro Usado",
    wine_opened: "Vinho Aberto",
  };
  return map[type] || type;
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `${mins}min atrás`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "ontem";
  return `${days} dias atrás`;
}
