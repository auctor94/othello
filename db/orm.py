from sqlalchemy import JSON, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class GameRow(Base):
    __tablename__ = "games"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    board: Mapped[list[list[str]]] = mapped_column(JSON)
    turn: Mapped[str] = mapped_column(String)
    status: Mapped[str] = mapped_column(String)
