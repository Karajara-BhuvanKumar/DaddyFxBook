-- ============================================================
-- Migration: Create AI tables
-- Fixes: 404 errors on ai_trade_reviews, ai_performance_reports,
--         ai_period_reports, ai_scorecards
-- ============================================================

-- 1. ai_trade_reviews
-- Stores per-trade AI review (grade, feedback, improvements)
CREATE TABLE IF NOT EXISTS public.ai_trade_reviews (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  trade_id    uuid REFERENCES public.trades(id) ON DELETE CASCADE NOT NULL,
  grade       text NOT NULL DEFAULT 'C',
  went_right  jsonb NOT NULL DEFAULT '[]'::jsonb,
  went_wrong  jsonb NOT NULL DEFAULT '[]'::jsonb,
  improvements jsonb NOT NULL DEFAULT '[]'::jsonb,
  summary     text NOT NULL DEFAULT '',
  created_at  timestamptz DEFAULT now() NOT NULL,
  updated_at  timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_trade_reviews_user_id ON public.ai_trade_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_trade_reviews_trade_id ON public.ai_trade_reviews(trade_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_trade_reviews_user_trade ON public.ai_trade_reviews(user_id, trade_id);

ALTER TABLE public.ai_trade_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own trade reviews"
  ON public.ai_trade_reviews FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own trade reviews"
  ON public.ai_trade_reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own trade reviews"
  ON public.ai_trade_reviews FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own trade reviews"
  ON public.ai_trade_reviews FOR DELETE
  USING (auth.uid() = user_id);


-- 2. ai_performance_reports
-- Stores full portfolio AI performance reports
CREATE TABLE IF NOT EXISTS public.ai_performance_reports (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  report      jsonb NOT NULL DEFAULT '{}'::jsonb,
  stats       jsonb DEFAULT NULL,
  trade_count integer NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now() NOT NULL,
  updated_at  timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_performance_reports_user_id ON public.ai_performance_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_performance_reports_created ON public.ai_performance_reports(created_at DESC);

ALTER TABLE public.ai_performance_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own performance reports"
  ON public.ai_performance_reports FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own performance reports"
  ON public.ai_performance_reports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own performance reports"
  ON public.ai_performance_reports FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own performance reports"
  ON public.ai_performance_reports FOR DELETE
  USING (auth.uid() = user_id);


-- 3. ai_period_reports
-- Stores daily/weekly/monthly AI period reports
CREATE TABLE IF NOT EXISTS public.ai_period_reports (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  period_type   text NOT NULL,  -- 'daily', 'weekly', 'monthly'
  period_start  date NOT NULL,
  period_end    date NOT NULL,
  trade_count   integer NOT NULL DEFAULT 0,
  stats         jsonb NOT NULL DEFAULT '{}'::jsonb,
  report        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz DEFAULT now() NOT NULL,
  updated_at    timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_period_reports_user_id ON public.ai_period_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_period_reports_lookup ON public.ai_period_reports(user_id, period_type, period_start);

ALTER TABLE public.ai_period_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own period reports"
  ON public.ai_period_reports FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own period reports"
  ON public.ai_period_reports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own period reports"
  ON public.ai_period_reports FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own period reports"
  ON public.ai_period_reports FOR DELETE
  USING (auth.uid() = user_id);


-- 4. ai_scorecards
-- Stores AI trader scorecard snapshots
CREATE TABLE IF NOT EXISTS public.ai_scorecards (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  discipline_score  numeric NOT NULL DEFAULT 0,
  risk_score        numeric NOT NULL DEFAULT 0,
  execution_score   numeric NOT NULL DEFAULT 0,
  psychology_score  numeric NOT NULL DEFAULT 0,
  consistency_score numeric NOT NULL DEFAULT 0,
  overall_score     numeric NOT NULL DEFAULT 0,
  classification    text NOT NULL DEFAULT 'Novice',
  trade_count       integer NOT NULL DEFAULT 0,
  breakdown         jsonb NOT NULL DEFAULT '{}'::jsonb,
  ai_insights       jsonb DEFAULT NULL,
  created_at        timestamptz DEFAULT now() NOT NULL,
  updated_at        timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_scorecards_user_id ON public.ai_scorecards(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_scorecards_created ON public.ai_scorecards(created_at DESC);

ALTER TABLE public.ai_scorecards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own scorecards"
  ON public.ai_scorecards FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own scorecards"
  ON public.ai_scorecards FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own scorecards"
  ON public.ai_scorecards FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own scorecards"
  ON public.ai_scorecards FOR DELETE
  USING (auth.uid() = user_id);
