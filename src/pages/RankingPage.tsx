import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Trophy, ThumbsUp, MessageSquare, Medal } from "lucide-react";
import { cn } from "@/lib/utils";

const PERIODS = [
  { value: "week", label: "Semana" },
  { value: "month", label: "Mês" },
  { value: "year", label: "Ano" },
  { value: "all", label: "All-time" },
] as const;

type Period = (typeof PERIODS)[number]["value"];

interface RankingEntry {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  vote_count: number;
  comment_count: number;
  total_points: number;
}

export default function RankingPage() {
  const [period, setPeriod] = useState<Period>("month");
  const { user } = useAuth();

  const { data: rankings, isLoading } = useQuery({
    queryKey: ["rankings", period],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_rankings", { period });
      if (error) throw error;
      return (data ?? []) as RankingEntry[];
    },
  });

  const currentUserRank = rankings?.findIndex((r) => r.user_id === user?.id);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Trophy className="h-7 w-7 text-accent" />
        <h1 className="text-2xl font-display">Ranking</h1>
      </div>

      <p className="text-sm text-muted-foreground">
        Cada voto e comentário vale <strong>1 ponto</strong>. Participe da curadoria e suba no ranking!
      </p>

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
      ) : !rankings?.length ? (
        <div className="text-center py-16 text-muted-foreground">
          <Trophy className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>Nenhuma atividade neste período.</p>
        </div>
      ) : (
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
                      entry.user_id === user?.id && "bg-primary/5"
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
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                        {getInitials(entry.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <p className="text-sm font-medium text-foreground text-center truncate w-full">
                      {entry.full_name || "Anônimo"}
                    </p>
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
                  <th className="px-4 py-3 font-medium w-12">#</th>
                  <th className="px-4 py-3 font-medium">Membro</th>
                  <th className="px-3 py-3 font-medium text-center" title="Votos">
                    <ThumbsUp className="h-3.5 w-3.5 mx-auto" />
                  </th>
                  <th className="px-3 py-3 font-medium text-center" title="Comentários">
                    <MessageSquare className="h-3.5 w-3.5 mx-auto" />
                  </th>
                  <th className="px-4 py-3 font-medium text-right">Pontos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rankings.map((entry, i) => {
                  const isMe = entry.user_id === user?.id;
                  return (
                    <tr
                      key={entry.user_id}
                      className={cn(
                        "hover:bg-muted/30 transition-colors",
                        isMe && "bg-primary/5 font-semibold"
                      )}
                    >
                      <td className="px-4 py-3">
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
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={entry.avatar_url || undefined} />
                            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                              {getInitials(entry.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className={cn("truncate", isMe && "text-primary")}>
                            {entry.full_name || "Anônimo"}
                            {isMe && " (você)"}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center text-muted-foreground">{entry.vote_count}</td>
                      <td className="px-3 py-3 text-center text-muted-foreground">{entry.comment_count}</td>
                      <td className="px-4 py-3 text-right font-display font-bold text-foreground">
                        {entry.total_points}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Current user position if not in top */}
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
      )}
    </div>
  );
}

function getInitials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
