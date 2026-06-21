
# DaddyFxBook Functions Audit

## Overview
This file audits all edge functions in the project.

---

## Function List

### 1. `ai-insights`
- **Function Name**: ai-insights
- **Purpose**: Generates AI commentary for daily/weekly/monthly reports and trader scorecards. Persists results to `ai_period_reports` and `ai_scorecards`.
- **Tables Used**: `ai_period_reports`, `ai_scorecards` (NOT in approved production schema)
- **External APIs Used**: https://ai.gateway.lovable.dev/v1/chat/completions
- **Gemini Usage**: Uses `google/gemini-2.5-flash`
- **OpenAI Usage**: None
- **Lovable Dependencies**: Uses LOVABLE_API_KEY environment variable, ai.gateway.lovable.dev
- **Recommendation**: Remove (depends on removed AI persistence tables)

### 2. `ai-report`
- **Function Name**: ai-report
- **Purpose**: Runs AI performance coach and per-trade reviews. Persists to `ai_trade_reviews` and `ai_performance_reports`.
- **Tables Used**: `ai_trade_reviews`, `ai_performance_reports` (NOT in approved production schema)
- **External APIs Used**: https://ai.gateway.lovable.dev/v1/chat/completions
- **Gemini Usage**: Uses `google/gemini-2.5-flash`
- **OpenAI Usage**: None
- **Lovable Dependencies**: Uses LOVABLE_API_KEY environment variable, ai.gateway.lovable.dev
- **Recommendation**: Remove (depends on removed AI persistence tables)

### 3. `backtest-ai`
- **Function Name**: backtest-ai
- **Purpose**: Analyzes backtest sessions using AI, persists results to `backtest_ai_reports`.
- **Tables Used**: `backtest_ai_reports` (NOT in approved production schema)
- **External APIs Used**: https://ai.gateway.lovable.dev/v1/chat/completions
- **Gemini Usage**: Uses `google/gemini-2.5-flash`
- **OpenAI Usage**: None
- **Lovable Dependencies**: Uses LOVABLE_API_KEY environment variable, ai.gateway.lovable.dev
- **Recommendation**: Remove (depends on removed AI persistence tables)

### 4. `market-ai`
- **Function Name**: market-ai
- **Purpose**: Generates AI analysis for a single economic event.
- **Tables Used**: None
- **External APIs Used**: https://ai.gateway.lovable.dev/v1/chat/completions
- **Gemini Usage**: Uses `google/gemini-2.5-flash`
- **OpenAI Usage**: None
- **Lovable Dependencies**: Uses LOVABLE_API_KEY environment variable, ai.gateway.lovable.dev
- **Recommendation**: Keep as optional, or remove if no AI features are needed

### 5. `market-events`
- **Function Name**: market-events
- **Purpose**: Fetches upcoming-week economic calendar from ForexFactory feed and normalizes it.
- **Tables Used**: None
- **External APIs Used**: https://nfs.faireconomy.media/ff_calendar_thisweek.json
- **Gemini Usage**: None
- **OpenAI Usage**: None
- **Lovable Dependencies**: None
- **Recommendation**: Keep (core functionality)
