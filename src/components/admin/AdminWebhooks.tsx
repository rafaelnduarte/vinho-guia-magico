import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, Loader2, AlertTriangle, CheckCircle2, XCircle, Eye } from "lucide-react";

interface ReprocessResult {
  event_id: string;
  status: string;
  email?: string;
  reason?: string;
  event_type?: string;
  full_name?: string;
  membership_type?: string;
  can_process?: boolean;
  error?: string;
}

interface ReprocessResponse {
  status: string;
  count?: number;
  summary?: { total: number; activated: number; cancelled: number; skipped: number; errors: number };
  results: ReprocessResult[];
}

export default function AdminWebhooks() {
  const { toast } = useToast();
  const [previewData, setPreviewData] = useState<ReprocessResponse | null>(null);
  const [processedData, setProcessedData] = useState<ReprocessResponse | null>(null);

  const previewMutation = useMutation({
    mutationFn: async (): Promise<ReprocessResponse> => {
      const resp = await supabase.functions.invoke("reprocess-webhooks", {
        body: { dry_run: true },
      });
      if (resp.error) throw new Error(resp.error.message);
      return resp.data;
    },
    onSuccess: (data) => {
      setPreviewData(data);
      setProcessedData(null);
    },
    onError: (e) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const reprocessMutation = useMutation({
    mutationFn: async (): Promise<ReprocessResponse> => {
      const resp = await supabase.functions.invoke("reprocess-webhooks", {
        body: { dry_run: false },
      });
      if (resp.error) throw new Error(resp.error.message);
      return resp.data;
    },
    onSuccess: (data) => {
      setProcessedData(data);
      setPreviewData(null);
      toast({
        title: "Reprocessamento concluído",
        description: `${data.summary?.activated ?? 0} ativados, ${data.summary?.skipped ?? 0} ignorados, ${data.summary?.errors ?? 0} erros`,
      });
    },
    onError: (e) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const isLoading = previewMutation.isPending || reprocessMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Webhooks Pendentes</h2>
          <p className="text-sm text-muted-foreground">
            Reprocesse webhooks da Hubla que falharam anteriormente (no_email_found).
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => previewMutation.mutate()}
            disabled={isLoading}
            className="gap-2"
          >
            {previewMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
            Visualizar Pendentes
          </Button>
          <Button
            onClick={() => reprocessMutation.mutate()}
            disabled={isLoading || (!previewData && !processedData)}
            className="gap-2"
          >
            {reprocessMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Reprocessar Todos
          </Button>
        </div>
      </div>

      {/* Summary banner */}
      {processedData?.summary && (
        <div className="rounded-lg border border-border bg-muted/30 p-4 grid grid-cols-2 sm:grid-cols-5 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-foreground">{processedData.summary.total}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-green-600">{processedData.summary.activated}</p>
            <p className="text-xs text-muted-foreground">Ativados</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-orange-500">{processedData.summary.cancelled}</p>
            <p className="text-xs text-muted-foreground">Cancelados</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-muted-foreground">{processedData.summary.skipped}</p>
            <p className="text-xs text-muted-foreground">Ignorados</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-red-500">{processedData.summary.errors}</p>
            <p className="text-xs text-muted-foreground">Erros</p>
          </div>
        </div>
      )}

      {/* Preview / Results table */}
      {(previewData || processedData) && (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">Nome</th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">Tipo Evento</th>
                  <th className="px-4 py-3 font-medium hidden lg:table-cell">Membership</th>
                  <th className="px-4 py-3 font-medium hidden lg:table-cell">Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(previewData?.results ?? processedData?.results ?? []).map((r, i) => (
                  <tr key={r.event_id + "-" + i} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <StatusBadge result={r} isPreview={!!previewData} />
                    </td>
                    <td className="px-4 py-3 text-foreground">{r.email || "—"}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{r.full_name || "—"}</td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{r.event_type || "—"}</code>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground capitalize">{r.membership_type || "—"}</td>
                    <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground text-xs">
                      {r.reason || r.error || "—"}
                    </td>
                  </tr>
                ))}
                {(previewData?.results ?? processedData?.results ?? []).length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                      Nenhum webhook pendente encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!previewData && !processedData && !isLoading && (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <AlertTriangle className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">
            Clique em "Visualizar Pendentes" para ver os webhooks que podem ser reprocessados.
          </p>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ result, isPreview }: { result: ReprocessResult; isPreview: boolean }) {
  if (isPreview) {
    if (result.can_process) {
      return <Badge className="bg-green-600/20 text-green-600 border-green-600/30">Pronto</Badge>;
    }
    return <Badge variant="secondary">Sem email</Badge>;
  }

  switch (result.status) {
    case "activated":
      return <Badge className="bg-green-600/20 text-green-600 border-green-600/30 gap-1"><CheckCircle2 className="h-3 w-3" /> Ativado</Badge>;
    case "cancelled":
      return <Badge className="bg-orange-500/20 text-orange-500 border-orange-500/30">Cancelado</Badge>;
    case "skipped":
      return <Badge variant="secondary">Ignorado</Badge>;
    case "error":
      return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Erro</Badge>;
    default:
      return <Badge variant="outline">{result.status}</Badge>;
  }
}
