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

    // STEP 1: Create DRM/Watermark Group
    console.log("[WATERMARK] Step 1: Creating DRM watermark group...");
    const groupRes = await fetch(`${PANDA_API_BASE}/drm/videos`, {
      method: "POST",
      headers: pandaHeaders,
      body: JSON.stringify({
        name: "VinhoGuiaMagico_DRM",
        active: true,
        percent_ts: 0.5,
      }),
    });

    if (!groupRes.ok) {
      const errText = await groupRes.text();
      console.error("[WATERMARK] Create group failed:", groupRes.status, errText);
      return new Response(JSON.stringify({ 
        success: false, 
        error: `Create DRM group failed: ${groupRes.status}`, 
        details: errText 
      }), { status: 500, headers: corsHeaders });
    }

    const group = await groupRes.json();
    const groupId = group.id || group.drm_group_id || group.group_id;
    console.log("[WATERMARK] Step 1 SUCCESS: Group created:", JSON.stringify(group));

    // STEP 2: Create a private token for this group
    console.log("[WATERMARK] Step 2: Creating private token...");
    const tokenKey = `system_key_${Date.now()}`;
    const tokenRes = await fetch(`${PANDA_API_BASE}/drm/tokens`, {
      method: "POST",
      headers: pandaHeaders,
      body: JSON.stringify({
        drm_group_id: groupId,
        jwt: true,
        key: tokenKey,
        string1: user.email || "admin",
      }),
    });

    let tokenData = null;
    let tokenError = null;
    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error("[WATERMARK] Create token failed:", tokenRes.status, errText);
      tokenError = `Create token failed: ${tokenRes.status} - ${errText}`;
    } else {
      tokenData = await tokenRes.json();
      console.log("[WATERMARK] Step 2 SUCCESS: Token created:", JSON.stringify(tokenData));
    }

    // STEP 3: List groups for verification
    console.log("[WATERMARK] Step 3: Listing groups for verification...");
    const listRes = await fetch(`${PANDA_API_BASE}/drm/videos/`, {
      method: "GET",
      headers: pandaHeaders,
    });

    let groups = null;
    if (listRes.ok) {
      groups = await listRes.json();
      console.log("[WATERMARK] Step 3 SUCCESS: Groups listed:", JSON.stringify(groups).slice(0, 500));
    } else {
      console.warn("[WATERMARK] Step 3: List failed (non-fatal):", listRes.status);
    }

    const privateTokenKey = tokenData?.key || tokenData?.private_token || tokenKey;

    return new Response(
      JSON.stringify({
        success: true,
        group_id: groupId,
        key: privateTokenKey,
        group_raw: group,
        token_raw: tokenData,
        token_error: tokenError,
        all_groups: groups,
        next_steps: [
          `1. Add secret PANDA_WATERMARK_GROUP_ID = ${groupId}`,
          `2. Add secret PANDA_WATERMARK_PRIVATE_TOKEN = ${privateTokenKey}`,
          "3. Videos in this group will require JWT for playback",
        ],
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    console.error("[WATERMARK] Error:", err.message);
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: corsHeaders });
  }
});
