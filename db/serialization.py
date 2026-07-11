from core.types import Board, Cell


def cell_to_str(cell: Cell) -> str:
    return cell.value


def cell_from_str(value: str) -> Cell:
    return Cell(value)


def board_to_json(board: Board) -> list[list[str]]:
    return [[cell_to_str(cell) for cell in row] for row in board]


def board_from_json(data: list[list[str]]) -> Board:
    return [[cell_from_str(cell) for cell in row] for row in data]
