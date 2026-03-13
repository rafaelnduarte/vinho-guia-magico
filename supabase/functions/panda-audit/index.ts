import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function normalize(title: string): string {
  return (title || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\.(mp4|mov|mkv|avi)$/g, "")
    .replace(/modulo\s*\d+/g, "")
    .replace(/\bpp\b/g, "")
    .replace(/\bparte\s*\d+/g, "")
    .replace(/\b\d+\s*-\s*/g, "")
    .replace(/\b\d+\.\s*/g, "")
    .replace(/-/g, " ")
    .replace(/_/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function computeConfidence(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 100;
  if (na.includes(nb) || nb.includes(na)) {
    const ratio = Math.min(na.length, nb.length) / Math.max(na.length, nb.length);
    return Math.round(70 + ratio * 30);
  }
  const wordsA = new Set(na.split(" ").filter(Boolean));
  const wordsB = new Set(nb.split(" ").filter(Boolean));
  const intersection = [...wordsA].filter((w) => wordsB.has(w)).length;
  const union = new Set([...wordsA, ...wordsB]).size;
  if (union === 0) return 0;
  return Math.round((intersection / union) * 100);
}

async function validateVideoExists(videoId: string, pandaApiKey: string): Promise<{ exists: boolean; status?: string }> {
  try {
    let res = await fetch(`https://api-v2.pandavideo.com.br/videos/${videoId}`, {
      headers: { Authorization: `Bearer ${pandaApiKey}` },
    });
    if (res.status === 401) {
      res = await fetch(`https://api-v2.pandavideo.com.br/videos/${videoId}`, {
        headers: { Authorization: pandaApiKey },
      });
    }
    if (res.ok) {
      const data = await res.json();
      return { exists: true, status: data.status };
    }
    return { exists: false };
  } catch {
    return { exists: false };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: corsHeaders,
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
        status: 401, headers: corsHeaders,
      });
    }

    const userId = claimsData.claims.sub as string;
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
        status: 403, headers: corsHeaders,
      });
    }

    const PANDA_API_KEY = Deno.env.get("PANDA_API_KEY");

    console.log("📋 Starting Panda Video Audit...");

    // Step 1: Read all aulas with panda_video_id
    const { data: aulas, error: aulasErr } = await adminClient
      .from("aulas")
      .select("id, titulo, panda_video_id, embed_url, curso_id, is_published, status");

    if (aulasErr) throw new Error(`Failed to read aulas: ${aulasErr.message}`);

    const aulasWithVideo = (aulas || []).filter((a: any) => a.panda_video_id);
    const supaVideoIds = new Set(aulasWithVideo.map((a: any) => a.panda_video_id));

    console.log(`📊 Supabase: ${aulasWithVideo.length} aulas with video IDs (${supaVideoIds.size} unique)`);

    // Step 2: Try to use panda_videos_index first (faster, offline)
    const { data: indexVideos } = await adminClient
      .from("panda_videos_index")
      .select("id, title, title_normalized, status, folder_id");

    let pandaVideos: any[] = [];

    if (indexVideos && indexVideos.length > 0) {
      console.log(`📊 Using panda_videos_index: ${indexVideos.length} entries`);
      pandaVideos = indexVideos.map((v: any) => ({
        id: v.id,
        title: v.title,
        title_normalized: v.title_normalized,
        status: v.status,
        folder_id: v.folder_id,
      }));
    } else if (PANDA_API_KEY) {
      // Fallback: fetch from Panda API
      console.log("📊 panda_videos_index empty, fetching from Panda API...");
      let page = 1;
      const limit = 50;
      while (true) {
        const url = `https://api-v2.pandavideo.com.br/videos?page=${page}&limit=${limit}`;
        let res = await fetch(url, {
          headers: { Authorization: `Bearer ${PANDA_API_KEY}` },
        });
        if (res.status === 401) {
          res = await fetch(url, { headers: { Authorization: PANDA_API_KEY } });
        }
        if (!res.ok) break;

        const data = await res.json();
        const videos = data.videos || data;
        if (!Array.isArray(videos) || videos.length === 0) break;

        pandaVideos.push(...videos.map((v: any) => ({
          id: v.id,
          title: v.title || "Sem título",
          title_normalized: normalize(v.title || ""),
          status: v.status,
          folder_id: v.folder_id || null,
        })));

        if (videos.length < limit) break;
        page++;
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    const pandaVideoMap = new Map<string, any>();
    for (const v of pandaVideos) {
      pandaVideoMap.set(v.id, v);
    }

    console.log(`📊 Panda catalog: ${pandaVideos.length} videos`);

    // Step 3: Compare — find inconsistent and orphans
    const inconsistent: any[] = [];
    const orphans: any[] = [];
    const missingEmbed: any[] = [];
    const failedVideos: any[] = [];

    for (const aula of aulasWithVideo) {
      // Check embed_url
      if (!aula.embed_url) {
        missingEmbed.push({
          aula_id: aula.id,
          aula_titulo: aula.titulo,
          panda_video_id: aula.panda_video_id,
        });
      }

      if (!pandaVideoMap.has(aula.panda_video_id)) {
        // Try fuzzy match
        let bestMatch: any = null;
        let bestConfidence = 0;

        for (const pv of pandaVideos) {
          const confidence = computeConfidence(aula.titulo, pv.title);
          if (confidence > bestConfidence && confidence >= 40) {
            bestConfidence = confidence;
            bestMatch = pv;
          }
        }

        inconsistent.push({
          aula_id: aula.id,
          aula_titulo: aula.titulo,
          current_video_id: aula.panda_video_id,
          curso_id: aula.curso_id,
          is_published: aula.is_published,
          suggestion: bestMatch ? {
            panda_id: bestMatch.id,
            panda_title: bestMatch.title,
            panda_status: bestMatch.status,
            confidence: bestConfidence,
          } : null,
        });
      } else {
        const pandaVideo = pandaVideoMap.get(aula.panda_video_id);
        if (pandaVideo?.status === "FAILED" || pandaVideo?.status === "ERROR") {
          failedVideos.push({
            aula_id: aula.id,
            aula_titulo: aula.titulo,
            panda_video_id: aula.panda_video_id,
            panda_status: pandaVideo.status,
          });
        }
      }
    }

    for (const pv of pandaVideos) {
      if (!supaVideoIds.has(pv.id)) {
        orphans.push({
          panda_id: pv.id,
          panda_title: pv.title || "Sem título",
          panda_status: pv.status,
          panda_folder_id: pv.folder_id || null,
        });
      }
    }

    console.log(`⚠️ Inconsistent: ${inconsistent.length}`);
    console.log(`🔸 Orphans: ${orphans.length}`);
    console.log(`📭 Missing embed: ${missingEmbed.length}`);
    console.log(`❌ Failed videos: ${failedVideos.length}`);

    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        supabase_aulas_with_video: aulasWithVideo.length,
        supabase_unique_video_ids: supaVideoIds.size,
        panda_total_videos: pandaVideos.length,
        inconsistent_count: inconsistent.length,
        orphan_count: orphans.length,
        missing_embed_count: missingEmbed.length,
        failed_videos_count: failedVideos.length,
        used_local_index: !!(indexVideos && indexVideos.length > 0),
      },
      inconsistent,
      orphans,
      missing_embed: missingEmbed,
      failed_videos: failedVideos,
    };

    console.log("📋 Audit complete:", JSON.stringify(report.summary));

    return new Response(JSON.stringify(report), { headers: corsHeaders });
  } catch (err) {
    console.error("Audit error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message || "Audit failed" }),
      { status: 500, headers: corsHeaders }
    );
  }
});
