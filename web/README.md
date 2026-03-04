# Reversi UI

React + CSS frontend for the Reversi single-player game (human = White, AI = Black).

## Run

```bash
npm install
npm run dev
```

Open http://localhost:5173. Ensure the backend is running on http://127.0.0.1:8000 (`uvicorn app.main:app --reload` from project root).

## Build

```bash
npm run build
```

Output in `dist/`. For production, set the API base URL via env (e.g. `VITE_API_URL`) and point the backend CORS at your frontend origin.
