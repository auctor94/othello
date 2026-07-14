from datetime import datetime, timezone

from core.engine import apply_move, get_valid_moves, has_valid_move, is_game_over
from core.rules import collect_flips, opponent
from core.types import Board, Cell
from db.models import Game


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _count_stones(board: Board) -> tuple[int, int]:
    white = 0
    black = 0
    for row in board:
        for cell in row:
            if cell == Cell.WHITE:
                white += 1
            elif cell == Cell.BLACK:
                black += 1
    return white, black


def _pct(part: int, whole: int) -> float:
    if whole == 0:
        return 0.0
    return round(100.0 * part / whole, 1)


def _game_duration_seconds(game: Game) -> float | None:
    if game.finished_at is None:
        return None
    start = game.created_at
    end = game.finished_at
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    if end.tzinfo is None:
        end = end.replace(tzinfo=timezone.utc)
    return max(0.0, (end - start).total_seconds())


def _streaks(finished: list[Game]) -> tuple[int, int, int]:
    ordered = sorted(
        finished,
        key=lambda g: g.finished_at or g.created_at,
    )
    longest_win = 0
    longest_lose = 0
    run_win = 0
    run_lose = 0
    for game in ordered:
        if game.result == "win":
            run_win += 1
            run_lose = 0
            longest_win = max(longest_win, run_win)
        elif game.result == "loss":
            run_lose += 1
            run_win = 0
            longest_lose = max(longest_lose, run_lose)
        else:
            run_win = 0
            run_lose = 0

    current_win = 0
    for game in reversed(ordered):
        if game.result == "win":
            current_win += 1
        else:
            break
    return current_win, longest_win, longest_lose


class GameService:
    """Single-player: human = WHITE, AI = BLACK."""

    def __init__(self, repo) -> None:
        self.repo = repo

    def create_game(self, player_id: str) -> Game:
        self.repo.abandon_active_games(player_id)
        return self.repo.create_game(player_id)

    def get_active_game(self, player_id: str) -> Game | None:
        return self.repo.get_active_for_player(player_id)

    def get_stats(self, player_id: str) -> dict:
        games = self.repo.list_by_player(player_id)
        if not games:
            return {
                "since": None,
                "days": 0,
                "started": 0,
                "finished": 0,
                "abandoned": 0,
                "won": 0,
                "lost": 0,
                "tied": 0,
                "won_pct": 0.0,
                "lost_pct": 0.0,
                "tied_pct": 0.0,
                "abandoned_pct": 0.0,
                "perfect": 0,
                "shutouts": 0,
                "highest_score": None,
                "lowest_score": None,
                "avg_score": None,
                "highest_move_score": None,
                "current_win_streak": 0,
                "longest_win_streak": 0,
                "longest_lose_streak": 0,
                "total_time": 0.0,
                "avg_time": None,
                "min_time": None,
                "max_time": None,
            }

        started = len(games)
        finished_games = [g for g in games if g.status == "finished"]
        abandoned = sum(1 for g in games if g.status == "abandoned")
        finished = len(finished_games)

        won = sum(1 for g in finished_games if g.result == "win")
        lost = sum(1 for g in finished_games if g.result == "loss")
        tied = sum(1 for g in finished_games if g.result == "draw")

        perfect = sum(1 for g in finished_games if g.white_score == 64)
        shutouts = sum(
            1
            for g in finished_games
            if g.result == "win" and g.black_score == 0
        )

        scores = [g.white_score for g in finished_games if g.white_score is not None]
        highest_score = max(scores) if scores else None
        lowest_score = min(scores) if scores else None
        avg_score = round(sum(scores) / len(scores), 1) if scores else None

        move_scores = [g.max_move_flips for g in games if g.max_move_flips is not None]
        highest_move_score = max(move_scores) if move_scores else None

        current_win, longest_win, longest_lose = _streaks(finished_games)

        durations = [
            d for g in finished_games if (d := _game_duration_seconds(g)) is not None
        ]
        total_time = float(sum(durations)) if durations else 0.0
        avg_time = round(total_time / len(durations), 1) if durations else None
        min_time = float(min(durations)) if durations else None
        max_time = float(max(durations)) if durations else None

        since = min(g.created_at for g in games)
        now = _utc_now()
        since_aware = since if since.tzinfo else since.replace(tzinfo=timezone.utc)
        days = max(0, (now - since_aware).days)

        return {
            "since": since,
            "days": days,
            "started": started,
            "finished": finished,
            "abandoned": abandoned,
            "won": won,
            "lost": lost,
            "tied": tied,
            # W/L/T % of finished only — abandoned must not dilute win rate
            "won_pct": _pct(won, finished),
            "lost_pct": _pct(lost, finished),
            "tied_pct": _pct(tied, finished),
            "abandoned_pct": _pct(abandoned, started),
            "perfect": perfect,
            "shutouts": shutouts,
            "highest_score": highest_score,
            "lowest_score": lowest_score,
            "avg_score": avg_score,
            "highest_move_score": highest_move_score,
            "current_win_streak": current_win,
            "longest_win_streak": longest_win,
            "longest_lose_streak": longest_lose,
            "total_time": total_time,
            "avg_time": avg_time,
            "min_time": min_time,
            "max_time": max_time,
        }

    def make_move(self, game_id: str, move: tuple[int, int]) -> Game:
        game = self.repo.get(game_id)
        if game.status != "active":
            raise ValueError("Game finished")
        if game.turn != Cell.WHITE:
            raise ValueError("Not your turn (human plays WHITE)")

        flips = collect_flips(game.board, Cell.WHITE, move)
        move_score = len(flips) + 1
        apply_move(game.board, Cell.WHITE, move)
        if game.max_move_flips is None or move_score > game.max_move_flips:
            game.max_move_flips = move_score

        self._resolve_after_white_turn(game)
        game.updated_at = _utc_now()
        self.repo.save(game)
        return game

    def pass_turn(self, game_id: str) -> Game:
        game = self.repo.get(game_id)
        if game.status != "active":
            raise ValueError("Game finished")
        if game.turn != Cell.WHITE:
            raise ValueError("Not your turn (human plays WHITE)")
        if get_valid_moves(game.board, Cell.WHITE):
            raise ValueError("Cannot pass while you have legal moves")

        self._resolve_after_white_turn(game)
        game.updated_at = _utc_now()
        self.repo.save(game)
        return game

    def _resolve_after_white_turn(self, game: Game) -> None:
        """WHITE moved or passed; run BLACK (AI) with chained passes until human acts or game ends."""
        game.turn = Cell.BLACK
        while True:
            if is_game_over(game.board):
                self._finish_game(game)
                return
            if has_valid_move(game.board, game.turn):
                if game.turn == Cell.BLACK:
                    ai_move = self._ai_move(game.board)
                    apply_move(game.board, Cell.BLACK, ai_move)
                    game.turn = Cell.WHITE
                return
            game.turn = opponent(game.turn)

    def _finish_game(self, game: Game) -> None:
        now = _utc_now()
        white_score, black_score = _count_stones(game.board)
        game.status = "finished"
        game.finished_at = now
        game.updated_at = now
        game.white_score = white_score
        game.black_score = black_score
        if white_score > black_score:
            game.result = "win"
        elif white_score < black_score:
            game.result = "loss"
        else:
            game.result = "draw"

    def _ai_move(self, board) -> tuple[int, int] | None:
        """Simple AI: first valid move for BLACK."""
        for r in range(8):
            for c in range(8):
                if collect_flips(board, Cell.BLACK, (r, c)):
                    return (r, c)
        return None
