Goal: to implement the game Reversi in Python and make it possible to play it in Telegram using Telegram mini apps.

## Architecture

Telegram Client
   ↓
Mini App (Frontend)
   ↓ HTTPS
Backend API (Game Logic)
   ↓
Database (game state)

## Project Structure (Planned)

```
reversi/
├── app/                    # FastAPI layer (HTTP)
│   ├── main.py
│   ├── deps.py
│   ├── routes/
│   │   ├── matchmaking.py
│   │   └── game.py
│   └── schemas.py          # Pydantic DTO
│
├── core/                   # CLEAR Game logic (without FastAPI!)
│   ├── board.py
│   ├── rules.py
│   ├── engine.py
│   └── types.py
│
├── services/               # business-logic (use cases)
│   ├── matchmaking.py
│   └── game_service.py
│
├── db/
│   ├── models.py
│   ├── repo.py
│   └── session.py
│
├── tests/
│   └── test_engine.py
│
├── pyproject.toml
└── README.md
```

## Install requirements
```
create venv
pip install -r requirements.txt
```

## Single-player API (current)

- **POST /game** — start a new game (human = WHITE, AI = BLACK). Returns `{ id, board, turn, status }`.
- **GET /game/{game_id}** — get game state.
- **POST /game/{game_id}/move** — body `{ "row": int, "col": int }`. Human (WHITE) plays; AI (BLACK) replies automatically. Returns updated game state.

## How to test

1. **Start the server**
   ```bash
   uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
   ```

2. **Create a game**
   ```bash
   curl -X POST http://127.0.0.1:8000/game
   ```
   Copy the `id` from the response.

3. **Get game state**
   ```bash
   curl http://127.0.0.1:8000/game/{game_id}
   ```

4. **Play a move** (row and col 0–7; human plays WHITE)
   ```bash
   curl -X POST http://127.0.0.1:8000/game/{game_id}/move \
     -H "Content-Type: application/json" \
     -d '{"row": 2, "col": 3}'
   ```
   The response is the updated state after your move and the AI’s reply (if any).

5. **Interactive docs:** open http://127.0.0.1:8000/docs and try the endpoints from the browser.