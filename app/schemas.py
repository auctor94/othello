from pydantic import BaseModel
from core.types import Board, Cell


class MoveRequest(BaseModel):
    row: int
    col: int


class GameResponse(BaseModel):
    id: str
    board: Board
    turn: Cell
    status: str
