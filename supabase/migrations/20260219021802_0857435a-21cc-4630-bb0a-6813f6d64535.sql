
-- Fix profiles: add INSERT policy (only for own user, used by trigger)
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Fix webhook_events: deny INSERT from client (only service_role from edge function)
CREATE POLICY "No client inserts on webhook_events"
  ON public.webhook_events FOR INSERT
  WITH CHECK (false);

-- Fix webhook_logs: deny INSERT from client 
CREATE POLICY "No client inserts on webhook_logs"
  ON public.webhook_logs FOR INSERT
  WITH CHECK (false);

-- Fix user_roles: INSERT only by admin (the ALL policy covers admins, but add explicit)
CREATE POLICY "Only admins can insert roles"
  ON public.user_roles FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
