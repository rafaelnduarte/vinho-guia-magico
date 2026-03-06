import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Sensitive fields to redact from stored payloads
const SENSITIVE_KEYS = [
  "userDocument", "user_document", "document", "cpf", "cnpj",
  "creditCardLR", "credit_card", "card_number", "card_hash",
  "card_expiration", "card_cvv", "card_holder",
  "password", "token", "secret",
];

function redactPayload(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(redactPayload);

  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.some((sk) => key.toLowerCase().includes(sk.toLowerCase()))) {
      result[key] = "[REDACTED]";
    } else if (typeof value === "object") {
      result[key] = redactPayload(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function extractRelevantHeaders(req: Request): Record<string, string> {
  const relevant = [
    "x-hubla-token", "x-hubla-idempotency", "x-hubla-sandbox",
    "content-type", "user-agent",
  ];
  const headers: Record<string, string> = {};
  for (const key of relevant) {
    const val = req.headers.get(key);
    if (val) {
      // Redact the token value
      headers[key] = key === "x-hubla-token" ? "[REDACTED]" : val;
    }
  }
  return headers;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  const WEBHOOK_SECRET = Deno.env.get("HUBLA_WEBHOOK_SECRET");
  if (!WEBHOOK_SECRET) {
    console.error("HUBLA_WEBHOOK_SECRET not configured");
    return jsonResponse(500, { error: "Server misconfigured" });
  }

  // --- Token Validation (Hubla sends plain token in x-hubla-token) ---
  const token = req.headers.get("x-hubla-token");
  if (!token) {
    console.error("Missing x-hubla-token header");
    return jsonResponse(401, { error: "Missing signature" });
  }

  if (token !== WEBHOOK_SECRET) {
    console.error("Token mismatch");
    return jsonResponse(401, { error: "Invalid signature" });
  }

  let body: string;
  let payload: any;

  try {
    body = await req.text();
    payload = JSON.parse(body);
  } catch {
    return jsonResponse(400, { error: "Invalid JSON" });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // --- Idempotency (via x-hubla-idempotency header or payload) ---
  const eventId =
    req.headers.get("x-hubla-idempotency") ??
    payload.id ??
    payload.event_id ??
    crypto.randomUUID();
  const eventType = payload.type ?? "unknown";

  const { data: existing } = await supabase
    .from("webhook_events")
    .select("id")
    .eq("event_id", eventId)
    .maybeSingle();

  if (existing) {
    await logWebhook(supabase, eventId, "duplicate_skipped", "info");
    return jsonResponse(200, { status: "already_processed" });
  }

  // --- Store webhook event (with redacted payload and headers) ---
  const redactedPayload = redactPayload(payload);
  const relevantHeaders = extractRelevantHeaders(req);

  await supabase.from("webhook_events").insert({
    event_id: eventId,
    event_type: eventType,
    payload: { ...redactedPayload, _headers: relevantHeaders },
  });

  // --- Process event (use original payload for data extraction) ---
  try {
    const event = payload.event ?? payload;
    
    // Hubla v2: data is nested under event.user, event.subscription, event.product
    const email =
      event.user?.email ??
      event.subscription?.payer?.email ??
      event.invoice?.payer?.email ??
      event.userEmail ??          // legacy fallback
      event.email;

    const firstName = event.user?.firstName ?? event.user?.first_name ?? "";
    const lastName = event.user?.lastName ?? event.user?.last_name ?? "";
    const fullName =
      [firstName, lastName].filter(Boolean).join(" ") ||
      (event.user?.name ?? event.userName ?? null);

    const externalId =
      event.subscription?.id ??
      event.invoice?.id ??
      event.subscriptionId ??
      event.invoiceId ??
      eventId;

    // Detect product to determine membership_type
    const productName = (
      event.product?.name ??
      event.products?.[0]?.name ??
      event.productName ??
      event.product_name ??
      event.planName ??
      event.plan_name ??
      ""
    ).toLowerCase();
    const membershipType = productName.includes("radar") ? "radar" : "comunidade";

    if (!email) {
      // Log available paths for debugging
      await logWebhook(supabase, eventId, "no_email_found", "warn", {
        event_type: eventType,
        available_keys: Object.keys(event),
        has_user: !!event.user,
        has_subscription: !!event.subscription,
        has_invoice: !!event.invoice,
      });
      return jsonResponse(200, { status: "no_email" });
    }

    if (isActivationEvent(eventType)) {
      await handleActivation(supabase, eventId, email, fullName, externalId, membershipType);
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

function isActivationEvent(type: string): boolean {
  const activations = [
    "NewUser",
    "subscription.activated",
    "subscription.renewed",
    "purchase.approved",
    "purchase.completed",
    "payment.approved",
    "invoice.paid",
  ];
  return activations.includes(type);
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
  return cancellations.includes(type);
}

async function logWebhook(
  supabase: any,
  eventId: string | null,
  action: string,
  status: string,
  details?: Record<string, any>
) {
  // Redact details too before storing
  await supabase.from("webhook_logs").insert({
    event_id: eventId,
    action,
    status,
    details: details ? redactPayload(details) : {},
  });
}

async function handleActivation(
  supabase: any,
  eventId: string,
  email: string,
  fullName: string | null,
  externalId: string,
  membershipType: string
) {
  let userId: string;
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const existingUser = existingUsers?.users?.find(
    (u: any) => u.email?.toLowerCase() === email.toLowerCase()
  );

  if (existingUser) {
    userId = existingUser.id;
  } else {
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

  const { data: existingMembership } = await supabase
    .from("memberships")
    .select("id, status")
    .eq("user_id", userId)
    .eq("source", "hubla")
    .maybeSingle();

  if (existingMembership) {
    await supabase
      .from("memberships")
      .update({ status: "active", ended_at: null, external_id: externalId, membership_type: membershipType })
      .eq("id", existingMembership.id);
  } else {
    await supabase.from("memberships").insert({
      user_id: userId,
      status: "active",
      source: "hubla",
      external_id: externalId,
      membership_type: membershipType,
    });
  }

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
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const user = existingUsers?.users?.find(
    (u: any) => u.email?.toLowerCase() === email.toLowerCase()
  );

  if (!user) {
    await logWebhook(supabase, eventId, "cancel_user_not_found", "warn", { email });
    return;
  }

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
