-- Migration: Default timezone for new users to IST
-- Idempotent: safe to run multiple times.

ALTER TABLE public.user_settings ALTER COLUMN timezone SET DEFAULT 'Asia/Kolkata';
