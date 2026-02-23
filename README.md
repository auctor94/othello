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