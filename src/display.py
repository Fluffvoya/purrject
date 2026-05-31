"""Terminal output formatting using Rich."""

from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.tree import Tree

from .models import Module, Project

console = Console()


def print_module_list(project: Project) -> None:
    """Print a table listing all modules in the project.

    Args:
        project: The project to display.
    """
    table = Table(title=f"Modules in '{project.name}'")
    table.add_column("Module", style="cyan", no_wrap=True)
    table.add_column("Intro", style="white")

    for name in sorted(project.modules):
        module = project.modules[name]
        table.add_row(name, module.intro)

    console.print(table)


def print_module_detail(module: Module) -> None:
    """Print detailed information about a single module.

    Args:
        module: The module to display.
    """
    deps = ", ".join(module.requirements) if module.requirements else "(none)"

    content = (
        f"[cyan]Name:[/cyan]         {module.name}\n"
        f"[cyan]Intro:[/cyan]        {module.intro}\n"
        f"[cyan]Document:[/cyan]     {module.document}\n"
        f"[cyan]Requirements:[/cyan] {deps}\n"
        f"[cyan]Path:[/cyan]         {module.path}"
    )

    console.print(Panel(content, title=f"Module: {module.name}", border_style="cyan"))


def print_dependency_tree(project: Project) -> None:
    """Print the full dependency tree for the project.

    Roots are modules not required by any other module.
    Handles cycles gracefully by marking revisited nodes.

    Args:
        project: The project to display.
    """
    roots = project.root_modules()

    if not roots:
        console.print("[yellow]No root modules found (possible circular dependency).[/yellow]")
        return

    tree = Tree(f"[bold]{project.name}[/bold]")
    visited: set[str] = set()

    for root_name in sorted(roots):
        _add_module_to_tree(tree, root_name, project, visited)

    console.print(tree)


def print_module_deps(project: Project, module_name: str) -> None:
    """Print the dependency tree for a specific module.

    Shows all transitive dependencies (recursively) with cycle detection.

    Args:
        project: The project containing all modules.
        module_name: Name of the module to show dependencies for.
    """
    module = project.get_module(module_name)
    if module is None:
        console.print(f"[red]Module not found: {module_name}[/red]")
        return

    if not module.requirements:
        console.print(f"[cyan]{module_name}[/cyan] has no dependencies.")
        return

    tree = Tree(f"[bold cyan]{module_name}[/bold cyan] dependencies")
    visited: set[str] = set()

    for dep_name in sorted(module.requirements):
        _add_module_to_tree(tree, dep_name, project, visited)

    console.print(tree)


def _add_module_to_tree(
    tree: Tree,
    module_name: str,
    project: Project,
    visited: set[str],
) -> None:
    """Recursively add a module and its dependencies to a Rich tree.

    Args:
        tree: The Rich tree node to add to.
        module_name: Name of the module to add.
        project: The project containing all modules.
        visited: Set of already-visited module names (for cycle detection).
    """
    module = project.get_module(module_name)

    if module_name in visited:
        tree.add(f"[dim]{module_name} (already shown)[/dim]")
        return

    if module is None:
        tree.add(f"[red]{module_name} (not found)[/red]")
        return

    visited.add(module_name)
    label = f"[cyan]{module_name}[/cyan] - {module.intro}"
    branch = tree.add(label)

    for dep_name in sorted(module.requirements):
        _add_module_to_tree(branch, dep_name, project, visited)
