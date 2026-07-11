import os

from dotenv import load_dotenv

from db.repo import InMemoryRepo, PostgresRepo
from db.session import SessionLocal
from services.game_service import GameService

load_dotenv()

if os.getenv("DATABASE_URL") and SessionLocal is not None:
    repo = PostgresRepo(SessionLocal)
else:
    repo = InMemoryRepo()


def get_game_service():
    return GameService(repo)
