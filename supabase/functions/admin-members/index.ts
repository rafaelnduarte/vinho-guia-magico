import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Check if called with service role key (internal/tool calls)
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    const isServiceRole = token === serviceRoleKey;

    if (!isServiceRole) {
      // Verify caller is admin via user JWT
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) throw new Error("Unauthorized");

      // Check admin role
      const { data: roleData } = await adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (!roleData) throw new Error("Forbidden: admin role required");
    }

    const { action, ...params } = await req.json();

    switch (action) {
      case "list_members": {
        const { data: memberships } = await adminClient
          .from("memberships")
          .select("*")
          .order("created_at", { ascending: false });

        const userIds = [...new Set((memberships ?? []).map((m: any) => m.user_id))];

        const { data: profiles } = await adminClient
          .from("profiles")
          .select("user_id, full_name, avatar_url, last_seen_at")
          .in("user_id", userIds);
        const profileMap: Record<string, any> = {};
        for (const p of profiles ?? []) profileMap[p.user_id] = p;

        const emailMap: Record<string, string> = {};
        for (const uid of userIds) {
          const { data: { user: authUser } } = await adminClient.auth.admin.getUserById(uid);
          if (authUser?.email) emailMap[uid] = authUser.email;
        }

        const { data: roles } = await adminClient.from("user_roles").select("user_id, role");
        const roleMap: Record<string, string> = {};
        for (const r of roles ?? []) roleMap[r.user_id] = r.role;

        const enriched = (memberships ?? []).map((m: any) => ({
          ...m,
          profiles: profileMap[m.user_id] ?? null,
          email: emailMap[m.user_id] ?? "—",
          role: roleMap[m.user_id] ?? "member",
        }));

        return new Response(JSON.stringify(enriched), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get_member_detail": {
        const { userId } = params;
        const { data: { user: authUser } } = await adminClient.auth.admin.getUserById(userId);
        
        const { data: profile } = await adminClient
          .from("profiles")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle();

        const { data: membership } = await adminClient
          .from("memberships")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle();

        const { data: events } = await adminClient
          .from("analytics_events")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(100);

        const { count: voteCount } = await adminClient
          .from("wine_votes")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId);

        const { count: commentCount } = await adminClient
          .from("wine_comments")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId);

        const pageViews = (events ?? []).filter((e: any) => e.event_type === "page_view").length;

        const { data: roleData2 } = await adminClient
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .maybeSingle();

        return new Response(JSON.stringify({
          email: authUser?.email ?? "—",
          created_at: authUser?.created_at,
          last_sign_in_at: authUser?.last_sign_in_at,
          profile,
          membership,
          role: roleData2?.role ?? "member",
          stats: { pageViews, voteCount: voteCount ?? 0, commentCount: commentCount ?? 0 },
          recentActivity: events ?? [],
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "create_member": {
        const { email, full_name, status = "active", source = "manual", membership_type = "comunidade", role = "member", password } = params;
        const result = await createSingleMember(adminClient, { email, full_name, status, source, membership_type, role, password });
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "bulk_create_members": {
        const { members: memberRows } = params;
        if (!Array.isArray(memberRows)) throw new Error("members must be an array");

        console.log(`[bulk_create] Starting batch of ${memberRows.length} members`);

        // Deduplicate by email (keep last occurrence)
        const emailMap = new Map<string, any>();
        for (const row of memberRows) {
          if (row.email) {
            emailMap.set(row.email.toLowerCase(), row);
          }
        }
        const uniqueRows = Array.from(emailMap.values());

        let success = 0;
        let skipped = 0;
        const errors: { row: number; email: string; message: string }[] = [];

        for (let i = 0; i < uniqueRows.length; i++) {
          const row = uniqueRows[i];
          try {
            const email = row.email?.toLowerCase();
            if (!email) { skipped++; continue; }

            let userId: string | undefined;

            // Try to create user first — fastest path for new users
            const userPassword = row.password || email;
            const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
              email,
              password: userPassword,
              email_confirm: true,
              user_metadata: { full_name: row.full_name },
            });

            if (newUser?.user) {
              userId = newUser.user.id;
              console.log(`[bulk_create] Created new user: ${email}`);
            } else if (createErr?.message?.includes("already been registered")) {
              // Look up existing user via DB function (fast, indexed)
              const { data: existingId } = await adminClient.rpc("get_user_id_by_email", { _email: email });
              if (existingId) {
                userId = existingId;
                console.log(`[bulk_create] Existing user found: ${email}`);
              } else {
                throw new Error("User exists but could not resolve ID");
              }
            } else if (createErr) {
              throw createErr;
            }

            // Upsert membership
            const membershipType = row.membership_type?.toLowerCase() || "radar";
            const status = row.status?.toLowerCase() || "active";
            const source = row.source || "csv_import";

            const { data: existingMembership } = await adminClient
              .from("memberships")
              .select("id")
              .eq("user_id", userId)
              .maybeSingle();

            if (existingMembership) {
              await adminClient.from("memberships").update({ status, source, membership_type: membershipType }).eq("id", existingMembership.id);
            } else {
              await adminClient.from("memberships").insert({ user_id: userId, status, source, membership_type: membershipType });
            }

            // Update profile name
            if (row.full_name) {
              await adminClient.from("profiles").update({ full_name: row.full_name }).eq("user_id", userId);
            }

            // Upsert role
            const targetRole = row.role?.toLowerCase() === "admin" ? "admin" : "member";
            const { data: existingRole } = await adminClient
              .from("user_roles")
              .select("id, role")
              .eq("user_id", userId)
              .maybeSingle();
            if (existingRole) {
              if (existingRole.role !== targetRole) {
                await adminClient.from("user_roles").update({ role: targetRole }).eq("id", existingRole.id);
              }
            } else {
              await adminClient.from("user_roles").insert({ user_id: userId, role: targetRole });
            }

            success++;
          } catch (err: any) {
            console.error(`[bulk_create] Error for ${row.email}: ${err.message}`);
            errors.push({ row: i + 2, email: row.email || "", message: err.message });
          }
        }

        console.log(`[bulk_create] Done: ${success} success, ${skipped} skipped, ${errors.length} errors`);
        return new Response(JSON.stringify({ success, skipped, errors, total: uniqueRows.length }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "update_member": {
        const { userId, full_name, status, membership_type } = params;
        if (full_name !== undefined) {
          await adminClient.from("profiles").update({ full_name }).eq("user_id", userId);
        }
        const membershipUpdate: Record<string, any> = {};
        if (status !== undefined) membershipUpdate.status = status;
        if (membership_type !== undefined) membershipUpdate.membership_type = membership_type;
        if (Object.keys(membershipUpdate).length > 0) {
          await adminClient.from("memberships").update(membershipUpdate).eq("user_id", userId);
        }
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "reset_password": {
        const { email } = params;
        const { error } = await adminClient.auth.admin.generateLink({
          type: "recovery",
          email,
        });
        if (error) throw error;
        return new Response(JSON.stringify({ success: true, message: "Link de recuperação enviado" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "delete_user": {
        const { userId } = params;
        await adminClient.from("user_roles").delete().eq("user_id", userId);
        await adminClient.from("profiles").delete().eq("user_id", userId);
        await adminClient.from("memberships").delete().eq("user_id", userId);
        const { error: delErr } = await adminClient.auth.admin.deleteUser(userId);
        if (delErr) throw delErr;
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "set_password": {
        const { userId, password } = params;
        const { error: pwErr } = await adminClient.auth.admin.updateUserById(userId, { password });
        if (pwErr) throw pwErr;
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "reset_onboarding": {
        const { userId } = params;
        const { data: userData } = await adminClient.auth.admin.getUserById(userId);
        if (!userData?.user?.email) throw new Error("User not found");
        const email = userData.user.email.toLowerCase();
        await adminClient.auth.admin.updateUserById(userId, { password: email });
        await adminClient.from("profiles").update({ must_change_password: true, onboarding_completed: true }).eq("user_id", userId);
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Helper to create a single member (reused by create_member action)
async function createSingleMember(adminClient: any, params: any) {
  const { email, full_name, status = "active", source = "manual", membership_type = "comunidade", role = "member", password } = params;

  let userId: string;
  const { data: existingUsers } = await adminClient.auth.admin.listUsers();
  const existing = existingUsers?.users?.find(
    (u: any) => u.email?.toLowerCase() === email.toLowerCase()
  );

  if (existing) {
    userId = existing.id;
  } else {
    const userPassword = password || email.toLowerCase();
    const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      password: userPassword,
      email_confirm: true,
      user_metadata: { full_name },
    });
    if (createErr) throw createErr;
    userId = newUser.user.id;
  }

  const { data: existingMembership } = await adminClient
    .from("memberships")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (existingMembership) {
    await adminClient.from("memberships").update({ status, source, membership_type }).eq("id", existingMembership.id);
  } else {
    await adminClient.from("memberships").insert({ user_id: userId, status, source, membership_type });
  }

  if (full_name) {
    await adminClient.from("profiles").update({ full_name }).eq("user_id", userId);
  }

  const targetRole = role === "admin" ? "admin" : "member";
  const { data: existingRole } = await adminClient
    .from("user_roles")
    .select("id, role")
    .eq("user_id", userId)
    .maybeSingle();
  if (existingRole) {
    if (existingRole.role !== targetRole) {
      await adminClient.from("user_roles").update({ role: targetRole }).eq("id", existingRole.id);
    }
  } else {
    await adminClient.from("user_roles").insert({ user_id: userId, role: targetRole });
  }

  return { success: true, userId };
}
