# Backend (Convex)

This workspace owns Convex schema and backend functions.

## Required auth env vars

WorkOS auth/account bootstrap requires these variables in `apps/backend/.env.local`:

- `WORKOS_CLIENT_ID` (WorkOS client/application ID used by Convex auth provider config)
- `WORKOS_API_KEY` (server-side key used to fetch/sync user profile data)

## Commands

- `bun run --cwd apps/backend dev` - start Convex dev, generate local project wiring.
- `bun run data:create` - create a JSON changeset from local `data/components/*/meta.json` (default: delta vs live Convex).
- `bun run data:validate -- --changeset <path>` - validate changeset schema and operation conflicts.
- `bun run data:diff -- --changeset <path>` - compare a changeset against live Convex rows.
- `bun run data:publish -- --changeset <path> [--dry-run]` - apply a changeset to live Convex (`upsert` + `delete`) atomically.
- `bun run data:pull` - overwrite `data/components/` with the latest Convex component documents and code files (canonical example file: `example.tsx`).
- `bun run --cwd apps/backend validate:data` - validate Convex table rows and cross-table integrity.
- `bun run --cwd apps/backend report:missing-install` - list components that still do not have `install` metadata.

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
- file consistency (`componentFiles.path` uniqueness per component, canonical single example warning with lexicographic-first selection)

Use `bun run --cwd apps/backend validate:data --json` for machine-readable output.

## Data model source of truth

`shared/component-schema/` is the shared canonical schema (Zod + inferred TypeScript types).
Convex validators in `apps/backend/convex/validators.ts` are derived from those shared constants.
