import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  // Auth: accept service_role key OR admin JWT
  const authHeader = req.headers.get("authorization");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  
  const isServiceRole = authHeader === `Bearer ${serviceRoleKey}`;

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    serviceRoleKey
  );

  if (!isServiceRole) {
    // Verify the caller is an admin user
    if (!authHeader) return json(401, { error: "Missing auth" });
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await supabaseUser.auth.getUser();
    if (!user) return json(401, { error: "Invalid token" });
    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (!isAdmin) return json(403, { error: "Admin only" });
  }

  // Parse body: optional { dry_run: boolean, event_ids: string[] }
  let body: any = {};
  try {
    body = await req.json();
  } catch { /* empty body is fine */ }

  const dryRun = body.dry_run === true;
  const specificIds: string[] | null = body.event_ids ?? null;

  // Find failed webhook events by joining with webhook_logs
  let query = supabaseAdmin
    .from("webhook_logs")
    .select("event_id")
    .eq("action", "no_email_found")
    .eq("status", "warn");

  const { data: failedLogs, error: logErr } = await query;
  if (logErr) return json(500, { error: logErr.message });

  const failedEventIds = [...new Set(
    (failedLogs ?? [])
      .map((l: any) => l.event_id)
      .filter(Boolean)
  )];

  // Filter to specific IDs if provided
  const targetIds = specificIds
    ? failedEventIds.filter((id: string) => specificIds.includes(id))
    : failedEventIds;

  if (targetIds.length === 0) {
    return json(200, { status: "nothing_to_reprocess", count: 0, results: [] });
  }

  // Fetch the actual webhook events in batches to avoid URL length limits
  const BATCH_SIZE = 30;
  const allEvents: any[] = [];
  for (let i = 0; i < targetIds.length; i += BATCH_SIZE) {
    const batch = targetIds.slice(i, i + BATCH_SIZE);
    const { data: batchEvents, error: evErr } = await supabaseAdmin
      .from("webhook_events")
      .select("*")
      .in("event_id", batch);
    if (evErr) return json(500, { error: evErr.message });
    if (batchEvents) allEvents.push(...batchEvents);
  }

  const events = allEvents;

  if (dryRun) {
    const preview = (events ?? []).map((e: any) => {
      const event = e.payload?.event ?? e.payload ?? {};
      const email =
        event.user?.email ??
        event.subscription?.payer?.email ??
        event.invoice?.payer?.email ??
        event.userEmail ??
        event.email ??
        null;
      const firstName = event.user?.firstName ?? event.user?.first_name ?? "";
      const lastName = event.user?.lastName ?? event.user?.last_name ?? "";
      const fullName = [firstName, lastName].filter(Boolean).join(" ") || (event.user?.name ?? null);
      const productName = (
        event.product?.name ?? event.products?.[0]?.name ?? event.productName ?? ""
      ).toLowerCase();
      const membershipType = productName.includes("radar") ? "radar" : "comunidade";

      return {
        event_id: e.event_id,
        event_type: e.event_type,
        email,
        full_name: fullName,
        membership_type: membershipType,
        can_process: !!email && isActivationEvent(e.event_type),
      };
    });
    return json(200, { status: "dry_run", count: preview.length, results: preview });
  }

  // Actually reprocess
  const results: any[] = [];

  for (const evt of (events ?? [])) {
    const event = evt.payload?.event ?? evt.payload ?? {};
    const email =
      event.user?.email ??
      event.subscription?.payer?.email ??
      event.invoice?.payer?.email ??
      event.userEmail ??
      event.email ??
      null;

    if (!email) {
      results.push({ event_id: evt.event_id, status: "skipped", reason: "no_email" });
      continue;
    }

    if (!isActivationEvent(evt.event_type) && !isCancellationEvent(evt.event_type)) {
      results.push({ event_id: evt.event_id, status: "skipped", reason: "irrelevant_event_type", event_type: evt.event_type });
      continue;
    }

    const firstName = event.user?.firstName ?? event.user?.first_name ?? "";
    const lastName = event.user?.lastName ?? event.user?.last_name ?? "";
    const fullName = [firstName, lastName].filter(Boolean).join(" ") || (event.user?.name ?? event.userName ?? null);

    const externalId =
      event.subscription?.id ?? event.invoice?.id ?? event.subscriptionId ?? evt.event_id;

    const productName = (
      event.product?.name ?? event.products?.[0]?.name ?? event.productName ?? ""
    ).toLowerCase();
    const membershipType = productName.includes("radar") ? "radar" : "comunidade";

    try {
      if (isActivationEvent(evt.event_type)) {
        await handleActivation(supabaseAdmin, evt.event_id, email, fullName, externalId, membershipType);
        results.push({ event_id: evt.event_id, status: "activated", email });
      } else {
        await handleCancellation(supabaseAdmin, evt.event_id, email, externalId);
        results.push({ event_id: evt.event_id, status: "cancelled", email });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ event_id: evt.event_id, status: "error", email, error: msg });
    }
  }

  const activated = results.filter((r) => r.status === "activated").length;
  const cancelled = results.filter((r) => r.status === "cancelled").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const errors = results.filter((r) => r.status === "error").length;

  return json(200, {
    status: "processed",
    summary: { total: results.length, activated, cancelled, skipped, errors },
    results,
  });
});

function json(status: number, body: Record<string, any>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isActivationEvent(type: string): boolean {
  return [
    "NewUser", "NewSale",
    "subscription.activated", "subscription.renewed", "subscription.created",
    "customer.member_added", "invoice.payment_succeeded",
    "purchase.approved", "purchase.completed",
    "payment.approved", "invoice.paid",
  ].includes(type);
}

function isCancellationEvent(type: string): boolean {
  return [
    "subscription.cancelled", "subscription.canceled", "subscription.expired",
    "subscription.deactivated", "customer.member_removed",
    "CanceledSale", "CanceledSubscription",
    "purchase.refunded", "purchase.chargeback",
    "payment.refunded", "invoice.refunded",
  ].includes(type);
}

async function logWebhook(
  supabase: any, eventId: string | null, action: string, status: string, details?: Record<string, any>
) {
  await supabase.from("webhook_logs").insert({
    event_id: eventId, action, status, details: details ?? {},
  });
}

async function handleActivation(
  supabase: any, eventId: string, email: string,
  fullName: string | null, externalId: string, membershipType: string
) {
  let userId: string;
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const existingUser = existingUsers?.users?.find(
    (u: any) => u.email?.toLowerCase() === email.toLowerCase()
  );

  if (existingUser) {
    userId = existingUser.id;
  } else {
    // Create user WITHOUT sending any email notification
    const tempPassword = crypto.randomUUID() + "Aa1!";
    const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
      email: email.toLowerCase(),
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: fullName ?? email.split("@")[0] },
    });
    if (createErr) throw new Error(`Failed to create user: ${createErr.message}`);
    userId = newUser.user.id;
    await logWebhook(supabase, eventId, "reprocess_user_created", "success", { userId, email });
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
      user_id: userId, status: "active", source: "hubla",
      external_id: externalId, membership_type: membershipType,
    });
  }

  const { data: existingRole } = await supabase
    .from("user_roles").select("id").eq("user_id", userId).maybeSingle();
  if (!existingRole) {
    await supabase.from("user_roles").insert({ user_id: userId, role: "member" });
  }

  await logWebhook(supabase, eventId, "reprocess_activation_complete", "success", { userId, email });
}

async function handleCancellation(
  supabase: any, eventId: string, email: string, externalId: string
) {
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const user = existingUsers?.users?.find(
    (u: any) => u.email?.toLowerCase() === email.toLowerCase()
  );

  if (!user) {
    await logWebhook(supabase, eventId, "reprocess_cancel_user_not_found", "warn", { email });
    return;
  }

  const { data: membership } = await supabase
    .from("memberships").select("id")
    .eq("user_id", user.id).eq("source", "hubla").eq("status", "active").maybeSingle();

  if (membership) {
    await supabase.from("memberships")
      .update({ status: "inactive", ended_at: new Date().toISOString() })
      .eq("id", membership.id);
  }

  await logWebhook(supabase, eventId, "reprocess_cancellation_complete", "success", {
    userId: user.id, email,
  });
}
