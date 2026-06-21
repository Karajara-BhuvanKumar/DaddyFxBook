# DATABASE MIGRATION PLAN

## 1. Current Architecture Overview

The current Supabase architecture for the DaddyFxBook project includes a comprehensive set of tables, RLS policies, storage buckets, and Edge Functions designed to support detailed trade journaling, backtesting, and AI-driven insights.

### Database Tables:

*   **`user_settings`**: Stores user preferences and configuration.
*   **`trading_rules`**: Manages user-defined trading rules.
*   **`trades`**: Core table for individual trade records.
*   **`journals`**: Stores qualitative journal entries linked to trades.
*   **`checklists`**: Stores pre-trade checklist items for each trade.
*   **`screenshots`**: Stores metadata for trade-related screenshots.
*   **`backtest_sessions`**: Manages backtesting sessions.
*   **`backtest_trades`**: Stores individual simulated trades within backtesting sessions.
*   **`backtest_ai_reports`**: Stores AI-generated reports for backtesting.
*   **`ai_period_reports`**: Stores AI-generated performance reports for various periods.
*   **`ai_scorecards`**: Stores AI-generated trader scorecards.
*   **`ai_trade_reviews`**: Stores AI-generated reviews for individual trades.

### Relationships:

*   All tables are linked to `auth.users.id` for user ownership.
*   `journals`, `checklists`, and `screenshots` are linked to `trades.id`.
*   `backtest_trades` and `backtest_ai_reports` are linked to `backtest_sessions.id`.

### Storage Buckets:

*   **`avatars`**: For user profile pictures.
*   **`screenshots`**: For trade-related images.

### Row Level Security (RLS) Policies:
Extensive RLS policies are implemented across all tables and storage buckets, ensuring data isolation and user-specific access.

### Edge Functions:

*   **`market-events`**: Fetches and normalizes economic calendar data.
*   **`market-ai`**: Provides AI analysis for economic events.
*   **`backtest-ai`**: Generates and persists AI reports for backtesting sessions.
*   **`ai-report`**: Generates and persists AI performance reports and trade reviews.
*   **`ai-insights`**: Generates and persists AI commentary for period reports and scorecards.

### Triggers:
`update_updated_at_column()` function and triggers are used to maintain `updated_at` timestamps.

## 2. Proposed Simplified Production Architecture

The proposed architecture focuses on streamlining the database by retaining core trading and backtesting functionalities while removing AI persistence tables to reduce complexity and storage overhead. AI analysis can still be performed on-the-fly by Edge Functions without persisting the results in the database if not explicitly required for historical storage.

### Tables to Keep:

1.  **`user_settings`**: Essential for user preferences and configuration.
2.  **`trading_rules`**: Essential for user-defined trading plans and strategies.
3.  **`trades`**: The central table for all individual trade records.
4.  **`journals`**: For qualitative analysis and notes linked to specific trades.
5.  **`checklists`**: To ensure adherence to pre-trade routines.
6.  **`screenshots`**: For visual documentation of trade setups and outcomes.
7.  **`backtest_sessions`**: To organize and manage backtesting efforts.
8.  **`backtest_trades`**: To store the results of individual simulated trades during backtesting.

### Tables to Remove:

The following tables, primarily used for persisting AI-generated data, will be removed:

*   `backtest_ai_reports`
*   `ai_period_reports`
*   `ai_scorecards`
*   `ai_trade_reviews`

### Edge Functions Impact:

*   **`market-events`**: Remains unchanged.
*   **`market-ai`**: Remains unchanged.
*   **`backtest-ai`**: This function currently persists data to `backtest_ai_reports`. It will be removed or modified to perform real-time analysis without database persistence. For this migration, it is considered removed.
*   **`ai-report`**: This function persists data to `ai_performance_reports` and `ai_trade_reviews`. It will be removed.
*   **`ai-insights`**: This function persists data to `ai_period_reports` and `ai_scorecards`. It will be removed.

### Storage Buckets to Keep:

*   `avatars`
*   `screenshots`

## 3. Migration Steps

To implement the proposed simplified schema, follow these steps:

1.  **Backup Your Database**: **CRITICAL**: Before making any changes, ensure you have a complete backup of your existing Supabase database.
2.  **Apply New Schema**: Apply the generated SQL migration file (`0000_initial_schema.sql`) to a fresh Supabase project. This file includes:
    *   The `update_updated_at_column` function.
    *   Definitions for all tables to keep (`user_settings`, `trading_rules`, `trades`, `journals`, `checklists`, `screenshots`, `backtest_sessions`, `backtest_trades`).
    *   All necessary RLS policies for these tables.
    *   Triggers for `updated_at` columns where applicable.
    *   Definitions and RLS policies for `avatars` and `screenshots` storage buckets.
3.  **Remove Old AI-related Edge Functions**: Delete the `backtest-ai`, `ai-report`, and `ai-insights` Edge Functions from your Supabase project.
4.  **Update Frontend Code**: Modify the frontend code to reflect the removal of the AI persistence tables and the associated Edge Functions. This includes updating any data fetching logic, type definitions, and UI components that previously interacted with these removed components.
5.  **Test Thoroughly**: Conduct comprehensive testing of all remaining functionalities to ensure the application works as expected with the simplified schema.

## 4. Generated SQL for Fresh Supabase Project

The SQL for the simplified schema, including table definitions, RLS policies, indexes, foreign keys, and storage buckets, is located in:

`c:\Users\karaj\Desktop\trade Journal\DaddyFxBook\supabase\migrations\0000_initial_schema.sql`

This file is designed to be applied to a fresh Supabase project.
