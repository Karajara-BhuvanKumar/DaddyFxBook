
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  username TEXT,
  avatar_url TEXT,
  timezone TEXT DEFAULT 'UTC',
  time_format TEXT DEFAULT '24h',
  currency TEXT DEFAULT 'USD',
  account_size NUMERIC DEFAULT 10000,
  default_risk_pct NUMERIC DEFAULT 1,
  max_daily_risk NUMERIC DEFAULT 3,
  max_weekly_risk NUMERIC DEFAULT 6,
  max_trades_per_day INTEGER DEFAULT 3,
  preferred_session TEXT DEFAULT 'London',
  theme TEXT DEFAULT 'dark',
  accent_color TEXT DEFAULT 'blue',
  chart_style TEXT DEFAULT 'smooth',
  compact_mode BOOLEAN DEFAULT false,
  notify_daily BOOLEAN DEFAULT true,
  notify_weekly BOOLEAN DEFAULT true,
  notify_monthly BOOLEAN DEFAULT false,
  notify_news BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_settings TO authenticated;
GRANT ALL ON public.user_settings TO service_role;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own settings" ON public.user_settings FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_user_settings_updated BEFORE UPDATE ON public.user_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.trading_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rule TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trading_rules TO authenticated;
GRANT ALL ON public.trading_rules TO service_role;
ALTER TABLE public.trading_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own rules" ON public.trading_rules FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_trading_rules_updated BEFORE UPDATE ON public.trading_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_trading_rules_user_created ON public.trading_rules(user_id, created_at DESC);

CREATE TABLE public.trades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL DEFAULT 'XAUUSD',
  direction TEXT NOT NULL CHECK (direction IN ('Long', 'Short')),
  entry_price NUMERIC NOT NULL,
  exit_price NUMERIC NOT NULL,
  lot_size NUMERIC NOT NULL DEFAULT 0.1,
  stop_loss NUMERIC,
  take_profit NUMERIC,
  pnl NUMERIC NOT NULL DEFAULT 0,
  open_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  close_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  session TEXT CHECK (session IN ('Asian', 'London', 'New York')),
  source TEXT NOT NULL DEFAULT 'Manual',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own trades" ON public.trades FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own trades" ON public.trades FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own trades" ON public.trades FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own trades" ON public.trades FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_trades_updated BEFORE UPDATE ON public.trades
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_trades_user_created ON public.trades(user_id, created_at DESC);
CREATE INDEX idx_trades_symbol ON public.trades(symbol);
CREATE INDEX idx_trades_session ON public.trades(session);

CREATE TABLE public.journals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trade_id UUID NOT NULL REFERENCES public.trades(id) ON DELETE CASCADE UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pre_trade_notes TEXT DEFAULT '',
  post_trade_notes TEXT DEFAULT '',
  emotions TEXT DEFAULT '',
  lessons TEXT DEFAULT '',
  tags TEXT DEFAULT '',
  rating INTEGER DEFAULT 5 CHECK (rating >= 1 AND rating <= 10),
  risk_reward TEXT DEFAULT '1:2',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.journals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own journals" ON public.journals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own journals" ON public.journals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own journals" ON public.journals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own journals" ON public.journals FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_journals_updated BEFORE UPDATE ON public.journals
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_journals_user_created ON public.journals(user_id, created_at DESC);

CREATE TABLE public.checklists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trade_id UUID NOT NULL REFERENCES public.trades(id) ON DELETE CASCADE UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  checked_higher_tf BOOLEAN DEFAULT false,
  risk_within_limits BOOLEAN DEFAULT false,
  fits_plan BOOLEAN DEFAULT false,
  key_levels BOOLEAN DEFAULT false,
  news_checked BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own checklists" ON public.checklists FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own checklists" ON public.checklists FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own checklists" ON public.checklists FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own checklists" ON public.checklists FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER update_checklists_updated BEFORE UPDATE ON public.checklists
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.screenshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trade_id UUID NOT NULL REFERENCES public.trades(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.screenshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own screenshots" ON public.screenshots FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own screenshots" ON public.screenshots FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own screenshots" ON public.screenshots FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX idx_screenshots_user_created ON public.screenshots(user_id, created_at DESC);

CREATE TABLE public.backtest_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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

CREATE TABLE public.backtest_trades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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
CREATE INDEX idx_backtest_trades_user_created ON public.backtest_trades(user_id, created_at DESC);
CREATE INDEX idx_backtest_trades_session_id ON public.backtest_trades(session_id);
CREATE INDEX idx_backtest_trades_pair ON public.backtest_trades(pair);
CREATE INDEX idx_backtest_trades_setup ON public.backtest_trades(setup);
CREATE INDEX idx_backtest_trades_trade_date ON public.backtest_trades(trade_date);

INSERT INTO storage.buckets (id, name, public) VALUES ('screenshots', 'screenshots', false);

CREATE POLICY "Users read own screenshots" ON storage.objects FOR SELECT USING (bucket_id = 'screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users upload own screenshots" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own screenshots" ON storage.objects FOR DELETE USING (bucket_id = 'screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);

INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', false);

CREATE POLICY "Users read own avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users upload own avatar" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users update own avatar" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own avatar" ON storage.objects FOR DELETE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
