
CREATE TABLE public.recovery_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id text NOT NULL,
  action text NOT NULL,
  status text NOT NULL DEFAULT 'started',
  new_video_id text,
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_recovery_logs_video_id ON public.recovery_logs(video_id);
CREATE INDEX idx_recovery_logs_created_at ON public.recovery_logs(created_at DESC);

ALTER TABLE public.recovery_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read recovery_logs"
  ON public.recovery_logs FOR SELECT
  TO public
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "No client inserts on recovery_logs"
  ON public.recovery_logs FOR INSERT
  TO public
  WITH CHECK (false);

CREATE POLICY "No client updates on recovery_logs"
  ON public.recovery_logs FOR UPDATE
  TO public
  USING (false);

CREATE POLICY "No client deletes on recovery_logs"
  ON public.recovery_logs FOR DELETE
  TO public
  USING (false);
