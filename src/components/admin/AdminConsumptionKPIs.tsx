import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  FunnelChart, Funnel, LabelList,
} from "recharts";
import {
  BookOpen, Clock, TrendingUp, Users, AlertTriangle, Award,
  BarChart3, Activity, Smartphone, RefreshCw, Layers, Info,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  profileMap: Record<string, string>;
  adminUserIds: Set<string>;
}

export default function AdminConsumptionKPIs({ profileMap, adminUserIds }: Props) {
  // --- Queries ---
  const { data: progressoRaw, isLoading: loadingProgresso } = useQuery({
    queryKey: ["admin-kpi-progresso"],
    queryFn: async () => {
      const { data, error } = await supabase.from("progresso").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: aulasRaw, isLoading: loadingAulas } = useQuery({
    queryKey: ["admin-kpi-aulas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("aulas").select("id, curso_id, titulo, duracao_segundos, sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: cursosRaw, isLoading: loadingCursos } = useQuery({
    queryKey: ["admin-kpi-cursos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cursos").select("id, titulo");
      if (error) throw error;
      return data ?? [];
    },
  });

  const isLoading = loadingProgresso || loadingAulas || loadingCursos;

  // Filter out admin progress
  const progresso = useMemo(() => progressoRaw ?? [], [progressoRaw]);
  const aulas = useMemo(() => aulasRaw ?? [], [aulasRaw]);
  const cursos = useMemo(() => cursosRaw ?? [], [cursosRaw]);

  // --- Maps ---
  const aulaMap = useMemo(() => {
    const m: Record<string, (typeof aulas)[0]> = {};
    aulas.forEach((a) => (m[a.id] = a));
    return m;
  }, [aulas]);

  const cursoMap = useMemo(() => {
    const m: Record<string, string> = {};
    cursos.forEach((c) => (m[c.id] = c.titulo));
    return m;
  }, [cursos]);

  const aulasByCurso = useMemo(() => {
    const m: Record<string, typeof aulas> = {};
    aulas.forEach((a) => {
      if (!m[a.curso_id]) m[a.curso_id] = [];
      m[a.curso_id].push(a);
    });
    // sort by sort_order
    Object.values(m).forEach((arr) => arr.sort((a, b) => a.sort_order - b.sort_order));
    return m;
  }, [aulas]);

  // ========================
  // KPI CALCULATIONS
  // ========================
  const kpis = useMemo(() => {
    if (!progresso.length || !aulas.length) {
      return null;
    }

    // KPI 1: Taxa de conclusão dos cursos
    // For each (user, curso): % of aulas completed. Then global average.
    const userCursoMap: Record<string, Set<string>> = {};
    progresso.forEach((p) => {
      if (!p.concluido) return;
      const key = `${p.user_id}::${p.curso_id}`;
      if (!userCursoMap[key]) userCursoMap[key] = new Set();
      userCursoMap[key].add(p.aula_id);
    });

    const completionRates: number[] = [];
    // Get unique user-curso pairs from ALL progresso (not just completed)
    const allUserCurso = new Set(progresso.map((p) => `${p.user_id}::${p.curso_id}`));
    allUserCurso.forEach((key) => {
      const [, cursoId] = key.split("::");
      const totalAulas = aulasByCurso[cursoId]?.length || 1;
      const completed = userCursoMap[key]?.size || 0;
      completionRates.push((completed / totalAulas) * 100);
    });
    const avgCourseCompletion = completionRates.length
      ? completionRates.reduce((a, b) => a + b, 0) / completionRates.length
      : 0;

    // KPI 2: Conclusão por aula — top 5 least completed
    const aulaCompletionMap: Record<string, { total: number; completed: number }> = {};
    progresso.forEach((p) => {
      if (!aulaCompletionMap[p.aula_id]) aulaCompletionMap[p.aula_id] = { total: 0, completed: 0 };
      aulaCompletionMap[p.aula_id].total++;
      if (p.concluido) aulaCompletionMap[p.aula_id].completed++;
    });
    const aulaCompletionList = Object.entries(aulaCompletionMap)
      .map(([aulaId, { total, completed }]) => ({
        aulaId,
        titulo: cleanTitle(aulaMap[aulaId]?.titulo ?? "Desconhecida"),
        curso: cursoMap[aulaMap[aulaId]?.curso_id ?? ""] ?? "",
        rate: total > 0 ? (completed / total) * 100 : 0,
        total,
        completed,
      }))
      .sort((a, b) => a.rate - b.rate);
    const leastCompleted = aulaCompletionList.slice(0, 5);

    // KPI 3 & 4: Tempo médio assistido & % médio assistido
    let totalWatched = 0;
    let percentages: number[] = [];
    progresso.forEach((p) => {
      totalWatched += p.posicao_segundos;
      const dur = aulaMap[p.aula_id]?.duracao_segundos || 0;
      if (dur > 0) {
        percentages.push(Math.min((p.posicao_segundos / dur) * 100, 100));
      }
    });
    const avgWatchedPct = percentages.length
      ? percentages.reduce((a, b) => a + b, 0) / percentages.length
      : 0;

    // KPI 5: Tempo total assistido
    const totalMinutes = totalWatched / 60;
    const totalHours = totalMinutes / 60;

    // KPI 6: Drop-off time (avg position where not completed)
    const dropOffs = progresso.filter((p) => !p.concluido && p.posicao_segundos > 0);
    const avgDropOffSeconds = dropOffs.length
      ? dropOffs.reduce((a, p) => a + p.posicao_segundos, 0) / dropOffs.length
      : 0;

    // KPI 7: Aulas com maior abandono (same as least completed — highest non-completion)
    const highestAbandonment = [...aulaCompletionList]
      .filter((a) => a.total > 0)
      .sort((a, b) => a.rate - b.rate)
      .slice(0, 5);

    // KPI 10: Heatmap de horários (bar chart by hour)
    const hourCounts = new Array(24).fill(0);
    progresso.forEach((p) => {
      const h = new Date(p.updated_at).getHours();
      hourCounts[h]++;
    });
    const heatmapData = hourCounts.map((count, hour) => ({
      hour: `${hour.toString().padStart(2, "0")}h`,
      count,
    }));

    // KPI 11: Aulas mais assistidas (by total seconds)
    const aulaWatched: Record<string, number> = {};
    progresso.forEach((p) => {
      aulaWatched[p.aula_id] = (aulaWatched[p.aula_id] || 0) + p.posicao_segundos;
    });
    const mostWatched = Object.entries(aulaWatched)
      .map(([aulaId, secs]) => ({
        titulo: cleanTitle(aulaMap[aulaId]?.titulo ?? "Desconhecida"),
        minutes: Math.round(secs / 60),
      }))
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 10);

    // KPI 12: DAU / WAU / MAU
    const now = Date.now();
    const dayMs = 86400000;
    const uniqueDay = new Set<string>();
    const uniqueWeek = new Set<string>();
    const uniqueMonth = new Set<string>();
    progresso.forEach((p) => {
      const diff = now - new Date(p.updated_at).getTime();
      if (diff <= dayMs) uniqueDay.add(p.user_id);
      if (diff <= 7 * dayMs) uniqueWeek.add(p.user_id);
      if (diff <= 30 * dayMs) uniqueMonth.add(p.user_id);
    });

    // KPI 14: Course Pace Index (avg time between consecutive lesson completions)
    const userCursoCompletions: Record<string, { sortOrder: number; completedAt: Date }[]> = {};
    progresso
      .filter((p) => p.concluido && p.concluido_at)
      .forEach((p) => {
        const key = `${p.user_id}::${p.curso_id}`;
        if (!userCursoCompletions[key]) userCursoCompletions[key] = [];
        userCursoCompletions[key].push({
          sortOrder: aulaMap[p.aula_id]?.sort_order ?? 0,
          completedAt: new Date(p.concluido_at!),
        });
      });
    const paceGaps: number[] = [];
    Object.values(userCursoCompletions).forEach((items) => {
      if (items.length < 2) return;
      items.sort((a, b) => a.sortOrder - b.sortOrder);
      for (let i = 1; i < items.length; i++) {
        const diffH = (items[i].completedAt.getTime() - items[i - 1].completedAt.getTime()) / 3600000;
        if (diffH > 0) paceGaps.push(diffH);
      }
    });
    const avgPaceHours = paceGaps.length
      ? paceGaps.reduce((a, b) => a + b, 0) / paceGaps.length
      : 0;

    // KPI 15: Funil de consumo (pick the first curso with most data)
    const cursoWithMostProgress = Object.entries(
      progresso.reduce<Record<string, number>>((acc, p) => {
        acc[p.curso_id] = (acc[p.curso_id] || 0) + 1;
        return acc;
      }, {})
    ).sort((a, b) => b[1] - a[1])[0];

    let funnelData: { name: string; value: number; fill: string }[] = [];
    if (cursoWithMostProgress) {
      const fCursoId = cursoWithMostProgress[0];
      const fAulas = (aulasByCurso[fCursoId] || []).slice(0, 5); // limit to 5 lessons for funnel
      const fProgresso = progresso.filter((p) => p.curso_id === fCursoId);
      const usersAccessed = new Set(fProgresso.map((p) => p.user_id)).size;

      const colors = ["hsl(var(--primary))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];
      funnelData = [
        { name: "Acessaram curso", value: usersAccessed, fill: colors[0] },
      ];
      fAulas.forEach((aula, i) => {
        const started = fProgresso.filter((p) => p.aula_id === aula.id).length;
        const finished = fProgresso.filter((p) => p.aula_id === aula.id && p.concluido).length;
        funnelData.push({
          name: `Iniciou "${cleanTitle(aula.titulo).slice(0, 20)}"`,
          value: started,
          fill: colors[(i * 2 + 1) % colors.length],
        });
        funnelData.push({
          name: `Concluiu "${cleanTitle(aula.titulo).slice(0, 20)}"`,
          value: finished,
          fill: colors[(i * 2 + 2) % colors.length],
        });
      });
    }

    // Detailed table per aula
    const detailedAulas = aulas.map((aula) => {
      const aulaProgress = progresso.filter((p) => p.aula_id === aula.id);
      const totalStudents = aulaProgress.length;
      const completedCount = aulaProgress.filter((p) => p.concluido).length;
      const completionRate = totalStudents > 0 ? (completedCount / totalStudents) * 100 : 0;
      const avgTime = totalStudents > 0
        ? aulaProgress.reduce((a, p) => a + p.posicao_segundos, 0) / totalStudents
        : 0;
      const dropOffAvg = aulaProgress.filter((p) => !p.concluido && p.posicao_segundos > 0);
      const avgDrop = dropOffAvg.length
        ? dropOffAvg.reduce((a, p) => a + p.posicao_segundos, 0) / dropOffAvg.length
        : 0;
      const totalMins = aulaProgress.reduce((a, p) => a + p.posicao_segundos, 0) / 60;

      return {
        id: aula.id,
        titulo: aula.titulo,
        curso: cursoMap[aula.curso_id] ?? "",
        completionRate,
        avgTimeSeconds: avgTime,
        dropOffSeconds: avgDrop,
        totalMinutes: totalMins,
        students: totalStudents,
      };
    }).filter((a) => a.students > 0)
      .sort((a, b) => b.totalMinutes - a.totalMinutes);

    return {
      avgCourseCompletion,
      leastCompleted,
      avgWatchedPct,
      totalHours,
      avgDropOffSeconds,
      highestAbandonment,
      heatmapData,
      mostWatched,
      dau: uniqueDay.size,
      wau: uniqueWeek.size,
      mau: uniqueMonth.size,
      avgPaceHours,
      funnelData,
      funnelCursoName: cursoWithMostProgress ? cursoMap[cursoWithMostProgress[0]] : null,
      detailedAulas,
    };
  }, [progresso, aulas, cursos, aulaMap, cursoMap, aulasByCurso]);

  if (isLoading) {
    return (
      <div className="space-y-4 mt-8">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!kpis) {
    return (
      <div className="mt-8 rounded-lg border border-border p-8 text-center">
        <Info className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-muted-foreground">Nenhum dado de progresso encontrado para exibir KPIs.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 mt-8">
      {/* Section heading */}
      <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
        <TrendingUp className="h-5 w-5 text-primary" />
        Indicadores de Consumo (KPIs)
      </h2>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard icon={BookOpen} label="Taxa Conclusão" value={`${kpis.avgCourseCompletion.toFixed(1)}%`} />
        <KpiCard icon={Clock} label="Tempo Total" value={`${kpis.totalHours.toFixed(1)}h`} />
        <KpiCard icon={BarChart3} label="% Médio Assistido" value={`${kpis.avgWatchedPct.toFixed(1)}%`} />
        <KpiCard icon={Users} label="DAU" value={String(kpis.dau)} />
        <KpiCard icon={Users} label="WAU" value={String(kpis.wau)} />
        <KpiCard icon={Users} label="MAU" value={String(kpis.mau)} />
      </div>

      {/* Extra metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={AlertTriangle} label="Drop-off Médio" value={formatSeconds(kpis.avgDropOffSeconds)} />
        <KpiCard icon={Activity} label="Ritmo entre Aulas" value={kpis.avgPaceHours > 0 ? `${kpis.avgPaceHours.toFixed(1)}h` : "—"} />
        <UnavailableCard icon={RefreshCw} label="Rewatch Rate" reason="Requer tracking de plays" />
        <UnavailableCard icon={Smartphone} label="Engajamento / Dispositivo" reason="Requer tracking de device" />
      </div>

      {/* Rankings */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <RankingList
          title="Aulas Menos Concluídas"
          icon={AlertTriangle}
          items={kpis.leastCompleted.map((a) => ({
            label: a.titulo,
            sub: a.curso,
            value: `${a.rate.toFixed(0)}%`,
          }))}
        />
        <RankingList
          title="Aulas Mais Assistidas"
          icon={Award}
          items={kpis.mostWatched.map((a) => ({
            label: a.titulo,
            value: `${a.minutes} min`,
          }))}
        />
        <RankingList
          title="Aulas com Maior Abandono"
          icon={AlertTriangle}
          items={kpis.highestAbandonment.map((a) => ({
            label: a.titulo,
            sub: a.curso,
            value: `${(100 - a.rate).toFixed(0)}% abandono`,
          }))}
        />
      </div>

      {/* Charts row */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Heatmap de horários */}
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="px-4 py-3 bg-muted/50 flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium text-foreground">Horários de Maior Consumo</h3>
          </div>
          <div className="p-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={kpis.heatmapData}>
                <XAxis dataKey="hour" tick={{ fontSize: 10 }} interval={2} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ fontSize: 12 }}
                  formatter={(value: number) => [`${value} atividades`, "Qtd"]}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {kpis.heatmapData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.count > 0 ? "hsl(var(--primary))" : "hsl(var(--muted))"}
                      fillOpacity={entry.count > 0 ? Math.max(0.3, Math.min(1, entry.count / Math.max(...kpis.heatmapData.map((d) => d.count)))) : 0.2}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Funil de consumo */}
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="px-4 py-3 bg-muted/50 flex items-center gap-2">
            <Layers className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium text-foreground">
              Funil de Consumo{kpis.funnelCursoName ? ` — ${kpis.funnelCursoName}` : ""}
            </h3>
          </div>
          <div className="p-4">
            {kpis.funnelData.length > 0 ? (
              <div className="space-y-2">
                {kpis.funnelData.map((step, i) => {
                  const maxVal = kpis.funnelData[0].value || 1;
                  const widthPct = Math.max(5, (step.value / maxVal) * 100);
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-44 text-xs text-muted-foreground truncate text-right">{step.name}</div>
                      <div className="flex-1 flex items-center gap-2">
                        <div
                          className="h-6 rounded bg-primary/80 flex items-center justify-end px-2 transition-all"
                          style={{ width: `${widthPct}%`, backgroundColor: step.fill }}
                        >
                          <span className="text-xs font-medium text-primary-foreground">{step.value}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-8">Sem dados suficientes para o funil.</p>
            )}
          </div>
        </div>
      </div>

      {/* Detailed table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="px-4 py-3 bg-muted/50 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium text-foreground">Detalhamento por Aula</h3>
        </div>
        <ScrollArea className="max-h-[400px]">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-left sticky top-0">
              <tr>
                <th className="px-4 py-2 font-medium">Aula</th>
                <th className="px-4 py-2 font-medium">Curso</th>
                <th className="px-4 py-2 font-medium text-right">Alunos</th>
                <th className="px-4 py-2 font-medium text-right">% Conclusão</th>
                <th className="px-4 py-2 font-medium text-right">Tempo Médio</th>
                <th className="px-4 py-2 font-medium text-right">Drop-off</th>
                <th className="px-4 py-2 font-medium text-right">Total (min)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {kpis.detailedAulas.map((a) => (
                <tr key={a.id} className="hover:bg-muted/20">
                  <td className="px-4 py-2 text-foreground max-w-[200px] truncate">{a.titulo}</td>
                  <td className="px-4 py-2 text-muted-foreground max-w-[150px] truncate">{a.curso}</td>
                  <td className="px-4 py-2 text-right text-foreground">{a.students}</td>
                  <td className="px-4 py-2 text-right">
                    <Badge variant={a.completionRate >= 70 ? "default" : a.completionRate >= 40 ? "secondary" : "destructive"}>
                      {a.completionRate.toFixed(0)}%
                    </Badge>
                  </td>
                  <td className="px-4 py-2 text-right text-muted-foreground">{formatSeconds(a.avgTimeSeconds)}</td>
                  <td className="px-4 py-2 text-right text-muted-foreground">{a.dropOffSeconds > 0 ? formatSeconds(a.dropOffSeconds) : "—"}</td>
                  <td className="px-4 py-2 text-right text-foreground">{a.totalMinutes.toFixed(1)}</td>
                </tr>
              ))}
              {kpis.detailedAulas.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Sem dados.</td>
                </tr>
              )}
            </tbody>
          </table>
        </ScrollArea>
      </div>

      {/* Unavailable KPI note */}
      <div className="rounded-lg border border-border bg-muted/20 p-4 text-xs text-muted-foreground flex items-start gap-2">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <div>
          <strong>KPIs indisponíveis:</strong> Rewatch Rate, Engajamento por Dispositivo e Sessões por Aluno requerem
          tracking adicional (contagem de plays, dados de device, session tracking) que não está implementado no schema atual.
        </div>
      </div>
    </div>
  );
}

// --- Sub-components ---

function KpiCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-2">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}

function UnavailableCard({ icon: Icon, label, reason }: { icon: any; label: string; reason: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-4 opacity-60">
      <div className="flex items-center gap-2 text-muted-foreground mb-2">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-sm text-muted-foreground">—</p>
      <p className="text-[10px] text-muted-foreground mt-1">{reason}</p>
    </div>
  );
}

function RankingList({
  title, icon: Icon, items,
}: {
  title: string;
  icon: any;
  items: Array<{ label: string; sub?: string; value: string }>;
}) {
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
              <span className="text-xs text-foreground truncate block">{item.label}</span>
              {item.sub && <span className="text-[10px] text-muted-foreground truncate block">{item.sub}</span>}
            </div>
            <Badge variant="secondary" className="text-xs shrink-0">{item.value}</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatSeconds(s: number): string {
  if (s < 60) return `${Math.round(s)}s`;
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  if (m < 60) return `${m}m${sec > 0 ? ` ${sec}s` : ""}`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `${h}h${rm > 0 ? ` ${rm}m` : ""}`;
}
