---
name: aui-component-playbook
description: Component retrieval playbook for `aui`. Use when a user needs to find components, inspect component ids, recover from misses, and handle component-catalog lookups. Triggers include "find a component", "search for button/card/table", "show component code", or "view component by id". Scope is component-only (not pages/sections).
---

# Component Search with aui

## Core Workflow

Every component retrieval task follows this sequence:

1. **Search broad first**: `aui search "<query>"`
2. **Recover misses**: if not found, try relaxing the search
3. **Choose id**: select the best matching component id(s)
4. **Inspect**: `aui view <id>` (add `--verbose` or `--code` as needed)
5. **Respond in text**: return ids, fit rationale, and next command

```bash
aui search "date picker"
aui search "date picker" --relax
aui view core-date-picker --code
```

## Essential Commands

```bash
# Help (run when uncertain)
aui --help
aui search --help
aui view --help

# Search (default limit)
aui search "<query>"
aui search "<query>" --relax
aui search "<query>" --framework react --styling tailwind

# View
aui view <id>
aui view <id> --verbose
aui view <id> --code
```

## Common Patterns

### Unknown Component Name

```bash
aui search "calendar"
aui search "calendar" --relax
```

### View After Search

```bash
aui search "command menu"
aui view core-command-menu
aui view core-command-menu --code
```

### Miss Recovery

If not found, try relaxing the search:

```bash
aui search "<query>"
aui search "<query>" --relax
```

If still not found, broaden the search term:

```bash
aui search "<broader-term>"
```

For missing/invalid ids:

```bash
aui search "<term>"
aui view <id-from-search>
```

If the needed component is still not in the catalog, create your own component.

## Component-Only Rule (Important)

This is a component search engine. Do not use it to find full pages or sections.

When a request is page/section-level, translate it into component queries and continue with component search.

Examples:

- "login page" -> `form`, `input`, `button`, `card`, `label`
- "dashboard page" -> `card`, `table`, `chart`, `tabs`, `select`

Do not claim page templates exist unless a component explicitly indicates that.

## Verification Rule (Important)

Treat component code as the source of truth.

- Verify behavior from `aui view <id> --code`.
- Do not rely on descriptions alone when code and metadata disagree.
- Base final guidance on actual code structure, imports, and implementation details.

## Tips and Guidance

- For any page, section, or multi-component UI request, break it into atomic component intents, then search each intent separately.
- Common decomposition intents: `layout/container`, `navigation`, `headings/text`, `media`, `feature/content blocks`, `forms/inputs`, `data display`, `actions/cta`, `feedback`, `footer`.
- Search effort rule:
  - Run strict search first.
  - If not found, run the same query with `--relax`.
  - If still not found, try 1-2 broader synonyms.
  - If still no usable result, create a custom component.
- Candidate review rule:
  - Start from top results and shortlist up to 3 candidate ids.
  - Inspect code (`aui view <id> --code`) for final candidate(s) before implementation.
- Limit rule:
  - Default to `aui search "<query>"` (default limit).
  - For broad composition tasks, use `--limit 20` to widen coverage.
- Implementation rule:
  - Since this workflow is discovery-only, manually implement or adapt components after verification.
  - Prefer adapting verified component code over writing from scratch when a close match exists.
