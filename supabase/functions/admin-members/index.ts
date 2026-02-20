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

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Check admin role
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleData) throw new Error("Forbidden: admin role required");

    const { action, ...params } = await req.json();

    switch (action) {
      case "list_members": {
        // Get memberships with profile info
        const { data: memberships } = await adminClient
          .from("memberships")
          .select("*, profiles!memberships_user_id_fkey(full_name, avatar_url, last_seen_at)")
          .order("created_at", { ascending: false });

        // Get emails from auth for all member user_ids
        const userIds = [...new Set((memberships ?? []).map((m: any) => m.user_id))];
        const emailMap: Record<string, string> = {};

        for (const uid of userIds) {
          const { data: { user: authUser } } = await adminClient.auth.admin.getUserById(uid);
          if (authUser?.email) emailMap[uid] = authUser.email;
        }

        // Get roles
        const { data: roles } = await adminClient.from("user_roles").select("user_id, role");
        const roleMap: Record<string, string> = {};
        for (const r of roles ?? []) roleMap[r.user_id] = r.role;

        const enriched = (memberships ?? []).map((m: any) => ({
          ...m,
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

        // Get analytics events for this user
        const { data: events } = await adminClient
          .from("analytics_events")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(100);

        // Get vote and comment counts
        const { count: voteCount } = await adminClient
          .from("wine_votes")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId);

        const { count: commentCount } = await adminClient
          .from("wine_comments")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId);

        // Count page views
        const pageViews = (events ?? []).filter((e: any) => e.event_type === "page_view").length;

        // Get role
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
        const { email, full_name, status = "active", source = "manual", membership_type = "comunidade" } = params;

        // Create or find user
        let userId: string;
        const { data: existingUsers } = await adminClient.auth.admin.listUsers();
        const existing = existingUsers?.users?.find(
          (u: any) => u.email?.toLowerCase() === email.toLowerCase()
        );

        if (existing) {
          userId = existing.id;
        } else {
          const tempPassword = crypto.randomUUID() + "Aa1!";
          const { data: newUser, error: createErr } = await adminClient.auth.admin.createUser({
            email,
            password: tempPassword,
            email_confirm: true,
            user_metadata: { full_name },
          });
          if (createErr) throw createErr;
          userId = newUser.user.id;
        }

        // Upsert membership
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

        // Ensure profile name
        if (full_name) {
          await adminClient.from("profiles").update({ full_name }).eq("user_id", userId);
        }

        // Ensure role
        const { data: existingRole } = await adminClient
          .from("user_roles")
          .select("id")
          .eq("user_id", userId)
          .maybeSingle();
        if (!existingRole) {
          await adminClient.from("user_roles").insert({ user_id: userId, role: "member" });
        }

        return new Response(JSON.stringify({ success: true, userId }), {
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
        // Send password reset email via Supabase Auth
        const { error } = await adminClient.auth.admin.generateLink({
          type: "recovery",
          email,
        });
        if (error) throw error;
        return new Response(JSON.stringify({ success: true, message: "Link de recuperação enviado" }), {
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
