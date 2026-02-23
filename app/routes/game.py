from fastapi import APIRouter, Depends, HTTPException
from services.game_service import GameService
from core.engine import InvalidMove
from app.schemas import MoveRequest, GameResponse
from app.deps import get_game_service

router = APIRouter()


@router.get("/{game_id}")
def get_game(game_id: str, svc = Depends(get_game_service)):
    try:
        game = svc.repo.get(game_id)
        pretty = svc.format_board(game)
        return {
            "id": game.id,
            "board": pretty,
            "turn": game.turn.name,
            "status": game.status
        }
    except KeyError:
        raise HTTPException(status_code=404, detail="Game not found")

@router.post("/{game_id}/move", response_model=GameResponse)
def move(game_id: str, req: MoveRequest, svc: GameService = Depends(get_game_service)):
    try:
        game = svc.make_move(
            game_id=game_id,
            user_id=req.user_id,  # TODO: replace with Telegram user id
            move=(req.row, req.col),
        )
        return game

    except InvalidMove:
        raise HTTPException(status_code=400, detail="Invalid move")

    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))

@router.post("/create-test")
def create_test_game(svc: GameService = Depends(get_game_service)):
    # For test, we set user_id=1
    game = svc.repo.create_game(player_human=1)
    return game

@router.get("/{game_id}/pretty")
def get_pretty_board(game_id: str, svc: GameService = Depends(get_game_service)):
    try:
        game = svc.repo.get(game_id)
        board_str = svc.format_board(game)
        return {"board": board_str, "turn": game.turn.name, "status": game.status}
    except KeyError:
        raise HTTPException(status_code=404, detail="Game not found")


