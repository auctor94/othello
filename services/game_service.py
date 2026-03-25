from core.engine import apply_move, get_valid_moves, has_valid_move, is_game_over, InvalidMove
from core.rules import collect_flips, opponent
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
        self._resolve_after_white_turn(game)

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

        self.repo.save(game)
        return game

    def _resolve_after_white_turn(self, game: Game) -> None:
        """WHITE moved or passed; run BLACK (AI) with chained passes until human acts or game ends."""
        game.turn = Cell.BLACK
        while True:
            if is_game_over(game.board):
                game.status = "finished"
                return
            if has_valid_move(game.board, game.turn):
                if game.turn == Cell.BLACK:
                    ai_move = self._ai_move(game.board)
                    apply_move(game.board, Cell.BLACK, ai_move)
                    game.turn = Cell.WHITE
                return
            game.turn = opponent(game.turn)

    def _ai_move(self, board) -> tuple[int, int] | None:
        """Simple AI: first valid move for BLACK."""
        for r in range(8):
            for c in range(8):
                if collect_flips(board, Cell.BLACK, (r, c)):
                    return (r, c)
        return None
