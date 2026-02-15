-- 1. Indexes on filterable wine fields
CREATE INDEX IF NOT EXISTS idx_wines_country ON public.wines (country);
CREATE INDEX IF NOT EXISTS idx_wines_type ON public.wines (type);
CREATE INDEX IF NOT EXISTS idx_wines_vintage ON public.wines (vintage);
CREATE INDEX IF NOT EXISTS idx_wines_importer ON public.wines (importer);
CREATE INDEX IF NOT EXISTS idx_wines_is_published ON public.wines (is_published);

-- 2. Index on analytics_events for period queries
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON public.analytics_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_type ON public.analytics_events (event_type);

-- 3. Enforce membership-based RLS on member-facing tables
-- Replace permissive SELECT policies with membership check

-- Helper function: check if user has active membership OR is admin
CREATE OR REPLACE FUNCTION public.has_active_access(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = _user_id AND role = 'admin'
  ) OR EXISTS (
    SELECT 1 FROM memberships WHERE user_id = _user_id AND status = 'active'
  );
END;
$$;

-- wines: only active members or admins can read published wines
DROP POLICY IF EXISTS "Authenticated users can read published wines" ON public.wines;
CREATE POLICY "Active members can read published wines"
ON public.wines FOR SELECT
USING (
  is_published = true AND has_active_access(auth.uid())
);

-- partners: only active members or admins
DROP POLICY IF EXISTS "Authenticated users can read active partners" ON public.partners;
CREATE POLICY "Active members can read active partners"
ON public.partners FOR SELECT
USING (
  is_active = true AND has_active_access(auth.uid())
);

-- seals: only active members or admins
DROP POLICY IF EXISTS "Authenticated users can read seals" ON public.seals;
CREATE POLICY "Active members can read seals"
ON public.seals FOR SELECT
USING (has_active_access(auth.uid()));

-- wine_seals: only active members or admins
DROP POLICY IF EXISTS "Authenticated users can read wine_seals" ON public.wine_seals;
CREATE POLICY "Active members can read wine_seals"
ON public.wine_seals FOR SELECT
USING (has_active_access(auth.uid()));

-- wine_comments: only active members can view
DROP POLICY IF EXISTS "Users can view all comments" ON public.wine_comments;
CREATE POLICY "Active members can view comments"
ON public.wine_comments FOR SELECT
USING (has_active_access(auth.uid()));

-- wine_comments: only active members can insert
DROP POLICY IF EXISTS "Users can insert their own comment" ON public.wine_comments;
CREATE POLICY "Active members can insert comments"
ON public.wine_comments FOR INSERT
WITH CHECK (auth.uid() = user_id AND has_active_access(auth.uid()));

-- wine_votes: only active members can view
DROP POLICY IF EXISTS "Users can view all votes" ON public.wine_votes;
CREATE POLICY "Active members can view votes"
ON public.wine_votes FOR SELECT
USING (has_active_access(auth.uid()));

-- wine_votes: only active members can insert
DROP POLICY IF EXISTS "Users can insert their own vote" ON public.wine_votes;
CREATE POLICY "Active members can insert votes"
ON public.wine_votes FOR INSERT
WITH CHECK (auth.uid() = user_id AND has_active_access(auth.uid()));