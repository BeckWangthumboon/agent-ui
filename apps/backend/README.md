# Backend (Convex)

This workspace owns Convex schema and backend functions.

## Commands

- `bun run --cwd apps/backend dev` - start Convex dev, generate local project wiring.
- `bun run --cwd apps/backend sync:data` - overwrite `data/components/` with the latest Convex component documents and code files.
- `bun run --cwd apps/backend validate:data` - validate Convex table rows and cross-table integrity.

## Migrations

`apps/backend/convex/migrations.ts` currently only exports the migration runner.
When a future migration is added, run it with:

- `npx convex run migrations:run '{"fn":"migrations:<name>","dryRun":true}'`
- `npx convex run migrations:run '{"fn":"migrations:<name>"}'`
- `npx convex run --component migrations lib:getStatus --watch`

## Validate data

`validate:data` reads the live Convex deployment configured by `CONVEX_URL` and checks:

- row schema validity for `components`, `componentCode`, `componentFiles`, and `componentSearch`
- duplicate ids in each table
- cross-table links (`components.id` must have matching `componentCode.componentId` and `componentSearch.componentId`)
- code consistency (`entryFile` must reference a `componentFiles(kind="code")` row)
- file consistency (`componentFiles.path` uniqueness per component, canonical single example warning)

Use `bun run --cwd apps/backend validate:data --json` for machine-readable output.

## Data model source of truth

`shared/component-schema/` is the shared canonical schema (Zod + inferred TypeScript types).
Convex validators in `apps/backend/convex/validators.ts` are derived from those shared constants.
