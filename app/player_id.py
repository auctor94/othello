import re
import uuid
from typing import Annotated

from fastapi import Header, HTTPException

# UUID preferred; otherwise a short non-empty safe guest id (localStorage-friendly).
_SAFE_PLAYER_ID = re.compile(r"^[A-Za-z0-9_-]{1,128}$")


def require_player_id(
    x_player_id: Annotated[str | None, Header(alias="X-Player-Id")] = None,
) -> str:
    """Require X-Player-Id for create/stats. Missing or invalid → 400."""
    if x_player_id is None or not x_player_id.strip():
        raise HTTPException(status_code=400, detail="X-Player-Id header is required")

    value = x_player_id.strip()
    try:
        uuid.UUID(value)
        return value
    except ValueError:
        pass

    if _SAFE_PLAYER_ID.fullmatch(value):
        return value

    raise HTTPException(status_code=400, detail="Invalid X-Player-Id")
