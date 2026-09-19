-- Migration: Add rule_type/threshold to trading_rules, create rule_violations table
-- Known limitation (left as-is): day keys are UTC-based like the current calendar.
-- Idempotent version: safe to run multiple times.

-- 1. Extend trading_rules with rule_type and threshold
ALTER TABLE public.trading_rules
  ADD COLUMN IF NOT EXISTS rule_type TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS threshold NUMERIC NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'trading_rules_rule_type_check'
  ) THEN
    ALTER TABLE public.trading_rules
      ADD CONSTRAINT trading_rules_rule_type_check 
      CHECK (rule_type IN ('manual','max_trades_per_day','max_consecutive_losses','max_daily_loss'));
  END IF;
END $$;

-- 2. Create rule_violations (manual flags only — auto violations are computed on the fly)
CREATE TABLE IF NOT EXISTS public.rule_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rule_id UUID NOT NULL REFERENCES public.trading_rules(id) ON DELETE CASCADE,
  violation_date DATE NOT NULL,
  note TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(rule_id, violation_date)
);

ALTER TABLE public.rule_violations ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rule_violations TO authenticated;
GRANT ALL ON public.rule_violations TO service_role;

DROP POLICY IF EXISTS "Users manage own rule violations" ON public.rule_violations;
CREATE POLICY "Users manage own rule violations"
  ON public.rule_violations FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_rule_violations_user_date
  ON public.rule_violations(user_id, violation_date);

NOTIFY pgrst, 'reload schema';
