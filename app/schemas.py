from pydantic import BaseModel
from typing import List
from core.types import Cell, Board


class MoveRequest(BaseModel):
    user_id: int
    row: int
    col: int


class GameResponse(BaseModel):
    id: str
    board: Board
    turn: Cell
    status: str

