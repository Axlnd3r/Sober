ALTER TABLE rooms ADD COLUMN IF NOT EXISTS provider_fixture_id bigint UNIQUE;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS provider_status text;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS provider_updated_at timestamptz;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS fixture_synced_at timestamptz;

CREATE TABLE IF NOT EXISTS job_leases (
  name text PRIMARY KEY,
  token uuid NOT NULL,
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS intents_reconcile_idx ON intents(state, updated_at)
  WHERE signature IS NOT NULL;
