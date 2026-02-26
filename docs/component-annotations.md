# Component Annotation Guidelines

Use this guide when authoring or updating component retrieval metadata.

Fields covered:

- `intent`
- `capabilities[]`
- `synonyms[]`
- `topics[]`
- `motionLevel`

## Goals

- Make search results easy to retrieve for real user language.
- Keep metadata consistent enough for lexical + semantic ranking.
- Avoid vague, duplicate, and implementation-heavy phrasing.

## Field Rules

### `intent`

- Exactly one short sentence describing user goal, not implementation.
- Prefer plain user language over framework terms.
- Good length: ~6-18 words.
- Avoid naming internal APIs, CSS classes, or file structure.

Good:

- `Show a compact accordion to reveal and hide related content sections.`

Avoid:

- `Uses radix primitives and tailwind classes to render collapsible UI.`

### `capabilities[]`

- 3-6 concise verb phrases.
- Start with an action verb when possible.
- Each item should describe one distinct behavior.
- Deduplicate semantically similar items.

Good:

- `toggle sections`
- `support keyboard navigation`
- `animate open and close`

Avoid:

- `accordion component`
- `good ux`
- `toggle sections quickly and smoothly with modern transitions and support`

### `synonyms[]`

- 4-8 realistic search phrases users might type.
- Include common aliases and alternate naming.
- Mix short terms and natural query-like phrases.
- Do not repeat the exact same phrase with minor punctuation changes.

Good:

- `collapsible panel`
- `expand collapse content`
- `faq accordion`
- `disclosure list`

Avoid:

- `accordion`
- `accordion`
- `Accordion Component`

### `topics[]`

- Choose the smallest useful set (usually 1-3).
- Use only controlled vocabulary terms from `shared/component-schema/constants.ts`.
- Pick topics by user intent, not visual style.

Example:

- Accordion usually maps to `disclosure` (and sometimes `navigation`).

### `motionLevel`

- Use one of: `none | minimal | standard | heavy`.
- Classify by visible motion intensity in default usage.
- Prefer conservative classification when unsure.

## Quality Bar

- No empty annotation arrays (`capabilities`, `synonyms`, `topics`).
- No placeholder text (`todo`, `tbd`, `n/a`).
- Keep wording stable; avoid noisy churn in equivalent phrasing.
- Keep annotations independent from install/source metadata.

## Derived/Related Fields

- `componentSearch.searchText` is derived from annotations and component name/intent inputs.
- Do not hand-maintain `searchText`; regenerate via normal data flows.
- After meaningful annotation updates, run:
  1. `bun run data:validate`
  2. `bun run data:reindex` (to refresh embeddings)

## Review Checklist

Before publishing:

1. `intent` is non-empty, user-goal oriented, and implementation-agnostic.
2. `capabilities` has 3-6 concrete action phrases.
3. `synonyms` has 4-8 realistic query variants.
4. `topics` uses only allowed vocabulary and minimal count.
5. `motionLevel` matches actual default behavior.
6. Validation passes with no errors and acceptable warnings.
