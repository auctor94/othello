from core.engine import apply_move, is_game_over
from core.rules import collect_flips
from db.models import Game
from core.types import Cell

class GameService:

    def __init__(self, repo):
        self.repo = repo

    def make_move(self, game_id: str, user_id: int, move):
        game = self.repo.get(game_id)

        if game.status != "active":
            raise ValueError("Game finished")

        player = self._resolve_player(game, user_id)
        if game.turn != player:
            raise ValueError("Not your turn")

        apply_move(game.board, player, move)
        game.turn = self._next_turn(player)

        if game.turn == Cell.WHITE and not is_game_over(game.board):
            ai_move = self._compute_ai_move(game.board)
            if ai_move:
                apply_move(game.board, Cell.WHITE, ai_move)
                game.turn = self._next_turn(Cell.WHITE)

        if is_game_over(game.board):
            game.status = "finished"

        self.repo.save(game)
        return game

    def _resolve_player(self, game: Game, user_id: int) -> Cell:
        if user_id == game.player_human:
            return Cell.BLACK
        elif game.player_ai:
            return Cell.WHITE
        else:
            raise ValueError("Game has no human player")


    def _next_turn(self, player: Cell) -> Cell:
        return Cell.WHITE if player == Cell.BLACK else Cell.BLACK

    def _compute_ai_move(self, board):
        for r in range(8):
            for c in range(8):
                if collect_flips(board, Cell.WHITE, (r, c)):
                    return (r, c)
        return None

    def format_board(self, game):
        symbols = {
            Cell.BLACK: "B",
            Cell.WHITE: "W",
            Cell.EMPTY: "."
        }
        header = "  " + " ".join(str(i) for i in range(8))
        lines = [header]
        for idx, row in enumerate(game.board):
            line = str(idx) + " " + " ".join(symbols.get(cell, ".") for cell in row)
            lines.append(line)
        return "\n".join(lines)