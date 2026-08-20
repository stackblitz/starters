/*
  # Slides deck schema

  The whole deck lives in Postgres. There is no local copy, no JSON file, and no
  dev-server storage: this file is the only description of where a deck is kept.

  ## Apply it with the migration tool, not by reading this file

  Nothing watches `supabase/`. Pass the contents of this file to
  `mcp__supabase__apply_migration` (name it `deck_schema`). It is written to be
  safe to re-run, so applying it twice costs nothing — which matters because the
  migration tool can time out after the SQL has already committed.

  ## Tables

  1. `deck` — one row, forever. `id` is a boolean checked to be true, so a second
     row cannot exist.
     - `title`, `transition`, `font`, `accent` — how the deck presents
     - `visibility` — `public` (the default: anyone who opens the published
       address sees the slides, never the speaker notes) or `link` (the published
       address shows nothing without a share link)
     - `publish_url` — where this project is deployed, recorded by the deck
       function the first time the published site calls it. Share links are built
       on this, because the address the editor runs on opens for nobody else
     - `owner_key` — the editing credential (see Security)
     - `version` — bumped on every write, anywhere. The editor polls it to notice
       edits made by the agent or another window
     - `updated_at`
  2. `slides` — one row per slide, ordered by `position`. `props` is the
     layout-specific payload, `background` a small JSON object, `notes` the
     speaker notes, `status` the review state.
  3. `shares` — at most one link per mode (`edit`, `presenter`, `present`), with
     an optional password.
  4. `share_grants` — a browser that answered a password correctly, so it is
     asked once rather than every visit.
  5. `unlock_attempts` — failed password tries per address, which is what makes
     guessing a password slow.

  ## Functions

  1. `import_deck(jsonb)` — replaces the deck in one statement and returns how
     many slides landed. Slides keep their identity: by `id` when the incoming
     deck names one, otherwise by position, so re-importing an edited deck does
     not replace every slide with a copy of itself.
  2. `export_deck()` — the deck as portable JSON, the same shape `import_deck`
     accepts.

  ## Security

  1. Row level security is enabled on every table with **no policies at all**.
     That is deliberate and is the whole security model: the anon key that ships
     in the published bundle can reach nothing directly. Every read and write
     goes through the `deck` Edge Function, which holds the service role.
  2. Do not add policies. A policy for `anon` would let anyone holding the
     published bundle rewrite the deck and read the speaker notes, which are
     exactly the two things the function exists to prevent.
  3. `owner_key` is the credential that proves a request is the deck's owner. The
     migration generates one; the agent copies it into `.env` as
     `DECK_OWNER_KEY`, and `vite.config.ts` hands it to the app only while
     serving, so a production build cannot contain it. It is stored in plain text
     on purpose: it is a key to the very rows it sits beside, so hashing it would
     protect nothing from anyone able to read this table, and keeping it readable
     means a lost `.env` can be recovered rather than locking the owner out.
  4. Both functions run as their caller (`SECURITY INVOKER`), so row level
     security still applies to them. An anon caller reaching `export_deck()`
     through the REST API sees an empty deck rather than the real one.
*/

/* ── tables ─────────────────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS deck (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  title text NOT NULL DEFAULT 'Untitled deck',
  transition text NOT NULL DEFAULT 'fade'
    CHECK (transition IN ('fade', 'slide', 'rise', 'zoom', 'none')),
  font text NOT NULL DEFAULT 'inter',
  accent text,
  /* Publishing a deck makes it readable by default, because that is what the
     person publishing it meant. `link` takes that back: the published address
     then shows nothing to anyone not holding a share link. */
  visibility text NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public', 'link')),
  publish_url text,
  /* 244 bits of randomness from two v4 UUIDs, which needs no extension —
     pgcrypto's gen_random_bytes is not guaranteed to be installed. */
  owner_key text NOT NULL DEFAULT
    replace(gen_random_uuid()::text, '-', '') ||
    replace(gen_random_uuid()::text, '-', ''),
  version bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO deck (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS slides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position integer NOT NULL,
  layout text NOT NULL DEFAULT 'statement',
  props jsonb NOT NULL DEFAULT '{}'::jsonb,
  background jsonb NOT NULL DEFAULT '{"type":"none"}'::jsonb,
  animation text NOT NULL DEFAULT 'cascade'
    CHECK (animation IN ('cascade', 'rise', 'fade', 'zoom', 'none')),
  /* null means "inherit the deck's transition" */
  transition text
    CHECK (transition IN ('fade', 'slide', 'rise', 'zoom', 'none')),
  nav text,
  notes text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'none'
    CHECK (status IN ('none', 'draft', 'in-progress', 'review', 'approved')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS slides_position_idx ON slides (position);

CREATE TABLE IF NOT EXISTS shares (
  mode text PRIMARY KEY CHECK (mode IN ('edit', 'presenter', 'present')),
  token text NOT NULL UNIQUE,
  /* self-describing so the hash can be strengthened later without a migration:
     pbkdf2-sha256$<iterations>$<salt base64>$<hash base64> */
  password_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS share_grants (
  key text PRIMARY KEY,
  mode text NOT NULL REFERENCES shares(mode) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS unlock_attempts (
  ip text PRIMARY KEY,
  tries integer NOT NULL DEFAULT 0,
  first_at timestamptz NOT NULL DEFAULT now()
);

/* ── version, so an open editor notices writes it did not make ──────── */

CREATE OR REPLACE FUNCTION deck_touch() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.version := OLD.version + 1;
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS deck_touch ON deck;
CREATE TRIGGER deck_touch BEFORE UPDATE ON deck
  FOR EACH ROW EXECUTE FUNCTION deck_touch();

/* Slide writes bump the deck's version through the trigger above. Per statement
   rather than per row, so importing forty slides counts as one change. */
CREATE OR REPLACE FUNCTION slides_touch_deck() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  UPDATE deck SET updated_at = now() WHERE id = true;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS slides_touch_deck ON slides;
CREATE TRIGGER slides_touch_deck
  AFTER INSERT OR UPDATE OR DELETE ON slides
  FOR EACH STATEMENT EXECUTE FUNCTION slides_touch_deck();

/* ── the portable deck format ───────────────────────────────────────── */

CREATE OR REPLACE FUNCTION export_deck() RETURNS jsonb
LANGUAGE sql STABLE AS $$
  SELECT jsonb_strip_nulls(jsonb_build_object(
    'title', d.title,
    'transition', d.transition,
    'font', d.font,
    'accent', d.accent,
    'slides', COALESCE((
      SELECT jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'id', s.id,
        'layout', s.layout,
        'props', s.props,
        'background', s.background,
        'animation', s.animation,
        'transition', s.transition,
        'nav', s.nav,
        'notes', s.notes,
        'status', s.status
      )) ORDER BY s.position)
      FROM slides s
    ), '[]'::jsonb)
  ))
  FROM deck d WHERE d.id = true;
$$;

/* Replace the deck with `payload`, in one transaction.

   Slides keep their identity where they can: an incoming slide naming an `id`
   that still exists updates that row, and an incoming slide with no id takes
   over whatever slide currently sits at its position. Only slides left unclaimed
   are deleted. This is what makes re-importing an edited deck a change rather
   than a replacement — the editor keeps its selection, and a slide's history is
   not thrown away because its wording moved.

   Returns { slides, title, version }: the slide count is the verification that
   the import landed, which is why there is no separate check to run after it. */
CREATE OR REPLACE FUNCTION import_deck(payload jsonb) RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE
  incoming jsonb := COALESCE(payload -> 'slides', '[]'::jsonb);
  slide jsonb;
  i integer := 0;
  target uuid;
  claimed uuid[] := '{}';
  positional uuid[];
BEGIN
  UPDATE deck SET
    title = COALESCE(payload ->> 'title', 'Untitled deck'),
    transition = COALESCE(payload ->> 'transition', 'fade'),
    font = COALESCE(payload ->> 'font', 'inter'),
    accent = payload ->> 'accent'
  WHERE id = true;

  SELECT COALESCE(array_agg(s.id ORDER BY s.position), '{}')
    INTO positional FROM slides s;

  FOR slide IN SELECT * FROM jsonb_array_elements(incoming) LOOP
    target := NULL;

    /* the incoming deck names a slide that is still here */
    IF slide ? 'id' THEN
      SELECT s.id INTO target FROM slides s
        WHERE s.id::text = slide ->> 'id' AND NOT (s.id = ANY (claimed));
    END IF;

    /* otherwise, whatever is at this position already */
    IF target IS NULL AND array_length(positional, 1) > i THEN
      IF NOT (positional[i + 1] = ANY (claimed)) THEN
        target := positional[i + 1];
      END IF;
    END IF;

    IF target IS NULL THEN
      INSERT INTO slides (
        position, layout, props, background, animation, transition, nav, notes,
        status
      ) VALUES (
        i,
        COALESCE(slide ->> 'layout', 'statement'),
        COALESCE(slide -> 'props', '{}'::jsonb),
        COALESCE(slide -> 'background', '{"type":"none"}'::jsonb),
        COALESCE(slide ->> 'animation', 'cascade'),
        slide ->> 'transition',
        slide ->> 'nav',
        COALESCE(slide ->> 'notes', ''),
        COALESCE(slide ->> 'status', 'none')
      ) RETURNING id INTO target;
    ELSE
      UPDATE slides SET
        position = i,
        layout = COALESCE(slide ->> 'layout', 'statement'),
        props = COALESCE(slide -> 'props', '{}'::jsonb),
        background = COALESCE(slide -> 'background', '{"type":"none"}'::jsonb),
        animation = COALESCE(slide ->> 'animation', 'cascade'),
        transition = slide ->> 'transition',
        nav = slide ->> 'nav',
        notes = COALESCE(slide ->> 'notes', ''),
        status = COALESCE(slide ->> 'status', 'none'),
        updated_at = now()
      WHERE id = target;
    END IF;

    claimed := claimed || target;
    i := i + 1;
  END LOOP;

  DELETE FROM slides WHERE NOT (id = ANY (claimed));

  RETURN jsonb_build_object(
    'slides', i,
    'title', (SELECT title FROM deck WHERE id = true),
    'version', (SELECT version FROM deck WHERE id = true)
  );
END $$;

/* ── security: on, and empty ────────────────────────────────────────── */

ALTER TABLE deck ENABLE ROW LEVEL SECURITY;
ALTER TABLE slides ENABLE ROW LEVEL SECURITY;
ALTER TABLE shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE unlock_attempts ENABLE ROW LEVEL SECURITY;
