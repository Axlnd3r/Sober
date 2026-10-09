ALTER TABLE fan_forecasts ADD COLUMN IF NOT EXISTS decision_snapshot jsonb;
CREATE INDEX IF NOT EXISTS fan_forecasts_notebook_idx ON fan_forecasts(wallet, updated_at DESC);
