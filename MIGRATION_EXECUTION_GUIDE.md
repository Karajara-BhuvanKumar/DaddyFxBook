
# DaddyFxBook Production Schema Migration Execution Guide

## Overview
This guide outlines the steps to apply the final production schema for DaddyFxBook. **Important: Do NOT apply these changes without a full database backup.**

---

## 1. Migration Order
Execute `FINAL_PRODUCTION_SCHEMA.sql` in your Supabase project (e.g., via the SQL Editor in the Supabase Dashboard) in the order it's written. This file contains all components:
1. `update_updated_at_column` Function
2. Tables (with foreign keys)
3. RLS Policies for Tables
4. Triggers for `updated_at`
5. Indexes
6. Storage Buckets
7. RLS Policies for Storage

---

## 2. Bucket Creation Order
Buckets are created in `FINAL_PRODUCTION_SCHEMA.sql` in this order:
1. `screenshots` (private)
2. `avatars` (private)

---

## 3. Policy Creation Order
Tables and their RLS policies are created in this order (ensuring dependencies are met):
1. `user_settings`
2. `trading_rules`
3. `trades`
4. `journals`
5. `checklists`
6. `screenshots`
7. `backtest_sessions`
8. `backtest_trades`

Storage bucket RLS policies are created after buckets are inserted:
1. `screenshots` bucket policies
2. `avatars` bucket policies

---

## 4. Rollback Steps
If you need to rollback, follow this order (reverse of creation):
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
3. Drop tables (reverse order of creation)
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

## 5. Important Notes
- **Backup First:** Always backup your database before applying migrations.
- **Fresh Install:** This schema is intended for a **fresh Supabase project**. If you have existing data, you will need to migrate it manually.
- **Frontend:** No frontend code changes are required for this schema.
- **RLS:** All existing RLS policies have been preserved.
