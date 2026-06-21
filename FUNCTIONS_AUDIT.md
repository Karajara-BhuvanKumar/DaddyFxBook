
# DaddyFxBook Functions Audit

## Overview
This file audits all edge functions in the project.

---

## Function List

### 1. `ai-insights`
- **Purpose**: Generates AI commentary for daily/weekly/monthly reports and trader scorecards. Persists results to `ai_period_reports` and `ai_scorecards`.
- **External APIs Used**: https://ai.gateway.lovable.dev/v1/chat/completions
- **Gemini Usage**: Uses `google/gemini-2.5-flash`
- **OpenAI Usage**: None
- **Lovable Dependencies**: Uses LOVABLE_API_KEY, ai.gateway.lovable.dev
- **Tables Used**: `ai_period_reports`, `ai_scorecards` (NOT in current production schema)
- **Recommendation**: Remove (depends on AI persistence tables)

### 2. `ai-report`
- **Purpose**: Runs AI performance coach and per-trade reviews. Persists to `ai_trade_reviews` and `ai_performance_reports`.
- **External APIs Used**: https://ai.gateway.lovable.dev/v1/chat/completions
- **Gemini Usage**: Uses `google/gemini-2.5-flash`
- **OpenAI Usage**: None
- **Lovable Dependencies**: Uses LOVABLE_API_KEY, ai.gateway.lovable.dev
- **Tables Used**: `ai_trade_reviews`, `ai_performance_reports` (NOT in current production schema)
- **Recommendation**: Remove (depends on AI persistence tables)

### 3. `backtest-ai`
- **Purpose**: Analyzes backtest sessions using AI, persists results to `backtest_ai_reports`.
- **External APIs Used**: https://ai.gateway.lovable.dev/v1/chat/completions
- **Gemini Usage**: Uses `google/gemini-2.5-flash`
- **OpenAI Usage**: None
- **Lovable Dependencies**: Uses LOVABLE_API_KEY, ai.gateway.lovable.dev
- **Tables Used**: `backtest_ai_reports` (NOT in current production schema)
- **Recommendation**: Remove (depends on AI persistence tables)

### 4. `market-ai`
- **Purpose**: Generates AI analysis for a single economic event.
- **External APIs Used**: https://ai.gateway.lovable.dev/v1/chat/completions
- **Gemini Usage**: Uses `google/gemini-2.5-flash`
- **OpenAI Usage**: None
- **Lovable Dependencies**: Uses LOVABLE_API_KEY, ai.gateway.lovable.dev
- **Tables Used**: None
- **Recommendation**: Keep as optional, or remove if no AI features are needed

### 5. `market-events`
- **Purpose**: Fetches upcoming-week economic calendar from ForexFactory feed and normalizes it.
- **External APIs Used**: https://nfs.faireconomy.media/ff_calendar_thisweek.json
- **Gemini Usage**: None
- **OpenAI Usage**: None
- **Lovable Dependencies**: None
- **Tables Used**: None
- **Recommendation**: Keep (core functionality)
