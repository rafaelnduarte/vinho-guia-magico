
-- Allow authenticated users to read basic profile info (for displaying comment author names)
CREATE POLICY "Authenticated users can read profiles for display"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);
