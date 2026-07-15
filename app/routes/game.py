from typing import Annotated

from fastapi import APIRouter, Body, Depends, HTTPException

from app.deps import get_game_service
from app.player_id import require_player_id
from app.schemas import CreateGameRequest, MoveRequest, GameResponse
from core.engine import InvalidMove, get_valid_moves
from services.game_service import GameService

router = APIRouter()


@router.post("", response_model=GameResponse)
def create_game(
    player_id: str = Depends(require_player_id),
    svc: GameService = Depends(get_game_service),
    req: Annotated[CreateGameRequest | None, Body()] = None,
):
    """Start a new single-player game. Human = WHITE, AI = BLACK."""
    difficulty = req.difficulty if req is not None else "easy"
    try:
        game = svc.create_game(player_id, difficulty=difficulty)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return _to_response(svc, game)


@router.get("/active", response_model=GameResponse)
def get_active_game(
    player_id: str = Depends(require_player_id),
    svc: GameService = Depends(get_game_service),
):
    """Return the player's current active game, if any (used to resume after reload)."""
    game = svc.get_active_game(player_id)
    if game is None:
        raise HTTPException(status_code=404, detail="No active game")
    return _to_response(svc, game)


@router.patch("/{game_id}/difficulty", response_model=GameResponse)
def set_difficulty(
    game_id: str,
    req: CreateGameRequest,
    svc: GameService = Depends(get_game_service),
):
    """Set AI difficulty before the first move of an active game."""
    try:
        game = svc.set_difficulty(game_id, req.difficulty)
        return _to_response(svc, game)
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except KeyError:
        raise HTTPException(status_code=404, detail="Game not found")


@router.get("/{game_id}", response_model=GameResponse)
def get_game(game_id: str, svc: GameService = Depends(get_game_service)):
    """Get current game state."""
    try:
        game = svc.get_game(game_id)
        return _to_response(svc, game)
    except KeyError:
        raise HTTPException(status_code=404, detail="Game not found")


@router.get("/{game_id}/valid-moves")
def get_valid_moves_for_game(game_id: str, svc: GameService = Depends(get_game_service)):
    """Return list of [row, col] valid for current turn (for UI hints)."""
    try:
        game = svc.get_game(game_id)
        if game.status != "active":
            return {"moves": []}
        moves = get_valid_moves(game.board, game.turn)
        return {"moves": [list(m) for m in moves]}
    except KeyError:
        raise HTTPException(status_code=404, detail="Game not found")


@router.post("/{game_id}/move", response_model=GameResponse)
def move(game_id: str, req: MoveRequest, svc: GameService = Depends(get_game_service)):
    """Human (WHITE) plays a move. AI (BLACK) replies automatically if game continues."""
    try:
        game = svc.make_move(game_id, (req.row, req.col))
        return _to_response(svc, game)
    except InvalidMove:
        raise HTTPException(status_code=400, detail="Invalid move")
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except KeyError:
        raise HTTPException(status_code=404, detail="Game not found")


@router.post("/{game_id}/pass", response_model=GameResponse)
def pass_turn(game_id: str, svc: GameService = Depends(get_game_service)):
    """Human (WHITE) passes when they have no legal moves. AI plays next (with chained passes)."""
    try:
        game = svc.pass_turn(game_id)
        return _to_response(svc, game)
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except KeyError:
        raise HTTPException(status_code=404, detail="Game not found")


def _to_response(svc: GameService, game) -> GameResponse:
    return GameResponse(
        id=game.id,
        board=game.board,
        turn=game.turn,
        status=game.status,
        difficulty=getattr(game, "difficulty", None) or "easy",
    )
