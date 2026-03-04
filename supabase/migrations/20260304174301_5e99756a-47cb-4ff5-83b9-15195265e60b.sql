CREATE TABLE public.home_banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url text NOT NULL,
  link_url text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.home_banners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active members can view active banners"
  ON public.home_banners FOR SELECT
  TO authenticated
  USING (is_active = true AND has_active_access(auth.uid()));

CREATE POLICY "Admins can manage banners"
  ON public.home_banners FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));