# Component Metadata Guide

This guide defines how to label components in `data/components.csv`.

## Field intent

- `intent`: one short sentence about the user problem solved.
- `capabilities`: 3-6 verb phrases describing what the component can do.
- `synonyms`: 4-8 likely search phrases users might type.
- `topics`: 3-5 controlled facets from the list below.
- `motion`: one of `none | minimal | standard | heavy`.

## Labeling rules

- Use plain product language, not implementation details.
- Do not include library names in `topics` (for example, no `radix` or `shadcn`).
- Do not use `accessibility` as a topic; accessibility is expected baseline quality.
- Keep topic IDs in kebab-case.

## Motion rubric

- `none`: no intentional animation or transition that users notice.
- `minimal`: subtle transitions only (hover/focus/opacity/position polish).
- `standard`: clear enter/exit or state animations users can notice (dialogs, toasts, sheets, menus).
- `heavy`: motion is a primary part of the UX (choreographed, prominent, multi-element, or long-form animation).

## Controlled topics vocabulary (v0)

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
