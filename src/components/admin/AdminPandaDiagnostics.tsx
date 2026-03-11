import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import {
  Stethoscope,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  RotateCcw,
  RefreshCw,
  Upload,
} from "lucide-react";

interface DiagResult {
  video_id: string;
  timestamp: string;
  checks: Record<string, any>;
  issues_count: number;
  issues: string[];
  recommendation: string;
}

const statusIcon = (status: string) => {
  if (status === "OK") return <CheckCircle2 className="h-5 w-5 text-green-500" />;
  if (status === "WARNING") return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
  return <XCircle className="h-5 w-5 text-destructive" />;
};

const statusBadge = (status: string) => {
  const variant = status === "completed" || status === "started"
    ? "default"
    : status === "failed"
    ? "destructive"
    : "secondary";
  return <Badge variant={variant}>{status}</Badge>;
};

export default function AdminPandaDiagnostics() {
  const [videoId, setVideoId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DiagResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recoveryLoading, setRecoveryLoading] = useState<string | null>(null);
  const [recoveryResult, setRecoveryResult] = useState<any>(null);
  const [reuploadUrl, setReuploadUrl] = useState("");
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupResult, setSetupResult] = useState<any>(null);
  const [setupError, setSetupError] = useState<string | null>(null);

  const runSetupWatermark = async () => {
    setSetupLoading(true);
    setSetupError(null);
    setSetupResult(null);

    const { data, error: fnErr } = await supabase.functions.invoke("setup-watermark", {
      method: "POST",
    });

    setSetupLoading(false);
    if (fnErr) {
      setSetupError(fnErr.message);
    } else {
      setSetupResult(data);
    }
  };

  // Fetch recovery logs
  const { data: recoveryLogs, refetch: refetchLogs } = useQuery({
    queryKey: ["recovery-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recovery_logs" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as any[];
    },
  });

  const run = async () => {
    const id = videoId.trim();
    if (!id) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setRecoveryResult(null);

    const { data, error: fnErr } = await supabase.functions.invoke("panda-diagnostics", {
      body: { video_id: id },
    });

    setLoading(false);
    if (fnErr) {
      setError(fnErr.message);
    } else {
      setResult(data as DiagResult);
    }
  };

  const executeRecovery = async (strategy: string) => {
    const id = videoId.trim();
    if (!id) return;

    if (strategy === "REUPLOAD" && !reuploadUrl.trim()) {
      setRecoveryResult({ success: false, error: "URL do arquivo original é obrigatória para re-upload" });
      return;
    }

    setRecoveryLoading(strategy);
    setRecoveryResult(null);

    const body: any = { video_id: id, strategy };
    if (strategy === "REUPLOAD") {
      body.file_url = reuploadUrl.trim();
      // Get folder_id and title from diagnostics if available
      const videoCheck = result?.checks?.video_status;
      if (videoCheck) {
        body.folder_id = videoCheck.folder_id;
        body.title = videoCheck.title;
      }
    }

    const { data, error: fnErr } = await supabase.functions.invoke("panda-recovery", {
      body,
    });

    setRecoveryLoading(null);
    if (fnErr) {
      setRecoveryResult({ success: false, error: fnErr.message });
    } else {
      setRecoveryResult(data);
      refetchLogs();
    }
  };

  return (
    <div className="space-y-6">
      {/* Diagnostic Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Stethoscope className="h-5 w-5" />
            Diagnóstico Panda Video
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Cole o panda_video_id aqui"
              value={videoId}
              onChange={(e) => setVideoId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && run()}
            />
            <Button onClick={run} disabled={loading || !videoId.trim()}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Diagnosticar"}
            </Button>
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {result && (
            <div className="space-y-4">
              {/* Summary */}
              <div
                className={`rounded-md p-4 text-sm ${
                  result.issues_count === 0
                    ? "bg-green-500/10 text-green-700 dark:text-green-400"
                    : "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400"
                }`}
              >
                <p className="font-medium">
                  {result.issues_count === 0
                    ? "✅ Nenhum problema detectado"
                    : `⚠️ ${result.issues_count} problema(s) detectado(s)`}
                </p>
                <p className="mt-1">{result.recommendation}</p>
              </div>

              {/* Checks */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Object.entries(result.checks).map(([key, val]: [string, any]) => (
                  <Card key={key} className="border">
                    <CardContent className="p-4 space-y-1">
                      <div className="flex items-center gap-2">
                        {statusIcon(val.status)}
                        <span className="font-medium text-sm capitalize">
                          {key.replace(/_/g, " ")}
                        </span>
                      </div>
                      {Object.entries(val)
                        .filter(([k]) => k !== "status")
                        .map(([k, v]) => (
                          <p key={k} className="text-xs text-muted-foreground">
                            <span className="font-medium">{k}:</span>{" "}
                            {Array.isArray(v) ? (v as string[]).join(", ") || "—" : String(v ?? "—")}
                          </p>
                        ))}
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Recovery Actions */}
              {result.issues_count > 0 && (
                <Card className="border-yellow-500/30">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">🔧 Ações de Recovery</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => executeRecovery("RECOVER")}
                        disabled={!!recoveryLoading}
                      >
                        {recoveryLoading === "RECOVER" ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <RotateCcw className="h-4 w-4 mr-1" />
                        )}
                        Recuperar (15-30min)
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => executeRecovery("REPROCESS")}
                        disabled={!!recoveryLoading}
                      >
                        {recoveryLoading === "REPROCESS" ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <RefreshCw className="h-4 w-4 mr-1" />
                        )}
                        Reprocessar (30-45min)
                      </Button>
                    </div>

                    <div className="flex gap-2">
                      <Input
                        placeholder="URL do arquivo original (para re-upload)"
                        value={reuploadUrl}
                        onChange={(e) => setReuploadUrl(e.target.value)}
                        className="text-xs"
                      />
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => executeRecovery("REUPLOAD")}
                        disabled={!!recoveryLoading || !reuploadUrl.trim()}
                      >
                        {recoveryLoading === "REUPLOAD" ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <Upload className="h-4 w-4 mr-1" />
                        )}
                        Re-upload
                      </Button>
                    </div>

                    {recoveryResult && (
                      <div
                        className={`rounded-md p-3 text-sm ${
                          recoveryResult.success
                            ? "bg-green-500/10 text-green-700 dark:text-green-400"
                            : "bg-destructive/10 text-destructive"
                        }`}
                      >
                        <p className="font-medium">
                          {recoveryResult.success ? "✅" : "❌"} {recoveryResult.action}:{" "}
                          {recoveryResult.message || recoveryResult.error}
                        </p>
                        {recoveryResult.new_video_id && (
                          <p className="mt-1 text-xs">
                            Novo video_id: <code>{recoveryResult.new_video_id}</code>
                          </p>
                        )}
                        {recoveryResult.eta_minutes && (
                          <p className="mt-1 text-xs">
                            ETA: ~{recoveryResult.eta_minutes} minutos
                          </p>
                        )}
                        {recoveryResult.suggestion && (
                          <p className="mt-1 text-xs opacity-75">{recoveryResult.suggestion}</p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Raw JSON */}
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  Ver JSON completo
                </summary>
                <pre className="mt-2 overflow-auto rounded-md bg-muted p-3 max-h-64">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recovery Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-lg">
            <span>📋 Histórico de Recovery</span>
            <Button size="sm" variant="ghost" onClick={() => refetchLogs()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!recoveryLogs?.length ? (
            <p className="text-sm text-muted-foreground">Nenhum log de recovery ainda.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Video ID</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Erro</TableHead>
                  <TableHead>Novo ID</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recoveryLogs.map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-mono text-xs">
                      {log.video_id?.slice(0, 12)}…
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{log.action}</Badge>
                    </TableCell>
                    <TableCell>{statusBadge(log.status)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                      {log.error_message || "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {log.new_video_id ? `${log.new_video_id.slice(0, 12)}…` : "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {new Date(log.created_at).toLocaleString("pt-BR")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
