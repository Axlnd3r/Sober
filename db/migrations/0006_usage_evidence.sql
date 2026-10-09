CREATE TABLE IF NOT EXISTS usage_events (
  wallet text NOT NULL,
  room_id text NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  event text NOT NULL CHECK(event IN ('room_view','analysis_view','share')),
  day date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  internal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(wallet,room_id,event,day)
);
