# Purrject

A CLI tool for analyzing project module structures. Purrject reads `purrject.toml` configuration files to map out modules and their dependencies.

## Installation

Requires [uv](https://docs.astral.sh/uv/).

```bash
uv sync
```

Or install directly:

```bash
uv pip install .
```

## Configuration

Purrject uses two levels of TOML configuration files.

### Root Config (`purrject.toml` at project root)

```toml
[project]
project_name = "my_project"

[modules]
module_a = "modules/module_a"
module_b = "modules/module_b"
```

- `[project].project_name` — display name of the project.
- `[modules]` — maps module names to their directory paths (relative to the config file).

### Module Config (`purrject.toml` inside each module directory)

```toml
[module]
module = "module_a"
intro = "Short description of this module"
document = "../../docs/module_a.md"
requirements = ["module_b"]
```

- `module` — module identifier.
- `intro` — one-line description shown in listings.
- `document` — relative path to the module's documentation file.
- `requirements` — list of module names this module depends on.

## Usage

### Initialize a new project

```bash
purrject init
```

Creates a `purrject.toml` in the current directory. Options:

- `-n, --name NAME` — project name (defaults to directory name).
- `-d, --directory PATH` — target directory (defaults to CWD).

```bash
purrject init -n my_project -d ./my_project
```

### Add a new module

```bash
purrject add <module_name>
```

Creates a module directory and its `purrject.toml`, and registers it in the root config. Options:

- `-i, --intro TEXT` — short description of the module.
- `--document PATH` — relative path to the module's documentation.
- `-r, --requirements NAME` — dependency module name (repeatable).
- `-d, --directory PATH` — project root directory.

```bash
purrject add auth -i "Authentication module"
purrject add api -i "API module" -r auth
```

### List all modules

```bash
purrject list
```

Output:

```
  Modules in 'my_project'
+----------------------------+
| Module     | Intro         |
|------------+---------------|
| module_a   | Short desc... |
| module_b   | Short desc... |
+----------------------------+
```

### Show module details

```bash
purrject show module_a
```

Output:

```
+--------------------------- Module: module_a ---------------------------+
| Name:         module_a                                                |
| Intro:        Short description of this module                        |
| Document:     ../../docs/module_a.md                                  |
| Requirements: module_b                                                |
| Path:         /path/to/project/modules/module_a                       |
+-----------------------------------------------------------------------+
```

### Show module dependencies

```bash
purrject deps module_a
```

Output:

```
module_a dependencies
`-- module_b - Short description of this module
```

Recursively lists all transitive dependencies. If the module has no dependencies:

```
module_a has no dependencies.
```

### Show dependency tree

```bash
purrject tree
```

Output:

```
my_project
`-- module_a - Short description of this module
    `-- module_b - Short description of this module
```

### Show dependency graph

```bash
purrject graph
```

Opens an interactive dependency graph in the default browser. Features:

- **Hover** over a node to see its intro tooltip.
- **Right-click** a node to open its document in a new tab.
- Root modules (not depended on by others) are shown in blue; others in yellow.
- Drag, zoom, and pan to explore the graph.

Save to a file instead of opening:

```bash
purrject graph -o graph.html
```

### Options

All commands accept:

- `-d, --directory PATH` — project root directory. Defaults to searching upward from the current working directory.

Global options:

- `--version` — show version.
- `--help` — show help.

## Example

An example project is included in the `example/` directory:

```bash
purrject list -d example
purrject show mod2 -d example
purrject deps mod2 -d example
purrject tree -d example
```
