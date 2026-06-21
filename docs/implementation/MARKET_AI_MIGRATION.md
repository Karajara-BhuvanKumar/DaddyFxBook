
# Market AI Migration

## Overview
Rewrote `supabase/functions/market-ai/index.ts` to remove Lovable AI dependencies and use user-owned Gemini API keys!

## Changes Made
- Removed use of `ai.gateway.lovable.dev` and `LOVABLE_API_KEY`
- Added user authentication (JWT-based)
- Added fetching of `user_settings.gemini_api_key` for current user
- Added direct call to `gemini-2.0-flash` with `x-goog-api-key` header
- Rewrote tool definitions to use Gemini's Function Declarations format instead of OpenAI's
- Preserved response structure completely

## Files Changed
- `supabase/functions/market-ai/index.ts`: Complete rewrite
