import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const PANDA_BASE = "https://api-v2.pandavideo.com.br";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } =
      await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const userId = claimsData.claims.sub;
    const { data: roleCheck } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });

    if (!roleCheck) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: corsHeaders,
      });
    }

    const { video_id } = await req.json();
    if (!video_id) {
      return new Response(
        JSON.stringify({ error: "video_id é obrigatório" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const pandaApiKey = Deno.env.get("PANDA_API_KEY");
    if (!pandaApiKey) {
      return new Response(
        JSON.stringify({ error: "PANDA_API_KEY not configured" }),
        { status: 500, headers: corsHeaders }
      );
    }

    const checks: Record<string, unknown> = {};

    // CHECK 1: Video status on Panda
    let videoData: any = null;
    try {
      const res = await fetch(`${PANDA_BASE}/videos/${video_id}`, {
        headers: { Authorization: pandaApiKey, Accept: "application/json" },
      });
      if (!res.ok) {
        checks.video_status = {
          status: "ERROR",
          code: res.status,
          message: `Panda retornou ${res.status}`,
        };
      } else {
        videoData = await res.json();
        const isComplete = videoData.status === "CONVERTED" || videoData.status === "completed";
        checks.video_status = {
          status: isComplete ? "OK" : "WARNING",
          panda_status: videoData.status,
          duration: videoData.duration ?? 0,
          title: videoData.title ?? "",
          folder_id: videoData.folder_id ?? null,
          profile_id: videoData.profile_id ?? null,
        };
      }
    } catch (e) {
      checks.video_status = { status: "ERROR", message: (e as Error).message };
    }

    // CHECK 2: Qualities / storage
    if (videoData) {
      const qualities = videoData.qualities ?? videoData.outputs ?? [];
      checks.qualities = {
        status: qualities.length > 0 ? "OK" : "WARNING",
        count: qualities.length,
        list: qualities.map((q: any) => q.quality ?? q.label ?? q.height ?? "unknown"),
      };
    }

    // CHECK 3: Supabase aula record
    const adminSupa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: aula, error: aulaErr } = await adminSupa
      .from("aulas")
      .select("id, titulo, is_published, status, curso_id")
      .eq("panda_video_id", video_id)
      .maybeSingle();

    if (aulaErr) {
      checks.supabase_aula = { status: "ERROR", message: aulaErr.message };
    } else if (!aula) {
      checks.supabase_aula = {
        status: "WARNING",
        message: "Nenhuma aula encontrada com este panda_video_id",
      };
    } else {
      checks.supabase_aula = {
        status: "OK",
        id: aula.id,
        titulo: aula.titulo,
        is_published: aula.is_published,
        aula_status: aula.status,
        curso_id: aula.curso_id,
      };
    }

    // Summary
    const issues = Object.entries(checks)
      .filter(([, v]: any) => v.status !== "OK")
      .map(([k, v]: any) => `${k}: ${v.message ?? v.panda_status ?? v.status}`);

    return new Response(
      JSON.stringify({
        video_id,
        timestamp: new Date().toISOString(),
        checks,
        issues_count: issues.length,
        issues,
        recommendation:
          issues.length === 0
            ? "Tudo OK — problema pode ser no Download Server do Panda Dashboard."
            : issues.join("; "),
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
