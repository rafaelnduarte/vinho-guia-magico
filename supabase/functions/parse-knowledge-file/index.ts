import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getDocumentProxy, extractText } from "npm:unpdf@0.12.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_PDF_SIZE_MB = 20;

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

      try {
        // Use unpdf for direct text extraction - no AI needed
        const pdf = await getDocumentProxy(bytes);
        const { text } = await extractText(pdf, { mergePages: true });
        extractedText = text;
        console.log(`PDF text extracted: ${extractedText.length} chars`);
      } catch (pdfErr) {
        console.error("PDF extraction error:", pdfErr);
        return new Response(
          JSON.stringify({ error: `Falha ao extrair texto do PDF: ${pdfErr instanceof Error ? pdfErr.message : String(pdfErr)}` }),
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
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
