import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Trophy, ThumbsUp, MessageSquare, Medal, Users, Wine, Target, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";
import MemberBadge from "@/components/MemberBadge";

const PERIODS = [
  { value: "week", label: "Semana" },
  { value: "month", label: "Mês" },
  { value: "year", label: "Ano" },
  { value: "all", label: "All-time" },
] as const;

type Period = (typeof PERIODS)[number]["value"];
type Section = "membros" | "vinhos";

interface RankingEntry {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  vote_count: number;
  comment_count: number;
  course_count: number;
  total_points: number;
  role: string;
  membership_type: string;
}

interface WineRankingEntry {
  wine_id: string;
  wine_name: string | null;
  wine_type: string | null;
  wine_country: string | null;
  wine_image_url: string | null;
  vote_count: number;
  comment_count: number;
  total_points: number;
}

function getBadgeType(role: string, membershipType: string): "admin" | "radar" | "comunidade" {
  if (role === "admin") return "admin";
  return membershipType === "radar" ? "radar" : "comunidade";
}

function StatusFallbackIcon({ membershipType }: { membershipType: string }) {
  const Icon = membershipType === "radar" ? Target : Wine;
  return <Icon className="h-4 w-4 text-accent" />;
}

export default function RankingPage() {
  const [period, setPeriod] = useState<Period>("month");
  const [section, setSection] = useState<Section>("membros");
  const { user } = useAuth();

  const { data: rankings, isLoading: loadingMembers } = useQuery({
    queryKey: ["rankings", period],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_rankings", { period });
      if (error) throw error;
      return (data ?? []) as RankingEntry[];
    },
  });

  const { data: wineRankings, isLoading: loadingWines } = useQuery({
    queryKey: ["wine-rankings", period],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_wine_rankings", { period });
      if (error) throw error;
      return (data ?? []) as WineRankingEntry[];
    },
  });

  const currentUserRank = rankings?.findIndex((r) => r.user_id === user?.id);
  const isLoading = section === "membros" ? loadingMembers : loadingWines;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 sm:py-8 space-y-4 sm:space-y-6">
      <div className="flex items-center gap-3">
        <Trophy className="h-7 w-7 text-accent" />
        <h1 className="text-2xl font-display">Ranking</h1>
      </div>

      <p className="text-sm text-muted-foreground">
        Cada voto e comentário vale <strong>1 ponto</strong>. Participe da curadoria e suba no ranking!
      </p>

      {/* Section toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setSection("membros")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
            section === "membros"
              ? "bg-primary text-primary-foreground"
              : "bg-muted/50 text-muted-foreground hover:bg-muted"
          )}
        >
          <Users className="h-4 w-4" />
          Membros
        </button>
        <button
          onClick={() => setSection("vinhos")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
            section === "vinhos"
              ? "bg-primary text-primary-foreground"
              : "bg-muted/50 text-muted-foreground hover:bg-muted"
          )}
        >
          <Wine className="h-4 w-4" />
          Vinhos
        </button>
      </div>

      {/* Period tabs */}
      <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
        <TabsList className="w-full grid grid-cols-4">
          {PERIODS.map((p) => (
            <TabsTrigger key={p.value} value={p.value}>
              {p.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : section === "membros" ? (
        <MembersRanking rankings={rankings ?? []} userId={user?.id} currentUserRank={currentUserRank} />
      ) : (
        <WinesRanking rankings={wineRankings ?? []} />
      )}
    </div>
  );
}

// ─── Members Ranking ───
function MembersRanking({
  rankings,
  userId,
  currentUserRank,
}: {
  rankings: RankingEntry[];
  userId?: string;
  currentUserRank?: number;
}) {
  if (!rankings.length) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Trophy className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p>Nenhuma atividade neste período.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Top 3 podium */}
      {rankings.length >= 3 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[rankings[1], rankings[0], rankings[2]].map((entry, i) => {
            const position = [2, 1, 3][i];
            const isFirst = position === 1;
            return (
              <div
                key={entry.user_id}
                className={cn(
                  "flex flex-col items-center rounded-xl border border-border bg-card p-4 transition-all",
                  isFirst && "ring-2 ring-accent -mt-2 pb-6",
                  entry.user_id === userId && "bg-primary/5"
                )}
              >
                <div className={cn(
                  "flex items-center justify-center rounded-full mb-2 font-display text-sm font-bold",
                  position === 1 && "h-8 w-8 bg-accent text-accent-foreground",
                  position === 2 && "h-7 w-7 bg-muted text-muted-foreground",
                  position === 3 && "h-7 w-7 bg-highlight/20 text-highlight"
                )}>
                  {position}
                </div>
                <Avatar className={cn("mb-2", isFirst ? "h-14 w-14" : "h-11 w-11")}>
                  <AvatarImage src={entry.avatar_url || undefined} />
                  <AvatarFallback className="bg-accent/20 border border-accent/40">
                    <StatusFallbackIcon membershipType={entry.membership_type} />
                  </AvatarFallback>
                </Avatar>
                <p className="text-sm font-medium text-foreground text-center truncate w-full">
                  {entry.full_name || "Anônimo"}
                </p>
                <MemberBadge type={getBadgeType(entry.role, entry.membership_type)} className="mt-1" />
                <p className={cn(
                  "font-display font-bold mt-1",
                  isFirst ? "text-2xl text-accent-foreground" : "text-lg text-foreground"
                )}>
                  {entry.total_points}
                </p>
                <p className="text-xs text-muted-foreground">pontos</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Full list */}
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-2 sm:px-4 py-3 font-medium w-8">#</th>
              <th className="px-2 sm:px-4 py-3 font-medium">Membro</th>
              <th className="px-1.5 sm:px-3 py-3 font-medium text-center w-10" title="Votos">
                <ThumbsUp className="h-3.5 w-3.5 mx-auto" />
              </th>
              <th className="px-1.5 sm:px-3 py-3 font-medium text-center hidden sm:table-cell" title="Comentários">
                <MessageSquare className="h-3.5 w-3.5 mx-auto" />
              </th>
              <th className="px-2 sm:px-4 py-3 font-medium text-right w-12">Pts</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rankings.map((entry, i) => {
              const isMe = entry.user_id === userId;
              return (
                <tr
                  key={entry.user_id}
                  className={cn(
                    "hover:bg-muted/30 transition-colors",
                    isMe && "bg-primary/5 font-semibold"
                  )}
                >
                  <td className="px-2 sm:px-4 py-3">
                    {i < 3 ? (
                      <Medal className={cn(
                        "h-4 w-4",
                        i === 0 && "text-accent",
                        i === 1 && "text-muted-foreground",
                        i === 2 && "text-highlight"
                      )} />
                    ) : (
                      <span className="text-muted-foreground">{i + 1}</span>
                    )}
                  </td>
                  <td className="px-2 sm:px-4 py-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar className="h-7 w-7 shrink-0">
                        <AvatarImage src={entry.avatar_url || undefined} />
                        <AvatarFallback className="bg-accent/20 border border-accent/40">
                          <StatusFallbackIcon membershipType={entry.membership_type} />
                        </AvatarFallback>
                      </Avatar>
                      <span className={cn("truncate text-xs sm:text-sm", isMe && "text-primary")}>
                        {entry.full_name || "Anônimo"}
                        {isMe && " (você)"}
                      </span>
                      <MemberBadge type={getBadgeType(entry.role, entry.membership_type)} className="shrink-0 hidden sm:inline-flex" />
                    </div>
                  </td>
                  <td className="px-1.5 sm:px-3 py-3 text-center text-muted-foreground">{entry.vote_count}</td>
                  <td className="px-1.5 sm:px-3 py-3 text-center text-muted-foreground hidden sm:table-cell">{entry.comment_count}</td>
                  <td className="px-2 sm:px-4 py-3 text-right font-display font-bold text-foreground">
                    {entry.total_points}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {currentUserRank !== undefined && currentUserRank > 9 && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-primary">#{currentUserRank + 1}</span>
            <span className="text-sm font-medium">Sua posição</span>
          </div>
          <span className="font-display font-bold text-primary">
            {rankings[currentUserRank].total_points} pts
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Wines Ranking ───
function WinesRanking({ rankings }: { rankings: WineRankingEntry[] }) {
  if (!rankings.length) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <Wine className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p>Nenhuma atividade neste período.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Top 3 podium */}
      {rankings.length >= 3 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[rankings[1], rankings[0], rankings[2]].map((entry, i) => {
            const position = [2, 1, 3][i];
            const isFirst = position === 1;
            return (
              <div
                key={entry.wine_id}
                className={cn(
                  "flex flex-col items-center rounded-xl border border-border bg-card p-4 transition-all",
                  isFirst && "ring-2 ring-accent -mt-2 pb-6"
                )}
              >
                <div className={cn(
                  "flex items-center justify-center rounded-full mb-2 font-display text-sm font-bold",
                  position === 1 && "h-8 w-8 bg-accent text-accent-foreground",
                  position === 2 && "h-7 w-7 bg-muted text-muted-foreground",
                  position === 3 && "h-7 w-7 bg-highlight/20 text-highlight"
                )}>
                  {position}
                </div>
                {entry.wine_image_url ? (
                  <img
                    src={entry.wine_image_url}
                    alt={entry.wine_name ?? ""}
                    className={cn("rounded-lg object-cover mb-2", isFirst ? "h-16 w-12" : "h-12 w-9")}
                  />
                ) : (
                  <div className={cn(
                    "rounded-lg bg-muted flex items-center justify-center mb-2",
                    isFirst ? "h-16 w-12" : "h-12 w-9"
                  )}>
                    <Wine className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <p className="text-xs font-medium text-foreground text-center truncate w-full">
                  {entry.wine_name || "Sem nome"}
                </p>
                {entry.wine_country && (
                  <p className="text-xs text-muted-foreground truncate">{entry.wine_country}</p>
                )}
                <p className={cn(
                  "font-display font-bold mt-1",
                  isFirst ? "text-2xl text-accent-foreground" : "text-lg text-foreground"
                )}>
                  {entry.total_points}
                </p>
                <p className="text-xs text-muted-foreground">pontos</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Full list */}
      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-2 sm:px-4 py-3 font-medium w-8">#</th>
              <th className="px-2 sm:px-4 py-3 font-medium">Vinho</th>
              <th className="px-1.5 sm:px-3 py-3 font-medium text-center w-10" title="Votos">
                <ThumbsUp className="h-3.5 w-3.5 mx-auto" />
              </th>
              <th className="px-1.5 sm:px-3 py-3 font-medium text-center hidden sm:table-cell" title="Comentários">
                <MessageSquare className="h-3.5 w-3.5 mx-auto" />
              </th>
              <th className="px-2 sm:px-4 py-3 font-medium text-right w-12">Pts</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rankings.map((entry, i) => (
              <tr key={entry.wine_id} className="hover:bg-muted/30 transition-colors">
                <td className="px-2 sm:px-4 py-3">
                  {i < 3 ? (
                    <Medal className={cn(
                      "h-4 w-4",
                      i === 0 && "text-accent",
                      i === 1 && "text-muted-foreground",
                      i === 2 && "text-highlight"
                    )} />
                  ) : (
                    <span className="text-muted-foreground">{i + 1}</span>
                  )}
                </td>
                <td className="px-2 sm:px-4 py-3">
                  <div className="flex items-center gap-2 min-w-0">
                    {entry.wine_image_url ? (
                      <img src={entry.wine_image_url} alt="" className="h-8 w-6 rounded object-cover shrink-0" />
                    ) : (
                      <div className="h-8 w-6 rounded bg-muted flex items-center justify-center shrink-0">
                        <Wine className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground text-xs sm:text-sm">{entry.wine_name || "Sem nome"}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {[entry.wine_type, entry.wine_country].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-1.5 sm:px-3 py-3 text-center text-muted-foreground">{entry.vote_count}</td>
                <td className="px-1.5 sm:px-3 py-3 text-center text-muted-foreground hidden sm:table-cell">{entry.comment_count}</td>
                <td className="px-2 sm:px-4 py-3 text-right font-display font-bold text-foreground">
                  {entry.total_points}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
