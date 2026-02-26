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
    // Verify admin role
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user is admin
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { fileId, bucket, type } = await req.json();
    // type: "image" or "audio"

    if (!fileId || !bucket) {
      return new Response(JSON.stringify({ error: "fileId and bucket required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Download from Google Drive using direct download URL
    const driveUrl = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`;
    console.log(`Downloading from Drive: ${driveUrl}`);

    const driveResponse = await fetch(driveUrl, {
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    });

    if (!driveResponse.ok) {
      console.error(`Drive download failed: ${driveResponse.status} ${driveResponse.statusText}`);
      return new Response(
        JSON.stringify({ error: `Failed to download from Drive: ${driveResponse.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const contentType = driveResponse.headers.get("content-type") || "";
    console.log(`Content-Type from Drive: ${contentType}`);

    // Check if we got an HTML page instead of the actual file (login/consent page)
    if (contentType.includes("text/html")) {
      // Try with confirmation bypass
      const body = await driveResponse.text();

      // Look for confirmation token in the HTML
      const confirmMatch = body.match(/confirm=([a-zA-Z0-9_-]+)/);
      if (confirmMatch) {
        const confirmUrl = `https://drive.google.com/uc?export=download&id=${fileId}&confirm=${confirmMatch[1]}`;
        const retryResponse = await fetch(confirmUrl, { redirect: "follow", headers: { "User-Agent": "Mozilla/5.0" } });
        
        if (!retryResponse.ok || (retryResponse.headers.get("content-type") || "").includes("text/html")) {
          return new Response(
            JSON.stringify({ error: "File not accessible - check sharing permissions" }),
            { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const fileData = new Uint8Array(await retryResponse.arrayBuffer());
        return await uploadToStorage(supabase, fileData, fileId, bucket, type, retryResponse.headers.get("content-type") || "", corsHeaders);
      }

      return new Response(
        JSON.stringify({ error: "File not accessible - check sharing permissions" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fileData = new Uint8Array(await driveResponse.arrayBuffer());
    return await uploadToStorage(supabase, fileData, fileId, bucket, type, contentType, corsHeaders);

  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function uploadToStorage(
  supabase: any,
  fileData: Uint8Array,
  fileId: string,
  bucket: string,
  type: string,
  contentType: string,
  corsHeaders: Record<string, string>
) {
  // Determine extension from content type
  let ext = "bin";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) ext = "jpg";
  else if (contentType.includes("png")) ext = "png";
  else if (contentType.includes("webp")) ext = "webp";
  else if (contentType.includes("gif")) ext = "gif";
  else if (contentType.includes("svg")) ext = "svg";
  else if (contentType.includes("mpeg") || contentType.includes("mp3")) ext = "mp3";
  else if (contentType.includes("mp4")) ext = "mp4";
  else if (contentType.includes("ogg")) ext = "ogg";
  else if (contentType.includes("wav")) ext = "wav";
  else if (contentType.includes("audio")) ext = "mp3";
  else if (type === "image") ext = "jpg";
  else if (type === "audio") ext = "mp3";

  const fileName = `${fileId}.${ext}`;
  console.log(`Uploading to ${bucket}/${fileName} (${fileData.length} bytes, ${contentType})`);

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(fileName, fileData, {
      contentType: contentType || (type === "image" ? "image/jpeg" : "audio/mpeg"),
      upsert: true,
    });

  if (uploadError) {
    console.error("Upload error:", uploadError);
    return new Response(
      JSON.stringify({ error: `Upload failed: ${uploadError.message}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const { data: publicUrl } = supabase.storage.from(bucket).getPublicUrl(fileName);

  console.log(`Successfully uploaded: ${publicUrl.publicUrl}`);

  return new Response(
    JSON.stringify({ url: publicUrl.publicUrl }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
