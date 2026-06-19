---
name: purrject-dev
description: CLI tool for analyzing and visualizing project module dependency structures using TOML config files.
---

# purrject
## Usage

```
purrject <command> [options]
```

## Commands

### init

Initialize a new purrject project.

```
purrject init -n <name> [-d <directory>]
```

- `-n` (required): Project name.
- `-d`: Target directory. Default: current directory.

Creates a root `purrject.toml` in the target directory. Fails if the file already exists.

### add

Add a module to the project.

```
purrject add <module-name> [-i <intro>] [--document <path>] [-r <dep> ...] [-d <directory>]
```

- `<module-name>` (required): Name of the module.
- `-i`: Short description of the module.
- `--document`: Path to the module's documentation file (relative to module dir).
- `-r`: Dependency module name. Repeatable for multiple dependencies.
- `-d`: Project root directory. Default: current directory.

Creates `modules/<name>/purrject.toml` and registers the module in the root config.

### list

List all modules in the project.

```
purrject list [-d <directory>]
```

- `-d`: Project root directory. Default: current directory.

### show

Show detailed information about a module.

```
purrject show <module-name> [-d <directory>]
```

- `<module-name>` (required): Name of the module to inspect.
- `-d`: Project root directory. Default: current directory.

Displays: name, intro, document path, filesystem path, dependencies, and reverse dependencies.

### deps

Print direct dependencies of a module, one per line.

```
purrject deps <module-name> [-d <directory>]
```

- `<module-name>` (required): Name of the module.
- `-d`: Project root directory. Default: current directory.

### tree

Print the full project dependency tree using Unicode box-drawing characters.

```
purrject tree [-d <directory>]
```

- `-d`: Project root directory. Default: current directory.

Root modules (not depended on by others) appear at the top. Circular dependencies are marked with "(cycle)".

### graph

Generate an interactive HTML dependency graph.

```
purrject graph [-o <output.html>] [-d <directory>]
```

- `-o`: Output HTML file path. Default: `purrject_graph.html` in project root.
- `-d`: Project root directory. Default: current directory.

Uses vis-network. Features: force-directed layout, click-to-highlight dependencies, double-click to open module docs, minimap.

## Global Options

- `--version`: Show version.
- `-h`, `--help`: Show help.
- `-d`: Available on all commands. Specifies project root directory. Default: current directory.

## Config Discovery

The tool walks up the directory tree from the working directory to find `purrject.toml`. Commands can be run from any subdirectory of the project.

Config file write rules are in `Reference/purrject_toml.md`.
