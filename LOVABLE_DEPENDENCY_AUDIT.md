
# DaddyFxBook Lovable Dependency Audit

## Overview
This file audits the codebase for references to Lovable, AI, and related terms.

---

## Categories

### SAFE TO KEEP
- `market-events` function (only uses ForexFactory, no Lovable)
- Core app logic (trades, journals, backtest core)

### SHOULD REMOVE
- `ai-insights` function (uses Lovable API gateway)
- `ai-report` function (uses Lovable API gateway)
- `backtest-ai` function (uses Lovable API gateway)
- `market-ai` function (uses Lovable API gateway, optional)
- Any references to AI tables (ai_performance_reports, ai_period_reports, ai_scorecards, ai_trade_reviews, backtest_ai_reports)

### SHOULD REPLACE
- Supabase client env var name (VITE_SUPABASE_PUBLISHABLE_KEY vs VITE_SUPABASE_ANON_KEY)
- Supabase types (regenerate from new production schema)

---

## List of Files with Findings
- `supabase/functions/ai-insights/index.ts`
- `supabase/functions/ai-report/index.ts`
- `supabase/functions/backtest-ai/index.ts`
- `supabase/functions/market-ai/index.ts`
- `src/integrations/supabase/types.ts` (contains old AI table types)
