import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
};

const PANDA_BASE = "https://api-v2.pandavideo.com";

function normalizeScrappy(str: string): string {
  return (str || "")
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

function mapPandaStatus(pandaStatus: string): string {
  if (pandaStatus === "CONVERTED") return "completed";
  if (pandaStatus === "FAILED" || pandaStatus === "ERROR") return "failed";
  return "processing";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth: verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } =
      await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const userId = claimsData.claims.sub;
    const { data: roleCheck } = await anonClient.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });

    if (!roleCheck) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: corsHeaders,
      });
    }

    // Use service role for writes
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const apiKey = Deno.env.get("PANDA_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "PANDA_API_KEY not configured" }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Check for optional folder_id in body (per-course sync)
    let targetFolderId: string | null = null;
    try {
      const body = await req.json();
      targetFolderId = body?.folder_id || null;
    } catch {
      // No body or invalid JSON — sync all folders
    }

    const results = {
      folders_synced: 0,
      videos_synced: 0,
      normalized_count: 0,
      videos_indexed: 0,
      errors: [] as string[],
    };

    // Track all synced panda_video_ids for orphan cleanup
    const allSyncedVideoIds: string[] = [];

    // Determine which folders to sync
    let foldersToSync: Array<{ id: string; name: string }> = [];

    if (targetFolderId) {
      const folderRes = await fetch(`${PANDA_BASE}/folders/${targetFolderId}`, {
        headers: { Authorization: apiKey, Accept: "application/json" },
      });
      if (folderRes.ok) {
        const folderData = await folderRes.json();
        foldersToSync = [{ id: targetFolderId, name: folderData.name || targetFolderId }];
      } else {
        foldersToSync = [{ id: targetFolderId, name: targetFolderId }];
      }
    } else {
      const foldersRes = await fetch(`${PANDA_BASE}/folders`, {
        headers: { Authorization: apiKey, Accept: "application/json" },
      });
      const foldersData = await foldersRes.json();
      foldersToSync = foldersData.folders ?? [];
    }

    for (const folder of foldersToSync) {
      // PASSO 1 — Upsert curso with titulo_normalizado
      const { error: cursoUpsertErr } = await supabase
        .from("cursos")
        .upsert(
          {
            panda_folder_id: folder.id,
            titulo: folder.name,
            titulo_normalizado: normalizeScrappy(folder.name),
            is_published: false,
          },
          { onConflict: "panda_folder_id" }
        );

      if (cursoUpsertErr) {
        results.errors.push(`Folder ${folder.name}: ${cursoUpsertErr.message}`);
        continue;
      }

      const { data: cursoData } = await supabase
        .from("cursos")
        .select("id")
        .eq("panda_folder_id", folder.id)
        .single();

      if (!cursoData) {
        results.errors.push(`Folder ${folder.name}: could not find curso after upsert`);
        continue;
      }

      const cursoId = cursoData.id;
      results.folders_synced++;
      console.log(`cursoId: ${cursoId} (folder: "${folder.name}")`);

      // PASSO 2 — Fetch videos and upsert aulas
      const videosRes = await fetch(
        `${PANDA_BASE}/videos?folder_id=${folder.id}`,
        { headers: { Authorization: apiKey, Accept: "application/json" } }
      );
      const videosData = await videosRes.json();
      const videos = videosData.videos ?? [];

      console.log(`videos a sincronizar: ${videos.length}`);

      const syncedVideoIds: string[] = [];
      const indexRows: Array<{
        panda_video_id: string;
        titulo_original: string;
        titulo_normalizado: string;
        curso_id: string;
        last_synced_at: string;
      }> = [];

      for (const [index, video] of videos.entries()) {
        console.log(`Syncing video [${index + 1}/${videos.length}]: "${video.title}" (id=${video.id})`);

        const tituloNormalizado = normalizeScrappy(video.title || "");

        const { error: aulaError } = await supabase.from("aulas").upsert(
          {
            panda_video_id: video.id,
            curso_id: cursoId,
            titulo: video.title || "Sem título",
            titulo_normalizado: tituloNormalizado,
            descricao: "",
            duracao_segundos: Math.floor(video.length || 0),
            sort_order: index + 1,
            is_published: video.status === "CONVERTED",
            thumbnail_url: video.thumbnail || video.thumbnail_url || null,
            status: mapPandaStatus(video.status || ""),
          },
          { onConflict: "panda_video_id" }
        );

        if (aulaError) {
          console.log(`VIDEO ERROR: ${aulaError.message}`, aulaError.details);
          results.errors.push(`${video.title}: ${aulaError.message}`);
          continue;
        }

        console.log(`Video "${video.title}" synced OK → normalized: "${tituloNormalizado}"`);
        syncedVideoIds.push(video.id);
        allSyncedVideoIds.push(video.id);
        results.videos_synced++;
        results.normalized_count++;

        // Prepare index row
        indexRows.push({
          panda_video_id: video.id,
          titulo_original: video.title || "Sem título",
          titulo_normalizado: tituloNormalizado,
          curso_id: cursoId,
          last_synced_at: new Date().toISOString(),
        });
      }

      // PASSO 3 — Upsert panda_title_index for this folder
      if (indexRows.length > 0) {
        const { error: indexError } = await supabase
          .from("panda_title_index")
          .upsert(indexRows, { onConflict: "panda_video_id" });

        if (indexError) {
          console.error(`Index upsert error for folder "${folder.name}": ${indexError.message}`);
          results.errors.push(`Index ${folder.name}: ${indexError.message}`);
        } else {
          console.log(`Index updated: ${indexRows.length} entries for folder "${folder.name}"`);
        }
      }

      // Assign profile to all synced videos
      const profileId = Deno.env.get("PANDA_PROFILE_ID");
      if (profileId && syncedVideoIds.length > 0) {
        try {
          const profileRes = await fetch(
            `https://api-v2.pandavideo.com.br/profile/?type=set-videos`,
            {
              method: "POST",
              headers: {
                Authorization: apiKey,
                Accept: "application/json",
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                profile: profileId,
                videos: syncedVideoIds,
              }),
            }
          );
          const profileBody = await profileRes.text();
          console.log(`Profile assignment for folder "${folder.name}": status=${profileRes.status} body=${profileBody}`);
        } catch (profileErr) {
          console.error(`Profile assignment error for folder "${folder.name}":`, profileErr);
          results.errors.push(`Profile assignment ${folder.name}: ${(profileErr as Error).message}`);
        }
      } else if (!profileId) {
        console.log("PANDA_PROFILE_ID not set, skipping profile assignment");
      }
    }

    // PASSO 4 — Full sync: clean orphan entries from panda_title_index
    if (!targetFolderId && allSyncedVideoIds.length > 0) {
      const { error: cleanupError, count } = await supabase
        .from("panda_title_index")
        .delete()
        .not("panda_video_id", "in", `(${allSyncedVideoIds.join(",")})`);

      if (cleanupError) {
        console.error(`Orphan cleanup error: ${cleanupError.message}`);
        results.errors.push(`Orphan cleanup: ${cleanupError.message}`);
      } else {
        console.log(`Orphan cleanup: removed ${count ?? 0} stale index entries`);
      }
    }

    // PASSO 5 — Populate panda_videos_index with ALL Panda videos (full catalog)
    try {
      console.log("📦 Fetching all Panda videos for full catalog index...");
      const allPandaVideos: any[] = [];
      let page = 1;
      const limit = 50;

      while (true) {
        const url = `https://api-v2.pandavideo.com.br/videos?page=${page}&limit=${limit}`;
        let res = await fetch(url, {
          headers: { Authorization: apiKey, Accept: "application/json" },
        });

        if (!res.ok) break;

        const data = await res.json();
        const videos = data.videos || data;
        if (!Array.isArray(videos) || videos.length === 0) break;

        allPandaVideos.push(...videos);
        if (videos.length < limit) break;
        page++;
        await new Promise((r) => setTimeout(r, 200));
      }

      console.log(`📦 Total Panda videos fetched: ${allPandaVideos.length}`);

      // Upsert into panda_videos_index in batches of 50
      for (let i = 0; i < allPandaVideos.length; i += 50) {
        const batch = allPandaVideos.slice(i, i + 50).map((v: any) => ({
          id: v.id,
          title: v.title || "Sem título",
          title_normalized: normalizeScrappy(v.title || ""),
          status: v.status || null,
          folder_id: v.folder_id || null,
          created_at: v.created_at || null,
          updated_at: v.updated_at || null,
          synced_at: new Date().toISOString(),
        }));

        const { error: indexErr } = await supabase
          .from("panda_videos_index")
          .upsert(batch, { onConflict: "id" });

        if (indexErr) {
          console.error(`panda_videos_index upsert error batch ${i}: ${indexErr.message}`);
          results.errors.push(`Videos index batch ${i}: ${indexErr.message}`);
        } else {
          results.videos_indexed += batch.length;
        }
      }

      console.log(`📦 panda_videos_index populated: ${results.videos_indexed} entries`);
    } catch (indexErr) {
      console.error("panda_videos_index population error:", indexErr);
      results.errors.push(`Videos index: ${(indexErr as Error).message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Sincronização concluída",
        ...results,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
