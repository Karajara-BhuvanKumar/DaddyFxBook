
CREATE TABLE public.ai_trade_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  trade_id UUID NOT NULL REFERENCES public.trades(id) ON DELETE CASCADE,
  grade TEXT NOT NULL,
  went_right TEXT[] NOT NULL DEFAULT '{}',
  went_wrong TEXT[] NOT NULL DEFAULT '{}',
  improvements TEXT[] NOT NULL DEFAULT '{}',
  summary TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, trade_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_trade_reviews TO authenticated;
GRANT ALL ON public.ai_trade_reviews TO service_role;
ALTER TABLE public.ai_trade_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own ai_trade_reviews" ON public.ai_trade_reviews FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own ai_trade_reviews" ON public.ai_trade_reviews FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own ai_trade_reviews" ON public.ai_trade_reviews FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own ai_trade_reviews" ON public.ai_trade_reviews FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_ai_trade_reviews_updated_at
  BEFORE UPDATE ON public.ai_trade_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX ai_trade_reviews_user_idx ON public.ai_trade_reviews(user_id, updated_at DESC);

CREATE TABLE public.ai_performance_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  report JSONB NOT NULL,
  stats JSONB,
  trade_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_performance_reports TO authenticated;
GRANT ALL ON public.ai_performance_reports TO service_role;
ALTER TABLE public.ai_performance_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own ai_performance_reports" ON public.ai_performance_reports FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own ai_performance_reports" ON public.ai_performance_reports FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own ai_performance_reports" ON public.ai_performance_reports FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX ai_performance_reports_user_idx ON public.ai_performance_reports(user_id, created_at DESC);
