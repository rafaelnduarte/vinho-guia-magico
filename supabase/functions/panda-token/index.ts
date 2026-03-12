import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify user is authenticated
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

    // Verify active membership
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: hasAccess } = await adminClient.rpc("has_active_access", { _user_id: user.id });
    if (!hasAccess) {
      return new Response(
        JSON.stringify({ error: "Forbidden", message: "Active membership required" }),
        { status: 403, headers: corsHeaders }
      );
    }

    const { video_id } = await req.json();
    if (!video_id) {
      return new Response(JSON.stringify({ error: "video_id is required" }), { status: 400, headers: corsHeaders });
    }

    const DRM_GROUP_ID = Deno.env.get("PANDA_WATERMARK_GROUP_ID");
    const PANDA_API_KEY = Deno.env.get("PANDA_API_KEY");

    if (!DRM_GROUP_ID || !PANDA_API_KEY) {
      console.error("[PANDA-TOKEN] Missing PANDA_WATERMARK_GROUP_ID or PANDA_API_KEY");
      return new Response(JSON.stringify({ token: null }), { status: 200, headers: corsHeaders });
    }

    // Expiration: 1 hour from now (ISO string)
    const expiredAt = new Date(Date.now() + 3600 * 1000).toISOString();

    // Try official endpoint first
    let token: string | null = null;

    const endpoints = [
      `https://api.pandavideo.com/watermark/groups/${DRM_GROUP_ID}/jwt?expiredAtJwt=${encodeURIComponent(expiredAt)}`,
      `https://api-v2.pandavideo.com.br/drm/videos/${DRM_GROUP_ID}/jwt?expiredAtJwt=${encodeURIComponent(expiredAt)}`,
    ];

    for (const url of endpoints) {
      try {
        // Try Bearer format first
        let res = await fetch(url, {
          method: "GET",
          headers: { "Authorization": `Bearer ${PANDA_API_KEY}` },
        });

        // Fallback to raw key if 401
        if (res.status === 401) {
          res = await fetch(url, {
            method: "GET",
            headers: { "Authorization": PANDA_API_KEY },
          });
        }

        if (res.ok) {
          const data = await res.json();
          token = data.jwt || data.token || null;
          if (token) {
            console.log(`[PANDA-TOKEN] ✅ JWT fetched from ${url} for user=${user.id}, video=${video_id}`);
            break;
          }
        } else {
          const body = await res.text();
          console.warn(`[PANDA-TOKEN] ${url} returned ${res.status}: ${body}`);
        }
      } catch (err) {
        console.warn(`[PANDA-TOKEN] Failed to fetch from ${url}:`, (err as Error).message);
      }
    }

    return new Response(JSON.stringify({ token }), { status: 200, headers: corsHeaders });
  } catch (err) {
    console.error("[PANDA-TOKEN] Error:", (err as Error).message);
    return new Response(JSON.stringify({ token: null }), { status: 200, headers: corsHeaders });
  }
});
