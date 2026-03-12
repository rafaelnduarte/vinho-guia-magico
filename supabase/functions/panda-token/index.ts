import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64url } from "https://deno.land/std@0.208.0/encoding/base64url.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

// Minimal JWT HS256 signer (no external lib needed)
async function signJwt(payload: Record<string, unknown>, secret: string, expiresIn: number): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = { ...payload, iat: now, exp: now + expiresIn };

  const enc = new TextEncoder();
  const headerB64 = base64url(enc.encode(JSON.stringify(header)));
  const payloadB64 = base64url(enc.encode(JSON.stringify(fullPayload)));

  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, enc.encode(`${headerB64}.${payloadB64}`));
  const sigB64 = base64url(new Uint8Array(signature));

  return `${headerB64}.${payloadB64}.${sigB64}`;
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
    const DRM_SECRET = Deno.env.get("PANDA_WATERMARK_PRIVATE_TOKEN");

    if (!DRM_GROUP_ID || !DRM_SECRET) {
      console.error("[PANDA-TOKEN] Missing PANDA_WATERMARK_GROUP_ID or PANDA_WATERMARK_PRIVATE_TOKEN");
      return new Response(JSON.stringify({ token: null }), { status: 200, headers: corsHeaders });
    }

    // Get user profile for watermark strings
    const { data: profile } = await adminClient
      .from("profiles")
      .select("full_name")
      .eq("user_id", user.id)
      .single();

    const userName = profile?.full_name || user.email || "Membro";

    // Sign JWT locally per Panda docs
    const jwtPayload = {
      drm_group_id: DRM_GROUP_ID,
      string1: "Jovem do Vinho",
      string2: userName,
      string3: user.email || "",
    };

    const token = await signJwt(jwtPayload, DRM_SECRET, 3600); // 1 hour

    console.log(`[PANDA-TOKEN] ✅ JWT signed locally for user=${user.id}, video=${video_id}`);

    return new Response(JSON.stringify({ token }), { status: 200, headers: corsHeaders });
  } catch (err) {
    console.error("[PANDA-TOKEN] Error:", (err as Error).message);
    return new Response(JSON.stringify({ token: null }), { status: 200, headers: corsHeaders });
  }
});
