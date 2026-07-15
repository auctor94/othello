-- Manual migration for existing Postgres (e.g. Render) when the API
-- cannot run ensure_schema, or you prefer applying SQL yourself.
-- Safe to re-run: skips columns/indexes that already exist (Postgres 9.1+
-- for CREATE INDEX IF NOT EXISTS; column checks are app-side / one-shot).
--
-- Note: plain CREATE_ALL does NOT alter existing tables. The API lifespan
-- calls db.schema.ensure_schema(), which runs equivalent ALTERs on boot.
-- Use this file only if you need to patch the DB out-of-band.

ALTER TABLE games ADD COLUMN IF NOT EXISTS player_id VARCHAR NOT NULL DEFAULT '';
ALTER TABLE games ADD COLUMN IF NOT EXISTS result VARCHAR;
ALTER TABLE games ADD COLUMN IF NOT EXISTS white_score INTEGER;
ALTER TABLE games ADD COLUMN IF NOT EXISTS black_score INTEGER;
ALTER TABLE games ADD COLUMN IF NOT EXISTS max_move_flips INTEGER;
ALTER TABLE games ADD COLUMN IF NOT EXISTS difficulty VARCHAR NOT NULL DEFAULT 'easy';
ALTER TABLE games ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE games ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE games ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS ix_games_player_id ON games (player_id);
