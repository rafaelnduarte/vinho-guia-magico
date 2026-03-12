import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const PANDA_BASE = "https://api-v2.pandavideo.com.br";
const PANDA_V1 = "https://api-v2.pandavideo.com.br";

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

    const body = await req.json();
    const { video_id, action } = body;

    const PANDA_API_KEY = Deno.env.get("PANDA_API_KEY")!;

    // Helper: assign a single video to DRM group
    // Helper: assign video(s) to watermark group
    // Try v1 watermark endpoint first, then v2 /drm/videos/ fallback
    const assignVideosToGroup = async (videoIds: string[], groupId: string, apiKey: string): Promise<{ success: boolean; error?: string }> => {
      const urls = [
        `${PANDA_V1}/watermark/groups/${groupId}`,
        `${PANDA_BASE}/drm/videos/${groupId}`,
      ];
      for (const url of urls) {
        for (const auth of [`Bearer ${apiKey}`, apiKey]) {
          const res = await fetch(url, {
            method: "PUT",
            headers: { "Authorization": auth, "Content-Type": "application/json" },
            body: JSON.stringify({ video_ids: videoIds }),
          });
          if (res.ok) {
            console.log(`[PANDA-DIAG] assign PUT success via ${url}`);
            return { success: true };
          }
          const errText = await res.text();
          console.warn(`[PANDA-DIAG] assign PUT failed (${url}, ${auth.startsWith("Bearer") ? "Bearer" : "raw"}): ${res.status} ${errText.substring(0, 300)}`);
          if (res.status !== 401 && res.status !== 403) {
            // Non-auth error, try next URL
            break;
          }
        }
      }
      return { success: false, error: "All endpoints failed" };
    };

    // Handle assign_drm action — associate single video with DRM group
    if (action === "assign_drm") {
      const vid = body.video_id;
      const groupId = Deno.env.get("PANDA_WATERMARK_GROUP_ID");
      if (!vid || !groupId) {
        return new Response(JSON.stringify({ success: false, error: "video_id and PANDA_WATERMARK_GROUP_ID required" }), { status: 200, headers: corsHeaders });
      }

      console.log(`[PANDA-DIAG] Assigning video ${vid} to DRM group ${groupId}`);
      const result = await assignVideosToGroup([vid], groupId, PANDA_API_KEY);
      return new Response(JSON.stringify({ ...result, video_id: vid, group_id: groupId }), { status: 200, headers: corsHeaders });
    }

    // Handle assign_drm_all — bulk associate ALL aulas videos to DRM group
    if (action === "assign_drm_all") {
      const groupId = Deno.env.get("PANDA_WATERMARK_GROUP_ID");
      if (!groupId) {
        return new Response(JSON.stringify({ success: false, error: "PANDA_WATERMARK_GROUP_ID not configured" }), { status: 200, headers: corsHeaders });
      }

      const adminSupa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: aulas, error: aulasErr } = await adminSupa
        .from("aulas")
        .select("panda_video_id, titulo")
        .not("panda_video_id", "is", null);

      if (aulasErr || !aulas?.length) {
        return new Response(JSON.stringify({ success: false, error: aulasErr?.message || "No aulas with panda_video_id found", total: 0 }), { status: 200, headers: corsHeaders });
      }

      const uniqueIds = [...new Set(aulas.map((a: any) => a.panda_video_id).filter(Boolean))] as string[];
      console.log(`[PANDA-DIAG] assign_drm_all: ${uniqueIds.length} unique videos to group ${groupId}`);

      // Send all video_ids in a single PUT request
      const result = await assignVideosToGroup(uniqueIds, groupId, PANDA_API_KEY);

      console.log(`[PANDA-DIAG] assign_drm_all result: ${result.success ? "SUCCESS" : "FAILED"}`);
      return new Response(JSON.stringify({
        success: result.success,
        total: uniqueIds.length,
        error: result.error || undefined,
      }), { status: 200, headers: corsHeaders });
    }

    // Handle group_info action
    if (action === "group_info") {
      const groupId = Deno.env.get("PANDA_WATERMARK_GROUP_ID");
      if (!groupId) {
        return new Response(JSON.stringify({ error: "PANDA_WATERMARK_GROUP_ID not configured" }), { status: 200, headers: corsHeaders });
      }

      // Try v1 watermark endpoint first, then v2
      const urls = [
        `${PANDA_V1}/watermark/groups/${groupId}`,
        `${PANDA_BASE}/drm/videos/${groupId}`,
      ];

      for (const url of urls) {
        for (const auth of [`Bearer ${PANDA_API_KEY}`, PANDA_API_KEY]) {
          try {
            const res = await fetch(url, {
              method: "GET",
              headers: { "Authorization": auth, "Content-Type": "application/json" },
            });

            if (!res.ok) continue;

            const resText = await res.text();
            try {
              const groupData = JSON.parse(resText);
              return new Response(JSON.stringify({
                group_id: groupId,
                endpoint_used: url,
                name: groupData.name,
                active: groupData.active,
                has_secret: !!groupData.secret,
                secret_preview: groupData.secret ? groupData.secret.substring(0, 8) + "..." : null,
                video_count: groupData.videos?.length || groupData.video_ids?.length || 0,
                videos: (groupData.videos || groupData.video_ids || []).slice(0, 10).map((v: any) => typeof v === 'string' ? { id: v } : { id: v.id || v, title: v.title }),
                raw_keys: Object.keys(groupData),
              }), { status: 200, headers: corsHeaders });
            } catch {
              return new Response(JSON.stringify({ error: "Failed to parse response", raw: resText.substring(0, 500) }), { status: 200, headers: corsHeaders });
            }
          } catch (e) {
            console.warn(`[PANDA-DIAG] group_info fetch failed (${url}):`, (e as Error).message);
          }
        }
      }

      return new Response(JSON.stringify({ error: "All endpoints failed for group_info", group_id: groupId }), { status: 200, headers: corsHeaders });
    }

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
