
-- Create panda_videos_index table (full Panda video catalog)
CREATE TABLE IF NOT EXISTS public.panda_videos_index (
  id text PRIMARY KEY,
  title text NOT NULL,
  title_normalized text NOT NULL,
  status text,
  folder_id text,
  created_at timestamptz,
  updated_at timestamptz,
  synced_at timestamptz DEFAULT now()
);

ALTER TABLE public.panda_videos_index ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage panda_videos_index" ON public.panda_videos_index
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_panda_videos_index_normalized ON public.panda_videos_index(title_normalized);

-- Create panda_audit_log table (tracks fix/assign operations)
CREATE TABLE IF NOT EXISTS public.panda_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aula_id uuid,
  old_video_id text,
  new_video_id text,
  action text NOT NULL,
  result text NOT NULL,
  details jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.panda_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage panda_audit_log" ON public.panda_audit_log
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
