/*
  # Create Bolt Slides tables

  1. New Tables
    - `deck` — single-row deck metadata (title, transition, font, accent)
    - `slides` — one row per slide (layout, props jsonb, notes, status)
    - `shares` — one share link per mode (edit / presenter / present)
    - `share_grants` — proof a visitor unlocked a password-protected link
    - `unlock_attempts` — per-address throttle for share-password guesses
  2. Security
    - Enable RLS on every table.
    - Add NO policies. The browser must never read these tables with the
      anon key: `shares` holds password hashes and `slides` holds speaker
      notes the audience link is not allowed to see. The `deck-api` edge
      function talks to Postgres with the service role; the browser only
      talks to that function.
  3. Notes
    - Single-tenant, no auth. Owner is NOT "a request with no share token".
      deck-api access() order: share token (that token's mode, even from the
      owner browser) → Authorization/apikey equals SUPABASE_SERVICE_ROLE_KEY
      → X-Deck-Owner matching DECK_OWNER_SECRET → deny. If the function
      secret is unset, no-token is still owner (local Vite / first deploy).
    - Apply this SQL as a migration. Writing this file to disk does not
      create the tables.
*/

CREATE TABLE IF NOT EXISTS deck (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  title text NOT NULL DEFAULT 'Untitled deck',
  transition text NOT NULL DEFAULT 'fade',
  font text NOT NULL DEFAULT 'inter',
  accent text,
  updated_at timestamptz
);

CREATE TABLE IF NOT EXISTS slides (
  id text PRIMARY KEY,
  position int NOT NULL,
  layout text NOT NULL,
  props jsonb NOT NULL DEFAULT '{}'::jsonb,
  background jsonb NOT NULL DEFAULT '{"type":"none"}'::jsonb,
  animation text NOT NULL DEFAULT 'cascade',
  transition text,
  nav text,
  notes text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'none',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shares (
  mode text PRIMARY KEY,
  token text NOT NULL UNIQUE,
  pass_hash text,
  pass_salt text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS share_grants (
  key text PRIMARY KEY,
  mode text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS unlock_attempts (
  ip text PRIMARY KEY,
  count int NOT NULL DEFAULT 0,
  first_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE deck ENABLE ROW LEVEL SECURITY;
ALTER TABLE slides ENABLE ROW LEVEL SECURITY;
ALTER TABLE shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE unlock_attempts ENABLE ROW LEVEL SECURITY;

INSERT INTO deck (id, title, transition, font)
VALUES (1, 'Untitled deck', 'fade', 'inter')
ON CONFLICT (id) DO NOTHING;
