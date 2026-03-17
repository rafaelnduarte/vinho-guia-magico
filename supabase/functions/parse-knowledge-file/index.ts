import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encodeBase64 } from "https://deno.land/std@0.224.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_PDF_SIZE_MB = 8; // Reduced to prevent memory limit exceeded in edge functions

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    // Verify admin
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data: isAdmin } = await adminClient.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { file_path, file_name } = await req.json();
    if (!file_path) {
      return new Response(JSON.stringify({ error: "file_path required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ext = (file_name || file_path).split(".").pop()?.toLowerCase() ?? "";
    let extractedText = "";

    // Download file from storage
    const { data: fileData, error: downloadErr } = await adminClient.storage
      .from("knowledge-files")
      .download(file_path);

    if (downloadErr || !fileData) {
      return new Response(
        JSON.stringify({ error: `Failed to download: ${downloadErr?.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (["txt", "md", "csv", "tsv"].includes(ext)) {
      extractedText = await fileData.text();
    } else if (ext === "pdf") {
      if (!lovableApiKey) {
        return new Response(
          JSON.stringify({ error: "LOVABLE_API_KEY not configured for PDF parsing" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const arrayBuffer = await fileData.arrayBuffer();
      const fileSizeMB = arrayBuffer.byteLength / (1024 * 1024);
      console.log(`Processing PDF: ${file_name}, size: ${fileSizeMB.toFixed(1)}MB`);

      if (fileSizeMB > MAX_PDF_SIZE_MB) {
        return new Response(
          JSON.stringify({
            error: `PDF muito grande (${fileSizeMB.toFixed(0)}MB). O limite é ${MAX_PDF_SIZE_MB}MB. Reduza o tamanho do arquivo ou converta para .txt antes de importar.`,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Use Deno's standard base64 encoder (efficient, no stack overflow)
      const base64 = encodeBase64(new Uint8Array(arrayBuffer));

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5 * 60 * 1000);

      try {
        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableApiKey}`,
            "Content-Type": "application/json",
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              {
                role: "system",
                content:
                  "Você é um extrator de texto. Extraia TODO o texto do documento PDF fornecido, preservando a estrutura e formatação. Retorne APENAS o texto extraído, sem comentários adicionais.",
              },
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: `Extraia todo o texto deste PDF chamado "${file_name || file_path}". Preserve parágrafos, listas e estrutura.`,
                  },
                  {
                    type: "image_url",
                    image_url: {
                      url: `data:application/pdf;base64,${base64}`,
                    },
                  },
                ],
              },
            ],
            max_tokens: 32000,
          }),
        });

        if (!aiResponse.ok) {
          const errText = await aiResponse.text();
          console.error("AI extraction error:", aiResponse.status, errText);
          return new Response(
            JSON.stringify({ error: `Falha ao extrair texto do PDF via IA: ${aiResponse.status}` }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const aiData = await aiResponse.json();
        extractedText = aiData.choices?.[0]?.message?.content ?? "";
      } finally {
        clearTimeout(timeout);
      }
    } else {
      return new Response(
        JSON.stringify({ error: `Formato não suportado: .${ext}. Use .txt, .md, .csv ou .pdf` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ text: extractedText, chars: extractedText.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("parse-knowledge-file error:", e);
    const message = e instanceof Error ? e.message : "Unknown error";
    const isTimeout = message.includes("abort");
    return new Response(
      JSON.stringify({ error: isTimeout ? "Timeout: o arquivo é muito grande para processar" : message }),
      { status: isTimeout ? 504 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
