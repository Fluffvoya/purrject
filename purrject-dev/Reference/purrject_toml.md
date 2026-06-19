# purrject.toml Reference

Two types of TOML config files: root config and module config.

## Root Config

Located at project root. Found by walking up the directory tree.

```toml
[project]
project_name = "my-project"

[modules]
auth = "modules/auth"
api = "modules/api"
```

### [project]

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `project_name` | string | Yes | `"unnamed"` | Project name. |

### [modules]

Key-value pairs mapping module names to their directory paths (relative to the root config directory). Each referenced directory must contain its own `purrject.toml`.

## Module Config

Located at `<module-dir>/purrject.toml` (e.g. `modules/auth/purrject.toml`).

```toml
[module]
module = "auth"
intro = "Authentication service"
document = "../../doc/auth.md"
requirements = ["db", "utils"]
```

### [module]

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `module` | string | Yes | — | Module name. Must match the key in root `[modules]`. |
| `intro` | string | No | `""` | Short description. |
| `document` | string | No | `""` | Path to documentation file, relative to module dir. |
| `requirements` | string[] | No | `[]` | Names of modules this module depends on. |

## Example

Root config:

```toml
[project]
project_name = "example"

[modules]
db = "modules/db"
utils = "modules/utils"
auth = "modules/auth"
api = "modules/api"
```

Module config for `auth` (`modules/auth/purrject.toml`):

```toml
[module]
module = "auth"
intro = "Authentication and authorization"
document = "../../doc/auth.md"
requirements = ["db", "utils"]
```
