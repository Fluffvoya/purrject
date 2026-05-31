# Architecture

## Project Layout

```
src/
├── __init__.py      # Package metadata and version
├── errors.py        # Exception hierarchy
├── models.py        # Data models (Module, Project)
├── config.py        # TOML config file parsing and writing
├── display.py       # Rich terminal output formatting
├── graph.py         # HTML dependency graph generation (vis.js)
└── cli.py           # Click CLI entry point and commands
```

## Data Flow

```
User runs CLI command
        │
        ▼
    cli.py (Click)
        │
        ├── config.find_root_config()  ← walks up CWD looking for purrject.toml
        │       │
        │       ▼
        ├── config.load_project()      ← parses root + module configs
        │       │
        │       ▼
        │   models.Project             ← frozen dataclass holding all modules
        │
        ▼
    display.py (Rich)                  ← formats and prints output
```

## Module Responsibilities

### `errors.py`
Defines the exception hierarchy. All purrject-specific errors inherit from `PurrjectError`. This allows callers to catch either specific errors or all purrject errors with a single handler.

### `models.py`
Contains two frozen dataclasses:

- **`Module`** — represents a single module with its metadata (name, intro, document path, requirements, filesystem path).
- **`Project`** — represents the entire project. Holds a `modules` dict and provides `get_module()` for lookup and `root_modules()` to find modules not required by any other module.

Frozen dataclasses enforce immutability since these are read-only domain objects parsed from config files.

### `config.py`
Responsible for locating, parsing, and writing configuration files:

- **`find_root_config(start)`** — walks up the directory tree from `start` (defaults to CWD) looking for a `purrject.toml` that contains a `[project]` section. This allows running commands from any subdirectory of a project.
- **`load_project(config_path)`** — parses the root config, iterates over `[modules]` entries, resolves each module's directory, loads its `purrject.toml`, and returns a `Project` instance.
- **`init_project(directory, project_name)`** — creates a new `purrject.toml` with `[project]` and empty `[modules]` sections.
- **`add_module(config_path, module_name, ...)`** — creates a module directory with its `purrject.toml` and updates the root config to register the module.

### `display.py`
Handles all terminal output using Rich:

- **`print_module_list()`** — renders a table of all modules.
- **`print_module_detail()`** — renders a panel with full module info.
- **`print_module_deps()`** — renders the transitive dependency tree for a specific module.
- **`print_dependency_tree()`** — renders a tree starting from root modules. Uses `visited` set for cycle detection to avoid infinite recursion.

### `graph.py`
Generates a self-contained HTML page with an interactive dependency graph using vis.js:

- **`generate_html(project)`** — returns a complete HTML string. Nodes are color-coded by root/non-root status. Hover shows intro tooltips. Right-click context menu opens module documents via `file://` URLs.
- Uses `str.replace()` for template substitution (not `str.format()`) to avoid conflicts with JS curly braces.

### `cli.py`
Click-based CLI with seven commands (`init`, `add`, `list`, `show`, `deps`, `tree`, `graph`). Read commands follow the pattern: find config → load project → call display/graph function. Write commands (`init`, `add`) call config functions directly. The `graph` command generates HTML and opens it in the browser. Errors are caught and printed to stderr with a non-zero exit code.

## Design Decisions

1. **TOML for configuration** — human-readable, widely supported, and available in the Python standard library (`tomllib` since 3.11).

2. **Upward directory search** — allows running `purrject` from any subdirectory of a project, similar to how `git` finds `.git`.

3. **Separation of parsing and display** — `config.py` knows nothing about terminal output; `display.py` knows nothing about file parsing. This makes both independently testable and replaceable.

4. **Root module detection** — the `tree` command identifies root modules as those not appearing in any other module's `requirements` list. This naturally handles forest structures (multiple independent module trees).

5. **Cycle detection** — the tree renderer tracks visited modules to gracefully handle circular dependencies by showing `(already shown)` instead of recursing infinitely.

6. **HTML graph visualization** — generates a self-contained HTML file with vis.js (loaded via CDN). This avoids adding heavy GUI dependencies (tkinter, PyQt) and works cross-platform since every system has a browser. The `file://` protocol is used for document links so they work offline.
