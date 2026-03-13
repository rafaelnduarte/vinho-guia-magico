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

    // Validate user via getUser
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

      // Try assigning profile (non-blocking, with diagnostic logging)
      const profileId = Deno.env.get("PANDA_PROFILE_ID");
      if (profileId) {
        for (const video of videos) {
          try {
            console.log(`[panda-sync] Attempting profile assignment for video ${video.id} with PANDA_PROFILE_ID=${profileId}`);
            const profileRes = await fetch(`${PANDA_BASE}/videos/${video.id}`, {
              method: "PATCH",
              headers: { ...pandaHeaders, "Content-Type": "application/json" },
              body: JSON.stringify({ player_id: profileId }),
            });
            if (!profileRes.ok) {
              const errText = await profileRes.text();
              console.warn(`[panda-sync] Profile assignment failed for ${video.id} (${profileRes.status}): ${errText}`);
            } else {
              console.log(`[panda-sync] Profile assigned successfully for ${video.id}`);
            }
          } catch (profileErr) {
            console.warn(`[panda-sync] Profile assignment exception for ${video.id}: ${(profileErr as Error).message}`);
          }
        }
      } else {
        console.log("[panda-sync] PANDA_PROFILE_ID not set, skipping profile assignment");
      }

      for (const [index, video] of videos.entries()) {
        // Fetch individual video details to get embed_url and embed_html
        let embedUrl: string | null = null;
        let embedHtml: string | null = null;

        try {
          console.log(`[panda-sync] Fetching details for video ${video.id}`);
          const detailRes = await fetch(`${PANDA_BASE}/videos/${video.id}`, {
            headers: pandaHeaders,
          });
          if (detailRes.ok) {
            const detail = await detailRes.json();
            embedUrl = detail.embed_url || detail.player_url || null;
            embedHtml = detail.embed_html || detail.embed_code || detail.embed || null;
            console.log(`[panda-sync] Video ${video.id}: embed_url=${embedUrl ? "YES" : "NO"}, embed_html=${embedHtml ? "YES" : "NO"}`);
          } else {
            console.warn(`[panda-sync] Detail fetch failed for ${video.id}: ${detailRes.status}`);
          }
        } catch (detailErr) {
          console.warn(`[panda-sync] Detail fetch exception for ${video.id}: ${(detailErr as Error).message}`);
        }

        // Fallback: build embed_url if API didn't provide one
        if (!embedUrl && video.id) {
          embedUrl = `https://player-vz-7b95acb0-d42.tv.pandavideo.com.br/embed/?v=${video.id}`;
          console.log(`[panda-sync] Using fallback embed_url for ${video.id}`);
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
            embed_html: embedHtml,
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
      status: 500, headers: corsHeaders,
    });
  }
});
