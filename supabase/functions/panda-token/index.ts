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

    const { video_id } = await req.json();
    if (!video_id) {
      return new Response(JSON.stringify({ error: "video_id is required" }), { status: 400, headers: corsHeaders });
    }

    const PANDA_API_KEY = Deno.env.get("PANDA_API_KEY");
    const DRM_GROUP_ID = Deno.env.get("PANDA_WATERMARK_GROUP_ID");

    if (!PANDA_API_KEY || !DRM_GROUP_ID) {
      console.error("[PANDA-TOKEN] Missing config: PANDA_API_KEY or PANDA_WATERMARK_GROUP_ID");
      return new Response(JSON.stringify({ token: null }), { status: 200, headers: corsHeaders });
    }

    // Generate expiration timestamp (1 hour from now)
    const exp = Math.floor(Date.now() / 1000) + 3600;

    // Fetch official JWT from Panda DRM API
    console.log(`[PANDA-TOKEN] Fetching official DRM JWT for group ${DRM_GROUP_ID}, video ${video_id}, user ${user.id}`);

    const res = await fetch(
      `${PANDA_API_BASE}/drm/videos/${DRM_GROUP_ID}/jwt?expiredAtJwt=${exp}`,
      {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${PANDA_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!res.ok) {
      const txt = await res.text();
      console.error(`[PANDA-TOKEN] Error fetching DRM JWT: ${res.status}`, txt);
      return new Response(JSON.stringify({ token: null }), { status: 200, headers: corsHeaders });
    }

    const data = await res.json();
    const token = data.jwt || data.token || null;

    if (!token) {
      console.error("[PANDA-TOKEN] Response has no jwt/token field:", JSON.stringify(data));
      return new Response(JSON.stringify({ token: null }), { status: 200, headers: corsHeaders });
    }

    console.log(`[PANDA-TOKEN] Official JWT fetched successfully for video ${video_id}, user ${user.id}`);

    return new Response(JSON.stringify({ token }), { status: 200, headers: corsHeaders });
  } catch (err) {
    console.error("[PANDA-TOKEN] Error:", (err as Error).message);
    return new Response(JSON.stringify({ token: null }), { status: 200, headers: corsHeaders });
  }
});
