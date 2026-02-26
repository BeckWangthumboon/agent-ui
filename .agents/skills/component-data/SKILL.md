---
name: component-data
description: Manage component data in this repo end-to-end (meta docs, changesets, Convex validation, pull/sync, and embeddings). Use when users ask to add/update/audit/publish/reindex component data.
---

# Component Data

Maintain and validate component data using the current Convex-first workflow.

For annotation-writing quality, use `docs/component-annotations.md`.

## Scope

Use this skill for:

- Adding or updating component metadata/code under `data/components/<id>/`.
- Creating, validating, diffing, and publishing changesets.
- Pulling live Convex rows back into local component docs.
- Validating live data quality and relationships.
- Reindexing component embeddings.

## Current Data Model

Two shapes exist:

1. Local editable documents (`schemaVersion: 2`): `data/components/<id>/meta.json` plus code/example files.
2. Live Convex split tables:
   - `components`
   - `componentCode`
   - `componentFiles`
   - `componentSearch`
   - `componentEmbeddings`

Source-of-truth policy:

- Runtime source of truth is live Convex rows.
- Local `data/components/*` is the authoring surface used to generate/publish desired state.

## Standard Workflow

1. Edit local component docs in `data/components/<id>/`.
2. Generate a changeset (`data:create`).
3. Validate the changeset (`data:changeset:validate`).
4. Diff desired vs live (`data:diff`).
5. Publish (`data:publish`).
6. Validate live data (`data:validate`).
7. Optionally sync local from live (`data:pull`) if needed.
8. Reindex embeddings (`data:reindex`) when search metadata/embedding text inputs changed.

## Scripts

Prefer root scripts first.

### Root `data:*` scripts

- `bun run data:create`
- `bun run data:changeset:validate -- --changeset <path>`
- `bun run data:diff -- --changeset <path>`
- `bun run data:publish -- --changeset <path> [--dry-run]`
- `bun run data:pull`
- `bun run data:validate`
- `bun run data:validate:json`
- `bun run data:check` (runs pull + validate)
- `bun run data:reindex` (passes through to backend embedding reindex)

### Backend scripts (`apps/backend`)

- `bun run --cwd apps/backend dev`
- `bun run --cwd apps/backend generate`
- `bun run --cwd apps/backend pull`
- `bun run --cwd apps/backend validate:data`
- `bun run --cwd apps/backend report:missing-install`
- `bun run --cwd apps/backend patch:component-fields`
- `bun run --cwd apps/backend reindex:embeddings [--dry-run] [--placeholder-embeddings]`

## Validation Expectations

`data:validate` is the main live validator. It reports:

- Errors for schema failures and cross-table relation/integrity failures.
- Warnings for missing completeness fields (`install`, canonical `example`, and search metadata arrays such as `capabilities`, `synonyms`, `topics`).

Treat errors as blocking. Address warnings unless the user explicitly accepts them.

## Authoring Rules

- Keep `id` stable; do not rename existing components unless requested.
- Keep annotations retrieval-oriented (`intent`, `capabilities`, `synonyms`, `topics`).
- Preserve controlled vocab fields (`framework`, `styling`, `motion`, `topics`).
- Keep canonical example behavior aligned with `example.tsx` conventions.
- Do not modify unrelated components.

## Reporting Requirements

When you finish component-data work, report:

- What changed (component ids and files touched).
- Which commands were run.
- Validation/publish outcomes.
- Any warnings left unresolved and why.
