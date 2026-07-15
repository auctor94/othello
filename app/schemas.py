from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from core.types import Board, Cell

Difficulty = Literal["easy", "medium", "hard"]


class CreateGameRequest(BaseModel):
    difficulty: Difficulty = "easy"


class MoveRequest(BaseModel):
    row: int
    col: int


class GameResponse(BaseModel):
    id: str
    board: Board
    turn: Cell
    status: str
    difficulty: Difficulty = "easy"


class StatsResponse(BaseModel):
    """Your statistics for a player_id (WHITE = human).

    won/lost/tied_pct are of finished; abandoned_pct is of started.
    """

    since: datetime | None
    days: int
    started: int
    finished: int
    abandoned: int
    won: int
    lost: int
    tied: int
    won_pct: float
    lost_pct: float
    tied_pct: float
    abandoned_pct: float
    perfect: int  # white_score == 64
    shutouts: int  # win && black_score == 0
    highest_score: int | None
    lowest_score: int | None
    avg_score: float | None
    highest_move_score: int | None
    current_win_streak: int
    longest_win_streak: int
    longest_lose_streak: int
    total_time: float  # seconds, finished only
    avg_time: float | None
    min_time: float | None
    max_time: float | None
