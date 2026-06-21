-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trades table
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

CREATE TRIGGER update_trades_updated_at BEFORE UPDATE ON public.trades
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Journals table
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

CREATE TRIGGER update_journals_updated_at BEFORE UPDATE ON public.journals
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Checklists table
CREATE TABLE public.checklists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trade_id UUID NOT NULL REFERENCES public.trades(id) ON DELETE CASCADE UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  checked_higher_tf BOOLEAN DEFAULT false,
  risk_within_limits BOOLEAN DEFAULT false,
  fits_plan BOOLEAN DEFAULT false,
  key_levels BOOLEAN DEFAULT false,
  news_checked BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.checklists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own checklists" ON public.checklists FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own checklists" ON public.checklists FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own checklists" ON public.checklists FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own checklists" ON public.checklists FOR DELETE USING (auth.uid() = user_id);

-- Screenshots storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('screenshots', 'screenshots', true);

CREATE POLICY "Anyone can view screenshots" ON storage.objects FOR SELECT USING (bucket_id = 'screenshots');
CREATE POLICY "Users can upload screenshots" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own screenshots" ON storage.objects FOR DELETE USING (bucket_id = 'screenshots' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Screenshots table
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