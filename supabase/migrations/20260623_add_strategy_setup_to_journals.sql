-- ============================================================
-- Migration: Add strategy_setup column to journals table
-- Fixes: PGRST204 "Could not find the 'strategy_setup' column"
-- ============================================================

ALTER TABLE public.journals
ADD COLUMN IF NOT EXISTS strategy_setup text DEFAULT NULL;

-- Notify PostgREST to reload the schema cache so the API recognizes the new column immediately
NOTIFY pgrst, 'reload schema';
