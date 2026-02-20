# Backend (Convex)

This workspace owns Convex schema and backend functions.

## Commands

- `bun run --cwd apps/backend dev` - start Convex dev, generate local project wiring.
- `bun run --cwd apps/backend snapshot:data` - export a JSON snapshot of Convex tables to `data/snapshots/`.
- `bun run --cwd apps/backend validate:data` - validate Convex table rows and cross-table integrity.

## Validate data

`validate:data` reads the live Convex deployment configured by `CONVEX_URL` and checks:

- row schema validity for `components`, `componentCode`, and `componentSearch`
- duplicate ids in each table
- cross-table links (`components.id` must have matching `componentCode.componentId` and `componentSearch.componentId`)
- code consistency (`entryFile` must exist in `files[]`, no duplicate `files[].path`)

Use `bun run --cwd apps/backend validate:data --json` for machine-readable output.

## Data model source of truth

`shared/component-schema/` is the shared canonical schema (Zod + inferred TypeScript types).
Convex validators in `apps/backend/convex/validators.ts` are derived from those shared constants.
