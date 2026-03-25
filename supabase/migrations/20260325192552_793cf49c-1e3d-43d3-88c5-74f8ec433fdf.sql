CREATE TABLE IF NOT EXISTS public.sync_orphans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aula_id uuid NOT NULL,
  panda_video_id text NOT NULL,
  titulo text NOT NULL,
  curso_id uuid,
  status text DEFAULT 'detected',
  detected_at timestamptz DEFAULT now(),
  action_taken_at timestamptz,
  action_type text
);

ALTER TABLE public.sync_orphans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage sync_orphans"
  ON public.sync_orphans FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_orphans_status ON public.sync_orphans(status);
CREATE INDEX idx_orphans_detected_at ON public.sync_orphans(detected_at);