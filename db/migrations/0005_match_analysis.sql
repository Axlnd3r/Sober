ALTER TABLE rooms ADD COLUMN IF NOT EXISTS home_team_provider_id integer;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS away_team_provider_id integer;
CREATE TABLE IF NOT EXISTS match_analyses (
  id uuid PRIMARY KEY,
  room_id text NOT NULL REFERENCES rooms(id),
  snapshot_hash text NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  UNIQUE(room_id, snapshot_hash)
);
CREATE INDEX IF NOT EXISTS match_analyses_room_idx ON match_analyses(room_id, created_at DESC);
ALTER TABLE fan_forecasts ADD COLUMN IF NOT EXISTS analysis_id uuid REFERENCES match_analyses(id);
