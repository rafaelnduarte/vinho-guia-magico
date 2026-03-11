import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Stethoscope, CheckCircle2, AlertTriangle, XCircle, Loader2 } from "lucide-react";

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

export default function AdminPandaDiagnostics() {
  const [videoId, setVideoId] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DiagResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    const id = videoId.trim();
    if (!id) return;
    setLoading(true);
    setError(null);
    setResult(null);

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

  return (
    <div className="space-y-6">
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
    </div>
  );
}
