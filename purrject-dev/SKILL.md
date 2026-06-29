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

Details are in `Reference/command.md`.

## Global Options

- `--version`: Show version.
- `-h`, `--help`: Show help.
- `-d`: Available on all commands. Specifies project root directory. Default: current directory.

## Config Discovery

The tool walks up the directory tree from the working directory to find `purrject.toml`. Commands can be run from any subdirectory of the project.

Config file write rules are in `Reference/purrject_toml.md`.

## Documents

Module document file specification is in `Reference/document_spec.md`.
