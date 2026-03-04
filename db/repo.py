import uuid
from core.board import create_initial_board
from core.types import Cell
from db.models import Game


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
