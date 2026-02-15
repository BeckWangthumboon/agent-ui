# Component Metadata Annotation Guide (Schema v2)

This guide defines how to annotate component metadata in `data/components.csv`.

`data/components.csv` is the editable source of truth. After edits, run `bun run import:csv` to regenerate `data/components/*/meta.json` in schema v2 format.

## Workflow

1. Edit rows in `data/components.csv`.
2. Ensure each row's `code_file` exists in that component directory under `data/components/`.
3. Run `bun run import:csv`.
4. Run `bun run validate`.

## CSV column contract

- `id` (required): stable unique id. Use lowercase kebab-case and keep existing ids stable.
- `name` (required): human-readable component name.
- `framework` (required): currently `react` only.
- `styling` (required): currently `tailwind` only.
- `intent` (required): one short sentence describing the user problem solved.
- `capabilities` (required header, value may be empty): pipe-delimited list of verb phrases.
- `synonyms` (required header, value may be empty): pipe-delimited list of likely search phrases.
- `topics` (required header, value may be empty): pipe-delimited list from the controlled vocabulary below.
- `dependencies` (required header, value may be empty): pipe-delimited npm package names. Imported as runtime dependencies.
- `motion` (required): one of `none | minimal | standard | heavy`.
- `source_url` (required): canonical public URL for the component docs/source.
- `source_library` (recommended): library name (for example `shadcn`, `magicui`).
- `source_repo` (required header, value may be empty): repository slug such as `owner/repo`.
- `source_author` (required header, value may be empty): author or maintainer.
- `source_license` (required header, value may be empty): license identifier (for example `MIT`).
- `code_file` (required): entry file name for this component (for example `dialog.tsx`).

## How CSV maps to schema v2

- `motion` in CSV maps to `motionLevel` in `meta.json`.
- `capabilities`, `synonyms`, `topics`, and `dependencies` are split on `|`, trimmed, and deduplicated case-insensitively.
- `dependencies` become objects in `meta.json` with `kind: "runtime"`.
- `code_file` maps to `code.entryFile`; importer loads file content from disk into `code.files`.

## Annotation guidance (semantic fields)

- `intent`
  - Write one sentence in product language.
  - Focus on user goal, not implementation.
  - Good: `Asks for explicit confirmation before destructive actions.`

- `capabilities`
  - Use 3-6 short verb phrases.
  - Start with action verbs (`open`, `filter`, `select`, `display`, `animate`).
  - Avoid repeating the same idea with minor wording changes.

- `synonyms`
  - Use 4-8 realistic search phrases users would type.
  - Include common variants and aliases (`tree view`, `directory tree`).
  - Keep phrases short; avoid full sentences.

- `topics`
  - Use 2-5 controlled facets from the vocabulary below.
  - Pick the smallest set that best captures retrieval intent.
  - Do not include library/vendor names (`radix`, `shadcn`, `magicui`).
  - Do not use `accessibility` as a topic; accessibility is baseline quality.

- `motion`
  - Use the rubric below consistently.

## Motion rubric

- `none`: no intentional animation or transition users notice.
- `minimal`: subtle polish only (hover/focus/opacity/position).
- `standard`: clear state/enter/exit animation users notice.
- `heavy`: motion is a primary part of the UX (prominent or choreographed animation).

## Controlled topics vocabulary (current)

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
