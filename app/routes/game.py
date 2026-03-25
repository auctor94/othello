from fastapi import APIRouter, Depends, HTTPException
from app.schemas import MoveRequest, GameResponse
from app.deps import get_game_service
from services.game_service import GameService
from core.engine import InvalidMove, get_valid_moves

router = APIRouter()


@router.post("", response_model=GameResponse)
def create_game(svc: GameService = Depends(get_game_service)):
    """Start a new single-player game. Human = WHITE, AI = BLACK."""
    game = svc.repo.create_game()
    return _to_response(svc, game)


@router.get("/{game_id}", response_model=GameResponse)
def get_game(game_id: str, svc: GameService = Depends(get_game_service)):
    """Get current game state."""
    try:
        game = svc.repo.get(game_id)
        return _to_response(svc, game)
    except KeyError:
        raise HTTPException(status_code=404, detail="Game not found")


@router.get("/{game_id}/valid-moves")
def get_valid_moves_for_game(game_id: str, svc: GameService = Depends(get_game_service)):
    """Return list of [row, col] valid for current turn (for UI hints)."""
    try:
        game = svc.repo.get(game_id)
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
    )
