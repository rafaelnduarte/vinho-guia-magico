import { ThumbsUp, ThumbsDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface WineVotingProps {
  wineId: string;
}

export default function WineVoting({ wineId }: WineVotingProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: votes } = useQuery({
    queryKey: ["wine-votes", wineId],
    queryFn: async () => {
      const { data } = await supabase
        .from("wine_votes")
        .select("vote, user_id")
        .eq("wine_id", wineId);
      return data ?? [];
    },
  });

  const recommend = votes?.filter((v) => v.vote === "recommend").length ?? 0;
  const notRecommend = votes?.filter((v) => v.vote === "not_recommend").length ?? 0;
  const myVote = votes?.find((v) => v.user_id === user?.id)?.vote;

  const voteMutation = useMutation({
    mutationFn: async (vote: "recommend" | "not_recommend") => {
      if (myVote === vote) {
        await supabase.from("wine_votes").delete().eq("wine_id", wineId).eq("user_id", user!.id);
      } else if (myVote) {
        await supabase.from("wine_votes").update({ vote }).eq("wine_id", wineId).eq("user_id", user!.id);
      } else {
        await supabase.from("wine_votes").insert({ wine_id: wineId, user_id: user!.id, vote });
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["wine-votes", wineId] }),
    onError: () => toast({ title: "Erro ao votar", variant: "destructive" }),
  });

  return (
    <div className="flex items-center gap-3">
      <Button
        variant={myVote === "recommend" ? "default" : "outline"}
        size="sm"
        className="gap-1.5"
        onClick={() => voteMutation.mutate("recommend")}
      >
        <ThumbsUp className="h-4 w-4" />
        <span>{recommend}</span>
      </Button>
      <Button
        variant={myVote === "not_recommend" ? "destructive" : "outline"}
        size="sm"
        className="gap-1.5"
        onClick={() => voteMutation.mutate("not_recommend")}
      >
        <ThumbsDown className="h-4 w-4" />
        <span>{notRecommend}</span>
      </Button>
    </div>
  );
}
