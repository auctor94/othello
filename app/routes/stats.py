from fastapi import APIRouter, Depends

from app.deps import get_game_service
from app.player_id import require_player_id
from app.schemas import StatsResponse
from services.game_service import GameService

router = APIRouter()


@router.get("/stats", response_model=StatsResponse)
def get_stats(
    player_id: str = Depends(require_player_id),
    svc: GameService = Depends(get_game_service),
):
    """Your statistics for the guest player_id (X-Player-Id)."""
    return StatsResponse(**svc.get_stats(player_id))
