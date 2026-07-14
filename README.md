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
│   ├── player_id.py        # X-Player-Id validation
│   ├── routes/
│   │   ├── game.py
│   │   └── stats.py
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
│   ├── schema.py           # create_all + additive ALTER on startup
│   ├── session.py
│   ├── serialization.py
│   └── migrations/         # optional manual SQL (Render / out-of-band)
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
│   │   ├── api.js          # fetchApi + guest player id
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

## Guest id and statistics

Stats are per **guest player**, not a logged-in account.

1. On first visit the UI calls `getOrCreatePlayerId()` (`web/src/api.js`):
   - reads `localStorage` key `othello_player_id`
   - if missing, sets `crypto.randomUUID()` and stores it
2. Every API call goes through `fetchApi`, which sends header **`X-Player-Id`**.
3. On page load the UI calls **GET /game/active** and resumes that party if it exists. **POST /game** (Restart) creates a new row and marks other `active` games for this id as `abandoned`. A plain reload must not abandon.
4. When a game finishes, the API writes `result` (`win` / `loss` / `draw` from WHITE’s perspective), `white_score` / `black_score`, `finished_at`, and tracks `max_move_flips` (move score = flips + 1).
5. **GET /stats** aggregates only games with that `player_id`. The UI **Statistics** button opens a modal and loads this endpoint.

Notes:

- Incognito / another device / cleared site data → new guest id → empty stats.
- Create and stats require `X-Player-Id` (UUID or safe `[A-Za-z0-9_-]{1,128}`); missing/invalid → **400**.
- Perfect = `white_score == 64`; shutout = `win` and `black_score == 0`. Won/Lost/Tied % are of **finished** games (abandoned does not dilute them); abandoned % is of **started**. Streaks use only `finished` games ordered by `finished_at`.

## Database schema updates

`Base.metadata.create_all()` only **creates** missing tables — it does **not** add columns to an existing `games` table.

On API startup the lifespan runs `ensure_schema()` (`db/schema.py`):

1. `create_all` (fresh DBs)
2. `ALTER TABLE … ADD COLUMN` for any missing stats columns
3. `CREATE INDEX` on `player_id` if needed

So a normal redeploy of the API against an old Postgres volume/Render DB is enough in most cases.

### Manual ALTER (Render / out-of-band)

If the API cannot reach the DB on boot, or you prefer applying SQL yourself (Render Postgres shell / external client), run:

[`db/migrations/001_stats_columns.sql`](db/migrations/001_stats_columns.sql)

```bash
# example: local Docker Postgres
psql postgresql://user:password@localhost:5432/reversi \
  -f db/migrations/001_stats_columns.sql
```

On Render: open the Postgres instance → **Connect** / shell → paste the SQL from that file → run once.

## Single-player API (current)

All create/stats calls need header `X-Player-Id`.

- **POST /game** — start a new game (human = WHITE, AI = BLACK). Abandons previous `active` games for this player. Returns `{ id, board, turn, status }`.
- **GET /game/active** — resume the player’s current `active` game (404 if none). Used on page load.
- **GET /game/{game_id}** — get game state.
- **GET /game/{game_id}/valid-moves** — list of `[row, col]` valid for the current turn (UI hints).
- **POST /game/{game_id}/move** — body `{ "row": int, "col": int }`. Human (WHITE) plays; AI (BLACK) replies automatically. Returns updated game state.
- **POST /game/{game_id}/pass** — human (WHITE) passes when they have no legal moves. AI plays next (with chained passes if needed). Returns 403 if legal moves still exist.
- **GET /stats** — Your statistics for `X-Player-Id` (started/finished/abandoned, W/L/T %, perfect, shutouts, scores, streaks, times).

## How to test (manual API)

1. **Start the server**
   ```bash
   uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
   ```

2. **Create a game** (guest id required)
   ```bash
   curl -X POST http://127.0.0.1:8000/game \
     -H "X-Player-Id: 00000000-0000-4000-8000-000000000001"
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

6. **Stats**
   ```bash
   curl http://127.0.0.1:8000/stats \
     -H "X-Player-Id: 00000000-0000-4000-8000-000000000001"
   ```

7. **Interactive docs:** open http://127.0.0.1:8000/docs and try the endpoints from the browser.

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
| `test_game_api.py` | HTTP endpoints (create + header, move, stats, abandon) |

## Web UI

A React UI lives in `web/`. It provides:

- **Header:** Black/White score and current turn (with a pulsing dot when it’s your turn).
- **Board:** 8×8 grid; valid moves show a subtle dot; click to play (human = White).
- **Pass:** when you have no legal moves, a Pass button appears.
- **Side panel:** Instructions, Statistics (guest stats modal), Flip foresight, Restart, Exit.
- **Guest id:** persisted in `localStorage` (`othello_player_id`); sent on every API request.

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

After deploy, confirm the API started cleanly so `ensure_schema()` could add any missing columns. If stats endpoints error on missing columns, run [`db/migrations/001_stats_columns.sql`](db/migrations/001_stats_columns.sql) on the Render Postgres instance, then retry.

### Frontend (static)

Build with the public API URL baked in at compile time:

```bash
cd web
cp .env.example .env   # set VITE_API_URL to your production API origin
npm install
npm run build
```

Serve `web/dist/` from any static host (nginx, S3 + CDN, Netlify, etc.). Redeploy the static site after API changes that the UI depends on (e.g. stats).

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
5. Redeploy API first (schema ensure / optional SQL), then the static frontend.
6. In the browser: DevTools → Application → Local Storage shows `othello_player_id`; Statistics modal loads without errors.
