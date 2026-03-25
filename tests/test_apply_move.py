from core.engine import apply_move, InvalidMove
from core.board import create_initial_board
from core.types import Cell
import pytest

def test_apply_move_valid_move_flips_and_sets_stone():
    board = create_initial_board()
    apply_move(board, Cell.BLACK, (2, 3))
    assert board[2][3] == Cell.BLACK
    assert board[3][3] == Cell.BLACK

def test_apply_move_invalid_move_no_flips_raises_invalidmove():
    board = create_initial_board()
    try:
        apply_move(board, Cell.BLACK, (0, 0))
        assert False, "Expected InvalidMove when there are no flips"
    except InvalidMove:
        pass

@pytest.mark.parametrize(
    "move, flipped_cell",
    [
        ((2, 3), (3, 3)),   # BLACK
        ((3, 2), (3, 3)),   # BLACK
        # can be extended
    ],
)
def test_apply_move_black_valid_moves(move, flipped_cell):
    board = create_initial_board()
    apply_move(board, Cell.BLACK, move)
    assert board[move[0]][move[1]] == Cell.BLACK
    assert board[flipped_cell[0]][flipped_cell[1]] == Cell.BLACK