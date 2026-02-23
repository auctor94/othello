from fastapi import FastAPI
from app.routes import game

app = FastAPI(title="Reversi API")

app.include_router(game.router, prefix="/game", tags=["game"])

@app.get("/")
def root():
    return {"status": "Reversi backend running"}
