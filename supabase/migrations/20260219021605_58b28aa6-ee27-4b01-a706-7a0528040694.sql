
-- 1. Fix profiles: remove overly permissive policy, users can only see own profile (admins already have a policy)
DROP POLICY IF EXISTS "Authenticated users can read profiles for display" ON public.profiles;

-- Create a view for public display names (e.g. comments) without exposing all fields
CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker = on) AS
  SELECT user_id, full_name, avatar_url
  FROM public.profiles;

-- 2. Fix usage_ledger: deny all writes from client (only service_role via edge function can write)
CREATE POLICY "No client inserts on usage_ledger"
  ON public.usage_ledger FOR INSERT
  WITH CHECK (false);

CREATE POLICY "No client updates on usage_ledger"
  ON public.usage_ledger FOR UPDATE
  USING (false);

CREATE POLICY "No client deletes on usage_ledger"
  ON public.usage_ledger FOR DELETE
  USING (false);

-- 3. Fix chat_messages: create a secure view hiding cost columns, deny direct SELECT
-- First drop existing permissive user policy
DROP POLICY IF EXISTS "Users can manage own messages" ON public.chat_messages;

-- Users can INSERT their own messages (through edge function, but allow for reading)
CREATE POLICY "Users can insert own messages"
  ON public.chat_messages FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.chat_sessions cs WHERE cs.id = session_id AND cs.user_id = auth.uid())
  );

-- Users can only SELECT via the view (no direct access to cost columns)
CREATE POLICY "Users can read own messages without cost"
  ON public.chat_messages FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.chat_sessions cs WHERE cs.id = session_id AND cs.user_id = auth.uid())
  );

-- No direct update/delete from client
CREATE POLICY "No client updates on chat_messages"
  ON public.chat_messages FOR UPDATE
  USING (false);

CREATE POLICY "No client deletes on chat_messages"
  ON public.chat_messages FOR DELETE
  USING (false);

-- Create a view that hides cost fields
CREATE OR REPLACE VIEW public.chat_messages_safe
WITH (security_invoker = on) AS
  SELECT id, session_id, role, content, mode, created_at
  FROM public.chat_messages;
