import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function normalizeScrappy(str: string): string {
  return (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\.(mp4|mov|mkv|avi)$/g, "")
    .replace(/modulo\s*\d+/g, "")
    .replace(/\bpp\b/g, "")
    .replace(/\bparte\s*\d+/g, "")
    .replace(/\b\d+\s*-\s*/g, "")
    .replace(/\b\d+\.\s*/g, "")
    .replace(/-/g, " ")
    .replace(/_/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check — admin only
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: corsHeaders,
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: corsHeaders,
      });
    }

    const userId = claimsData.claims.sub as string;
    const { data: roleCheck } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });

    if (!roleCheck) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403, headers: corsHeaders,
      });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const PANDA_API_KEY = Deno.env.get("PANDA_API_KEY");
    if (!PANDA_API_KEY) {
      return new Response(JSON.stringify({ error: "PANDA_API_KEY not configured" }), {
        status: 500, headers: corsHeaders,
      });
    }

    const { fixes } = await req.json() as { fixes: Array<{ aula_id: string; new_video_id: string }> };

    if (!Array.isArray(fixes) || fixes.length === 0) {
      return new Response(JSON.stringify({ error: "fixes array is required" }), {
        status: 400, headers: corsHeaders,
      });
    }

    const results: Array<{
      aula_id: string;
      new_video_id: string;
      status: "success" | "error";
      message: string;
    }> = [];

    for (const fix of fixes) {
      try {
        // Validate new_video_id exists in Panda
        let res = await fetch(`https://api-v2.pandavideo.com.br/videos/${fix.new_video_id}`, {
          headers: { Authorization: `Bearer ${PANDA_API_KEY}` },
        });
        if (res.status === 401) {
          res = await fetch(`https://api-v2.pandavideo.com.br/videos/${fix.new_video_id}`, {
            headers: { Authorization: PANDA_API_KEY },
          });
        }

        if (!res.ok) {
          results.push({
            aula_id: fix.aula_id,
            new_video_id: fix.new_video_id,
            status: "error",
            message: `Video not found in Panda (HTTP ${res.status})`,
          });
          continue;
        }

        const pandaVideo = await res.json();
        const newTitle = pandaVideo.title || "";

        // Get current aula for audit log
        const { data: aula } = await adminClient
          .from("aulas")
          .select("panda_video_id, titulo")
          .eq("id", fix.aula_id)
          .maybeSingle();

        if (!aula) {
          results.push({
            aula_id: fix.aula_id,
            new_video_id: fix.new_video_id,
            status: "error",
            message: "Aula not found in database",
          });
          continue;
        }

        const oldVideoId = aula.panda_video_id;

        // Update aula
        const { error: updateErr } = await adminClient
          .from("aulas")
          .update({
            panda_video_id: fix.new_video_id,
            titulo_normalizado: normalizeScrappy(newTitle || aula.titulo),
          })
          .eq("id", fix.aula_id);

        if (updateErr) {
          results.push({
            aula_id: fix.aula_id,
            new_video_id: fix.new_video_id,
            status: "error",
            message: updateErr.message,
          });
          continue;
        }

        // Log to audit
        await adminClient.from("panda_audit_log").insert({
          aula_id: fix.aula_id,
          old_video_id: oldVideoId,
          new_video_id: fix.new_video_id,
          action: "fixed",
          result: "success",
          details: { panda_title: newTitle, fixed_by: userId },
        });

        results.push({
          aula_id: fix.aula_id,
          new_video_id: fix.new_video_id,
          status: "success",
          message: "Video ID updated successfully",
        });

        console.log(`[PANDA-FIX] ✅ ${fix.aula_id}: ${oldVideoId} → ${fix.new_video_id}`);
      } catch (err) {
        results.push({
          aula_id: fix.aula_id,
          new_video_id: fix.new_video_id,
          status: "error",
          message: (err as Error).message,
        });
      }

      // Rate limit
      await new Promise((r) => setTimeout(r, 100));
    }

    const successCount = results.filter((r) => r.status === "success").length;
    const errorCount = results.filter((r) => r.status === "error").length;

    return new Response(JSON.stringify({
      total: fixes.length,
      success_count: successCount,
      error_count: errorCount,
      results,
    }), { headers: corsHeaders });
  } catch (err) {
    console.error("[PANDA-FIX] Error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message || "Fix failed" }),
      { status: 500, headers: corsHeaders }
    );
  }
});
