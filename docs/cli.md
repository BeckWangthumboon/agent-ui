# CLI

`@agent-ui/cli` is a Bun CLI for searching and viewing component metadata from Convex.

## Runtime Requirements

- `CONVEX_URL` must be set for any command that needs backend access.
- The generated Convex API module must exist at `apps/backend/convex/_generated/api`.
- For default config lookup, commands that use config must run inside a Git project or pass `--config`.

## Scripts

- `bun run --cwd apps/cli dev`
- `bun run --cwd apps/cli test`
- `bun run --cwd apps/cli typecheck`

## Command Reference

Binary name:

- `component-search`

Global options:

- `--config <path>`: explicit path to config file. Consumed by `search` and `add`.
- `--help`

### `search <query>`

Searches component metadata.

Options:

- `-l, --limit <number>`
- `--framework <framework>`
- `--styling <styling>`
- `--motion <motion>` (repeatable)
- `--primitive-library <library>` (repeatable)
- `--relax`
- `--json`

Behavior:

- Trims and validates non-empty query.
- Loads config defaults and merges them with CLI flags.
- Creates a Convex client from `CONVEX_URL`.
- Queries `api.search.componentsQuery`.
- Sends all filters (including multi-value `motion` and `primitiveLibrary`) to the backend query.
- Ranks candidates with Fuse.js.
- Uses strict ranking by default.
- `--relax` switches to relaxed ranking to show best-effort matches.
- Hydrates metadata via `api.components.getMetadataByIds`.
- Prints table-like text output or structured JSON.
- On strict zero-hit, prints actionable recovery hints and notes that the component/topic may not exist in the current catalog.

Failure cases:

- Empty query.
- Invalid option value parsing.
- Missing/invalid config.
- Missing `CONVEX_URL`.

### `view|v <id>`

Shows a component by id.

Options:

- `--verbose`
- `--code`
- `--example`
- `--json`

Behavior:

- Trims and validates non-empty id.
- Creates a Convex client from `CONVEX_URL`.
- Queries `api.search.getById`.
- `--code` requests code payload (`includeCode: true`).
- `--example` requests a canonical usage example payload (`includeExample: true`).
- Prints summary output, verbose metadata, full code blocks, canonical example blocks, or structured JSON.
- Non-verbose output includes primitive/animation library values when present (non-`none`).
- JSON contract:
  - `--json`: metadata only
  - `--json --code`: metadata + code
  - `--json --verbose`: metadata + verbose (no code)
  - `--json --example`: metadata + canonical usage example
  - `--json --verbose --code --example`: full payload
  - Stable envelope always included: `included: { code: boolean, verbose: boolean, example: boolean }`

Failure cases:

- Empty id.
- Component not found.

### `add <id>`

Prints install instructions for a component.

Options:

- `--package-manager <manager>` (`npx|bunx|pnpm|yarn`)
- `--json`

Behavior:

- Trims and validates non-empty id.
- Loads optional config defaults for `add.packageManager`.
- Creates a Convex client from `CONVEX_URL`.
- Queries `api.components.getMetadataById`.
- For `install.mode=command`, prints the rendered install command.
- For `install.mode=manual`, prints ordered manual steps.
- For `install.mode=command+manual`, prints both command and steps.
- Runner mapping:
  - `npx <template>`
  - `bunx <template>`
  - `pnpm dlx <template>`
  - `yarn dlx <template>`

Failure cases:

- Empty id.
- Component not found.
- Missing install metadata.

## Config File

Canonical project config location:

- `.agents/agent-ui.json`

Schema version:

- `schemaVersion: 1`

Current supported config section:

- `search` defaults:
  - `limit`
  - `framework`
  - `styling`
  - `motion[]`
  - `primitiveLibrary[]`
  - `json`
- `add` defaults:
  - `packageManager` (`npx|bunx|pnpm|yarn`)

`search --json` fields include:

- `mode`: `"strict"` or `"relaxed"`
- `strictResultCount`: count from strict ranking before relaxed substitution
- `relaxed`: boolean reflecting `--relax`

Default config payload written on first `search` run when missing:

```json
{
  "schemaVersion": 1,
  "search": {
    "limit": 5,
    "framework": "react",
    "styling": "tailwind",
    "motion": ["none", "minimal"],
    "primitiveLibrary": ["radix", "base-ui"],
    "json": true
  },
  "add": {
    "packageManager": "npx"
  }
}
```

## Config Resolution and Project Boundaries

For commands that load default config:

1. If `--config` is provided, resolve and use it directly.
2. Otherwise walk up from `cwd` to find nearest `.git` marker.
3. If no `.git` is found, error:
   - `No git project found from '<cwd>' upward. Use --config <path> or run inside a git repository.`
4. Search for the nearest existing `.agents` directory between `cwd` and Git root.
5. If none exists, use `<git-root>/.agents`.
6. Use `<resolved .agents>/agent-ui.json`.
7. Never read `.agents` above the Git root.

Write behavior:

- `search` only: missing default config triggers `.agents` creation and default file write.
- Explicit `--config`: never auto-created; missing file is an error.

## Implementation Notes

Entrypoints:

- `apps/cli/src/cli.ts`: command wiring and global error handling.
- `apps/cli/src/search.ts`: search pipeline, ranking, and output formatting.
- `apps/cli/src/view.ts`: detail lookup and display formatting.
- `apps/cli/src/add.ts`: install command and manual steps output.
- `apps/cli/src/config.ts`: schema, load/validate/create logic, CLI default merge.
- `apps/cli/src/agentPaths.ts`: Git-bounded `.agents` discovery and errors.

Option merge policy for `search`:

- CLI flags override config defaults.
- Unset CLI flags inherit from config defaults.
