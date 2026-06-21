
# Backtest AI Frontend Migration

## Overview
Modified frontend to handle the fact that `backtest-ai` Edge Function no longer persists reports to `backtest_ai_reports` table.

## Files Changed
1. `src/hooks/useBacktest.ts`: Updated `useBacktestAIReport` and `useGenerateBacktestAIReport`
2. `src/components/backtest/AIReportPanel.tsx`: Updated UI description to remove "Lovable AI" mention

## Detailed Changes
### src/hooks/useBacktest.ts
  - **useBacktestAIReport**: Changed to `enabled: false` and `queryFn` returns `null`; no longer queries the database
  - **useGenerateBacktestAIReport**: In `onSuccess` hook, use `qc.setQueryData` to directly set the report data into the React Query cache for key ["backtest-ai-report", sessionId]

### src/components/backtest/AIReportPanel.tsx
  - Updated description text to: "AI analyses every trade and identifies strengths, weaknesses, recurring patterns, and a strategy scorecard using your Gemini API key."
  - Component otherwise unchanged; continues to use `useBacktestAIReport` data as before, since it's stored in cache now

## Result
- UI preserved exactly
- Report data is stored in React Query cache instead of Supabase database
- No changes to routing or business logic
