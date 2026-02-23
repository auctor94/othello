from core.board import create_initial_board
from core.engine import apply_move
from core.types import Cell

def test_first_move():
    board = create_initial_board()
    apply_move(board, Cell.BLACK, (2, 3))

    assert board[3][3] == Cell.BLACK
