# purrject

A CLI tool for analyzing project module structures. It reads `purrject.toml` configuration files to map modules and their dependencies, providing dependency tree and interactive HTML graph visualizations.

## Installation

```bash
dotnet build src/Purrject/
```

Run with:

```bash
purrject [command] [options]
```

## Configuration Format

### Root Config (`purrject.toml`)

```toml
[project]
project_name = "myproject"

[modules]
auth = "modules/auth"
api = "modules/api"
```

### Module Config (`modules/<name>/purrject.toml`)

```toml
[module]
module = "auth"
intro = "Authentication and authorization"
document = "../doc/auth.md"
requirements = ["db", "utils"]
```

## Commands

### `purrject init`

Initialize a new purrject project.

```bash
purrject init -n myproject [-d directory]
```

| Option | Description                          |
| ------ | ------------------------------------ |
| `-n`   | Project name (required)              |
| `-d`   | Project directory (default: current) |

### `purrject add`

Add a new module to the project.

```bash
purrject add auth -i "Authentication module" --document "doc/auth.md" -r db -r utils [-d directory]
```

| Option       | Description                         |
| ------------ | ----------------------------------- |
| `<module>`   | Module name (required)              |
| `-i`         | Module introduction                 |
| `--document` | Documentation file path             |
| `-r`         | Dependency module name (repeatable) |
| `-d`         | Project root directory              |

### `purrject list`

List all modules in the project.

```bash
purrject list [-d directory]
```

Output:

```
Module       Description
------------ --------------------------------------------------
api          REST API endpoints
auth         Authentication and authorization
db           Database access layer

Total: 3 module(s)
```

### `purrject show`

Show detailed information about a module.

```bash
purrject show auth [-d directory]
```

Output:

```
Module:    auth
Intro:     Authentication and authorization
Document:  ../../doc/auth.md
Path:      /path/to/modules/auth
Depends on:
  - db
  - utils
Depended by:
  - api
  - web
```

### `purrject deps`

Show direct dependencies of a module.

```bash
purrject deps gateway [-d directory]
```

Output:

```
api
auth
cache
```

### `purrject tree`

Show the full project dependency tree.

```bash
purrject tree [-d directory]
```

### `purrject graph`

Generate an interactive HTML dependency graph.

```bash
purrject graph [-o output.html] [-d directory]
```

| Option | Description                                                       |
| ------ | ----------------------------------------------------------------- |
| `-o`   | Output file path (default: `purrject_graph.html` in project root) |
| `-d`   | Project root directory                                            |

The generated HTML file features:

- Interactive node dragging and zooming
- Hover tooltips showing module descriptions
- Click to highlight a module's dependencies
- Double-click to open module documentation

## Global Options

| Option       | Description                     |
| ------------ | ------------------------------- |
| `--version`  | Show version information        |
| `-h, --help` | Show help and usage information |
| `-d`         | Specify project root directory  |

## License

MIT
