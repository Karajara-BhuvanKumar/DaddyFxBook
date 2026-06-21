
# DaddyFxBook Production Schema Migration Execution Guide

## Overview
This guide outlines the steps to apply the final production schema for DaddyFxBook. **Important: Do NOT apply these changes without a full database backup.**

---

## 1. Execution Order
Execute `supabase/migrations/0000_initial_schema.sql` in your Supabase project (e.g., via the SQL Editor in the Supabase Dashboard) in the order it's written:
1. `update_updated_at_column` Function
2. `user_settings` Table
3. `trading_rules` Table
4. `trades` Table
5. `journals` Table
6. `checklists` Table
7. `screenshots` Table
8. `backtest_sessions` Table
9. `backtest_trades` Table
10. Insert storage buckets
11. Create storage RLS policies

---

## 2. Bucket Creation Order
1. `screenshots` (private)
2. `avatars` (private)

---

## 3. Policy Creation Order
### Table RLS Policies
1. `user_settings`
2. `trading_rules`
3. `trades`
4. `journals`
5. `checklists`
6. `screenshots`
7. `backtest_sessions`
8. `backtest_trades`

### Storage RLS Policies
1. `screenshots` bucket policies
2. `avatars` bucket policies

---

## 4. Trigger Order
Triggers are created after their respective tables and the `update_updated_at_column` function:
1. `trg_user_settings_updated`
2. `trg_trading_rules_updated`
3. `update_trades_updated`
4. `update_journals_updated`
5. `update_checklists_updated`
6. `trg_backtest_sessions_updated`
7. `trg_backtest_trades_updated`

---

## 5. Rollback Instructions
To rollback, follow this order:
1. Drop storage bucket policies
   ```sql
   DROP POLICY IF EXISTS "Users read own screenshots" ON storage.objects;
   DROP POLICY IF EXISTS "Users upload own screenshots" ON storage.objects;
   DROP POLICY IF EXISTS "Users delete own screenshots" ON storage.objects;
   DROP POLICY IF EXISTS "Users read own avatars" ON storage.objects;
   DROP POLICY IF EXISTS "Users upload own avatar" ON storage.objects;
   DROP POLICY IF EXISTS "Users update own avatar" ON storage.objects;
   DROP POLICY IF EXISTS "Users delete own avatar" ON storage.objects;
   ```
2. Drop storage buckets
   ```sql
   DELETE FROM storage.buckets WHERE id = 'screenshots';
   DELETE FROM storage.buckets WHERE id = 'avatars';
   ```
3. Drop tables (reverse of creation order)
   ```sql
   DROP TABLE IF EXISTS public.backtest_trades CASCADE;
   DROP TABLE IF EXISTS public.backtest_sessions CASCADE;
   DROP TABLE IF EXISTS public.screenshots CASCADE;
   DROP TABLE IF EXISTS public.checklists CASCADE;
   DROP TABLE IF EXISTS public.journals CASCADE;
   DROP TABLE IF EXISTS public.trades CASCADE;
   DROP TABLE IF EXISTS public.trading_rules CASCADE;
   DROP TABLE IF EXISTS public.user_settings CASCADE;
   ```
4. Drop function
   ```sql
   DROP FUNCTION IF EXISTS public.update_updated_at_column();
   ```

---

## 6. Expected Tables After Migration
The following tables should exist after migration:
- `public.user_settings`
- `public.trading_rules`
- `public.trades`
- `public.journals`
- `public.checklists`
- `public.screenshots`
- `public.backtest_sessions`
- `public.backtest_trades`

---

## 7. Expected Indexes
The following indexes should exist after migration:
- `idx_trading_rules_user_created`
- `idx_trades_user_created`
- `idx_trades_symbol`
- `idx_trades_session`
- `idx_journals_user_created`
- `idx_screenshots_user_created`
- `idx_backtest_sessions_user`
- `idx_backtest_trades_session`
- `idx_backtest_trades_user_created`
- `idx_backtest_trades_session_id`
- `idx_backtest_trades_pair`
- `idx_backtest_trades_setup`
- `idx_backtest_trades_trade_date`

---

## 8. Expected Storage Buckets
- `screenshots` (private)
- `avatars` (private)

---

## 9. Important Notes
- **Backup First:** Always backup your database before applying migrations.
- **Fresh Install:** This schema is intended for a **fresh Supabase project**. If you have existing data, you will need to migrate it manually.
- **Frontend:** No frontend code changes are required for this schema.
