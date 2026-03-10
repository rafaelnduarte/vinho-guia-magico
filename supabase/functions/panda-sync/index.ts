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
      // PASSO 1 — Upsert curso + fetch id separately
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
      console.log(`cursoId: ${cursoId} (folder: "${folder.name}")`);

      // PASSO 2 — Select-then-insert module
      let { data: moduloData } = await supabase
        .from("modulos")
        .select("id")
        .eq("curso_id", cursoId)
        .order("sort_order", { ascending: true })
        .limit(1)
        .single();

      if (!moduloData) {
        const { data: novoModulo, error: moduloInsertErr } = await supabase
          .from("modulos")
          .insert({
            curso_id: cursoId,
            titulo: "Módulo 1",
            sort_order: 1,
          })
          .select("id")
          .single();

        if (moduloInsertErr || !novoModulo) {
          results.errors.push(`Module for ${folder.name}: ${moduloInsertErr?.message || "insert failed"}`);
          continue;
        }
        moduloData = novoModulo;
      }

      const moduloId = moduloData.id;
      console.log(`moduloId: ${moduloId}`);

      // PASSO 3 — Fetch videos for this folder
      const videosRes = await fetch(
        `${PANDA_BASE}/videos?folder_id=${folder.id}`,
        { headers: { Authorization: apiKey, Accept: "application/json" } }
      );
      const videosData = await videosRes.json();
      const videos = videosData.videos ?? [];

      console.log(`videos a sincronizar: ${videos.length}`);

      for (const [index, video] of videos.entries()) {
        console.log(`Syncing video [${index + 1}/${videos.length}]: "${video.title}" (id=${video.id})`);

        const { error: aulaError } = await supabase.from("aulas").upsert(
          {
            panda_video_id: video.id,
            curso_id: cursoId,
            modulo_id: moduloId,
            titulo: video.title || "Sem título",
            descricao: "",
            duracao_segundos: Math.floor(video.length || 0),
            sort_order: index + 1,
            is_published: video.status === "CONVERTED",
          },
          { onConflict: "panda_video_id" }
        );

        if (aulaError) {
          console.log(`VIDEO ERROR: ${aulaError.message}`, aulaError.details);
          results.errors.push(`${video.title}: ${aulaError.message}`);
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
