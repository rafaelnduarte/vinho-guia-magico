
-- Wine votes (recommend / not recommend)
CREATE TABLE public.wine_votes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wine_id UUID NOT NULL REFERENCES public.wines(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  vote TEXT NOT NULL CHECK (vote IN ('recommend', 'not_recommend')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(wine_id, user_id)
);

ALTER TABLE public.wine_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all votes"
  ON public.wine_votes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own vote"
  ON public.wine_votes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own vote"
  ON public.wine_votes FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own vote"
  ON public.wine_votes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Wine comments
CREATE TABLE public.wine_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wine_id UUID NOT NULL REFERENCES public.wines(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.wine_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all comments"
  ON public.wine_comments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own comment"
  ON public.wine_comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comment"
  ON public.wine_comments FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comment"
  ON public.wine_comments FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER update_wine_comments_updated_at
  BEFORE UPDATE ON public.wine_comments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
