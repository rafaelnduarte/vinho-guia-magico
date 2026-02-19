
ALTER TABLE public.profiles ADD COLUMN bio text;

-- Add constraint for max 140 chars
ALTER TABLE public.profiles ADD CONSTRAINT profiles_bio_max_length CHECK (char_length(bio) <= 140);
