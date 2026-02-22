---
name: component-ingest
description: Ingest component metadata from web sources into `data/components.csv`, synchronize generated docs under `data/components/`, and validate the import pipeline. Use when the user asks to import/update components from a specific source.
---

# Component Ingest

Populate and maintain `data/components.csv` from a user-specified source while keeping metadata annotations and generated component docs consistent with the repository's current schema and validation rules.

## Authority and Scope

1. Read `docs/component-metadata.md` before any edit.
2. Treat it as authoritative for CSV contract, semantic fields, motion rubric, and controlled topics intent.
3. Also read `shared/component-schema/constants.ts` and treat `COMPONENT_TOPICS` as the runtime-enforced controlled vocabulary.
4. When validating table-shape assumptions, read `shared/component-schema/types.ts` (especially split storage types for `componentCode` and `componentFiles`).
5. If docs and runtime schema disagree, prefer runtime safety and report the mismatch.

## Source of Truth Policy

- Treat JSON component documents under `data/components/<id>/meta.json` (and their code files) as the canonical source of truth.
- Treat `data/components.csv` as a temporary editing/import surface used for easier bulk annotation and user edits.
- After CSV edits, always run import so JSON documents are synchronized to the latest intended state.
- Do not treat CSV-only changes as complete until import and validation succeed.
- For live backend behavior, remember upsert splits data into `components`, `componentCode` (manifest), `componentFiles` (one row per `code`/`example` file), and `componentSearch`.

## Workflow

1. Parse source and requested scope from the user prompt.
2. Collect candidate items from docs/site/repo.
3. Filter to atomic components by default (exclude abstract block bundles unless the user explicitly asks for them).
4. Normalize each selected component into the CSV schema.
5. Upsert rows in `data/components.csv`.
6. Ensure each row has a real `code_file` on disk under `data/components/`.
7. Run import pipeline.
8. Run validation pipeline.
9. Report results, assumptions, exclusions, and vocabulary changes.

## Source Filtering Rules

- Include items that are standalone, installable, or represented as a single reusable component unit.
- Exclude section packs, block collections, and multi-component bundles by default.
- If source has ambiguous items, choose the safest atomic interpretation and explicitly report exclusions.
- Only include blocks/bundles when the user clearly requests them.

## Upsert Rules

- Keep existing `id` values stable.
- New `id` values must be lowercase kebab-case.
- Prefer upsert-by-`id`; otherwise derive deterministic IDs from source library + component slug/name.
- Update rows when source metadata changed; add rows when component is new.
- Preserve existing CSV header order and delimiter conventions.

## Code File and Directory Rules

- `code_file` must exist and be non-empty.
- Prefer deterministic naming: `code_file = <id>.tsx` and path `data/components/<id>/<id>.tsx`.
- Ensure the chosen `code_file` naming aligns with importer directory resolution logic used in this repo.
- Avoid collisions with existing component directories or entry filenames.
- Usage examples are optional and not part of the CSV contract; if needed, represent them in `meta.json` as `example: { path, content }`.
- Canonical example path convention is `example.tsx`; sync and upsert flows normalize to this path.
- CSV import preserves existing `meta.json` non-CSV fields (including `example`) instead of dropping them.

## Annotation Rules

- Fill all required columns defined in `docs/component-metadata.md`.
- `intent`: one short user-goal sentence.
- `capabilities`: 3-6 concise verb phrases, pipe-delimited.
- `synonyms`: 4-8 realistic short search phrases, pipe-delimited.
- `topics`: smallest useful set from controlled vocabulary.
- `motion`: one of `none | minimal | standard | heavy`, using rubric in docs.
- `dependencies`: runtime package names only, pipe-delimited, deduplicated.

## Controlled Topics Vocabulary Extensions

- Prefer existing topic terms first.
- Add a new topic term only when existing terms cannot represent retrieval intent without distortion.
- When adding a new term:
  1. Update controlled vocabulary list in `docs/component-metadata.md`.
  2. Update runtime enum in `shared/component-schema/constants.ts` (`COMPONENT_TOPICS`).
  3. Re-run import + validation.
- Always report each new term and rationale.

## Import and Validation Commands

Use this command flow:

1. `bun run import:csv`
2. `bun run --cwd apps/backend validate:data`

If validation fails, fix issues and re-run until clean when possible.

## Direct Edit vs Script

- Use direct CSV edits for small, one-off updates.
- Use a deterministic script for larger imports/repetitive normalization.
- If using a script:
  - Keep it simple and deterministic.
  - Re-run safely.
  - Verify resulting CSV diff and generated files.
  - Remove temporary ingest scripts unless user asked to keep them.

## Reporting Requirements (Final Response)

Always include:

- Source processed (URL/repo/docs path).
- Scope applied (what was included and excluded).
- Components added, updated, unchanged (by `id`).
- Any assumptions or unresolved fields (for example unknown license/repo).
- Any new controlled-topic terms introduced (or explicit "none").
- Commands run for import/validation and their outcomes.
- Any fallback behavior used.

## Safety and Consistency

- Do not change unrelated rows/files.
- Do not delete existing components unless user explicitly requests removals.
- Preserve stable IDs and avoid accidental renames.
- Keep annotations concise, retrieval-oriented, and schema-valid.
