
# DaddyFxBook Backend Migration Roadmap

## Overview
This file outlines the step-by-step migration plan for the backend and related infrastructure.

---

## Phase 1 - Database Migration
- [ ] Apply `FINAL_PRODUCTION_SCHEMA.sql` to new/clean Supabase project
- [ ] Verify all tables, RLS policies, triggers, indexes, and storage buckets are created correctly
- [ ] If existing data needs to be migrated, plan and execute data migration from old tables to new schema

## Phase 2 - Supabase Client Verification
- [ ] Align environment variable names (VITE_SUPABASE_PUBLISHABLE_KEY vs VITE_SUPABASE_ANON_KEY)
- [ ] Regenerate Supabase TypeScript types from new production schema using `npx supabase gen types`
- [ ] Update `src/integrations/supabase/types.ts` with new generated types

## Phase 3 - Edge Function Cleanup
- [ ] Remove AI-related functions: `ai-insights`, `ai-report`, `backtest-ai`
- [ ] Evaluate `market-ai` function (keep if needed, or remove)
- [ ] Keep core function: `market-events`

## Phase 4 - Gemini API Migration
- [ ] If AI features are kept, replace Lovable gateway with direct Gemini API calls (if desired)
- [ ] Update any AI-related frontend components/hooks as needed (only if necessary)

## Phase 5 - Local Testing
- [ ] Configure local Supabase instance with new schema
- [ ] Test all app features (Auth, Trades, Journals, Backtesting, Market)
- [ ] Run post-migration test plan from `POST_MIGRATION_TEST_PLAN.md`

## Phase 6 - GitHub Push
- [ ] Commit and push all migration-related docs and schema files
- [ ] Verify no sensitive information is committed to repo
- [ ] Ensure .env is in .gitignore

## Phase 7 - Vercel Deployment
- [ ] Update Vercel environment variables with new Supabase project credentials
- [ ] Deploy to Vercel
- [ ] Verify production deployment is working correctly
