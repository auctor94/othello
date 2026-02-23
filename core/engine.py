from .types import Board, Cell, Move
from .rules import collect_flips


class InvalidMove(Exception):
    pass


def apply_move(board: Board, player: Cell, move: Move) -> Board:
    flips = collect_flips(board, player, move)

    if not flips:
        raise InvalidMove()

    r, c = move
    board[r][c] = player

    for fr, fc in flips:
        board[fr][fc] = player

    return board

def has_valid_move(board: Board, player: Cell) -> bool:
    for r in range(8):
        for c in range(8):
            if collect_flips(board, player, (r, c)):
                return True
    return False

def is_game_over(board: Board) -> bool:
    from .rules import opponent
    return (
        not has_valid_move(board, Cell.BLACK)
        and not has_valid_move(board, Cell.WHITE)
    )
