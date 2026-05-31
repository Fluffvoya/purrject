"""Data models for purrject project and module structures."""

from dataclasses import dataclass, field
from pathlib import Path


@dataclass(frozen=True)
class Module:
    """Represents a single module in the project."""

    name: str
    intro: str
    document: str
    requirements: tuple[str, ...]
    path: Path


@dataclass(frozen=True)
class Project:
    """Represents the entire project with all its modules."""

    name: str
    modules: dict[str, Module] = field(default_factory=dict)

    def get_module(self, name: str) -> Module | None:
        """Get a module by name, returning None if not found."""
        return self.modules.get(name)

    def root_modules(self) -> list[str]:
        """Return module names that are not required by any other module."""
        required: set[str] = set()
        for module in self.modules.values():
            required.update(module.requirements)
        return [name for name in self.modules if name not in required]
