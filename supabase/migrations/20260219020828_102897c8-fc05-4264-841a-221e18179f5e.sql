
-- Thomas notes linked to wines
CREATE TABLE public.thomas_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wine_id UUID NOT NULL REFERENCES public.wines(id) ON DELETE CASCADE,
  note_type TEXT NOT NULL DEFAULT 'opinion',
  note_text TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'public',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.thomas_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Active members can read public notes" ON public.thomas_notes FOR SELECT USING (visibility = 'public' AND has_active_access(auth.uid()));
CREATE POLICY "Admins can manage thomas_notes" ON public.thomas_notes FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER update_thomas_notes_updated_at BEFORE UPDATE ON public.thomas_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Chat sessions
CREATE TABLE public.chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT DEFAULT 'Nova conversa',
  summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own sessions" ON public.chat_sessions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can read all sessions" ON public.chat_sessions FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER update_chat_sessions_updated_at BEFORE UPDATE ON public.chat_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Chat messages
CREATE TABLE public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content TEXT NOT NULL,
  tokens_in INT DEFAULT 0,
  tokens_out INT DEFAULT 0,
  cost_usd NUMERIC(10,6) DEFAULT 0,
  cost_brl NUMERIC(10,4) DEFAULT 0,
  mode TEXT DEFAULT 'economico',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own messages" ON public.chat_messages FOR ALL USING (
  EXISTS (SELECT 1 FROM public.chat_sessions cs WHERE cs.id = session_id AND cs.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.chat_sessions cs WHERE cs.id = session_id AND cs.user_id = auth.uid())
);
CREATE POLICY "Admins can read all messages" ON public.chat_messages FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- Usage ledger (monthly budget tracking per user)
CREATE TABLE public.usage_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  month TEXT NOT NULL, -- YYYY-MM
  input_tokens BIGINT DEFAULT 0,
  output_tokens BIGINT DEFAULT 0,
  estimated_cost_usd NUMERIC(10,6) DEFAULT 0,
  estimated_cost_brl NUMERIC(10,4) DEFAULT 0,
  request_count INT DEFAULT 0,
  last_request_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, month)
);
ALTER TABLE public.usage_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own usage" ON public.usage_ledger FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can read all usage" ON public.usage_ledger FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER update_usage_ledger_updated_at BEFORE UPDATE ON public.usage_ledger FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- AI pricing config (admin editable)
CREATE TABLE public.ai_pricing_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_name TEXT NOT NULL UNIQUE DEFAULT 'google/gemini-3-flash-preview',
  price_in_per_1k NUMERIC(10,6) NOT NULL DEFAULT 0.00010,
  price_out_per_1k NUMERIC(10,6) NOT NULL DEFAULT 0.00040,
  usd_brl_rate NUMERIC(6,2) NOT NULL DEFAULT 5.00,
  monthly_cap_brl NUMERIC(10,2) NOT NULL DEFAULT 10.00,
  max_tokens_economico INT NOT NULL DEFAULT 350,
  max_tokens_detalhado INT NOT NULL DEFAULT 700,
  max_tokens_ultra_economico INT NOT NULL DEFAULT 180,
  rate_limit_per_5min INT NOT NULL DEFAULT 10,
  rate_limit_per_day INT NOT NULL DEFAULT 60,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_pricing_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read pricing config" ON public.ai_pricing_config FOR SELECT USING (has_active_access(auth.uid()));
CREATE POLICY "Admins can manage pricing config" ON public.ai_pricing_config FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER update_ai_pricing_config_updated_at BEFORE UPDATE ON public.ai_pricing_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default pricing row
INSERT INTO public.ai_pricing_config (model_name) VALUES ('google/gemini-3-flash-preview');

-- Chat feedback
CREATE TABLE public.chat_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  rating INT CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own feedback" ON public.chat_feedback FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can read all feedback" ON public.chat_feedback FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- Indexes for performance
CREATE INDEX idx_chat_messages_session ON public.chat_messages(session_id);
CREATE INDEX idx_chat_sessions_user ON public.chat_sessions(user_id);
CREATE INDEX idx_usage_ledger_user_month ON public.usage_ledger(user_id, month);
CREATE INDEX idx_thomas_notes_wine ON public.thomas_notes(wine_id);
CREATE INDEX idx_chat_messages_created ON public.chat_messages(created_at);
