# Component Metadata Guide

This project uses two related shapes:

- Local source shape: `data/components/<id>/meta.json` (`schemaVersion: 2`)
- Backend storage shape: split Convex tables (`schemaVersion: 4/5`)

## Current data flow (Convex-first + changesets)

1. Edit local component docs in `data/components/<id>/meta.json`.
2. Create a changeset:
   - `bun run data:changeset:create`
3. Validate the changeset:
   - `bun run data:changeset:validate -- --changeset data/changesets/<id>.json`
4. Diff against live Convex data:
   - `bun run data:changeset:diff -- --changeset data/changesets/<id>.json`
5. Publish to Convex:
   - `bun run data:changeset:publish -- --changeset data/changesets/<id>.json`
6. Optional live integrity/sync scripts:
   - `bun run --cwd apps/backend validate:data`
   - `bun run data:pull`

## Source of truth

- Live Convex data (`components`, `componentCode`, `componentFiles`, `componentSearch`) is the runtime source of truth.
- Local `data/components/` files are an editable source that can be materialized into a changeset.

## Changeset format (`data/changesets/*.json`)

One file per publish run. Example:

```json
{
  "schemaVersion": 1,
  "id": "20260223T204501Z",
  "createdAt": "2026-02-23T20:45:01.000Z",
  "source": "agent",
  "operations": [
    {
      "type": "upsert",
      "component": {
        "schemaVersion": 2,
        "id": "button-shadcn-3fb3fb60",
        "...": "..."
      }
    },
    {
      "type": "delete",
      "componentId": "button-shadcn-4f67a1b2"
    }
  ]
}
```

Notes:

- `upsert.component` must be a valid v2 component document.
- `delete.componentId` is the public Convex component id (`components.id`), not the local source id.
- Validation blocks duplicate/conflicting operations for the same public component id.

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

- Local `meta.json` `id` is an input identifier.
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

- Local pull (`bun run data:pull`) materializes the canonical example file as `data/components/<id>/example.tsx`.
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
