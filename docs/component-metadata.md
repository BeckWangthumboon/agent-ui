# Component Metadata Guide

This project currently uses two related shapes:

- Local annotation/source shape: `data/components/<id>/meta.json` (`schemaVersion: 2`)
- Backend/storage shape: split Convex tables (`schemaVersion: 4/5`)

`data/components.csv` is a bulk editing surface that imports into local `meta.json` files.

## Current data flow

1. Edit `data/components.csv`.
2. Run `bun run data:import-csv` (alias: `bun run import:csv`) to update `data/components/<id>/meta.json`.
3. Backend upsert (`apps/backend/convex/admin.ts`) accepts the v2 document and splits it into:
   - `components` (metadata)
   - `componentCode` (code manifest: `entryFile`)
   - `componentFiles` (one row per code/example file)
   - `componentSearch` (search text fields)
4. Optional live Convex integrity check:
   - `bun run --cwd apps/backend validate:data`
5. Optional reverse sync from Convex back to local `data/components/`:
   - `bun run --cwd apps/backend sync:data`

## Source of truth

- For local editing/import: `data/components/<id>/meta.json` is canonical.
- For live backend behavior: Convex tables (`components`, `componentCode`, `componentFiles`, `componentSearch`) are canonical.

## CSV contract (import-from-csv)

Required headers:

- `id`
- `name`
- `framework`
- `styling`
- `intent`
- `capabilities`
- `synonyms`
- `topics`
- `dependencies`
- `motion`
- `source_url`
- `source_repo`
- `source_author`
- `source_license`
- `code_file`

Optional header:

- `source_library`

Allowed values enforced by importer:

- `motion`: `none | minimal | standard | heavy`

Notes:

- `capabilities`, `synonyms`, `topics`, `dependencies` are `|`-delimited, trimmed, and deduplicated case-insensitively.
- `dependencies` become objects with `kind: "runtime"` in v2 `meta.json`.
- `code_file` must exist at `data/components/<id>/<code_file>` and must be non-empty.
- Import preserves non-CSV fields from existing `meta.json` when present (`example`, `constraints`, `primitiveLibrary`, `animationLibrary`, and extra `code.files` entries).
- Import updates `code.entryFile` from `code_file` and refreshes that file's content from disk.
- CSV import does not populate `example`; add/edit that directly in `meta.json` when needed.
- Canonical local example filename is `example.tsx` when generated from Convex sync.
- `example.tsx` is reserved for canonical examples; do not use it as a code file path in `code.files`.

## v2 local document fields (`meta.json`)

`schemaVersion: 2` documents include:

- `id`
- `name`
- `source`:
  - `url` (required)
  - `library`, `repo`, `author`, `license` (optional)
- `framework`
- `styling`
- `dependencies` (`[{ name, kind }]`)
- `intent`
- `capabilities`
- `synonyms`
- `topics`
- `motionLevel`
- `primitiveLibrary` (optional)
- `animationLibrary` (optional)
- `constraints` (optional)
- `code`:
  - `entryFile`
  - `files[]` (`{ path, content }`)
- `example` (optional):
  - `{ path, content }`
  - canonical path convention: `example.tsx`

## v4/v5 backend split records (derived on upsert)

When a v2 document is upserted, backend derives:

- `components` (`schemaVersion: 4`):
  - `id`, `name`, `source`, `framework`, `styling`, `dependencies`, `motionLevel`, `primitiveLibrary`, `animationLibrary`, `constraints`
- `componentCode` (`schemaVersion: 5`):
  - `componentId`, `entryFile`
- `componentFiles` (`schemaVersion: 5`):
  - `componentId`, `kind` (`code | example`), `path`, `content`
  - runtime convention: one canonical example path, `example.tsx`
- `componentSearch` (`schemaVersion: 4`):
  - `componentId`, `intent`, `capabilities`, `synonyms`, `topics`

### Important: ID behavior

- CSV/local `meta.json` `id` is an input identifier.
- Backend generates a public component id via `buildPublicComponentId(...)` and stores that in v4 tables.
- Generated id is based on name/library slug plus a hash fingerprint of:
  - local `id`
  - `source.url`
  - `framework`
  - `styling`

## Derived library fields

If v2 `primitiveLibrary` / `animationLibrary` are missing, backend derives them from dependencies:

- `primitiveLibrary`
  - `radix` if dependency starts with `@radix-ui/`
  - `base-ui` if dependency starts with `@base-ui/` or contains `base-ui`
  - `other` if dependency matches headless/ariakit patterns
  - otherwise `none`
- `animationLibrary`
  - `motion` for `motion` / `motion/react` patterns
  - `framer-motion` for framer-motion patterns
  - otherwise `none`

## Example canonicalization

- Local sync (`bun run --cwd apps/backend sync:data`) materializes the canonical example file as `data/components/<id>/example.tsx`.
- Upsert canonicalizes any provided `example.path` to `example.tsx` before writing to Convex.
- If multiple `componentFiles(kind="example")` rows exist, validation currently warns and canonical selection uses lexicographically first `path`.

## Controlled vocabularies

- `framework`: `react`
- `styling`: `tailwind`
- `motion`: `none | minimal | standard | heavy`
- `topics`:
  - action
  - selection
  - toggle
  - confirmation
  - destructive
  - disclosure
  - input
  - form
  - validation
  - authentication
  - date-time
  - navigation
  - menu
  - command-palette
  - breadcrumb
  - pagination
  - overlay
  - modal
  - popover
  - drawer
  - tooltip
  - feedback
  - status
  - notification
  - loading
  - progress
  - empty-state
  - data-display
  - data-visualization
  - layout
  - scrolling
  - resizable
  - keyboard
