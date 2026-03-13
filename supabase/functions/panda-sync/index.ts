import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json",
};

const PANDA_BASE = "https://api-v2.pandavideo.com.br";

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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: corsHeaders,
      });
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData, error: userError } = await anonClient.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: corsHeaders,
      });
    }

    const userId = userData.user.id;
    const { data: roleCheck } = await anonClient.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });

    if (!roleCheck) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: corsHeaders,
      });
    }

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

    let targetFolderId: string | null = null;
    try {
      const body = await req.json();
      targetFolderId = body?.folder_id || null;
    } catch {
      // No body — full sync
    }

    const results = {
      folders_synced: 0,
      videos_synced: 0,
      errors: [] as string[],
    };

    const pandaHeaders = { Authorization: apiKey, Accept: "application/json" };

    // Determine which folders to sync
    let foldersToSync: Array<{ id: string; name: string }> = [];

    if (targetFolderId) {
      const folderRes = await fetch(`${PANDA_BASE}/folders/${targetFolderId}`, {
        headers: pandaHeaders,
      });
      if (folderRes.ok) {
        const folderData = await folderRes.json();
        foldersToSync = [{ id: targetFolderId, name: folderData.name || targetFolderId }];
      } else {
        foldersToSync = [{ id: targetFolderId, name: targetFolderId }];
      }
    } else {
      const foldersRes = await fetch(`${PANDA_BASE}/folders`, {
        headers: pandaHeaders,
      });
      const foldersData = await foldersRes.json();
      foldersToSync = foldersData.folders ?? [];
    }

    let loggedSampleResponse = false;

    for (const folder of foldersToSync) {
      // Upsert curso
      const { error: cursoUpsertErr } = await supabase
        .from("cursos")
        .upsert(
          {
            panda_folder_id: folder.id,
            titulo: folder.name,
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

      // Fetch videos list for this folder
      const videosRes = await fetch(
        `${PANDA_BASE}/videos?folder_id=${folder.id}`,
        { headers: pandaHeaders }
      );
      const videosData = await videosRes.json();
      const videos = videosData.videos ?? [];

      for (const [index, video] of videos.entries()) {
        // Fetch individual video details to discover available fields
        let embedUrl: string | null = null;

        try {
          const detailRes = await fetch(`${PANDA_BASE}/videos/${video.id}`, {
            headers: pandaHeaders,
          });
          if (detailRes.ok) {
            const detail = await detailRes.json();

            // Log the full response keys ONCE for diagnosis
            if (!loggedSampleResponse) {
              console.log(`[panda-sync] SAMPLE video detail keys: ${JSON.stringify(Object.keys(detail))}`);
              // Log player-related fields specifically
              const playerFields = Object.entries(detail)
                .filter(([k]) => /player|embed|url|link|iframe/i.test(k))
                .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {});
              console.log(`[panda-sync] SAMPLE player-related fields: ${JSON.stringify(playerFields)}`);
              loggedSampleResponse = true;
            }

            // Try all known possible field names from Panda API
            embedUrl = detail.embed_url || detail.player_url || detail.video_player || null;
          } else {
            console.warn(`[panda-sync] Detail fetch failed for ${video.id}: ${detailRes.status}`);
          }
        } catch (detailErr) {
          console.warn(`[panda-sync] Detail fetch exception for ${video.id}: ${(detailErr as Error).message}`);
        }

        // Construct embed URL from video ID (this is the standard Panda format)
        if (!embedUrl && video.id) {
          embedUrl = `https://player-vz-7b95acb0-d42.tv.pandavideo.com.br/embed/?v=${video.id}`;
        }

        const { error: aulaError } = await supabase.from("aulas").upsert(
          {
            panda_video_id: video.id,
            curso_id: cursoId,
            titulo: video.title || "Sem título",
            descricao: "",
            duracao_segundos: Math.floor(video.length || 0),
            sort_order: index + 1,
            is_published: video.status === "CONVERTED",
            thumbnail_url: video.thumbnail || video.thumbnail_url || null,
            status: mapPandaStatus(video.status || ""),
            embed_url: embedUrl,
          },
          { onConflict: "panda_video_id" }
        );

        if (aulaError) {
          results.errors.push(`${video.title}: ${aulaError.message}`);
          continue;
        }

        results.videos_synced++;
      }
    }

    console.log(`[panda-sync] Done: ${results.folders_synced} folders, ${results.videos_synced} videos, ${results.errors.length} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Sincronização concluída",
        ...results,
      }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err) {
    console.error(`[panda-sync] Fatal error: ${(err as Error).message}`);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: corsHeaders,
    });
  }
});
