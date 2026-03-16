
-- Drop existing permissive SELECT policy
DROP POLICY IF EXISTS "Anyone can read pricing config" ON public.ai_pricing_config;

-- Create admin-only SELECT policy
CREATE POLICY "Admins can read pricing config"
  ON public.ai_pricing_config
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Create a function for members to read only monthly_cap_brl
CREATE OR REPLACE FUNCTION public.get_member_ai_limits()
RETURNS TABLE(monthly_cap_brl numeric, rate_limit_per_day integer, rate_limit_per_5min integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT monthly_cap_brl, rate_limit_per_day, rate_limit_per_5min
  FROM public.ai_pricing_config
  LIMIT 1;
$$;
