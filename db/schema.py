"""Ensure the games table matches GameRow (create_all + additive ALTER for existing DBs)."""

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine

from db.orm import Base

# (column_name, PostgreSQL type for ADD COLUMN IF NOT EXISTS)
_GAMES_COLUMNS: list[tuple[str, str]] = [
    ("player_id", "VARCHAR NOT NULL DEFAULT ''"),
    ("result", "VARCHAR"),
    ("white_score", "INTEGER"),
    ("black_score", "INTEGER"),
    ("max_move_flips", "INTEGER"),
    ("created_at", "TIMESTAMPTZ NOT NULL DEFAULT NOW()"),
    ("updated_at", "TIMESTAMPTZ NOT NULL DEFAULT NOW()"),
    ("finished_at", "TIMESTAMPTZ"),
]

_PLAYER_ID_INDEX = "ix_games_player_id"


def ensure_schema(engine: Engine) -> None:
    Base.metadata.create_all(bind=engine)

    inspector = inspect(engine)
    if "games" not in inspector.get_table_names():
        return

    existing_columns = {col["name"] for col in inspector.get_columns("games")}
    existing_indexes = {ix["name"] for ix in inspector.get_indexes("games")}

    with engine.begin() as conn:
        for name, sql_type in _GAMES_COLUMNS:
            if name not in existing_columns:
                conn.execute(text(f"ALTER TABLE games ADD COLUMN {name} {sql_type}"))

        if _PLAYER_ID_INDEX not in existing_indexes:
            conn.execute(
                text(f"CREATE INDEX IF NOT EXISTS {_PLAYER_ID_INDEX} ON games (player_id)")
            )
