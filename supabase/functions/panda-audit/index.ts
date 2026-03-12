import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function normalize(title: string): string {
  return title
    .toLowerCase()
    .replace(/\.mp4$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function fuzzyMatch(a: string, b: string): boolean {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  // Check if first 10 chars match (for partial titles)
  if (na.length > 10 && nb.length > 10 && na.slice(0, 10) === nb.slice(0, 10)) return true;
  return false;
}

async function fetchAllPandaVideos(apiKey: string): Promise<any[]> {
  const allVideos: any[] = [];
  let page = 1;
  const limit = 50;

  while (true) {
    const url = `https://api-v2.pandavideo.com.br/videos?page=${page}&limit=${limit}`;
    let res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    // Fallback without Bearer prefix
    if (res.status === 401) {
      res = await fetch(url, {
        headers: { Authorization: apiKey },
      });
    }

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Panda API error page=${page}: ${res.status} ${txt}`);
    }

    const data = await res.json();
    const videos = data.videos || data;

    if (!Array.isArray(videos) || videos.length === 0) break;

    allVideos.push(...videos);
    if (videos.length < limit) break;
    page++;

    // Small delay to avoid rate limiting
    await new Promise((r) => setTimeout(r, 200));
  }

  return allVideos;
}

async function validateConfig(videoId: string): Promise<{ status: number; ok: boolean }> {
  try {
    const res = await fetch(
      `https://config.tv.pandavideo.com.br/embed/v2/${videoId}.json`,
      { method: "GET" }
    );
    await res.text(); // consume body
    return { status: res.status, ok: res.ok };
  } catch (e) {
    return { status: 0, ok: false };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check — admin only
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
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const userId = claimsData.claims.sub as string;

    // Admin check
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: corsHeaders,
      });
    }

    console.log("📋 Starting Panda Video Audit...");

    // Step 1: Read all aulas with panda_video_id
    const { data: aulas, error: aulasErr } = await adminClient
      .from("aulas")
      .select("id, titulo, panda_video_id, curso_id, is_published, status");

    if (aulasErr) throw new Error(`Failed to read aulas: ${aulasErr.message}`);

    const aulasWithVideo = (aulas || []).filter((a: any) => a.panda_video_id);
    const supaVideoIds = new Set(aulasWithVideo.map((a: any) => a.panda_video_id));

    console.log(`📊 Supabase: ${aulasWithVideo.length} aulas with video IDs (${supaVideoIds.size} unique)`);

    // Step 2: Fetch all Panda videos
    const PANDA_API_KEY = Deno.env.get("PANDA_API_KEY");
    if (!PANDA_API_KEY) throw new Error("PANDA_API_KEY not configured");

    const pandaVideos = await fetchAllPandaVideos(PANDA_API_KEY);
    const pandaVideoMap = new Map<string, any>();
    for (const v of pandaVideos) {
      pandaVideoMap.set(v.id, v);
    }

    console.log(`📊 Panda: ${pandaVideos.length} videos found`);

    // Step 3: Compare
    const inconsistent: any[] = []; // In Supabase but NOT in Panda
    const orphans: any[] = []; // In Panda but NOT in Supabase

    for (const aula of aulasWithVideo) {
      if (!pandaVideoMap.has(aula.panda_video_id)) {
        // Try fuzzy match
        let suggestion = null;
        for (const pv of pandaVideos) {
          if (fuzzyMatch(aula.titulo, pv.title || "")) {
            suggestion = {
              panda_id: pv.id,
              panda_title: pv.title,
              panda_status: pv.status,
            };
            break;
          }
        }

        inconsistent.push({
          aula_id: aula.id,
          aula_titulo: aula.titulo,
          current_video_id: aula.panda_video_id,
          curso_id: aula.curso_id,
          is_published: aula.is_published,
          suggestion,
        });
      }
    }

    for (const pv of pandaVideos) {
      if (!supaVideoIds.has(pv.id)) {
        orphans.push({
          panda_id: pv.id,
          panda_title: pv.title || "Sem título",
          panda_status: pv.status,
          panda_folder_id: pv.folder_id || null,
          created_at: pv.created_at,
        });
      }
    }

    console.log(`⚠️ Inconsistent (Supabase→Panda missing): ${inconsistent.length}`);
    console.log(`🔸 Orphans (Panda only): ${orphans.length}`);

    // Step 4: Validate config.json for all Supabase videos
    const configResults: any[] = [];
    const configFailed: any[] = [];

    for (const aula of aulasWithVideo) {
      const result = await validateConfig(aula.panda_video_id);
      const entry = {
        aula_id: aula.id,
        aula_titulo: aula.titulo,
        panda_video_id: aula.panda_video_id,
        config_status: result.status,
        config_ok: result.ok,
      };
      configResults.push(entry);
      if (!result.ok) {
        configFailed.push(entry);
      }

      // Small delay between config checks
      await new Promise((r) => setTimeout(r, 100));
    }

    console.log(`✅ config.json OK: ${configResults.length - configFailed.length}`);
    console.log(`❌ config.json FAILED: ${configFailed.length}`);

    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        supabase_aulas_with_video: aulasWithVideo.length,
        supabase_unique_video_ids: supaVideoIds.size,
        panda_total_videos: pandaVideos.length,
        inconsistent_count: inconsistent.length,
        orphan_count: orphans.length,
        config_ok_count: configResults.length - configFailed.length,
        config_failed_count: configFailed.length,
      },
      inconsistent,
      orphans,
      config_failed: configFailed,
      config_all: configResults,
    };

    console.log("📋 Audit complete:", JSON.stringify(report.summary));

    return new Response(JSON.stringify(report), { headers: corsHeaders });
  } catch (err) {
    console.error("Audit error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Audit failed" }),
      { status: 500, headers: corsHeaders }
    );
  }
});
