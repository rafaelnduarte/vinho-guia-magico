import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Search, Loader2, MessageSquare, Trash2, ChevronLeft, ChevronRight, Wine, User, Download } from "lucide-react";
import { exportToCsv } from "@/lib/exportCsv";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const PAGE_SIZE = 30;

interface CommentRow {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  wine_id: string;
  wine_name: string | null;
  user_name: string | null;
  user_avatar: string | null;
}

export default function AdminComments() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [deleteTarget, setDeleteTarget] = useState<CommentRow | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-comments", page, searchQuery, sortOrder],
    queryFn: async () => {
      // Build query with joins via separate queries
      let query = supabase
        .from("wine_comments")
        .select("id, content, created_at, user_id, wine_id", { count: "exact" })
        .order("created_at", { ascending: sortOrder === "oldest" })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

      const { data: comments, error, count } = await query;
      if (error) throw error;

      if (!comments || comments.length === 0) {
        return { comments: [] as CommentRow[], total: count ?? 0 };
      }

      // Fetch wine names and user profiles in parallel
      const wineIds = [...new Set(comments.map((c) => c.wine_id))];
      const userIds = [...new Set(comments.map((c) => c.user_id))];

      const [winesRes, profilesRes] = await Promise.all([
        supabase.from("wines").select("id, name").in("id", wineIds),
        supabase.from("profiles").select("user_id, full_name, avatar_url").in("user_id", userIds),
      ]);

      const wineMap = new Map((winesRes.data ?? []).map((w) => [w.id, w.name]));
      const profileMap = new Map(
        (profilesRes.data ?? []).map((p) => [p.user_id, { name: p.full_name, avatar: p.avatar_url }])
      );

      const enriched: CommentRow[] = comments.map((c) => ({
        ...c,
        wine_name: wineMap.get(c.wine_id) ?? null,
        user_name: profileMap.get(c.user_id)?.name ?? null,
        user_avatar: profileMap.get(c.user_id)?.avatar ?? null,
      }));

      // Client-side search filter (applied after fetch for simplicity)
      const filtered = searchQuery
        ? enriched.filter(
            (c) =>
              c.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
              (c.wine_name ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
              (c.user_name ?? "").toLowerCase().includes(searchQuery.toLowerCase())
          )
        : enriched;

      return { comments: filtered, total: count ?? 0 };
    },
    placeholderData: (prev) => prev,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("wine_comments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-comments"] });
      toast({ title: "Comentário excluído" });
      setDeleteTarget(null);
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
    },
  });

  const comments = data?.comments ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleSearch = useCallback(() => {
    setSearchQuery(searchInput.trim());
    setPage(1);
  }, [searchInput]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <MessageSquare className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Comentários ({total})</h2>
        </div>
        <Button variant="outline" size="sm" className="gap-1 text-xs" onClick={() => {
          if (!comments.length) return;
          exportToCsv(`comentarios-${new Date().toISOString().slice(0, 10)}.csv`,
            ["Membro", "Vinho", "Comentário", "Data"],
            comments.map(c => [c.user_name || "Anônimo", c.wine_name || "", c.content, format(new Date(c.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })])
          );
        }}>
          <Download className="h-3 w-3" /> Exportar CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-2 flex-1">
          <Input
            placeholder="Buscar por conteúdo, vinho ou membro..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="flex-1"
          />
          <Button size="icon" variant="secondary" onClick={handleSearch}>
            <Search className="h-4 w-4" />
          </Button>
        </div>
        <Select value={sortOrder} onValueChange={(v) => { setSortOrder(v as "newest" | "oldest"); setPage(1); }}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Mais recentes</SelectItem>
            <SelectItem value="oldest">Mais antigos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>Nenhum comentário encontrado.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-3 py-3 font-medium">Membro</th>
                <th className="px-3 py-3 font-medium">Vinho</th>
                <th className="px-3 py-3 font-medium hidden md:table-cell">Comentário</th>
                <th className="px-3 py-3 font-medium w-32">Data</th>
                <th className="px-3 py-3 font-medium w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {comments.map((c) => (
                <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar className="h-7 w-7 shrink-0">
                        <AvatarImage src={c.user_avatar || undefined} />
                        <AvatarFallback className="bg-accent/20 border border-accent/40">
                          <User className="h-3.5 w-3.5 text-accent" />
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate text-xs sm:text-sm text-foreground">
                        {c.user_name || "Anônimo"}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Wine className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate text-xs sm:text-sm text-foreground max-w-[150px]">
                        {c.wine_name || "Sem nome"}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3 hidden md:table-cell">
                    <p className="text-xs text-muted-foreground line-clamp-2 max-w-md">{c.content}</p>
                  </td>
                  <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(c.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                  </td>
                  <td className="px-3 py-3">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(c)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile: show content below */}
          <div className="md:hidden divide-y divide-border">
            {comments.map((c) => (
              <div key={`mobile-${c.id}`} className="px-3 py-2 bg-muted/20">
                <p className="text-xs text-muted-foreground line-clamp-3">{c.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Página {page} de {totalPages}
          </span>
          <div className="flex gap-1">
            <Button size="icon" variant="outline" className="h-8 w-8" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="outline" className="h-8 w-8" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir comentário?</AlertDialogTitle>
            <AlertDialogDescription>
              Comentário de <strong>{deleteTarget?.user_name || "Anônimo"}</strong> em{" "}
              <strong>{deleteTarget?.wine_name || "vinho"}</strong> será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
