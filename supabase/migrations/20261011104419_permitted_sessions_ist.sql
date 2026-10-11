BEGIN;

ALTER TABLE public.trading_rules DROP CONSTRAINT trading_rules_allowed_sessions_check;

-- Consolidate the retired options without changing rule text, enabled state,
-- thresholds, ordering, or any unrelated rule configuration.
UPDATE public.trading_rules
SET allowed_sessions = ARRAY(
  SELECT mapped
  FROM (
    SELECT CASE WHEN id IN ('sydney', 'tokyo') THEN 'asian' ELSE id END AS mapped,
      min(position) AS first_position
    FROM unnest(allowed_sessions) WITH ORDINALITY AS selection(id, position)
    GROUP BY CASE WHEN id IN ('sydney', 'tokyo') THEN 'asian' ELSE id END
  ) AS normalized
  ORDER BY first_position
)
WHERE allowed_sessions && ARRAY['sydney', 'tokyo']::TEXT[];

-- Store only session identities here. All timing/display/check logic lives in
-- src/lib/marketSessions.ts; there is no independent database schedule.
ALTER TABLE public.trading_rules ADD CONSTRAINT trading_rules_allowed_sessions_check
  CHECK (allowed_sessions <@ ARRAY['asian', 'london', 'new-york']::TEXT[]
    AND array_position(allowed_sessions, NULL) IS NULL);

NOTIFY pgrst, 'reload schema';
COMMIT;
