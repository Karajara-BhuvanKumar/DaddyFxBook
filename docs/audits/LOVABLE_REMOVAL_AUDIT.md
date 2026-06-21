
# Lovable Removal Audit Report

## Files Found

### SAFE TO KEEP
- `docs/implementation/MARKET_AI_DECISION.md`: Documentation file, not runtime code
- `docs/REPOSITORY_STRUCTURE.md`: Documentation file
- `docs/migration/AI_FUNCTIONS_MIGRATION.md`: Migration documentation file
- `docs/audits/EDGE_FUNCTIONS_AUDIT.md`: Audit documentation file
- `docs/migration/BACKEND_CLEANUP_PLAN.md`: Migration documentation file
- `docs/audits/LOVABLE_DEPENDENCY_AUDIT.md`: Audit documentation file
- `docs/audits/SUPABASE_TYPES_AUDIT.md`: Audit documentation file
- `docs/migration/BACKEND_MIGRATION_ROADMAP.md`: Migration documentation file
- `docs/audits/SECRETS_AUDIT.md`: Audit documentation file
- `docs/audits/FUNCTIONS_AUDIT.md`: Audit documentation file
- `docs/migration/DATABASE_MIGRATION_PLAN.md`: Migration documentation file
- `package-lock.json`: Dependency lock file, not runtime
- `bun.lock`: Dependency lock file, not runtime
- `playwright.config.ts`: Test config file
- `playwright-fixture.ts`: Test fixture file
- `index.html`: Meta title has "Lovable" but it's just the page title

### SHOULD REMOVE
- `supabase/migrations_backup/`: Entire folder, it's a backup of old migrations (we kept `supabase/migrations/` as current working copy)
- Any remaining references in test files if they're not needed (but let's check first)

### SHOULD REWRITE
- `supabase/functions/market-ai/index.ts`: Uses ai.gateway.lovable.dev and LOVABLE_API_KEY (see MARKET_AI_DECISION.md)
- `src/integrations/supabase/types.ts`: Contains types for the old Lovable tables (ai_period_reports, ai_scorecards, backtest_ai_reports) - these types aren't used since we removed persistence
- `src/hooks/useBacktest.ts`: May reference backtest_ai_reports? Let's check
- `src/components/backtest/AIReportPanel.tsx`: May reference backtest_ai_reports? Let's check
- `vite.config.ts`: May have Lovable references? Let's check
