"""CLI commands for purrject."""

import sys
from pathlib import Path

import click
from rich.console import Console

from .config import add_module, find_root_config, init_project, load_project
from .display import print_dependency_tree, print_module_deps, print_module_detail, print_module_list
from .errors import ConfigNotFoundError, ConfigParseError, ModuleNotFoundError
from .graph import generate_html

console = Console(stderr=True)


@click.group()
@click.version_option(version="0.1.0")
def main() -> None:
    """Purrject - Analyze project module structures."""


@main.command(name="init")
@click.option("-n", "--name", default=None, help="Project name. Defaults to directory name.")
@click.option("-d", "--directory", type=click.Path(path_type=Path), default=None,
              help="Directory to initialize in. Defaults to CWD.")
def init_cmd(name: str | None, directory: Path | None) -> None:
    """Initialize a new purrject project."""
    try:
        target = (directory or Path.cwd()).resolve()
        target.mkdir(parents=True, exist_ok=True)
        project_name = name or target.name
        config_path = init_project(target, project_name)
        console.print(f"[green]Initialized project '{project_name}' at {config_path}[/green]")
    except ConfigParseError as e:
        console.print(f"[red]Error:[/red] {e}")
        sys.exit(1)


@main.command()
@click.argument("module_name")
@click.option("-i", "--intro", default="", help="Short description of the module.")
@click.option("--document", default="", help="Relative path to the module's documentation.")
@click.option("-r", "--requirements", multiple=True, help="Module dependencies (repeatable).")
@click.option("-d", "--directory", type=click.Path(exists=True, path_type=Path), default=None,
              help="Project root directory. Defaults to searching from CWD.")
def add(
    module_name: str,
    intro: str,
    document: str,
    requirements: tuple[str, ...],
    directory: Path | None,
) -> None:
    """Add a new module to the project."""
    try:
        config_path = find_root_config(directory)
        module_config = add_module(
            config_path,
            module_name,
            intro=intro,
            document=document,
            requirements=list(requirements),
        )
        console.print(f"[green]Added module '{module_name}' at {module_config}[/green]")
    except (ConfigNotFoundError, ConfigParseError) as e:
        console.print(f"[red]Error:[/red] {e}")
        sys.exit(1)


@main.command(name="list")
@click.option("-d", "--directory", type=click.Path(exists=True, path_type=Path), default=None,
              help="Project root directory. Defaults to searching from CWD.")
def list_cmd(directory: Path | None) -> None:
    """List all modules in the project."""
    try:
        config_path = find_root_config(directory)
        project = load_project(config_path)
        print_module_list(project)
    except (ConfigNotFoundError, ConfigParseError) as e:
        console.print(f"[red]Error:[/red] {e}")
        sys.exit(1)


@main.command()
@click.argument("module_name")
@click.option("-d", "--directory", type=click.Path(exists=True, path_type=Path), default=None,
              help="Project root directory. Defaults to searching from CWD.")
def show(module_name: str, directory: Path | None) -> None:
    """Show details of a specific module."""
    try:
        config_path = find_root_config(directory)
        project = load_project(config_path)
        module = project.get_module(module_name)
        if module is None:
            raise ModuleNotFoundError(module_name)
        print_module_detail(module)
    except (ConfigNotFoundError, ConfigParseError, ModuleNotFoundError) as e:
        console.print(f"[red]Error:[/red] {e}")
        sys.exit(1)


@main.command()
@click.argument("module_name")
@click.option("-d", "--directory", type=click.Path(exists=True, path_type=Path), default=None,
              help="Project root directory. Defaults to searching from CWD.")
def deps(module_name: str, directory: Path | None) -> None:
    """Show all dependencies of a specific module."""
    try:
        config_path = find_root_config(directory)
        project = load_project(config_path)
        if project.get_module(module_name) is None:
            raise ModuleNotFoundError(module_name)
        print_module_deps(project, module_name)
    except (ConfigNotFoundError, ConfigParseError, ModuleNotFoundError) as e:
        console.print(f"[red]Error:[/red] {e}")
        sys.exit(1)


@main.command()
@click.option("-d", "--directory", type=click.Path(exists=True, path_type=Path), default=None,
              help="Project root directory. Defaults to searching from CWD.")
def tree(directory: Path | None) -> None:
    """Show the full dependency tree."""
    try:
        config_path = find_root_config(directory)
        project = load_project(config_path)
        print_dependency_tree(project)
    except (ConfigNotFoundError, ConfigParseError) as e:
        console.print(f"[red]Error:[/red] {e}")
        sys.exit(1)


@main.command()
@click.option("-o", "--output", type=click.Path(path_type=Path), default=None,
              help="Output HTML file path. Defaults to purrject_graph.html in project root.")
@click.option("-d", "--directory", type=click.Path(exists=True, path_type=Path), default=None,
              help="Project root directory. Defaults to searching from CWD.")
def graph(output: Path | None, directory: Path | None) -> None:
    """Generate an interactive dependency graph HTML file."""
    try:
        config_path = find_root_config(directory)
        project = load_project(config_path)
        html = generate_html(project)

        if not output:
            output = config_path.parent / "purrject_graph.html"
        output.write_text(html, encoding="utf-8")
        console.print(f"[green]Graph written to {output}[/green]")
    except (ConfigNotFoundError, ConfigParseError) as e:
        console.print(f"[red]Error:[/red] {e}")
        sys.exit(1)
