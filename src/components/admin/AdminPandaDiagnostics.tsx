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
  Wrench,
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
  const [groupInfoLoading, setGroupInfoLoading] = useState(false);
  const [groupInfo, setGroupInfo] = useState<any>(null);
  const [groupInfoError, setGroupInfoError] = useState<string | null>(null);
  const [assignDrmLoading, setAssignDrmLoading] = useState(false);
  const [assignDrmResult, setAssignDrmResult] = useState<any>(null);
  const [assignAllLoading, setAssignAllLoading] = useState(false);
  const [assignAllResult, setAssignAllResult] = useState<any>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditResult, setAuditResult] = useState<any>(null);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [fixingId, setFixingId] = useState<string | null>(null);
  const [fixAllLoading, setFixAllLoading] = useState(false);
  const [fixResult, setFixResult] = useState<any>(null);

  const runAudit = async () => {
    setAuditLoading(true);
    setAuditError(null);
    setAuditResult(null);
    setFixResult(null);

    const { data, error: fnErr } = await supabase.functions.invoke("panda-audit");

    setAuditLoading(false);
    if (fnErr) {
      setAuditError(fnErr.message);
    } else {
      setAuditResult(data);
    }
  };

  const applySingleFix = async (aulaId: string, newVideoId: string) => {
    setFixingId(aulaId);
    const { data, error: fnErr } = await supabase.functions.invoke("panda-fix", {
      body: { fixes: [{ aula_id: aulaId, new_video_id: newVideoId }] },
    });
    setFixingId(null);

    if (fnErr) {
      setFixResult({ error: fnErr.message });
    } else {
      setFixResult(data);
      // Remove fixed item from audit result
      if (auditResult?.inconsistent) {
        setAuditResult({
          ...auditResult,
          inconsistent: auditResult.inconsistent.filter((i: any) => i.aula_id !== aulaId),
          summary: {
            ...auditResult.summary,
            inconsistent_count: (auditResult.summary?.inconsistent_count || 1) - 1,
          },
        });
      }
      refetchAuditLogs();
    }
  };

  const applyAllFixes = async () => {
    if (!auditResult?.inconsistent) return;

    const highConfidence = auditResult.inconsistent.filter(
      (i: any) => i.suggestion && (i.suggestion.confidence ?? 0) >= 80
    );

    if (highConfidence.length === 0) {
      setFixResult({ error: "Nenhuma sugestão com confiança ≥ 80%" });
      return;
    }

    setFixAllLoading(true);
    const fixes = highConfidence.map((i: any) => ({
      aula_id: i.aula_id,
      new_video_id: i.suggestion.panda_id,
    }));

    const { data, error: fnErr } = await supabase.functions.invoke("panda-fix", {
      body: { fixes },
    });

    setFixAllLoading(false);
    if (fnErr) {
      setFixResult({ error: fnErr.message });
    } else {
      setFixResult(data);
      // Remove fixed items
      const fixedIds = new Set(fixes.map((f: any) => f.aula_id));
      setAuditResult({
        ...auditResult,
        inconsistent: auditResult.inconsistent.filter((i: any) => !fixedIds.has(i.aula_id)),
        summary: {
          ...auditResult.summary,
          inconsistent_count: (auditResult.summary?.inconsistent_count || 0) - (data?.success_count || 0),
        },
      });
      refetchAuditLogs();
    }
  };

  // Fetch audit logs
  const { data: auditLogs, refetch: refetchAuditLogs } = useQuery({
    queryKey: ["panda-audit-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("panda_audit_log" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data as any[];
    },
  });

  const fetchGroupInfo = async () => {
    setGroupInfoLoading(true);
    setGroupInfoError(null);
    setGroupInfo(null);

    const { data, error: fnErr } = await supabase.functions.invoke("panda-diagnostics", {
      body: { action: "group_info" },
    });

    setGroupInfoLoading(false);
    if (fnErr) {
      setGroupInfoError(fnErr.message);
    } else {
      setGroupInfo(data);
    }
  };

  const assignDrm = async (vid: string) => {
    setAssignDrmLoading(true);
    setAssignDrmResult(null);

    const { data, error: fnErr } = await supabase.functions.invoke("panda-diagnostics", {
      body: { action: "assign_drm", video_id: vid },
    });

    setAssignDrmLoading(false);
    if (fnErr) {
      setAssignDrmResult({ success: false, error: fnErr.message });
    } else {
      setAssignDrmResult(data);
    }
  };

  const assignAllDrm = async () => {
    setAssignAllLoading(true);
    setAssignAllResult(null);

    const { data, error: fnErr } = await supabase.functions.invoke("panda-diagnostics", {
      body: { action: "assign_drm_all" },
    });

    setAssignAllLoading(false);
    if (fnErr) {
      setAssignAllResult({ success: false, error: fnErr.message });
    } else {
      setAssignAllResult(data);
    }
  };

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

  const highConfidenceCount = auditResult?.inconsistent?.filter(
    (i: any) => i.suggestion && (i.suggestion.confidence ?? 0) >= 80
  ).length ?? 0;

  return (
    <div className="space-y-6">
      {/* Auditoria Completa Card */}
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            📋 Auditoria Completa (Supabase ↔ Panda)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Valida todos os video_ids entre o banco de dados e a API do Panda Video.
            Identifica inconsistências, órfãos e falhas no config.json.
          </p>
          <div className="flex items-center gap-3">
            <Button onClick={runAudit} disabled={auditLoading} variant="default">
              {auditLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Stethoscope className="h-4 w-4 mr-1" />}
              {auditLoading ? "Auditando... (pode levar 1-2 min)" : "Executar Auditoria Completa"}
            </Button>
            {auditResult?.summary?.used_local_index && (
              <Badge variant="secondary">Usando índice local</Badge>
            )}
          </div>

          {auditError && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              ❌ {auditError}
            </div>
          )}

          {auditResult && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="border">
                  <CardContent className="p-3 text-center">
                    <p className="text-2xl font-bold">{auditResult.summary?.supabase_aulas_with_video ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Aulas c/ vídeo</p>
                  </CardContent>
                </Card>
                <Card className="border">
                  <CardContent className="p-3 text-center">
                    <p className="text-2xl font-bold">{auditResult.summary?.panda_total_videos ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Vídeos no Panda</p>
                  </CardContent>
                </Card>
                <Card className="border border-yellow-500/50">
                  <CardContent className="p-3 text-center">
                    <p className="text-2xl font-bold text-yellow-600">{auditResult.summary?.inconsistent_count ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Inconsistentes</p>
                  </CardContent>
                </Card>
                <Card className="border border-destructive/50">
                  <CardContent className="p-3 text-center">
                    <p className="text-2xl font-bold text-destructive">{auditResult.summary?.config_failed_count ?? 0}</p>
                    <p className="text-xs text-muted-foreground">config.json 404</p>
                  </CardContent>
                </Card>
              </div>

              {/* Fix Result */}
              {fixResult && (
                <div className={`rounded-md p-3 text-sm ${fixResult.error ? "bg-destructive/10 text-destructive" : "bg-green-500/10 text-green-700 dark:text-green-400"}`}>
                  {fixResult.error ? (
                    <p>❌ {fixResult.error}</p>
                  ) : (
                    <p>✅ {fixResult.success_count} correção(ões) aplicada(s) com sucesso. {fixResult.error_count > 0 ? `${fixResult.error_count} falha(s).` : ""}</p>
                  )}
                </div>
              )}

              {/* Inconsistent */}
              {auditResult.inconsistent?.length > 0 && (
                <Card className="border-yellow-500/30">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">⚠️ Inconsistentes ({auditResult.inconsistent.length})</CardTitle>
                      {highConfidenceCount > 0 && (
                        <Button
                          size="sm"
                          variant="default"
                          onClick={applyAllFixes}
                          disabled={fixAllLoading}
                        >
                          {fixAllLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Wrench className="h-4 w-4 mr-1" />}
                          Corrigir Todos ({highConfidenceCount} c/ confiança ≥80%)
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Aula</TableHead>
                          <TableHead>Video ID atual</TableHead>
                          <TableHead>Sugestão (fuzzy)</TableHead>
                          <TableHead>Confiança</TableHead>
                          <TableHead>Ação</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {auditResult.inconsistent.map((item: any, i: number) => (
                          <TableRow key={i}>
                            <TableCell className="text-xs max-w-[200px] truncate">{item.aula_titulo}</TableCell>
                            <TableCell className="font-mono text-xs">{item.current_video_id?.slice(0, 16)}…</TableCell>
                            <TableCell className="text-xs">
                              {item.suggestion ? (
                                <span className="text-green-600">
                                  {item.suggestion.panda_title} ({item.suggestion.panda_id?.slice(0, 12)}…)
                                </span>
                              ) : (
                                <span className="text-destructive">Nenhuma correspondência</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {item.suggestion ? (
                                <Badge variant={item.suggestion.confidence >= 80 ? "default" : item.suggestion.confidence >= 50 ? "secondary" : "destructive"}>
                                  {item.suggestion.confidence}%
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {item.suggestion ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={fixingId === item.aula_id}
                                  onClick={() => applySingleFix(item.aula_id, item.suggestion.panda_id)}
                                >
                                  {fixingId === item.aula_id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    "Aplicar"
                                  )}
                                </Button>
                              ) : null}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {/* Config Failed */}
              {auditResult.config_failed?.length > 0 && (
                <Card className="border-destructive/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">❌ config.json Falhou ({auditResult.config_failed.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Aula</TableHead>
                          <TableHead>Video ID</TableHead>
                          <TableHead>Status HTTP</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {auditResult.config_failed.map((item: any, i: number) => (
                          <TableRow key={i}>
                            <TableCell className="text-xs">{item.aula_titulo}</TableCell>
                            <TableCell className="font-mono text-xs">{item.panda_video_id?.slice(0, 16)}…</TableCell>
                            <TableCell>
                              <Badge variant="destructive">{item.config_status}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {/* Orphans */}
              {auditResult.orphans?.length > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground font-medium">
                    🔸 Órfãos no Panda ({auditResult.orphans.length} vídeos sem referência no Supabase)
                  </summary>
                  <Table className="mt-2">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Título</TableHead>
                        <TableHead>Panda ID</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditResult.orphans.map((item: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs">{item.panda_title}</TableCell>
                          <TableCell className="font-mono text-xs">{item.panda_id?.slice(0, 16)}…</TableCell>
                          <TableCell><Badge variant="secondary">{item.panda_status}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </details>
              )}

              {/* Full JSON */}
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Ver JSON completo</summary>
                <pre className="mt-2 overflow-auto rounded-md bg-muted p-3 max-h-64">{JSON.stringify(auditResult, null, 2)}</pre>
              </details>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Audit Log */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-lg">
            <span>🔧 Histórico de Correções</span>
            <Button size="sm" variant="ghost" onClick={() => refetchAuditLogs()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!auditLogs?.length ? (
            <p className="text-sm text-muted-foreground">Nenhuma correção aplicada ainda.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aula ID</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Resultado</TableHead>
                  <TableHead>Video Antigo</TableHead>
                  <TableHead>Video Novo</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLogs.map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-mono text-xs">{log.aula_id?.slice(0, 12)}…</TableCell>
                    <TableCell><Badge variant="secondary">{log.action}</Badge></TableCell>
                    <TableCell>
                      <Badge variant={log.result === "success" ? "default" : "destructive"}>{log.result}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{log.old_video_id?.slice(0, 12)}…</TableCell>
                    <TableCell className="font-mono text-xs">{log.new_video_id?.slice(0, 12)}…</TableCell>
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

      {/* Setup Watermark Card */}
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            🔐 Setup Watermark Group (DRM)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Executa uma única vez para criar o Watermark Group no Panda, habilitar DRM e gerar o Private Token.
            Os valores retornados devem ser salvos como secrets.
          </p>
          <Button onClick={runSetupWatermark} disabled={setupLoading} variant="default">
            {setupLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Stethoscope className="h-4 w-4 mr-1" />}
            Executar Setup Watermark
          </Button>

          {setupError && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              ❌ {setupError}
            </div>
          )}

          {setupResult && (
            <div className="space-y-3">
              <div className={`rounded-md p-4 text-sm ${setupResult.success ? "bg-green-500/10 text-green-700 dark:text-green-400" : "bg-destructive/10 text-destructive"}`}>
                <p className="font-medium">{setupResult.success ? "✅ Setup completo!" : "❌ Setup falhou"}</p>
              </div>
              {setupResult.group_id && (
                <div className="rounded-md bg-muted p-3 space-y-2">
                  <p className="text-xs font-medium">Copie estes valores para adicionar como secrets:</p>
                  <div className="text-xs font-mono">
                    <p><span className="font-bold">PANDA_WATERMARK_GROUP_ID:</span> {setupResult.group_id}</p>
                    <p><span className="font-bold">PANDA_WATERMARK_PRIVATE_TOKEN:</span> {setupResult.key || setupResult.private_token || "N/A"}</p>
                  </div>
                  {setupResult.next_steps && (
                    <ul className="text-xs text-muted-foreground list-disc pl-4 mt-2">
                      {setupResult.next_steps.map((s: string, i: number) => <li key={i}>{s}</li>)}
                    </ul>
                  )}
                </div>
              )}
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Ver JSON completo</summary>
                <pre className="mt-2 overflow-auto rounded-md bg-muted p-3 max-h-40">{JSON.stringify(setupResult, null, 2)}</pre>
              </details>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bulk Assign ALL to DRM Group */}
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            🔗 Associar TODOS ao DRM Group
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Associa TODOS os vídeos cadastrados nas aulas ao DRM/Watermark Group. 
            Sem esta associação, o Panda limita a reprodução a 6 segundos.
          </p>
          <Button onClick={assignAllDrm} disabled={assignAllLoading} variant="default">
            {assignAllLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Associar TODOS os vídeos ao DRM Group
          </Button>

          {assignAllResult && (
            <div className="space-y-2">
              <div className={`rounded-md p-4 text-sm ${assignAllResult.success ? "bg-green-500/10 text-green-700 dark:text-green-400" : "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400"}`}>
                <p className="font-medium">
                  {assignAllResult.success ? "✅ Todos associados com sucesso!" : `⚠️ Concluído com ${assignAllResult.failed} falha(s)`}
                </p>
                <p className="mt-1 text-xs">
                  Total: {assignAllResult.total} | Sucesso: {assignAllResult.success_count ?? assignAllResult.success} | Falhas: {assignAllResult.failed}
                </p>
              </div>
              {assignAllResult.errors?.length > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                    Ver falhas ({assignAllResult.errors.length})
                  </summary>
                  <pre className="mt-2 overflow-auto rounded-md bg-muted p-3 max-h-40">
                    {JSON.stringify(assignAllResult.errors, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* DRM Group Info Card */}
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            🔍 DRM Group Info
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Consulta o DRM Group no Panda para verificar se o grupo existe, tem secret válido e quais vídeos estão associados.
          </p>
          <Button onClick={fetchGroupInfo} disabled={groupInfoLoading} variant="outline">
            {groupInfoLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Stethoscope className="h-4 w-4 mr-1" />}
            Consultar DRM Group
          </Button>

          {groupInfoError && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              ❌ {groupInfoError}
            </div>
          )}

          {groupInfo && (
            <div className="space-y-3">
              <div className={`rounded-md p-4 text-sm ${groupInfo.error ? "bg-destructive/10 text-destructive" : "bg-green-500/10 text-green-700 dark:text-green-400"}`}>
                <p className="font-medium">{groupInfo.error ? `❌ ${groupInfo.error}` : "✅ DRM Group encontrado"}</p>
              </div>
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Ver JSON completo</summary>
                <pre className="mt-2 overflow-auto rounded-md bg-muted p-3 max-h-40">{JSON.stringify(groupInfo, null, 2)}</pre>
              </details>
            </div>
          )}
        </CardContent>
      </Card>

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

              {/* Assign to DRM Group */}
              <Card className="border-primary/30">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">🔗 Associar vídeo ao DRM Group</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Sem associação ao grupo DRM, o Panda limita a reprodução a 6 segundos.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => assignDrm(videoId.trim())}
                    disabled={assignDrmLoading || !videoId.trim()}
                  >
                    {assignDrmLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                    Assign to DRM Group
                  </Button>
                  {assignDrmResult && (
                    <div className={`rounded-md p-3 text-sm ${assignDrmResult.success ? "bg-green-500/10 text-green-700 dark:text-green-400" : "bg-destructive/10 text-destructive"}`}>
                      <p className="font-medium">{assignDrmResult.success ? "✅ Vídeo associado ao grupo DRM" : `❌ ${assignDrmResult.error}`}</p>
                      {assignDrmResult.response && (
                        <details className="text-xs mt-1">
                          <summary className="cursor-pointer">Detalhes</summary>
                          <pre className="mt-1 overflow-auto">{assignDrmResult.response}</pre>
                        </details>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

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
