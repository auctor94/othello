from core.board import create_initial_board
from core.rules import collect_flips
from core.types import Board, Cell

def test_collect_flips():
    board = create_initial_board()
    assert collect_flips(board, Cell.BLACK, (2, 3)) == [(3, 3)]
    assert collect_flips(board, Cell.WHITE, (2, 4)) == [(3, 4)]

def test_collect_flips_illegal_move_on_occupied_cell():
    board = create_initial_board()
    # (3,3) is already occupied (WHITE), so the move is illegal -> []
    assert collect_flips(board, Cell.BLACK, (3, 3)) == []

def test_collect_flips_multiple_directions():
    board = empty_board()
    # Right: (3,4)=WHITE, (3,5)=BLACK -> flip (3,4)
    board[3][4] = Cell.WHITE
    board[3][5] = Cell.BLACK
    # Down: (4,3)=WHITE, (5,3)=BLACK -> flip (4,3)
    board[4][3] = Cell.WHITE
    board[5][3] = Cell.BLACK
    flips = collect_flips(board, Cell.BLACK, (3, 3))
    print(flips)
    assert len(flips) == 2
    assert set(flips) == {(3, 4), (4, 3)}

def test_collect_flips_out_of_board_column_raises():
    board = create_initial_board()
    try:
        print(collect_flips(board, Cell.BLACK, (0, 8)))
        assert False, "Expected IndexError for move outside the board"
    except IndexError:
        pass


def empty_board() -> Board:
    return [[Cell.EMPTY for _ in range(8)] for _ in range(8)]
