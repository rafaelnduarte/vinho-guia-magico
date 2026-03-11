import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const PANDA_API_BASE = "https://api-v2.pandavideo.com.br";

async function fetchDrmJwt(groupId: string, apiKey: string, exp: number): Promise<{ token: string | null; error?: string }> {
  const url = `${PANDA_API_BASE}/drm/videos/${groupId}/jwt?expiredAtJwt=${exp}`;

  // Attempt 1: Bearer prefix (per Panda docs)
  console.log(`[PANDA-TOKEN] Attempt 1: Bearer prefix`);
  const res1 = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (res1.ok) {
    const data = await res1.json();
    const token = data.jwt || data.token || null;
    if (token) {
      console.log(`[PANDA-TOKEN] Success with Bearer prefix`);
      return { token };
    }
    console.error(`[PANDA-TOKEN] Bearer OK but no jwt field:`, JSON.stringify(data));
    return { token: null, error: "No jwt field in response" };
  }

  const err1 = await res1.text();
  console.warn(`[PANDA-TOKEN] Bearer failed: ${res1.status} ${err1}`);

  // Attempt 2: No prefix (format used by panda-sync/panda-diagnostics that works)
  console.log(`[PANDA-TOKEN] Attempt 2: No prefix (compatible mode)`);
  const res2 = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": apiKey,
      "Content-Type": "application/json",
    },
  });

  if (res2.ok) {
    const data = await res2.json();
    const token = data.jwt || data.token || null;
    if (token) {
      console.log(`[PANDA-TOKEN] Success without Bearer prefix`);
      return { token };
    }
    console.error(`[PANDA-TOKEN] No-prefix OK but no jwt field:`, JSON.stringify(data));
    return { token: null, error: "No jwt field in response" };
  }

  const err2 = await res2.text();
  console.error(`[PANDA-TOKEN] No-prefix also failed: ${res2.status} ${err2}`);

  // Attempt 3: Try alternative base URL without -v2
  const altUrl = `https://api.pandavideo.com/drm/videos/${groupId}/jwt?expiredAtJwt=${exp}`;
  console.log(`[PANDA-TOKEN] Attempt 3: Alternative base URL (api.pandavideo.com)`);
  const res3 = await fetch(altUrl, {
    method: "GET",
    headers: {
      "Authorization": apiKey,
      "Content-Type": "application/json",
    },
  });

  if (res3.ok) {
    const data = await res3.json();
    const token = data.jwt || data.token || null;
    if (token) {
      console.log(`[PANDA-TOKEN] Success with alt base URL`);
      return { token };
    }
  }

  const err3 = await res3.text();
  console.error(`[PANDA-TOKEN] Alt URL also failed: ${res3.status} ${err3}`);

  return { token: null, error: `All attempts failed. Last: ${res3.status}` };
}

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

    const exp = Math.floor(Date.now() / 1000) + 3600;

    console.log(`[PANDA-TOKEN] Fetching DRM JWT for group ${DRM_GROUP_ID}, video ${video_id}, user ${user.id}`);

    const result = await fetchDrmJwt(DRM_GROUP_ID, PANDA_API_KEY, exp);

    if (result.token) {
      console.log(`[PANDA-TOKEN] JWT obtained successfully for video ${video_id}`);
    } else {
      console.error(`[PANDA-TOKEN] Failed to obtain JWT: ${result.error}`);
    }

    return new Response(JSON.stringify({ token: result.token }), { status: 200, headers: corsHeaders });
  } catch (err) {
    console.error("[PANDA-TOKEN] Error:", (err as Error).message);
    return new Response(JSON.stringify({ token: null }), { status: 200, headers: corsHeaders });
  }
});
