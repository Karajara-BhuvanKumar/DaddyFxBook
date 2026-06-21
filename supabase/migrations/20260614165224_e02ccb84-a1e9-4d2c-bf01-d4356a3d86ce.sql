
CREATE TABLE public.ai_period_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  period_type TEXT NOT NULL CHECK (period_type IN ('daily','weekly','monthly')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  trade_count INTEGER NOT NULL DEFAULT 0,
  stats JSONB NOT NULL,
  report JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, period_type, period_start)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_period_reports TO authenticated;
GRANT ALL ON public.ai_period_reports TO service_role;
ALTER TABLE public.ai_period_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own ai_period_reports" ON public.ai_period_reports FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own ai_period_reports" ON public.ai_period_reports FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own ai_period_reports" ON public.ai_period_reports FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own ai_period_reports" ON public.ai_period_reports FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_ai_period_reports_updated_at
  BEFORE UPDATE ON public.ai_period_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX ai_period_reports_user_idx ON public.ai_period_reports(user_id, period_type, period_start DESC);

CREATE TABLE public.ai_scorecards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  discipline_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  risk_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  execution_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  psychology_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  consistency_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  overall_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  classification TEXT NOT NULL DEFAULT 'Beginner',
  trade_count INTEGER NOT NULL DEFAULT 0,
  breakdown JSONB NOT NULL,
  ai_insights JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_scorecards TO authenticated;
GRANT ALL ON public.ai_scorecards TO service_role;
ALTER TABLE public.ai_scorecards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own ai_scorecards" ON public.ai_scorecards FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own ai_scorecards" ON public.ai_scorecards FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own ai_scorecards" ON public.ai_scorecards FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX ai_scorecards_user_idx ON public.ai_scorecards(user_id, created_at DESC);
