from dataclasses import dataclass
from typing import List
from core.board import create_initial_board
from core.types import Cell, Board
import uuid

@dataclass
class Game:
    id: str
    player_human: int
    player_ai: str = "AI"
    board: Board = None
    turn: Cell = Cell.BLACK
    status: str = "active"

class InMemoryRepo:
    def __init__(self):
        self.games: dict[str, Game] = {}

    def create_game(self, player_human: int) -> Game:
        game_id = str(uuid.uuid4())
        game = Game(
            id=game_id,
            player_human=player_human,
            board=create_initial_board(),
            turn=Cell.BLACK,
            status="active",
        )
        self.games[game_id] = game
        return game

    def get(self, game_id: str) -> Game:
        return self.games[game_id]

    def save(self, game: Game) -> None:
        self.games[game.id] = game
