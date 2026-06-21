
# DaddyFxBook DB Push Readiness Report

## Overview
This file verifies the project is ready for `npx supabase db push`.

---

## 1. Tables Expected After Migration
- `public.user_settings`
- `public.trading_rules`
- `public.trades`
- `public.journals`
- `public.checklists`
- `public.screenshots`
- `public.backtest_sessions`
- `public.backtest_trades`

---

## 2. Indexes Expected
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

## 3. Triggers Expected
- `trg_user_settings_updated`
- `trg_trading_rules_updated`
- `update_trades_updated`
- `update_journals_updated`
- `update_checklists_updated`
- `trg_backtest_sessions_updated`
- `trg_backtest_trades_updated`

---

## 4. Buckets Expected
- `screenshots` (private)
- `avatars` (private)

---

## 5. Policies Expected
### Table Policies
- `Users manage own settings` (user_settings)
- `Users manage own rules` (trading_rules)
- `Users can view own trades` (trades)
- `Users can insert own trades` (trades)
- `Users can update own trades` (trades)
- `Users can delete own trades` (trades)
- `Users can view own journals` (journals)
- `Users can insert own journals` (journals)
- `Users can update own journals` (journals)
- `Users can delete own journals` (journals)
- `Users can view own checklists` (checklists)
- `Users can insert own checklists` (checklists)
- `Users can update own checklists` (checklists)
- `Users can delete own checklists` (checklists)
- `Users can view own screenshots` (screenshots)
- `Users can insert own screenshots` (screenshots)
- `Users can delete own screenshots` (screenshots)
- `owners manage backtest sessions` (backtest_sessions)
- `owners manage backtest trades` (backtest_trades)

### Storage Policies
- `Users read own screenshots`
- `Users upload own screenshots`
- `Users delete own screenshots`
- `Users read own avatars`
- `Users upload own avatar`
- `Users update own avatar`
- `Users delete own avatar`
