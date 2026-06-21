
-- Backtest sessions
CREATE TABLE public.backtest_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  pair TEXT,
  strategy TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.backtest_sessions TO authenticated;
GRANT ALL ON public.backtest_sessions TO service_role;
ALTER TABLE public.backtest_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners manage backtest sessions" ON public.backtest_sessions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_backtest_sessions_user ON public.backtest_sessions(user_id, created_at DESC);
CREATE TRIGGER trg_backtest_sessions_updated BEFORE UPDATE ON public.backtest_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Backtest trades
CREATE TABLE public.backtest_trades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_id UUID NOT NULL REFERENCES public.backtest_sessions(id) ON DELETE CASCADE,
  trade_number INT,
  pair TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('long','short')),
  entry_price NUMERIC,
  stop_loss NUMERIC,
  take_profit NUMERIC,
  exit_price NUMERIC,
  rr NUMERIC,
  r_gained NUMERIC,
  pnl NUMERIC,
  outcome TEXT NOT NULL CHECK (outcome IN ('win','loss','breakeven')),
  setup TEXT,
  session TEXT,
  market_condition TEXT,
  emotion TEXT,
  notes TEXT,
  screenshot_url TEXT,
  trade_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.backtest_trades TO authenticated;
GRANT ALL ON public.backtest_trades TO service_role;
ALTER TABLE public.backtest_trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners manage backtest trades" ON public.backtest_trades FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_backtest_trades_session ON public.backtest_trades(session_id, created_at);
CREATE TRIGGER trg_backtest_trades_updated BEFORE UPDATE ON public.backtest_trades FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Backtest AI reports
CREATE TABLE public.backtest_ai_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_id UUID NOT NULL REFERENCES public.backtest_sessions(id) ON DELETE CASCADE,
  strengths JSONB NOT NULL DEFAULT '[]'::jsonb,
  weaknesses JSONB NOT NULL DEFAULT '[]'::jsonb,
  patterns JSONB NOT NULL DEFAULT '[]'::jsonb,
  suggestions JSONB NOT NULL DEFAULT '[]'::jsonb,
  scorecard JSONB NOT NULL DEFAULT '{}'::jsonb,
  summary TEXT,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.backtest_ai_reports TO authenticated;
GRANT ALL ON public.backtest_ai_reports TO service_role;
ALTER TABLE public.backtest_ai_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners manage backtest ai reports" ON public.backtest_ai_reports FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_backtest_ai_reports_session ON public.backtest_ai_reports(session_id, created_at DESC);
CREATE TRIGGER trg_backtest_ai_reports_updated BEFORE UPDATE ON public.backtest_ai_reports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
