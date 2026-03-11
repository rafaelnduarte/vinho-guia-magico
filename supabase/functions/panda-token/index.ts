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
    const groupId = Deno.env.get("PANDA_WATERMARK_GROUP_ID");
    const privateToken = Deno.env.get("PANDA_WATERMARK_PRIVATE_TOKEN");

    if (!PANDA_API_KEY || !groupId || !privateToken) {
      console.error("[PANDA-TOKEN] Missing config: PANDA_API_KEY, PANDA_WATERMARK_GROUP_ID, or PANDA_WATERMARK_PRIVATE_TOKEN");
      // Return empty token so player falls back to non-JWT playback
      return new Response(JSON.stringify({ token: null }), { status: 200, headers: corsHeaders });
    }

    // Generate JWT via Panda Watermark API
    console.log(`[PANDA-TOKEN] Requesting Watermark JWT for video ${video_id}, user ${user.id}`);

    const jwtRes = await fetch(`${PANDA_API_BASE}/watermark/jwt/${groupId}`, {
      method: "POST",
      headers: {
        "Authorization": PANDA_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        private_token: privateToken,
        expires_in: 3600, // 1 hour
      }),
    });

    if (!jwtRes.ok) {
      const errText = await jwtRes.text();
      console.error(`[PANDA-TOKEN] Watermark JWT failed: ${jwtRes.status}`, errText);
      // Return null token so player continues without JWT
      return new Response(JSON.stringify({ token: null }), { status: 200, headers: corsHeaders });
    }

    const jwtData = await jwtRes.json();
    const jwt = jwtData.jwt || jwtData.token;

    console.log(`[PANDA-TOKEN] Watermark JWT generated for video ${video_id}, user ${user.id}`);

    return new Response(JSON.stringify({ token: jwt }), { status: 200, headers: corsHeaders });
  } catch (err) {
    console.error("[PANDA-TOKEN] Error:", err.message);
    return new Response(JSON.stringify({ token: null }), { status: 200, headers: corsHeaders });
  }
});
