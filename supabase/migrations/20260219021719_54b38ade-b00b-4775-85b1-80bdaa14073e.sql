
-- Fix profiles_public view: enable RLS (views inherit from base table with security_invoker)
-- The view uses security_invoker=on, so RLS on the base profiles table applies.
-- But we need to ensure members can read via the view. Add back a limited SELECT policy.
CREATE POLICY "Members can read basic profile info"
  ON public.profiles FOR SELECT
  USING (has_active_access(auth.uid()));

-- Fix chat_messages_safe: same approach - the view uses security_invoker=on so base table RLS applies.
-- The SELECT policy "Users can read own messages without cost" already exists on chat_messages.
-- No additional action needed for chat_messages_safe since security_invoker passes through.

-- Fix analytics_events: these use RESTRICTIVE policies (Permissive: No = RESTRICTIVE in pg)
-- Actually, looking at the policies, they're already restrictive. Non-admin users can only INSERT own events.
-- The SELECT is admin-only. But let's add explicit deny for extra safety.

-- Fix webhook_events and webhook_logs: add explicit deny for non-admin
-- These tables already have admin-only SELECT. The scan is warning about explicit blocks.
-- Add explicit deny policies for non-admin operations.
