import uuid
from collections.abc import Callable
from typing import TypeAlias

from sqlalchemy.orm import Session

from core.board import create_initial_board
from core.types import Cell
from db.models import Game
from db.orm import GameRow
from db.serialization import board_from_json, board_to_json, cell_from_str, cell_to_str

SessionFactory: TypeAlias = Callable[[], Session]


class InMemoryRepo:
    def __init__(self) -> None:
        self.games: dict[str, Game] = {}

    def create_game(self) -> Game:
        game = Game(
            id=str(uuid.uuid4()),
            board=create_initial_board(),
            turn=Cell.WHITE,
            status="active",
        )
        self.games[game.id] = game
        return game

    def get(self, game_id: str) -> Game:
        return self.games[game_id]

    def save(self, game: Game) -> None:
        self.games[game.id] = game


class PostgresRepo:
    def __init__(self, session_factory: SessionFactory) -> None:
        self._session_factory = session_factory

    def create_game(self) -> Game:
        game = Game(
            id=str(uuid.uuid4()),
            board=create_initial_board(),
            turn=Cell.WHITE,
            status="active",
        )
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
                row = GameRow(
                    id=game.id,
                    board=board_to_json(game.board),
                    turn=cell_to_str(game.turn),
                    status=game.status,
                )
                session.add(row)
            else:
                row.board = board_to_json(game.board)
                row.turn = cell_to_str(game.turn)
                row.status = game.status
            session.commit()


def _row_to_game(row: GameRow) -> Game:
    return Game(
        id=row.id,
        board=board_from_json(row.board),
        turn=cell_from_str(row.turn),
        status=row.status,
    )
