Goal: implement the Reversi game in Python with a web UI and HTTP API.

## to do

 - [ ] upgrade AI Bot (2 levels: easy and little bit wiser)

## Architecture

Browser (React UI)
   ↓ HTTPS
Backend API (game logic)
   ↓
PostgreSQL (or in-memory repo if DATABASE_URL is unset)

## Project Structure

```
othello/
├── app/                    # FastAPI layer (HTTP)
│   ├── main.py
│   ├── deps.py
│   ├── routes/
│   │   └── game.py
│   └── schemas.py          # Pydantic DTO
│
├── core/                   # Pure game logic (without FastAPI)
│   ├── board.py
│   ├── rules.py
│   ├── engine.py
│   └── types.py
│
├── services/               # Business logic (use cases)
│   └── game_service.py
│
├── db/
│   ├── models.py
│   ├── orm.py
│   ├── repo.py             # InMemoryRepo / PostgresRepo
│   ├── session.py
│   └── serialization.py
│
├── Dockerfile
├── docker-compose.yml
│
├── tests/
│   ├── test_engine.py
│   ├── test_apply_move.py
│   ├── test_collect_flips.py
│   └── test_game_api.py
│
├── web/                    # React UI (Vite)
│   ├── src/
│   │   ├── App.jsx
│   │   └── ...
│   └── package.json
│
├── requirements.txt
└── README.md
```

## Install requirements

```bash
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
pip install pytest          # for running tests
```

Copy env template and adjust `DATABASE_URL` if using Postgres locally:

```bash
cp .env.example .env
```

## Docker

Run Postgres and the API together:

```bash
docker compose up --build
```

- API: http://localhost:8000 (docs at `/docs`)
- Postgres: `localhost:5432` (user `user`, password `password`, database `reversi`)

Stop and remove containers (keep the database volume):

```bash
docker compose down
```

Run only Postgres (API on host with uvicorn):

```bash
docker compose up db
```

Use `DATABASE_URL=postgresql+psycopg://user:password@localhost:5432/reversi` in `.env` — see `.env.example`.

## Single-player API (current)

- **POST /game** — start a new game (human = WHITE, AI = BLACK). Returns `{ id, board, turn, status }`.
- **GET /game/{game_id}** — get game state.
- **GET /game/{game_id}/valid-moves** — list of `[row, col]` valid for the current turn (UI hints).
- **POST /game/{game_id}/move** — body `{ "row": int, "col": int }`. Human (WHITE) plays; AI (BLACK) replies automatically. Returns updated game state.
- **POST /game/{game_id}/pass** — human (WHITE) passes when they have no legal moves. AI plays next (with chained passes if needed). Returns 403 if legal moves still exist.

## How to test (manual API)

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

5. **Pass** (when you have no legal moves)
   ```bash
   curl -X POST http://127.0.0.1:8000/game/{game_id}/pass
   ```

6. **Interactive docs:** open http://127.0.0.1:8000/docs and try the endpoints from the browser.

## Automated tests

From the project root (with venv activated):

```bash
pytest
```

| File | What it covers |
|------|----------------|
| `test_engine.py` | Basic engine smoke test |
| `test_apply_move.py` | Valid/invalid moves, flips |
| `test_collect_flips.py` | Flip detection rules |
| `test_game_api.py` | HTTP endpoints (create, get, move, valid-moves) |

## Web UI

A simple React UI lives in `web/`. It provides:

- **Header:** Black/White score and current turn (with a pulsing dot when it’s your turn).
- **Board:** 8×8 grid; valid moves show a subtle dot; click to play (human = White).
- **Pass:** when you have no legal moves, a Pass button appears.
- **Footer:** Restart (new game) and Exit (tries to close the browser tab/window).

Run backend and frontend:

```bash
# Terminal 1 – backend
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

# Terminal 2 – frontend
cd web && npm install && npm run dev
```

Then open http://localhost:5173.

Production build:

```bash
cd web && npm install && npm run build
```

Output in `web/dist/`. Set `VITE_API_URL` before building (see [Deploy](#deploy)).

## Deploy

### Backend (API)

Recommended: `docker compose up --build -d` with Postgres, or run the `api` image / `uvicorn` behind a reverse proxy.

```bash
docker compose up --build -d
```

Health check: **GET /** → `{"status": "Reversi backend running"}` (use for load balancers and uptime probes).

### Frontend (static)

Build with the public API URL baked in at compile time:

```bash
cd web
cp .env.example .env   # set VITE_API_URL to your production API origin
npm install
npm run build
```

Serve `web/dist/` from any static host (nginx, S3 + CDN, Netlify, etc.).

### Production environment variables

| Variable | Service | Required | Description |
|----------|---------|----------|-------------|
| `DATABASE_URL` | API | Yes | PostgreSQL URL, e.g. `postgresql+psycopg://user:pass@host:5432/reversi` |
| `CORS_ORIGINS` | API | Yes | Comma-separated frontend origins, e.g. `https://game.example.com` |
| `VITE_API_URL` | Frontend (build) | Yes | Public API base URL, no trailing slash, e.g. `https://api.example.com` |

Templates: `.env.example` (API), `web/.env.example` (frontend).

**Checklist**

1. Postgres reachable from the API; `DATABASE_URL` set.
2. `CORS_ORIGINS` includes the exact frontend origin (scheme + host + port).
3. Frontend built with `VITE_API_URL` pointing at the public API.
4. Probe **GET /** on the API returns 200.
