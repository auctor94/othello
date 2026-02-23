from .types import Board, Cell

SIZE = 8

def create_initial_board() -> Board:
    board = [[Cell.EMPTY for _ in range(SIZE)] for _ in range(SIZE)]

    board[3][3] = Cell.WHITE
    board[3][4] = Cell.BLACK
    board[4][3] = Cell.BLACK
    board[4][4] = Cell.WHITE

    return board
