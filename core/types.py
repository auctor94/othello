from enum import Enum
from typing import List, Tuple

class Cell(str, Enum):
    EMPTY = "."
    BLACK = "B"
    WHITE = "W"

Player = Cell  # alias

Board = List[List[Cell]]

Move = Tuple[int, int]  # (row, column)
