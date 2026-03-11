import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as jose from "https://deno.land/x/jose@v5.2.0/index.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const PANDA_API_BASE = "https://api-v2.pandavideo.com.br";

// Cache the group secret for 1 hour to avoid repeated API calls
let cachedSecret: string | null = null;
let cachedSecretExpiry = 0;

async function getGroupSecret(groupId: string, apiKey: string): Promise<string | null> {
  const now = Date.now();
  if (cachedSecret && now < cachedSecretExpiry) {
    return cachedSecret;
  }

  console.log(`[PANDA-TOKEN] Fetching DRM group secret for group ${groupId}`);
  const res = await fetch(`${PANDA_API_BASE}/drm/videos/${groupId}`, {
    method: "GET",
    headers: {
      "Authorization": apiKey,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`[PANDA-TOKEN] Failed to fetch group info: ${res.status}`, errText);
    return null;
  }

  const groupData = await res.json();
  const secret = groupData.secret || groupData.private_token || groupData.key;

  if (!secret) {
    console.error("[PANDA-TOKEN] Group data has no secret/private_token/key field:", JSON.stringify(groupData));
    return null;
  }

  // Cache for 1 hour
  cachedSecret = secret;
  cachedSecretExpiry = now + 3600 * 1000;

  console.log(`[PANDA-TOKEN] Group secret fetched and cached successfully`);
  return secret;
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
    const groupId = Deno.env.get("PANDA_WATERMARK_GROUP_ID");

    if (!PANDA_API_KEY || !groupId) {
      console.error("[PANDA-TOKEN] Missing config: PANDA_API_KEY or PANDA_WATERMARK_GROUP_ID");
      return new Response(JSON.stringify({ token: null }), { status: 200, headers: corsHeaders });
    }

    // Try to get the group secret (from cache or API)
    let secret = await getGroupSecret(groupId, PANDA_API_KEY);

    // Fallback: use PANDA_WATERMARK_PRIVATE_TOKEN if API doesn't return a secret
    if (!secret) {
      const privateToken = Deno.env.get("PANDA_WATERMARK_PRIVATE_TOKEN");
      if (privateToken) {
        console.log("[PANDA-TOKEN] Using PANDA_WATERMARK_PRIVATE_TOKEN as fallback secret");
        secret = privateToken;
      }
    }

    if (!secret) {
      console.error("[PANDA-TOKEN] No secret available for JWT signing");
      return new Response(JSON.stringify({ token: null }), { status: 200, headers: corsHeaders });
    }

    // Sign JWT locally using the group secret (official Panda approach)
    console.log(`[PANDA-TOKEN] Signing JWT locally for video ${video_id}, user ${user.id}`);

    const encodedSecret = new TextEncoder().encode(secret);
    const token = await new jose.SignJWT({
      drm_group_id: groupId,
      string1: user.email || "member",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(encodedSecret);

    console.log(`[PANDA-TOKEN] JWT signed successfully for video ${video_id}, user ${user.id}`);

    return new Response(JSON.stringify({ token }), { status: 200, headers: corsHeaders });
  } catch (err) {
    console.error("[PANDA-TOKEN] Error:", err.message);
    return new Response(JSON.stringify({ token: null }), { status: 200, headers: corsHeaders });
  }
});
