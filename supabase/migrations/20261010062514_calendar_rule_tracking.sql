-- Optional recorded risk: NULL means unknown, never inferred from P&L or defaults.
ALTER TABLE public.trades ADD COLUMN IF NOT EXISTS risk_pct NUMERIC NULL;
ALTER TABLE public.trades ADD CONSTRAINT trades_risk_pct_check
  CHECK (risk_pct IS NULL OR (risk_pct >= 0 AND risk_pct <= 100));

ALTER TABLE public.trading_rules ADD COLUMN IF NOT EXISTS allowed_sessions TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE public.trading_rules DROP CONSTRAINT trading_rules_rule_type_check;
ALTER TABLE public.trading_rules ADD CONSTRAINT trading_rules_rule_type_check
  CHECK (rule_type IN ('manual', 'max_trades_per_day', 'max_consecutive_losses', 'max_daily_loss', 'max_risk_per_trade', 'permitted_sessions'));
ALTER TABLE public.trading_rules ADD CONSTRAINT trading_rules_allowed_sessions_check
  CHECK (allowed_sessions <@ ARRAY['sydney', 'tokyo', 'london', 'new-york']::TEXT[] AND array_position(allowed_sessions, NULL) IS NULL);
ALTER TABLE public.trading_rules ADD CONSTRAINT trading_rules_new_configuration_check
  CHECK ((rule_type <> 'permitted_sessions' OR cardinality(allowed_sessions) > 0)
    AND (rule_type <> 'max_risk_per_trade' OR (threshold IS NOT NULL AND threshold > 0 AND threshold <= 100)));
-- Existing ownership policies and grants continue to cover the new columns.
NOTIFY pgrst, 'reload schema';
