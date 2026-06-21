
# DaddyFxBook Supabase Types Audit

## Overview
This file audits src/integrations/supabase/types.ts for compatibility with the approved production schema.

---

## Tables in Approved Production Schema
The following tables should be present and compatible:

- [x] user_settings
- [x] trading_rules
- [x] trades
- [x] journals
- [x] checklists
- [x] screenshots
- [x] backtest_sessions
- [x] backtest_trades

---

## Extra Tables (From Old Schema)
The types file also includes types for these tables, which are NOT in the approved production schema:

- ai_performance_reports
- ai_period_reports
- ai_scorecards
- ai_trade_reviews
- backtest_ai_reports

---

## Recommendations
- Regenerate Supabase types from the new production schema using `npx supabase gen types typescript --project-id <project-id> --schema public > src/integrations/supabase/types.ts`
- This will remove the extra AI table types and ensure full compatibility with the new schema
