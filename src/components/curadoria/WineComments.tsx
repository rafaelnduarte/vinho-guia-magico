import { useState } from "react";
import { Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface WineCommentsProps {
  wineId: string;
}

export default function WineComments({ wineId }: WineCommentsProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [content, setContent] = useState("");

  const { data: comments, isLoading } = useQuery({
    queryKey: ["wine-comments", wineId],
    queryFn: async () => {
      const { data } = await supabase
        .from("wine_comments")
        .select("*")
        .eq("wine_id", wineId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  // Fetch profile names for comment authors
  const userIds = [...new Set(comments?.map((c) => c.user_id) ?? [])];
  const { data: profiles } = useQuery({
    queryKey: ["profiles-for-comments", userIds],
    queryFn: async () => {
      if (userIds.length === 0) return [];
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);
      return data ?? [];
    },
    enabled: userIds.length > 0,
  });

  const profileMap = new Map(profiles?.map((p) => [p.user_id, p.full_name]) ?? []);

  const addComment = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("wine_comments").insert({
        wine_id: wineId,
        user_id: user!.id,
        content: content.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setContent("");
      queryClient.invalidateQueries({ queryKey: ["wine-comments", wineId] });
    },
    onError: () => toast({ title: "Erro ao comentar", variant: "destructive" }),
  });

  const deleteComment = useMutation({
    mutationFn: async (commentId: string) => {
      await supabase.from("wine_comments").delete().eq("id", commentId);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["wine-comments", wineId] }),
  });

  return (
    <div className="space-y-4">
      {/* Input */}
      <div className="flex gap-2">
        <Textarea
          placeholder="Deixe sua percepção sobre este vinho..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="min-h-[60px] resize-none"
        />
        <Button
          size="icon"
          disabled={!content.trim() || addComment.isPending}
          onClick={() => addComment.mutate()}
          className="shrink-0 self-end"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>

      {/* List */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : comments && comments.length > 0 ? (
        <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
          {comments.map((c) => (
            <div key={c.id} className="rounded-lg border border-border bg-muted/30 p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-foreground">
                  {profileMap.get(c.user_id) ?? "Membro"}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: ptBR })}
                  </span>
                  {c.user_id === user?.id && (
                    <button
                      onClick={() => deleteComment.mutate(c.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{c.content}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-4">
          Nenhum comentário ainda. Seja o primeiro!
        </p>
      )}
    </div>
  );
}
