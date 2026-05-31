"""Configuration file parsing and writing for purrject."""

import tomllib
from pathlib import Path

import tomli_w

from .errors import ConfigNotFoundError, ConfigParseError
from .models import Module, Project

CONFIG_FILENAME = "purrject.toml"


def find_root_config(start: Path | None = None) -> Path:
    """Walk up from start directory looking for purrject.toml with a [project] section.

    Args:
        start: Directory to start searching from. Defaults to CWD.

    Returns:
        Path to the root purrject.toml.

    Raises:
        ConfigNotFoundError: If no valid config is found.
    """
    current = (start or Path.cwd()).resolve()

    while True:
        config_path = current / CONFIG_FILENAME
        if config_path.is_file():
            try:
                with open(config_path, "rb") as f:
                    data = tomllib.load(f)
                if "project" in data:
                    return config_path
            except tomllib.TOMLDecodeError:
                pass

        parent = current.parent
        if parent == current:
            break
        current = parent

    raise ConfigNotFoundError(str(start or Path.cwd()))


def load_project(config_path: Path) -> Project:
    """Load a project from a root purrject.toml.

    Args:
        config_path: Path to the root purrject.toml file.

    Returns:
        A Project instance with all modules loaded.

    Raises:
        ConfigParseError: If the config file is invalid.
    """
    try:
        with open(config_path, "rb") as f:
            data = tomllib.load(f)
    except (tomllib.TOMLDecodeError, OSError) as e:
        raise ConfigParseError(str(config_path), str(e)) from e

    project_section = data.get("project", {})
    project_name = project_section.get("project_name", config_path.parent.name)

    modules_section = data.get("modules", {})
    config_dir = config_path.parent
    modules: dict[str, Module] = {}

    for module_name, module_rel_path in modules_section.items():
        module_dir = (config_dir / module_rel_path).resolve()
        module_config_path = module_dir / CONFIG_FILENAME

        if not module_config_path.is_file():
            raise ConfigParseError(
                str(module_config_path),
                f"Module config not found for '{module_name}'",
            )

        try:
            with open(module_config_path, "rb") as f:
                module_data = tomllib.load(f)
        except (tomllib.TOMLDecodeError, OSError) as e:
            raise ConfigParseError(str(module_config_path), str(e)) from e

        module_section = module_data.get("module", {})
        modules[module_name] = Module(
            name=module_section.get("module", module_name),
            intro=module_section.get("intro", ""),
            document=module_section.get("document", ""),
            requirements=tuple(module_section.get("requirements", [])),
            path=module_dir,
        )

    return Project(name=project_name, modules=modules)


def init_project(directory: Path, project_name: str) -> Path:
    """Create a new purrject.toml in the given directory.

    Args:
        directory: Directory to create the config in.
        project_name: Name of the project.

    Returns:
        Path to the created config file.

    Raises:
        ConfigParseError: If a config already exists.
    """
    config_path = directory / CONFIG_FILENAME
    if config_path.is_file():
        raise ConfigParseError(str(config_path), "Config file already exists")

    data = {
        "project": {"project_name": project_name},
        "modules": {},
    }

    config_path.write_text(tomli_w.dumps(data), encoding="utf-8")
    return config_path


def add_module(
    config_path: Path,
    module_name: str,
    intro: str = "",
    document: str = "",
    requirements: list[str] | None = None,
    modules_dir: str = "modules",
) -> Path:
    """Add a new module to an existing project.

    Creates the module directory and purrject.toml, and updates the root config.

    Args:
        config_path: Path to the root purrject.toml.
        module_name: Name of the new module.
        intro: Short description of the module.
        document: Relative path to the module's documentation.
        requirements: List of module names this module depends on.
        modules_dir: Name of the modules directory.

    Returns:
        Path to the created module config file.

    Raises:
        ConfigParseError: If the module already exists or config is invalid.
    """
    config_dir = config_path.parent

    # Load existing root config
    try:
        with open(config_path, "rb") as f:
            data = tomllib.load(f)
    except (tomllib.TOMLDecodeError, OSError) as e:
        raise ConfigParseError(str(config_path), str(e)) from e

    modules_section = data.get("modules", {})
    if module_name in modules_section:
        raise ConfigParseError(str(config_path), f"Module '{module_name}' already exists")

    # Create module directory
    module_rel_path = f"{modules_dir}/{module_name}"
    module_dir = (config_dir / module_rel_path).resolve()
    module_dir.mkdir(parents=True, exist_ok=True)

    # Create module purrject.toml
    module_data: dict = {
        "module": {
            "module": module_name,
            "intro": intro,
            "document": document,
            "requirements": requirements or [],
        }
    }
    module_config_path = module_dir / CONFIG_FILENAME
    module_config_path.write_text(tomli_w.dumps(module_data), encoding="utf-8")

    # Update root config
    modules_section[module_name] = module_rel_path
    data["modules"] = modules_section
    config_path.write_text(tomli_w.dumps(data), encoding="utf-8")

    return module_config_path
