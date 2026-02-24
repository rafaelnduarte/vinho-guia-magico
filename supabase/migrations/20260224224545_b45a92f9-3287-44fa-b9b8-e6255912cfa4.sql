
-- Add website_url for seller link and audio_url for audio comment
ALTER TABLE public.wines ADD COLUMN IF NOT EXISTS website_url text;
ALTER TABLE public.wines ADD COLUMN IF NOT EXISTS audio_url text;
