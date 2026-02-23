from db.repo import InMemoryRepo
from services.game_service import GameService

repo = InMemoryRepo()


def get_game_service():
    return GameService(repo)
