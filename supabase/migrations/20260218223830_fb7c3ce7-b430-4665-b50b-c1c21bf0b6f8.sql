
ALTER TABLE public.partners ADD COLUMN category text NOT NULL DEFAULT 'importadoras';
ALTER TABLE public.partners ADD COLUMN discount text;
ALTER TABLE public.partners ADD COLUMN contact_info text;
