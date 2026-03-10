import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const expectedToken = Deno.env.get("PANDA_WEBHOOK_TOKEN");

  if (!token || token !== expectedToken) {
    return new Response(JSON.stringify({ error: "Invalid token" }), {
      status: 401,
      headers: corsHeaders,
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const payload = await req.json();
    const eventType = payload.event || payload.action || "unknown";
    const eventId = payload.id || crypto.randomUUID();

    // Log event
    await supabase.from("webhook_logs").insert({
      event_id: eventId,
      action: `panda.${eventType}`,
      status: "received",
      details: payload,
    });

    // Process based on event type
    if (eventType === "folder.created" && payload.folder) {
      const folder = payload.folder;
      await supabase.from("cursos").insert({
        titulo: folder.name || "Sem título",
        panda_folder_id: folder.id,
        is_published: false,
      });
    } else if (eventType === "video.created" && payload.video) {
      const video = payload.video;
      // Find curso by folder_id
      const { data: curso } = await supabase
        .from("cursos")
        .select("id")
        .eq("panda_folder_id", video.folder_id)
        .maybeSingle();

      if (curso) {
        await supabase.from("aulas").insert({
          curso_id: curso.id,
          titulo: video.title || video.name || "Sem título",
          panda_video_id: video.id,
          duracao_segundos: Math.round(video.duration || 0),
          is_published: false,
        });
      }

      // Assign profile to new video
      const profileId = Deno.env.get("PANDA_PROFILE_ID");
      const pandaApiKey = Deno.env.get("PANDA_API_KEY");
      if (profileId && pandaApiKey && video.id) {
        try {
          const profileRes = await fetch(
            "https://api-v2.pandavideo.com/profiles/?type=set-videos",
            {
              method: "POST",
              headers: {
                Authorization: pandaApiKey,
                Accept: "application/json",
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                profile_id: profileId,
                video_ids: [video.id],
              }),
            }
          );
          const profileBody = await profileRes.text();
          console.log(`Profile assigned to new video ${video.id}: status=${profileRes.status} body=${profileBody}`);
        } catch (profileErr) {
          console.error(`Profile assignment error for video ${video.id}:`, profileErr);
        }
      }
    } else if (
      eventType === "video.changeStatus" &&
      payload.status === "CONVERTED" &&
      payload.video_id
    ) {
      console.log('VIDEO.CHANGESTATUS RECEBIDO:', {
        videoId: payload.video_id,
        status: payload.status,
        external_id: payload.video_external_id
      });

      const { error: updateError } = await supabase
        .from("aulas")
        .update({ is_published: true, status: "completed", updated_at: new Date().toISOString() })
        .eq("panda_video_id", payload.video_id);

      if (updateError) {
        console.error('ERRO ao publicar aula:', updateError);
      } else {
        console.log('AULA PUBLICADA COM SUCESSO:', payload.video_id);
      }

    } else if (eventType === "video.encoded" && payload.video) {
      const video = payload.video;
      if (video.id) {
        const { error: updateError } = await supabase
          .from("aulas")
          .update({ is_published: true, status: "completed" })
          .eq("panda_video_id", video.id);

        if (updateError) {
          console.error('ERRO ao atualizar aula:', updateError);
        } else {
          console.log('AULA PUBLICADA (fallback):', video.id);
        }
      }

    } else if (eventType === "video.deleted" && payload.video) {
      const video = payload.video;
      if (video.id) {
        await supabase
          .from("aulas")
          .update({ is_published: false })
          .eq("panda_video_id", video.id);
      }
    } else if (eventType === "folder.deleted" && payload.folder) {
      const folder = payload.folder;
      if (folder.id) {
        await supabase
          .from("cursos")
          .update({ is_published: false })
          .eq("panda_folder_id", folder.id);
      }
    } else {
      console.log('EVENTO NÃO MAPEADO:', eventType);
    }

    // Update log status
    await supabase
      .from("webhook_logs")
      .update({ status: "processed" })
      .eq("event_id", eventId)
      .eq("action", `panda.${eventType}`);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
