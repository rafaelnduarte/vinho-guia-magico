CREATE POLICY "Admins can delete any comment"
ON public.wine_comments
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));