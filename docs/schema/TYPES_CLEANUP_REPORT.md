
# Types Cleanup Report

## Overview
Cleaned up `src/integrations/supabase/types.ts` to only include active tables!

## Tables Removed
- `ai_period_reports`
- `ai_scorecards`
- `ai_trade_reviews`
- `ai_performance_reports`
- `backtest_ai_reports`

## Tables Preserved
- `user_settings` (with added `gemini_api_key` column)
- `trading_rules`
- `trades`
- `journals`
- `checklists`
- `screenshots`
- `backtest_sessions`
- `backtest_trades`

## Files Changed
- `src/integrations/supabase/types.ts`: Complete rewrite
