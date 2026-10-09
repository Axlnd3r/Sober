ALTER TABLE fan_forecasts
  ADD COLUMN IF NOT EXISTS created_at timestamptz;

UPDATE fan_forecasts
SET created_at = updated_at
WHERE created_at IS NULL;

ALTER TABLE fan_forecasts
  ALTER COLUMN created_at SET DEFAULT now(),
  ALTER COLUMN created_at SET NOT NULL;
