from .types import Board, Cell, Move

DIRECTIONS = [
    (-1, -1), (-1, 0), (-1, 1),
    (0, -1),          (0, 1),
    (1, -1),  (1, 0), (1, 1),
]

def inside(r: int, c: int) -> bool:
    return 0 <= r < 8 and 0 <= c < 8


def opponent(player: Cell) -> Cell:
    return Cell.BLACK if player == Cell.WHITE else Cell.WHITE

def collect_flips(board: Board, player: Cell, move: Move):
    r, c = move

    if board[r][c] != Cell.EMPTY:
        return []

    flips = []

    for dr, dc in DIRECTIONS:
        path = []
        cr, cc = r + dr, c + dc

        while inside(cr, cc) and board[cr][cc] == opponent(player):
            path.append((cr, cc))
            cr += dr
            cc += dc

        if inside(cr, cc) and board[cr][cc] == player:
            flips.extend(path)

    return flips
