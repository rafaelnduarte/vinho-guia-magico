import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const PANDA_API_BASE = "https://api-v2.pandavideo.com.br";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders });
  }

  try {
    // Admin-only: verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const adminCheck = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: roleData } = await adminCheck.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!roleData) {
      return new Response(JSON.stringify({ error: "Admin only" }), { status: 403, headers: corsHeaders });
    }

    const PANDA_API_KEY = Deno.env.get("PANDA_API_KEY");
    if (!PANDA_API_KEY) {
      return new Response(JSON.stringify({ error: "PANDA_API_KEY not configured" }), { status: 500, headers: corsHeaders });
    }

    const pandaHeaders = {
      "Authorization": PANDA_API_KEY,
      "Content-Type": "application/json",
    };

    // STEP 1: Create Watermark Group
    console.log("[WATERMARK] Creating watermark group...");
    const groupRes = await fetch(`${PANDA_API_BASE}/watermark/group`, {
      method: "POST",
      headers: pandaHeaders,
      body: JSON.stringify({
        name: "Jovem_do_Vinho_Cursos",
        description: "DRM group for wine courses",
      }),
    });

    if (!groupRes.ok) {
      const errText = await groupRes.text();
      console.error("[WATERMARK] Create group failed:", groupRes.status, errText);
      return new Response(JSON.stringify({ error: `Create group failed: ${groupRes.status}`, details: errText }), { status: 500, headers: corsHeaders });
    }

    const group = await groupRes.json();
    const groupId = group.id || group.group_id;
    console.log("[WATERMARK] Group created:", groupId);

    // STEP 2: Enable DRM on group
    console.log("[WATERMARK] Enabling DRM...");
    const enableRes = await fetch(`${PANDA_API_BASE}/watermark/group/${groupId}/enable`, {
      method: "POST",
      headers: pandaHeaders,
      body: JSON.stringify({ enable: true, drm_enabled: true }),
    });

    if (!enableRes.ok) {
      const errText = await enableRes.text();
      console.warn("[WATERMARK] Enable DRM response:", enableRes.status, errText);
      // Non-fatal: some Panda plans may not support this endpoint
    } else {
      console.log("[WATERMARK] DRM enabled");
    }

    // STEP 3: Create a shared private token
    console.log("[WATERMARK] Creating private token...");
    const tokenRes = await fetch(`${PANDA_API_BASE}/watermark/private-tokens`, {
      method: "POST",
      headers: pandaHeaders,
      body: JSON.stringify({
        group_id: groupId,
        token: `jdv_shared_${Date.now()}`,
        expire_in_days: 365,
      }),
    });

    let privateToken = null;
    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.warn("[WATERMARK] Create private token response:", tokenRes.status, errText);
      // Non-fatal: token can be created manually
    } else {
      const tokenData = await tokenRes.json();
      privateToken = tokenData.token || tokenData.private_token;
      console.log("[WATERMARK] Private token created");
    }

    return new Response(
      JSON.stringify({
        success: true,
        group_id: groupId,
        private_token: privateToken,
        next_steps: [
          `1. Add secret PANDA_WATERMARK_GROUP_ID = ${groupId}`,
          privateToken
            ? `2. Add secret PANDA_WATERMARK_PRIVATE_TOKEN = ${privateToken}`
            : "2. Create private token manually in Panda Dashboard and add as secret PANDA_WATERMARK_PRIVATE_TOKEN",
          "3. Link your videos to this watermark group in Panda Dashboard",
          "4. Test video playback",
        ],
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    console.error("[WATERMARK] Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
});
