from core.engine import apply_move, is_game_over, InvalidMove
from core.rules import collect_flips
from core.types import Cell
from db.models import Game


class GameService:
    """Single-player: human = WHITE, AI = BLACK."""

    def __init__(self, repo) -> None:
        self.repo = repo

    def make_move(self, game_id: str, move: tuple[int, int]) -> Game:
        game = self.repo.get(game_id)
        if game.status != "active":
            raise ValueError("Game finished")
        if game.turn != Cell.WHITE:
            raise ValueError("Not your turn (human plays WHITE)")

        apply_move(game.board, Cell.WHITE, move)
        game.turn = Cell.BLACK

        if not is_game_over(game.board):
            ai_move = self._ai_move(game.board)
            if ai_move:
                apply_move(game.board, Cell.BLACK, ai_move)
                game.turn = Cell.WHITE
            else:
                game.turn = Cell.WHITE  # AI had no move, back to human

        if is_game_over(game.board):
            game.status = "finished"

        self.repo.save(game)
        return game

    def _ai_move(self, board) -> tuple[int, int] | None:
        """Simple AI: first valid move for BLACK."""
        for r in range(8):
            for c in range(8):
                if collect_flips(board, Cell.BLACK, (r, c)):
                    return (r, c)
        return None
