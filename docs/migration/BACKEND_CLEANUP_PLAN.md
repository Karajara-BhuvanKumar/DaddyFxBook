
# DaddyFxBook Backend Cleanup Plan

## Overview
This file outlines the step-by-step cleanup plan for the backend and related infrastructure.

---

## Phase 1 - Frontend Connected to New Supabase
- [x] Align environment variable names to use VITE_SUPABASE_ANON_KEY
- [x] Update Supabase client initialization in src/integrations/supabase/client.ts
- [ ] Test that frontend can connect to new Supabase project

## Phase 2 - Verify Authentication
- [ ] Verify Signup flow works correctly
- [ ] Verify Login flow works correctly
- [ ] Verify Logout flow works correctly
- [ ] Verify Session persistence works correctly

## Phase 3 - Verify Trades
- [ ] Verify trade creation (Create trade)
- [ ] Verify trade editing (Edit trade)
- [ ] Verify trade deletion (Delete trade)

## Phase 4 - Verify Journals
- [ ] Verify saving notes (Save notes)
- [ ] Verify updating notes (Update notes)

## Phase 5 - Verify Screenshots
- [ ] Verify screenshot upload (Upload screenshot)
- [ ] Verify screenshot deletion (Delete screenshot)

## Phase 6 - Audit Edge Functions
- [x] Audit all edge functions
- [ ] Remove unnecessary AI functions (ai-insights, ai-report, backtest-ai)
- [ ] Keep core market-events function

## Phase 7 - Remove Lovable Dependencies
- [ ] Remove references to ai.gateway.lovable.dev
- [ ] Remove any unused Lovable related code
- [ ] Regenerate Supabase types from new schema

## Phase 8 - Move AI to Gemini API (Optional)
- [ ] If keeping AI features, replace Lovable gateway with direct Gemini API calls
- [ ] Update AI functions accordingly

## Phase 9 - GitHub Push
- [ ] Commit and push all changes
- [ ] Verify no sensitive information in commits
- [ ] Verify .env is in .gitignore

## Phase 10 - Deploy to Vercel
- [ ] Update Vercel environment variables with new Supabase credentials
- [ ] Deploy to Vercel
- [ ] Verify production deployment works correctly
