
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

CREATE POLICY "Users read own avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users upload own avatar" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users update own avatar" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users delete own avatar" ON storage.objects FOR DELETE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
