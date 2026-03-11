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
    // Auth: admin-only
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
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: corsHeaders,
      });
    }

    const { video_id, strategy, file_url, title, folder_id } = await req.json();
    if (!video_id || !strategy) {
      return new Response(
        JSON.stringify({ error: "video_id and strategy are required" }),
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

    // Service role client for logging
    const adminSupa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const logRecovery = async (
      action: string,
      status: string,
      errorMessage?: string,
      newVideoId?: string
    ) => {
      await adminSupa.from("recovery_logs").insert({
        video_id,
        action,
        status,
        error_message: errorMessage ?? null,
        new_video_id: newVideoId ?? null,
      });
    };

    const pandaHeaders = {
      Authorization: pandaApiKey,
      Accept: "application/json",
      "Content-Type": "application/json",
    };

    // ── STRATEGY: RECOVER ──
    if (strategy === "RECOVER") {
      console.log(`[RECOVERY] RECOVER: ${video_id}`);
      try {
        const res = await fetch(`${PANDA_BASE}/videos/${video_id}/recover`, {
          method: "POST",
          headers: pandaHeaders,
        });

        if (!res.ok) {
          const errText = await res.text();
          console.error(`[RECOVERY] RECOVER failed: ${res.status} ${errText}`);
          await logRecovery("RECOVER", "failed", `HTTP ${res.status}: ${errText}`);
          return new Response(
            JSON.stringify({
              success: false,
              action: "RECOVER",
              error: `Panda returned ${res.status}`,
              suggestion: "Try REPROCESS strategy",
            }),
            { status: 200, headers: corsHeaders }
          );
        }

        await logRecovery("RECOVER", "started");
        return new Response(
          JSON.stringify({
            success: true,
            action: "RECOVER",
            message: "Video recovery started. ETA: 15-30 minutes.",
            eta_minutes: 15,
          }),
          { status: 200, headers: corsHeaders }
        );
      } catch (e) {
        await logRecovery("RECOVER", "failed", (e as Error).message);
        return new Response(
          JSON.stringify({
            success: false,
            action: "RECOVER",
            error: (e as Error).message,
          }),
          { status: 200, headers: corsHeaders }
        );
      }
    }

    // ── STRATEGY: REPROCESS ──
    if (strategy === "REPROCESS") {
      console.log(`[RECOVERY] REPROCESS: ${video_id}`);
      try {
        // Get current video data
        const getRes = await fetch(`${PANDA_BASE}/videos/${video_id}`, {
          headers: pandaHeaders,
        });

        if (!getRes.ok) {
          await logRecovery("REPROCESS", "failed", `GET failed: ${getRes.status}`);
          return new Response(
            JSON.stringify({
              success: false,
              action: "REPROCESS",
              error: `Cannot fetch video: ${getRes.status}`,
            }),
            { status: 200, headers: corsHeaders }
          );
        }

        const videoData = await getRes.json();

        // Force reprocessing by setting status back to "uploaded"
        const updateRes = await fetch(`${PANDA_BASE}/videos/${video_id}`, {
          method: "PUT",
          headers: pandaHeaders,
          body: JSON.stringify({
            title: videoData.title,
            description: videoData.description,
            status: "uploaded",
          }),
        });

        if (!updateRes.ok) {
          const errText = await updateRes.text();
          await logRecovery("REPROCESS", "failed", `PUT failed: ${updateRes.status}: ${errText}`);
          return new Response(
            JSON.stringify({
              success: false,
              action: "REPROCESS",
              error: `Reprocess failed: ${updateRes.status}`,
            }),
            { status: 200, headers: corsHeaders }
          );
        }

        await logRecovery("REPROCESS", "started");
        return new Response(
          JSON.stringify({
            success: true,
            action: "REPROCESS",
            message: "Video queued for reprocessing. ETA: 30-45 minutes.",
            eta_minutes: 30,
          }),
          { status: 200, headers: corsHeaders }
        );
      } catch (e) {
        await logRecovery("REPROCESS", "failed", (e as Error).message);
        return new Response(
          JSON.stringify({
            success: false,
            action: "REPROCESS",
            error: (e as Error).message,
          }),
          { status: 200, headers: corsHeaders }
        );
      }
    }

    // ── STRATEGY: REUPLOAD ──
    if (strategy === "REUPLOAD") {
      console.log(`[RECOVERY] REUPLOAD: ${video_id}`);
      if (!file_url) {
        return new Response(
          JSON.stringify({
            success: false,
            action: "REUPLOAD",
            error: "file_url is required for REUPLOAD strategy",
          }),
          { status: 400, headers: corsHeaders }
        );
      }

      try {
        // Step 1: Delete corrupted video
        const delRes = await fetch(`${PANDA_BASE}/videos/${video_id}`, {
          method: "DELETE",
          headers: pandaHeaders,
        });
        console.log(`[RECOVERY] DELETE ${video_id}: ${delRes.status}`);

        // Step 2: Upload new video from URL
        const uploadRes = await fetch(`${PANDA_BASE}/videos`, {
          method: "POST",
          headers: pandaHeaders,
          body: JSON.stringify({
            source: file_url,
            title: title || "Video Recuperado",
            folder_id: folder_id || undefined,
          }),
        });

        if (!uploadRes.ok) {
          const errText = await uploadRes.text();
          await logRecovery("REUPLOAD", "failed", `Upload failed: ${uploadRes.status}: ${errText}`);
          return new Response(
            JSON.stringify({
              success: false,
              action: "REUPLOAD",
              error: `Upload failed: ${uploadRes.status}`,
            }),
            { status: 200, headers: corsHeaders }
          );
        }

        const uploadData = await uploadRes.json();
        const newVideoId = uploadData.id;

        // Step 3: Update aulas table with new video ID
        const { error: updateErr } = await adminSupa
          .from("aulas")
          .update({ panda_video_id: newVideoId })
          .eq("panda_video_id", video_id);

        if (updateErr) {
          console.error(`[RECOVERY] Failed to update aulas: ${updateErr.message}`);
        }

        await logRecovery("REUPLOAD", "completed", undefined, newVideoId);

        return new Response(
          JSON.stringify({
            success: true,
            action: "REUPLOAD",
            old_video_id: video_id,
            new_video_id: newVideoId,
            message: "Video re-uploaded successfully. Aulas table updated.",
            aulas_updated: !updateErr,
            eta_minutes: 10,
          }),
          { status: 200, headers: corsHeaders }
        );
      } catch (e) {
        await logRecovery("REUPLOAD", "failed", (e as Error).message);
        return new Response(
          JSON.stringify({
            success: false,
            action: "REUPLOAD",
            error: (e as Error).message,
          }),
          { status: 200, headers: corsHeaders }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: `Unknown strategy: ${strategy}. Use RECOVER, REPROCESS, or REUPLOAD.` }),
      { status: 400, headers: corsHeaders }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
