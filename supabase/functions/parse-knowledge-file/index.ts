import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_PDF_SIZE_MB = 20;

// Efficient base64 encoder that processes in chunks to avoid memory spikes
function toBase64Chunked(bytes: Uint8Array): string {
  const CHUNK = 32768; // 32KB chunks
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const slice = bytes.subarray(i, Math.min(i + CHUNK, bytes.length));
    parts.push(String.fromCharCode(...slice));
  }
  return btoa(parts.join(""));
}

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

      // Read bytes and immediately release the Blob
      const bytes = new Uint8Array(await fileData.arrayBuffer());
      const fileSizeMB = bytes.byteLength / (1024 * 1024);
      console.log(`Processing PDF: ${file_name}, size: ${fileSizeMB.toFixed(1)}MB`);

      if (fileSizeMB > MAX_PDF_SIZE_MB) {
        return new Response(
          JSON.stringify({
            error: `PDF muito grande (${fileSizeMB.toFixed(0)}MB). O limite é ${MAX_PDF_SIZE_MB}MB.`,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Encode to base64 then release the raw bytes
      const base64 = toBase64Chunked(bytes);
      // bytes is now eligible for GC

      // Build the request body as a string to control memory
      const bodyStr = JSON.stringify({
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
      });

      const MAX_RETRIES = 3;
      let lastError = "";

      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        if (attempt > 0) {
          const delay = Math.min(2000 * Math.pow(2, attempt - 1), 10000);
          console.log(`Retry ${attempt}/${MAX_RETRIES} after ${delay}ms...`);
          await new Promise((r) => setTimeout(r, delay));
        }

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
            body: bodyStr,
          });

          clearTimeout(timeout);

          if (aiResponse.status >= 500) {
            lastError = `${aiResponse.status} ${await aiResponse.text()}`;
            console.error(`AI extraction error (attempt ${attempt + 1}):`, lastError);
            continue; // retry on 5xx
          }

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
          break; // success
        } catch (e) {
          clearTimeout(timeout);
          lastError = e instanceof Error ? e.message : String(e);
          console.error(`AI fetch error (attempt ${attempt + 1}):`, lastError);
          if (attempt === MAX_RETRIES - 1) {
            const isTimeout = lastError.includes("abort");
            return new Response(
              JSON.stringify({ error: isTimeout ? "Timeout: o arquivo é muito grande para processar" : `Falha após ${MAX_RETRIES} tentativas: ${lastError}` }),
              { status: isTimeout ? 504 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
      }

      if (!extractedText && lastError) {
        return new Response(
          JSON.stringify({ error: `Falha após ${MAX_RETRIES} tentativas: ${lastError}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
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
