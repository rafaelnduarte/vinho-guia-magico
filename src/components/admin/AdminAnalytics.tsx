import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BarChart3, Eye, Filter, Wine, Users, Clock, Loader2 } from "lucide-react";

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
    case "7d":
      return new Date(now.getTime() - 7 * 86400000).toISOString();
    case "30d":
      return new Date(now.getTime() - 30 * 86400000).toISOString();
    case "90d":
      return new Date(now.getTime() - 90 * 86400000).toISOString();
    case "mtd":
      return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    case "all":
      return null;
  }
}

export default function AdminAnalytics() {
  const [period, setPeriod] = useState<Period>("30d");

  const { data: events, isLoading } = useQuery({
    queryKey: ["admin-analytics", period],
    queryFn: async () => {
      let query = supabase
        .from("analytics_events")
        .select("*")
        .order("created_at", { ascending: false });

      const start = getPeriodStart(period);
      if (start) {
        query = query.gte("created_at", start);
      }

      // Fetch up to 1000 events for aggregations
      const { data, error } = await query.limit(1000);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: lastAccesses } = useQuery({
    queryKey: ["admin-last-accesses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, last_seen_at")
        .not("last_seen_at", "is", null)
        .order("last_seen_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  const stats = useMemo(() => {
    if (!events) return null;

    const pageViews = events.filter((e) => e.event_type === "page_view");
    const filterEvents = events.filter((e) => e.event_type === "filter_used");
    const wineOpened = events.filter((e) => e.event_type === "wine_opened");
    const uniqueUsers = new Set(events.map((e) => e.user_id).filter(Boolean));

    // Top pages
    const pageCounts: Record<string, number> = {};
    pageViews.forEach((e) => {
      const p = e.page ?? "unknown";
      pageCounts[p] = (pageCounts[p] || 0) + 1;
    });
    const topPages = Object.entries(pageCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    // Top filters
    const filterCounts: Record<string, number> = {};
    filterEvents.forEach((e) => {
      const meta = e.metadata as any;
      const key = `${meta?.filter_name}: ${meta?.filter_value}`;
      filterCounts[key] = (filterCounts[key] || 0) + 1;
    });
    const topFilters = Object.entries(filterCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    // Top wines opened
    const wineCounts: Record<string, { name: string; count: number }> = {};
    wineOpened.forEach((e) => {
      const meta = e.metadata as any;
      const id = meta?.wine_id ?? "unknown";
      if (!wineCounts[id]) wineCounts[id] = { name: meta?.wine_name ?? id, count: 0 };
      wineCounts[id].count++;
    });
    const topWines = Object.values(wineCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalEvents: events.length,
      pageViews: pageViews.length,
      filterEvents: filterEvents.length,
      wineOpened: wineOpened.length,
      uniqueUsers: uniqueUsers.size,
      topPages,
      topFilters,
      topWines,
    };
  }, [events]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Analytics
        </h2>
        <div className="flex gap-1">
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
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : stats ? (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard icon={Eye} label="Page Views" value={stats.pageViews} />
            <KpiCard icon={Filter} label="Filtros Usados" value={stats.filterEvents} />
            <KpiCard icon={Wine} label="Vinhos Abertos" value={stats.wineOpened} />
            <KpiCard icon={Users} label="Usuários Únicos" value={stats.uniqueUsers} />
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* Top Pages */}
            <RankingCard
              title="Páginas Mais Visitadas"
              icon={Eye}
              items={stats.topPages.map(([page, count]) => ({
                label: formatPageName(page),
                value: count,
              }))}
            />

            {/* Top Filters */}
            <RankingCard
              title="Filtros Mais Usados"
              icon={Filter}
              items={stats.topFilters.map(([filter, count]) => ({
                label: filter,
                value: count,
              }))}
            />

            {/* Top Wines */}
            <RankingCard
              title="Vinhos Mais Abertos"
              icon={Wine}
              items={stats.topWines.map((w) => ({
                label: w.name,
                value: w.count,
              }))}
            />
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
                  {lastAccesses?.map((u) => (
                    <tr key={u.user_id} className="hover:bg-muted/20">
                      <td className="px-4 py-2 text-foreground">{u.full_name || u.user_id.slice(0, 8)}</td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {u.last_seen_at ? formatRelativeTime(u.last_seen_at) : "—"}
                      </td>
                    </tr>
                  ))}
                  {(!lastAccesses || lastAccesses.length === 0) && (
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
      ) : null}
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
  title,
  icon: Icon,
  items,
}: {
  title: string;
  icon: any;
  items: Array<{ label: string; value: number }>;
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
                <Badge variant="secondary" className="text-xs ml-2 shrink-0">
                  {item.value}
                </Badge>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${(item.value / maxVal) * 100}%` }}
                />
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
    "/": "Home",
    "/curadoria": "Curadoria",
    "/parceiros": "Parceiros",
    "/selos": "Selos",
    "/admin": "Admin",
    "/login": "Login",
  };
  if (map[path]) return map[path];
  if (path.startsWith("/curadoria/")) return "Detalhe Vinho";
  return path;
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
