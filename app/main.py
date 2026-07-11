import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from app.routes import game
from db.orm import Base
from db.session import engine

_cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173")
allow_origins = [origin.strip() for origin in _cors_origins.split(",") if origin.strip()]


@asynccontextmanager
async def lifespan(app: FastAPI):
    if engine is not None:
        Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="Reversi API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(game.router, prefix="/game", tags=["game"])


@app.get("/")
def root():
    return {"status": "Reversi backend running"}
