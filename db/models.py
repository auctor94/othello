from dataclasses import dataclass
from typing import List
from core.types import Cell, Board


# @dataclass
# class Game:
#     id: str
#     player_black: int
#     player_white: int
#     board: Board
#     turn: Cell
#     status: str

@dataclass
class Game:
    id: str
    player_human: int
    board: Board
    turn: Cell = Cell.BLACK
    status: str = "active"
    player_ai: str = "AI"

