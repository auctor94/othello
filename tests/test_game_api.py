import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.deps import repo
from core.types import Cell
from db.repo import InMemoryRepo
from services.game_service import GameService

PLAYER_HEADERS = {"X-Player-Id": "00000000-0000-4000-8000-000000000001"}


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(autouse=True)
def reset_repo():
    if isinstance(repo, InMemoryRepo):
        repo.games.clear()
    yield
    if isinstance(repo, InMemoryRepo):
        repo.games.clear()


def test_post_game_requires_player_id(client):
    response = client.post("/game")
    assert response.status_code == 400
    assert response.json()["detail"] == "X-Player-Id header is required"


def test_post_game_rejects_invalid_player_id(client):
    response = client.post("/game", headers={"X-Player-Id": "bad id!"})
    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid X-Player-Id"


def test_post_game_returns_initial_payload(client):
    response = client.post("/game", headers=PLAYER_HEADERS)

    assert response.status_code == 200
    data = response.json()

    assert "id" in data
    assert "board" in data
    assert "turn" in data
    assert "status" in data
    assert data["status"] == "active"
    assert data["turn"] == Cell.WHITE.value
    assert data["difficulty"] == "easy"
    assert len(data["board"]) == 8
    assert all(len(row) == 8 for row in data["board"])


def test_post_game_with_medium_difficulty(client):
    response = client.post(
        "/game",
        headers=PLAYER_HEADERS,
        json={"difficulty": "medium"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["difficulty"] == "medium"
    assert repo.get(data["id"]).difficulty == "medium"


def test_post_game_rejects_invalid_difficulty(client):
    response = client.post(
        "/game",
        headers=PLAYER_HEADERS,
        json={"difficulty": "nightmare"},
    )

    assert response.status_code == 422


def test_post_game_with_hard_difficulty(client):
    response = client.post(
        "/game",
        headers=PLAYER_HEADERS,
        json={"difficulty": "hard"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["difficulty"] == "hard"
    assert repo.get(data["id"]).difficulty == "hard"


def test_patch_difficulty_before_and_after_start(client):
    created = client.post("/game", headers=PLAYER_HEADERS)
    game_id = created.json()["id"]

    updated = client.patch(
        f"/game/{game_id}/difficulty",
        json={"difficulty": "medium"},
    )
    assert updated.status_code == 200
    assert updated.json()["difficulty"] == "medium"
    assert repo.get(game_id).difficulty == "medium"

    client.post(f"/game/{game_id}/move", json={"row": 2, "col": 4})
    locked = client.patch(
        f"/game/{game_id}/difficulty",
        json={"difficulty": "easy"},
    )
    assert locked.status_code == 403
    assert locked.json()["detail"] == "Difficulty locked after game starts"
    assert repo.get(game_id).difficulty == "medium"


def test_post_game_abandons_previous_active(client):
    first = client.post("/game", headers=PLAYER_HEADERS)
    first_id = first.json()["id"]

    second = client.post("/game", headers=PLAYER_HEADERS)
    second_id = second.json()["id"]

    assert first_id != second_id
    assert repo.get(first_id).status == "abandoned"
    assert repo.get(second_id).status == "active"


def test_get_active_game_resumes_without_new_row(client):
    created = client.post("/game", headers=PLAYER_HEADERS)
    game_id = created.json()["id"]

    active = client.get("/game/active", headers=PLAYER_HEADERS)
    missing_header = client.get("/game/active")

    assert active.status_code == 200
    assert active.json()["id"] == game_id
    assert missing_header.status_code == 400
    # Still a single started game — resume must not create/abandon
    stats = client.get("/stats", headers=PLAYER_HEADERS).json()
    assert stats["started"] == 1
    assert stats["abandoned"] == 0


def test_get_game_existing_and_missing_id(client):
    created = client.post("/game", headers=PLAYER_HEADERS)
    game_id = created.json()["id"]

    existing = client.get(f"/game/{game_id}")
    missing = client.get("/game/does-not-exist")

    assert existing.status_code == 200
    assert existing.json()["id"] == game_id
    assert missing.status_code == 404
    assert missing.json()["detail"] == "Game not found"


def test_post_move_valid_and_invalid_move(client):
    created = client.post("/game", headers=PLAYER_HEADERS)
    game_id = created.json()["id"]

    valid = client.post(f"/game/{game_id}/move", json={"row": 2, "col": 4})
    invalid = client.post(f"/game/{game_id}/move", json={"row": 0, "col": 0})

    assert valid.status_code == 200
    assert valid.json()["id"] == game_id
    assert invalid.status_code == 400
    assert invalid.json()["detail"] == "Invalid move"


def test_post_move_updates_max_move_flips(client):
    created = client.post("/game", headers=PLAYER_HEADERS)
    game_id = created.json()["id"]

    client.post(f"/game/{game_id}/move", json={"row": 2, "col": 4})
    game = repo.get(game_id)

    # Opening move flips 1 disc → move score = len(flips) + 1
    assert game.max_move_flips == 2
    assert game.updated_at is not None


def test_post_move_forbidden_when_game_finished(client):
    created = client.post("/game", headers=PLAYER_HEADERS)
    game_id = created.json()["id"]
    game = repo.get(game_id)
    game.status = "finished"
    repo.save(game)

    response = client.post(f"/game/{game_id}/move", json={"row": 2, "col": 4})

    assert response.status_code == 403
    assert response.json()["detail"] == "Game finished"


def test_get_valid_moves_returns_list_of_lists(client):
    created = client.post("/game", headers=PLAYER_HEADERS)
    game_id = created.json()["id"]

    response = client.get(f"/game/{game_id}/valid-moves")

    assert response.status_code == 200
    data = response.json()
    assert "moves" in data
    assert isinstance(data["moves"], list)
    assert all(isinstance(move, list) for move in data["moves"])
    assert all(len(move) == 2 for move in data["moves"])


def test_finish_sets_result_scores_and_finished_at():
    svc = GameService(InMemoryRepo())
    game = svc.create_game("player-finish")

    for r in range(8):
        for c in range(8):
            game.board[r][c] = Cell.WHITE
    game.board[0][0] = Cell.BLACK
    game.board[0][1] = Cell.BLACK

    svc._resolve_after_white_turn(game)

    assert game.status == "finished"
    assert game.result == "win"
    assert game.white_score == 62
    assert game.black_score == 2
    assert game.finished_at is not None


def test_game_finishes_immediately_after_ai_fills_board():
    """AI's last move must end the game — no extra Pass for WHITE."""
    svc = GameService(InMemoryRepo())
    game = svc.create_game("endgame-ai-fill")

    for r in range(8):
        for c in range(8):
            game.board[r][c] = Cell.WHITE
    game.board[0][0] = Cell.EMPTY
    game.board[0][2] = Cell.BLACK

    svc._resolve_after_white_turn(game)

    assert game.status == "finished"
    assert game.board[0][0] == Cell.BLACK
    assert game.finished_at is not None


def test_get_game_heals_stuck_active_endgame():
    """Active game with no legal moves for either side is finished on read."""
    svc = GameService(InMemoryRepo())
    game = svc.create_game("stuck-endgame")
    for r in range(8):
        for c in range(8):
            game.board[r][c] = Cell.WHITE
    game.board[0][0] = Cell.BLACK
    svc.repo.save(game)

    healed = svc.get_game(game.id)
    assert healed.status == "finished"
    assert healed.result == "win"


def test_game_finishes_when_white_move_leaves_no_legal_moves(client):
    """WHITE's last useful move ends the game when neither side can play."""
    created = client.post("/game", headers=PLAYER_HEADERS)
    game_id = created.json()["id"]
    game = repo.get(game_id)

    for r in range(8):
        for c in range(8):
            game.board[r][c] = Cell.BLACK
    # Only legal WHITE move: (0,0) flips (0,1); after that neither side can move.
    game.board[0][0] = Cell.EMPTY
    game.board[0][1] = Cell.BLACK
    game.board[0][2] = Cell.WHITE
    for r in range(1, 8):
        game.board[r][0] = Cell.WHITE
    repo.save(game)

    response = client.post(f"/game/{game_id}/move", json={"row": 0, "col": 0})
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "finished"
    assert repo.get(game_id).status == "finished"


def test_ai_easy_picks_first_legal_move():
    svc = GameService(InMemoryRepo())
    board = [[Cell.EMPTY for _ in range(8)] for _ in range(8)]
    board[3][3] = Cell.WHITE
    board[3][4] = Cell.BLACK
    board[4][3] = Cell.BLACK
    board[4][4] = Cell.WHITE

    move = svc._ai_move(board, "easy")
    assert move == (2, 3)


def test_ai_medium_prefers_max_flips():
    svc = GameService(InMemoryRepo())
    board = [[Cell.EMPTY for _ in range(8)] for _ in range(8)]
    # Two BLACK stones; WHITE line of 3 — move at (0,4) flips 3
    board[0][0] = Cell.BLACK
    board[0][1] = Cell.WHITE
    board[0][2] = Cell.WHITE
    board[0][3] = Cell.WHITE
    # Alternate legal move flips only 1
    board[2][2] = Cell.BLACK
    board[3][2] = Cell.WHITE

    move = svc._ai_move(board, "medium")
    assert move == (0, 4)


def test_ai_medium_prefers_corner_over_more_flips():
    svc = GameService(InMemoryRepo())
    board = [[Cell.EMPTY for _ in range(8)] for _ in range(8)]
    # Corner (0,0) flips 1 WHITE
    board[0][1] = Cell.WHITE
    board[0][2] = Cell.BLACK
    # Non-corner (2,4) flips 3 WHITEs
    board[2][0] = Cell.BLACK
    board[2][1] = Cell.WHITE
    board[2][2] = Cell.WHITE
    board[2][3] = Cell.WHITE

    move = svc._ai_move(board, "medium")
    assert move == (0, 0)


def test_ai_hard_takes_corner_when_available():
    svc = GameService(InMemoryRepo())
    board = [[Cell.EMPTY for _ in range(8)] for _ in range(8)]
    board[0][1] = Cell.WHITE
    board[0][2] = Cell.BLACK
    board[2][0] = Cell.BLACK
    board[2][1] = Cell.WHITE
    board[2][2] = Cell.WHITE
    board[2][3] = Cell.WHITE

    move = svc._ai_move(board, "hard")
    assert move == (0, 0)


def test_ai_hard_returns_legal_opening_move():
    from core.board import create_initial_board
    from core.engine import get_valid_moves

    svc = GameService(InMemoryRepo())
    board = create_initial_board()
    move = svc._ai_move(board, "hard")
    assert move in get_valid_moves(board, Cell.BLACK)


def test_stats_requires_player_id(client):
    response = client.get("/stats")
    assert response.status_code == 400
    assert response.json()["detail"] == "X-Player-Id header is required"


def test_stats_empty(client):
    response = client.get("/stats", headers=PLAYER_HEADERS)
    assert response.status_code == 200
    data = response.json()
    assert data["started"] == 0
    assert data["finished"] == 0
    assert data["abandoned"] == 0
    assert data["won"] == 0
    assert data["lost"] == 0
    assert data["tied"] == 0
    assert data["won_pct"] == 0.0
    assert data["perfect"] == 0
    assert data["shutouts"] == 0
    assert data["highest_score"] is None
    assert data["lowest_score"] is None
    assert data["avg_score"] is None
    assert data["highest_move_score"] is None
    assert data["current_win_streak"] == 0
    assert data["total_time"] == 0.0
    assert data["since"] is None
    assert data["days"] == 0


def _finish_as(result: str, *, white: int, black: int) -> None:
    """Create and finish a full-board game for PLAYER_HEADERS via the shared InMemoryRepo."""
    assert white + black == 64
    svc = GameService(repo)
    game = svc.create_game(PLAYER_HEADERS["X-Player-Id"])
    stones = [Cell.WHITE] * white + [Cell.BLACK] * black
    idx = 0
    for r in range(8):
        for c in range(8):
            game.board[r][c] = stones[idx]
            idx += 1
    svc._resolve_after_white_turn(game)
    assert game.status == "finished"
    assert game.result == result
    repo.save(game)


def test_stats_after_finish_won_and_lost(client):
    _finish_as("win", white=40, black=24)
    _finish_as("loss", white=20, black=44)
    # Restart abandons the previous active game — must not dilute Won %
    client.post("/game", headers=PLAYER_HEADERS)

    response = client.get("/stats", headers=PLAYER_HEADERS)
    assert response.status_code == 200
    data = response.json()

    assert data["started"] == 3
    assert data["finished"] == 2
    assert data["abandoned"] == 0  # both finished before restart; current is active
    assert data["won"] == 1
    assert data["lost"] == 1
    assert data["tied"] == 0
    # % of finished, not started (would be 33% if abandoned/active diluted)
    assert data["won_pct"] == 50.0
    assert data["lost_pct"] == 50.0
    assert data["highest_score"] == 40
    assert data["lowest_score"] == 20
    assert data["avg_score"] == 30.0
    assert data["current_win_streak"] == 0  # last finished is a loss
    assert data["longest_win_streak"] == 1
    assert data["longest_lose_streak"] == 1
    assert data["total_time"] >= 0.0
    assert data["since"] is not None


def test_stats_won_pct_ignores_abandoned(client):
    _finish_as("win", white=40, black=24)
    # Leave an abandoned game without finishing
    client.post("/game", headers=PLAYER_HEADERS)
    client.post("/game", headers=PLAYER_HEADERS)

    data = client.get("/stats", headers=PLAYER_HEADERS).json()
    assert data["started"] == 3
    assert data["finished"] == 1
    assert data["abandoned"] == 1
    assert data["won"] == 1
    assert data["won_pct"] == 100.0
    assert data["abandoned_pct"] == round(100.0 / 3, 1)
