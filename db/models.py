from dataclasses import dataclass
from datetime import datetime

from core.types import Cell, Board


@dataclass
class Game:
    """Single-player game: human = WHITE, AI = BLACK."""

    id: str
    board: Board
    turn: Cell
    status: str  # "active" | "finished" | "abandoned"
    player_id: str
    created_at: datetime
    updated_at: datetime
    finished_at: datetime | None = None
    result: str | None = None  # "win" | "loss" | "draw"
    white_score: int | None = None
    black_score: int | None = None
    max_move_flips: int | None = None
    difficulty: str = "easy"  # "easy" | "medium" | "hard"
