import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify admin
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const limit = body.limit || 5;
    const offset = body.offset || 0;

    // Get wines with Drive URLs
    const { data: wines, error: queryError } = await supabase
      .from("wines")
      .select("id, name, image_url, audio_url")
      .or("image_url.like.%googleusercontent%,image_url.like.%drive.google%,audio_url.like.%drive.google%")
      .range(offset, offset + limit - 1);

    if (queryError) throw queryError;

    const results: { id: string; name: string; image: string; audio: string }[] = [];

    for (const wine of wines || []) {
      const result: any = { id: wine.id, name: wine.name, image: "skipped", audio: "skipped" };

      // Process image
      if (wine.image_url && !wine.image_url.includes("supabase.co/storage")) {
        const fileId = extractDriveFileId(wine.image_url);
        if (fileId) {
          const url = await rehostFile(supabase, fileId, "wine-images", "image");
          if (url) {
            await supabase.from("wines").update({ image_url: url }).eq("id", wine.id);
            result.image = "ok";
          } else {
            result.image = "failed";
          }
        }
      }

      // Process audio
      if (wine.audio_url && !wine.audio_url.includes("supabase.co/storage")) {
        const fileId = extractDriveFileId(wine.audio_url);
        if (fileId) {
          const url = await rehostFile(supabase, fileId, "wine-audio", "audio");
          if (url) {
            await supabase.from("wines").update({ audio_url: url }).eq("id", wine.id);
            result.audio = "ok";
          } else {
            result.audio = "failed";
          }
        }
      }

      results.push(result);
    }

    return new Response(
      JSON.stringify({ total: wines?.length || 0, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function extractDriveFileId(url: string): string | null {
  const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  const match2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (match2) return match2[1];
  const match3 = url.match(/lh3\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/);
  if (match3) return match3[1];
  return null;
}

async function rehostFile(supabase: any, fileId: string, bucket: string, type: string): Promise<string | null> {
  try {
    const driveUrl = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`;
    const response = await fetch(driveUrl, { redirect: "follow", headers: { "User-Agent": "Mozilla/5.0" } });

    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") || "";
    
    if (contentType.includes("text/html")) {
      const body = await response.text();
      const confirmMatch = body.match(/confirm=([a-zA-Z0-9_-]+)/);
      if (confirmMatch) {
        const retryResponse = await fetch(
          `https://drive.google.com/uc?export=download&id=${fileId}&confirm=${confirmMatch[1]}`,
          { redirect: "follow", headers: { "User-Agent": "Mozilla/5.0" } }
        );
        if (!retryResponse.ok) return null;
        const ct = retryResponse.headers.get("content-type") || "";
        if (ct.includes("text/html")) return null;
        return await doUpload(supabase, new Uint8Array(await retryResponse.arrayBuffer()), fileId, bucket, type, ct);
      }
      return null;
    }

    return await doUpload(supabase, new Uint8Array(await response.arrayBuffer()), fileId, bucket, type, contentType);
  } catch (err) {
    console.error(`Failed to rehost ${fileId}:`, err);
    return null;
  }
}

async function doUpload(supabase: any, data: Uint8Array, fileId: string, bucket: string, type: string, contentType: string): Promise<string | null> {
  let ext = type === "image" ? "jpg" : "mp3";
  if (contentType.includes("png")) ext = "png";
  else if (contentType.includes("webp")) ext = "webp";
  else if (contentType.includes("mp4")) ext = "mp4";
  else if (contentType.includes("ogg")) ext = "ogg";

  const fileName = `${fileId}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(fileName, data, {
    contentType: contentType || (type === "image" ? "image/jpeg" : "audio/mpeg"),
    upsert: true,
  });

  if (error) {
    console.error(`Upload error for ${fileName}:`, error);
    return null;
  }

  const { data: publicUrl } = supabase.storage.from(bucket).getPublicUrl(fileName);
  return publicUrl.publicUrl;
}
