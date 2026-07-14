import uuid
from collections.abc import Callable
from datetime import datetime, timezone
from typing import TypeAlias

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from core.board import create_initial_board
from core.types import Cell
from db.models import Game
from db.orm import GameRow
from db.serialization import board_from_json, board_to_json, cell_from_str, cell_to_str

SessionFactory: TypeAlias = Callable[[], Session]


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _new_game(player_id: str) -> Game:
    now = _utc_now()
    return Game(
        id=str(uuid.uuid4()),
        board=create_initial_board(),
        turn=Cell.WHITE,
        status="active",
        player_id=player_id,
        created_at=now,
        updated_at=now,
        finished_at=None,
        result=None,
        white_score=None,
        black_score=None,
        max_move_flips=None,
    )


def _apply_game_to_row(row: GameRow, game: Game) -> None:
    row.player_id = game.player_id
    row.board = board_to_json(game.board)
    row.turn = cell_to_str(game.turn)
    row.status = game.status
    row.result = game.result
    row.white_score = game.white_score
    row.black_score = game.black_score
    row.max_move_flips = game.max_move_flips
    row.created_at = game.created_at
    row.updated_at = game.updated_at
    row.finished_at = game.finished_at


def _row_to_game(row: GameRow) -> Game:
    return Game(
        id=row.id,
        board=board_from_json(row.board),
        turn=cell_from_str(row.turn),
        status=row.status,
        player_id=row.player_id,
        created_at=row.created_at,
        updated_at=row.updated_at,
        finished_at=row.finished_at,
        result=row.result,
        white_score=row.white_score,
        black_score=row.black_score,
        max_move_flips=row.max_move_flips,
    )


class InMemoryRepo:
    def __init__(self) -> None:
        self.games: dict[str, Game] = {}

    def create_game(self, player_id: str) -> Game:
        game = _new_game(player_id)
        self.games[game.id] = game
        return game

    def get(self, game_id: str) -> Game:
        return self.games[game_id]

    def save(self, game: Game) -> None:
        self.games[game.id] = game

    def abandon_active_games(self, player_id: str) -> None:
        now = _utc_now()
        for game in self.games.values():
            if game.player_id == player_id and game.status == "active":
                game.status = "abandoned"
                game.updated_at = now

    def list_by_player(self, player_id: str) -> list[Game]:
        return [g for g in self.games.values() if g.player_id == player_id]

    def get_active_for_player(self, player_id: str) -> Game | None:
        active = [
            g
            for g in self.games.values()
            if g.player_id == player_id and g.status == "active"
        ]
        if not active:
            return None
        return max(active, key=lambda g: g.updated_at)


class PostgresRepo:
    def __init__(self, session_factory: SessionFactory) -> None:
        self._session_factory = session_factory

    def create_game(self, player_id: str) -> Game:
        game = _new_game(player_id)
        self.save(game)
        return game

    def get(self, game_id: str) -> Game:
        with self._session_factory() as session:
            row = session.get(GameRow, game_id)
            if row is None:
                raise KeyError(game_id)
            return _row_to_game(row)

    def save(self, game: Game) -> None:
        with self._session_factory() as session:
            row = session.get(GameRow, game.id)
            if row is None:
                row = GameRow(id=game.id)
                session.add(row)
            _apply_game_to_row(row, game)
            session.commit()

    def abandon_active_games(self, player_id: str) -> None:
        with self._session_factory() as session:
            session.execute(
                update(GameRow)
                .where(GameRow.player_id == player_id, GameRow.status == "active")
                .values(status="abandoned", updated_at=_utc_now())
            )
            session.commit()

    def list_by_player(self, player_id: str) -> list[Game]:
        with self._session_factory() as session:
            rows = session.scalars(
                select(GameRow).where(GameRow.player_id == player_id)
            ).all()
            return [_row_to_game(row) for row in rows]

    def get_active_for_player(self, player_id: str) -> Game | None:
        with self._session_factory() as session:
            row = session.scalars(
                select(GameRow)
                .where(GameRow.player_id == player_id, GameRow.status == "active")
                .order_by(GameRow.updated_at.desc())
                .limit(1)
            ).first()
            return _row_to_game(row) if row is not None else None
