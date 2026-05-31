"""Custom exception hierarchy for purrject."""


class PurrjectError(Exception):
    """Base exception for all purrject errors."""


class ConfigNotFoundError(PurrjectError):
    """Raised when no purrject.toml is found."""

    def __init__(self, search_path: str) -> None:
        super().__init__(f"No purrject.toml found searching from: {search_path}")
        self.search_path = search_path


class ConfigParseError(PurrjectError):
    """Raised when a purrject.toml file is invalid."""

    def __init__(self, path: str, detail: str) -> None:
        super().__init__(f"Failed to parse {path}: {detail}")
        self.path = path
        self.detail = detail


class ModuleNotFoundError(PurrjectError):
    """Raised when a requested module does not exist in the project."""

    def __init__(self, name: str) -> None:
        super().__init__(f"Module not found: {name}")
        self.name = name
