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

    const results = {
      folders_synced: 0,
      videos_synced: 0,
      errors: [] as string[],
    };

    // 1. Fetch all folders from Panda
    const foldersRes = await fetch(`${PANDA_BASE}/folders`, {
      headers: { Authorization: apiKey, Accept: "application/json" },
    });
    const foldersData = await foldersRes.json();
    const folders = foldersData.folders ?? [];

    for (const folder of folders) {
      // 2. Upsert curso
      const { data: cursoData, error: cursoError } = await supabase
        .from("cursos")
        .upsert(
          {
            panda_folder_id: folder.id,
            titulo: folder.name,
            is_published: false,
          },
          { onConflict: "panda_folder_id" }
        )
        .select("id")
        .single();

      if (cursoError) {
        results.errors.push(`Folder ${folder.name}: ${cursoError.message}`);
        continue;
      }

      const cursoId = cursoData.id;
      results.folders_synced++;

      // 3. Upsert default module "Geral"
      const { data: moduloData, error: moduloError } = await supabase
        .from("modulos")
        .upsert(
          {
            curso_id: cursoId,
            titulo: "Geral",
            sort_order: 0,
          },
          { onConflict: "curso_id,titulo" }
        )
        .select("id")
        .single();

      // Fallback: if upsert failed, try fetching existing
      let moduloId: string;
      if (moduloError || !moduloData) {
        console.log(`Modulo upsert issue for ${folder.name}:`, moduloError?.message);
        const { data: existing } = await supabase
          .from("modulos")
          .select("id")
          .eq("curso_id", cursoId)
          .eq("titulo", "Geral")
          .single();
        if (!existing) {
          results.errors.push(
            `Module for ${folder.name}: could not create or find`
          );
          continue;
        }
        moduloId = existing.id;
      } else {
        moduloId = moduloData.id;
      }

      console.log(`Folder "${folder.name}" → curso=${cursoId}, modulo=${moduloId}`);

      // 4. Fetch videos for this folder
      const videosRes = await fetch(
        `${PANDA_BASE}/videos?folder_id=${folder.id}`,
        { headers: { Authorization: apiKey, Accept: "application/json" } }
      );
      const videosData = await videosRes.json();
      const videos = videosData.videos ?? [];

      console.log(`Folder "${folder.name}": ${videos.length} videos found`);

      for (const video of videos) {
        console.log(`Syncing video: "${video.title}" (id=${video.id}, status=${video.status})`);

        const { data: aulaData, error: aulaError } = await supabase.from("aulas").upsert(
          {
            panda_video_id: video.id,
            curso_id: cursoId,
            modulo_id: moduloId,
            titulo: video.title || "Sem título",
            duracao_segundos: Math.floor(video.length || 0),
            is_published: video.status === "CONVERTED",
          },
          { onConflict: "panda_video_id" }
        );

        if (aulaError) {
          console.log(`VIDEO ERROR for "${video.title}":`, aulaError.message, aulaError.details);
          results.errors.push(
            `Video ${video.title}: ${aulaError.message}`
          );
          continue;
        }
        console.log(`Video "${video.title}" synced OK`);
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
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
