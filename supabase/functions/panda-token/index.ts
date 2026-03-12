import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

interface Attempt {
  label: string;
  url: string;
  auth: string;
}

async function fetchOfficialJwt(groupId: string, apiKey: string, exp: number): Promise<{ token: string | null; error?: string }> {
  const attempts: Attempt[] = [
    {
      label: "watermark/groups Bearer",
      url: `https://api.pandavideo.com/watermark/groups/${groupId}/jwt?expiredAtJwt=${exp}`,
      auth: `Bearer ${apiKey}`,
    },
    {
      label: "watermark/groups no-prefix",
      url: `https://api.pandavideo.com/watermark/groups/${groupId}/jwt?expiredAtJwt=${exp}`,
      auth: apiKey,
    },
    {
      label: "drm/videos Bearer (api-v2)",
      url: `https://api-v2.pandavideo.com.br/drm/videos/${groupId}/jwt?expiredAtJwt=${exp}`,
      auth: `Bearer ${apiKey}`,
    },
    {
      label: "drm/videos no-prefix (api-v2)",
      url: `https://api-v2.pandavideo.com.br/drm/videos/${groupId}/jwt?expiredAtJwt=${exp}`,
      auth: apiKey,
    },
  ];

  for (const attempt of attempts) {
    console.log(`[PANDA-TOKEN] Trying: ${attempt.label}`);
    try {
      const res = await fetch(attempt.url, {
        method: "GET",
        headers: {
          Authorization: attempt.auth,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok) {
        const errText = await res.text();
        console.warn(`[PANDA-TOKEN] ${attempt.label} failed: ${res.status} ${errText.substring(0, 200)}`);
        continue;
      }

      const data = await res.json();
      const token = data.jwt || data.token || null;
      if (token) {
        console.log(`[PANDA-TOKEN] ✅ Success via ${attempt.label}`);
        return { token };
      }
      console.warn(`[PANDA-TOKEN] ${attempt.label} OK but no jwt field:`, JSON.stringify(data).substring(0, 200));
    } catch (err) {
      console.error(`[PANDA-TOKEN] ${attempt.label} exception:`, (err as Error).message);
    }
  }

  return { token: null, error: "All attempts failed" };
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

    // Verify active membership using service role client
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

    const PANDA_API_KEY = Deno.env.get("PANDA_API_KEY");
    const DRM_GROUP_ID = Deno.env.get("PANDA_WATERMARK_GROUP_ID");

    if (!PANDA_API_KEY || !DRM_GROUP_ID) {
      console.error("[PANDA-TOKEN] Missing PANDA_API_KEY or PANDA_WATERMARK_GROUP_ID");
      return new Response(JSON.stringify({ token: null }), { status: 200, headers: corsHeaders });
    }

    const exp = Math.floor(Date.now() / 1000) + 3600;

    console.log(`[PANDA-TOKEN] Fetching official JWT for group=${DRM_GROUP_ID}, video=${video_id}, user=${user.id}`);

    const result = await fetchOfficialJwt(DRM_GROUP_ID, PANDA_API_KEY, exp);

    if (!result.token) {
      console.error(`[PANDA-TOKEN] Failed: ${result.error}`);
    }

    return new Response(JSON.stringify({ token: result.token }), { status: 200, headers: corsHeaders });
  } catch (err) {
    console.error("[PANDA-TOKEN] Error:", (err as Error).message);
    return new Response(JSON.stringify({ token: null }), { status: 200, headers: corsHeaders });
  }
});
