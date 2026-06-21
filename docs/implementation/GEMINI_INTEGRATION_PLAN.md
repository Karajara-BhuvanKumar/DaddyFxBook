
# DaddyFxBook Gemini Integration Plan

## Overview
This file outlines the plan to integrate Google Gemini API into DaddyFxBook, with per-user API key management.

---

## 1. Schema Changes
### Modify user_settings table
Add column: `gemini_api_key TEXT` to store each user's API key. This column is added to `public.user_settings` table.

**SQL for Migration:**
```sql
ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS gemini_api_key TEXT;
```

---

## 2. Frontend Flow
1. **Save API Key Section**:
   - UI already exists for user settings, add "Gemini API Key" input field
   - User enters their key, clicks "Save Key"
   - Frontend upserts the key to user_settings.gemini_api_key

2. **Generate AI Report Flow**:
   - User clicks "Generate AI Report"
   - Frontend collects necessary data (trades, period, etc.)
   - Frontend calls Supabase Edge Function to generate report
   - Edge Function handles fetching user's key, calling Gemini, and returning report
   - Report displayed to user in existing UI

---

## 3. Backend Flow
### Edge Function
Create/modify an Edge Function that:
1. Receives request from authenticated user
2. Fetches user's gemini_api_key from user_settings
3. Collects necessary data (trades, journals, etc.)
4. Calls Gemini API using user's key
5. Generates and returns report
6. (Optional) Persist report (if needed)

---

## 4. Security Considerations
1. **RLS Policies**: Keep existing RLS policies on user_settings, users can only access their own gemini_api_key
2. **API Key Storage**: Stored in Supabase database, encrypted at rest (Supabase default)
3. **Edge Function Security**: Only authenticated users can call the function
4. **No Hardcoded Keys**: No keys stored in frontend or backend environment variables
5. **Data Privacy**: User's trade data and API key are never exposed to third parties (except Gemini API itself)
