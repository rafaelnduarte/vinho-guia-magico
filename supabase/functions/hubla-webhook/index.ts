import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const REPLAY_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const WEBHOOK_SECRET = Deno.env.get("HUBLA_WEBHOOK_SECRET");
  if (!WEBHOOK_SECRET) {
    console.error("HUBLA_WEBHOOK_SECRET not configured");
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let body: string;
  let payload: any;

  try {
    body = await req.text();
    payload = JSON.parse(body);
  } catch {
    return jsonResponse(400, { error: "Invalid JSON" });
  }

  // --- HMAC Validation ---
  const signature = req.headers.get("x-hubla-signature") ?? req.headers.get("x-webhook-signature") ?? "";
  if (!signature) {
    return jsonResponse(401, { error: "Missing signature" });
  }

  const isValid = await verifyHmac(WEBHOOK_SECRET, body, signature);
  if (!isValid) {
    await logWebhook(supabase, null, "signature_invalid", "error", { signature });
    return jsonResponse(401, { error: "Invalid signature" });
  }

  // --- Replay Protection ---
  const timestamp = req.headers.get("x-hubla-timestamp") ?? req.headers.get("x-webhook-timestamp");
  if (timestamp) {
    const tsMs = parseInt(timestamp) * 1000 || Date.parse(timestamp);
    if (!isNaN(tsMs) && Math.abs(Date.now() - tsMs) > REPLAY_WINDOW_MS) {
      await logWebhook(supabase, null, "replay_rejected", "error", { timestamp });
      return jsonResponse(403, { error: "Request too old or too far in future" });
    }
  }

  // --- Idempotency ---
  const eventId = payload.id ?? payload.event_id ?? crypto.randomUUID();
  const eventType = payload.event ?? payload.type ?? "unknown";

  const { data: existing } = await supabase
    .from("webhook_events")
    .select("id")
    .eq("event_id", eventId)
    .maybeSingle();

  if (existing) {
    await logWebhook(supabase, eventId, "duplicate_skipped", "info");
    return jsonResponse(200, { status: "already_processed" });
  }

  // --- Store webhook event ---
  await supabase.from("webhook_events").insert({
    event_id: eventId,
    event_type: eventType,
    payload,
  });

  // --- Process event ---
  try {
    const email = payload.customer?.email ?? payload.buyer?.email ?? payload.user?.email;
    const fullName = payload.customer?.name ?? payload.buyer?.name ?? payload.user?.name;
    const externalId = payload.subscription_id ?? payload.purchase_id ?? eventId;

    if (!email) {
      await logWebhook(supabase, eventId, "no_email_found", "warn", { payload });
      return jsonResponse(200, { status: "no_email" });
    }

    if (isActivationEvent(eventType)) {
      await handleActivation(supabase, eventId, email, fullName, externalId);
    } else if (isCancellationEvent(eventType)) {
      await handleCancellation(supabase, eventId, email, externalId);
    } else {
      await logWebhook(supabase, eventId, "event_ignored", "info", { eventType });
    }

    return jsonResponse(200, { status: "processed", event_id: eventId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await logWebhook(supabase, eventId, "processing_error", "error", { error: msg });
    return jsonResponse(500, { error: "Processing failed" });
  }
});

// ---- Helpers ----

function jsonResponse(status: number, body: Record<string, any>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function verifyHmac(secret: string, body: string, signature: string): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
    const computed = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Compare constant-time (strip sha256= prefix if present)
    const clean = signature.replace(/^sha256=/, "").toLowerCase();
    if (computed.length !== clean.length) return false;
    let diff = 0;
    for (let i = 0; i < computed.length; i++) {
      diff |= computed.charCodeAt(i) ^ clean.charCodeAt(i);
    }
    return diff === 0;
  } catch {
    return false;
  }
}

function isActivationEvent(type: string): boolean {
  const activations = [
    "subscription.activated",
    "subscription.renewed",
    "purchase.approved",
    "purchase.completed",
    "payment.approved",
    "invoice.paid",
  ];
  return activations.includes(type.toLowerCase());
}

function isCancellationEvent(type: string): boolean {
  const cancellations = [
    "subscription.cancelled",
    "subscription.canceled",
    "subscription.expired",
    "purchase.refunded",
    "purchase.chargeback",
    "payment.refunded",
  ];
  return cancellations.includes(type.toLowerCase());
}

async function logWebhook(
  supabase: any,
  eventId: string | null,
  action: string,
  status: string,
  details?: Record<string, any>
) {
  await supabase.from("webhook_logs").insert({
    event_id: eventId,
    action,
    status,
    details: details ?? {},
  });
}

async function handleActivation(
  supabase: any,
  eventId: string,
  email: string,
  fullName: string | null,
  externalId: string
) {
  // 1. Ensure user exists in auth
  let userId: string;
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const existingUser = existingUsers?.users?.find(
    (u: any) => u.email?.toLowerCase() === email.toLowerCase()
  );

  if (existingUser) {
    userId = existingUser.id;
  } else {
    // Create user with random password (they'll use password reset)
    const tempPassword = crypto.randomUUID() + "Aa1!";
    const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
      email: email.toLowerCase(),
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: fullName ?? email.split("@")[0] },
    });
    if (createErr) throw new Error(`Failed to create user: ${createErr.message}`);
    userId = newUser.user.id;
    await logWebhook(supabase, eventId, "user_created", "success", { userId, email });
  }

  // 2. Ensure membership exists and is active
  const { data: existingMembership } = await supabase
    .from("memberships")
    .select("id, status")
    .eq("user_id", userId)
    .eq("source", "hubla")
    .maybeSingle();

  if (existingMembership) {
    await supabase
      .from("memberships")
      .update({ status: "active", ended_at: null, external_id: externalId })
      .eq("id", existingMembership.id);
  } else {
    await supabase.from("memberships").insert({
      user_id: userId,
      status: "active",
      source: "hubla",
      external_id: externalId,
    });
  }

  // 3. Ensure role exists (trigger may have already created it)
  const { data: existingRole } = await supabase
    .from("user_roles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!existingRole) {
    await supabase.from("user_roles").insert({ user_id: userId, role: "member" });
  }

  await logWebhook(supabase, eventId, "activation_complete", "success", { userId, email });
}

async function handleCancellation(
  supabase: any,
  eventId: string,
  email: string,
  externalId: string
) {
  // Find user
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const user = existingUsers?.users?.find(
    (u: any) => u.email?.toLowerCase() === email.toLowerCase()
  );

  if (!user) {
    await logWebhook(supabase, eventId, "cancel_user_not_found", "warn", { email });
    return;
  }

  // Deactivate membership
  const { data: membership } = await supabase
    .from("memberships")
    .select("id")
    .eq("user_id", user.id)
    .eq("source", "hubla")
    .eq("status", "active")
    .maybeSingle();

  if (membership) {
    await supabase
      .from("memberships")
      .update({ status: "inactive", ended_at: new Date().toISOString() })
      .eq("id", membership.id);
  }

  await logWebhook(supabase, eventId, "cancellation_complete", "success", {
    userId: user.id,
    email,
  });
}
