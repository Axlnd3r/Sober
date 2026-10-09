CREATE TABLE IF NOT EXISTS auth_nonces (
  id uuid PRIMARY KEY,
  wallet text NOT NULL,
  challenge text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz
);
CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash text PRIMARY KEY,
  wallet text NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);
CREATE TABLE IF NOT EXISTS rooms (
  id text PRIMARY KEY,
  competition text NOT NULL,
  home_team text NOT NULL,
  away_team text NOT NULL,
  kickoff_at timestamptz NOT NULL,
  fixture_source_url text NOT NULL,
  brief text NOT NULL DEFAULT '',
  panta_market_id text UNIQUE,
  question text,
  resolution_rule text,
  sources jsonb NOT NULL DEFAULT '[]',
  cutoff_at timestamptz NOT NULL,
  published boolean NOT NULL DEFAULT false,
  reviewed boolean NOT NULL DEFAULT false,
  trading_paused boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS fan_forecasts (
  wallet text NOT NULL,
  room_id text NOT NULL REFERENCES rooms(id),
  side text NOT NULL CHECK (side IN ('yes','no')),
  reason varchar(280) NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (wallet, room_id)
);
CREATE TABLE IF NOT EXISTS intents (
  id uuid PRIMARY KEY,
  wallet text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('buy','claim','create')),
  room_id text REFERENCES rooms(id),
  market_id text,
  side text,
  amount_usdc text,
  idempotency_key uuid NOT NULL,
  request_hash text NOT NULL,
  state text NOT NULL,
  quote jsonb,
  build jsonb,
  signature text UNIQUE,
  chain_status text NOT NULL DEFAULT 'unknown',
  panta_status text NOT NULL DEFAULT 'unknown',
  attribution_status text NOT NULL DEFAULT 'pending',
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (wallet, idempotency_key)
);
CREATE INDEX IF NOT EXISTS intents_wallet_idx ON intents(wallet, created_at DESC);
