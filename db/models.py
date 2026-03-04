from dataclasses import dataclass
from core.types import Cell, Board


@dataclass
class Game:
    """Single-player game: human = WHITE, AI = BLACK."""
    id: str
    board: Board
    turn: Cell
    status: str  # "active" | "finished"
