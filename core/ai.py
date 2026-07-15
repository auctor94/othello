"""AI move selection for single-player BLACK."""

from __future__ import annotations

import math

from core.engine import apply_move, get_valid_moves, has_valid_move, is_game_over
from core.rules import collect_flips, opponent
from core.types import Board, Cell, Move

CORNERS: frozenset[Move] = frozenset({(0, 0), (0, 7), (7, 0), (7, 7)})

# Classic Othello square weights: corners high, X/C-squares next to corners low.
_POSITION: tuple[tuple[int, ...], ...] = (
    (120, -20, 20, 5, 5, 20, -20, 120),
    (-20, -40, -5, -5, -5, -5, -40, -20),
    (20, -5, 15, 3, 3, 15, -5, 20),
    (5, -5, 3, 3, 3, 3, -5, 5),
    (5, -5, 3, 3, 3, 3, -5, 5),
    (20, -5, 15, 3, 3, 15, -5, 20),
    (-20, -40, -5, -5, -5, -5, -40, -20),
    (120, -20, 20, 5, 5, 20, -20, 120),
)

_HARD_DEPTH = 3


def _copy_board(board: Board) -> Board:
    return [row[:] for row in board]


def _count_stones(board: Board) -> tuple[int, int, int]:
    white = black = empty = 0
    for row in board:
        for cell in row:
            if cell == Cell.WHITE:
                white += 1
            elif cell == Cell.BLACK:
                black += 1
            else:
                empty += 1
    return white, black, empty


def _evaluate(board: Board, perspective: Cell) -> float:
    """Heuristic score for `perspective` (higher = better for that player)."""
    opp = opponent(perspective)
    white, black, empty = _count_stones(board)
    my_discs = black if perspective == Cell.BLACK else white
    opp_discs = white if perspective == Cell.BLACK else black

    if is_game_over(board):
        if my_discs > opp_discs:
            return 10_000 + (my_discs - opp_discs)
        if my_discs < opp_discs:
            return -10_000 - (opp_discs - my_discs)
        return 0.0

    positional = 0
    for r in range(8):
        for c in range(8):
            cell = board[r][c]
            if cell == perspective:
                positional += _POSITION[r][c]
            elif cell == opp:
                positional -= _POSITION[r][c]

    my_moves = len(get_valid_moves(board, perspective))
    opp_moves = len(get_valid_moves(board, opp))
    if my_moves + opp_moves == 0:
        mobility = 0.0
    else:
        mobility = 100.0 * (my_moves - opp_moves) / (my_moves + opp_moves)

    disc_diff = my_discs - opp_discs
    if empty <= 12:
        # Late game: raw disc count starts to matter.
        discs = 15.0 * disc_diff
    else:
        discs = 1.5 * disc_diff

    return positional + mobility + discs


def _ordered_moves(board: Board, player: Cell) -> list[Move]:
    moves = get_valid_moves(board, player)
    moves.sort(key=lambda m: (_POSITION[m[0]][m[1]], m[0], m[1]), reverse=True)
    return moves


def _minimax(
    board: Board,
    depth: int,
    alpha: float,
    beta: float,
    maximizing: bool,
) -> tuple[float, Move | None]:
    """Alpha-beta search; scores are from BLACK's perspective."""
    if depth == 0 or is_game_over(board):
        return _evaluate(board, Cell.BLACK), None

    player = Cell.BLACK if maximizing else Cell.WHITE
    moves = _ordered_moves(board, player)

    if not moves:
        if not has_valid_move(board, opponent(player)):
            return _evaluate(board, Cell.BLACK), None
        return _minimax(board, depth - 1, alpha, beta, not maximizing)

    best_move: Move | None = None
    if maximizing:
        value = -math.inf
        for move in moves:
            next_board = _copy_board(board)
            apply_move(next_board, player, move)
            score, _ = _minimax(next_board, depth - 1, alpha, beta, False)
            if score > value:
                value = score
                best_move = move
            alpha = max(alpha, value)
            if alpha >= beta:
                break
        return value, best_move

    value = math.inf
    for move in moves:
        next_board = _copy_board(board)
        apply_move(next_board, player, move)
        score, _ = _minimax(next_board, depth - 1, alpha, beta, True)
        if score < value:
            value = score
            best_move = move
        beta = min(beta, value)
        if alpha >= beta:
            break
    return value, best_move


def choose_move(board: Board, difficulty: str = "easy") -> Move | None:
    """Pick a legal BLACK move for the given difficulty."""
    scored: list[tuple[Move, int]] = []
    for r in range(8):
        for c in range(8):
            flips = collect_flips(board, Cell.BLACK, (r, c))
            if flips:
                scored.append(((r, c), len(flips)))
    if not scored:
        return None

    if difficulty == "easy":
        return scored[0][0]

    if difficulty == "medium":
        corner_moves = [move for move, _ in scored if move in CORNERS]
        if corner_moves:
            return corner_moves[0]
        best = max(n for _, n in scored)
        for move, n in scored:
            if n == best:
                return move
        return None

    # hard: minimax + positional / mobility heuristics
    _, move = _minimax(board, _HARD_DEPTH, -math.inf, math.inf, True)
    return move if move is not None else scored[0][0]
