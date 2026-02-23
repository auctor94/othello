import sys
from pathlib import Path

# Add project root so "core", "db", etc. resolve when running this file directly
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from core.board import create_initial_board
from core.engine import apply_move
from core.types import Cell

board = create_initial_board()
apply_move(board, Cell.BLACK, (2,3))
for row in board:
    print(" ".join(c.name if c else "." for c in row))