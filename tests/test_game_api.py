from fastapi.testclient import TestClient

from app.main import app
from app.deps import repo
from core.types import Cell


client = TestClient(app)


def setup_function():
    repo.games.clear()

def test_post_game_returns_initial_payload():
    response = client.post("/game")

    assert response.status_code == 200
    data = response.json()

    assert "id" in data
    assert "board" in data
    assert "turn" in data
    assert "status" in data
    assert data["status"] == "active"
    assert data["turn"] == Cell.WHITE.value
    assert len(data["board"]) == 8
    assert all(len(row) == 8 for row in data["board"])


def test_get_game_existing_and_missing_id():
    created = client.post("/game")
    game_id = created.json()["id"]

    existing = client.get(f"/game/{game_id}")
    missing = client.get("/game/does-not-exist")

    assert existing.status_code == 200
    assert existing.json()["id"] == game_id
    assert missing.status_code == 404
    assert missing.json()["detail"] == "Game not found"


def test_post_move_valid_and_invalid_move():
    created = client.post("/game")
    game_id = created.json()["id"]

    valid = client.post(f"/game/{game_id}/move", json={"row": 2, "col": 4})
    invalid = client.post(f"/game/{game_id}/move", json={"row": 0, "col": 0})

    assert valid.status_code == 200
    assert valid.json()["id"] == game_id
    assert invalid.status_code == 400
    assert invalid.json()["detail"] == "Invalid move"


def test_post_move_forbidden_when_game_finished():
    created = client.post("/game")
    game_id = created.json()["id"]
    game = repo.get(game_id)
    game.status = "finished"
    repo.save(game)

    response = client.post(f"/game/{game_id}/move", json={"row": 2, "col": 4})

    assert response.status_code == 403
    assert response.json()["detail"] == "Game finished"


def test_get_valid_moves_returns_list_of_lists():
    created = client.post("/game")
    game_id = created.json()["id"]

    response = client.get(f"/game/{game_id}/valid-moves")

    assert response.status_code == 200
    data = response.json()
    assert "moves" in data
    assert isinstance(data["moves"], list)
    assert all(isinstance(move, list) for move in data["moves"])
    assert all(len(move) == 2 for move in data["moves"])
