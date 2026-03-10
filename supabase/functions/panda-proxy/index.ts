import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
};

const PANDA_BASE = "https://api-v2.pandavideo.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
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

    const { data: roleCheck } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });

    if (!roleCheck) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: corsHeaders,
      });
    }

    // Parse resource
    const url = new URL(req.url);
    const resource = url.searchParams.get("resource");
    const folderId = url.searchParams.get("folder_id");

    let pandaUrl: string;
    if (resource === "folders") {
      pandaUrl = `${PANDA_BASE}/folders`;
    } else if (resource === "videos" && folderId) {
      pandaUrl = `${PANDA_BASE}/videos?folder_id=${folderId}`;
    } else {
      return new Response(
        JSON.stringify({ error: "Invalid resource or missing folder_id" }),
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

    const pandaRes = await fetch(pandaUrl, {
      method: "GET",
      headers: {
        Authorization: pandaApiKey,
        Accept: "application/json",
      },
    });

    const rawData = await pandaRes.json();

    if (!pandaRes.ok) {
      return new Response(
        JSON.stringify({ error: "Panda API error", details: rawData }),
        { status: pandaRes.status, headers: corsHeaders }
      );
    }

    const result =
      resource === "folders"
        ? rawData.folders ?? []
        : rawData.videos ?? [];

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
