# Backend (Convex)

This workspace owns Convex schema and backend functions.

## Commands

- `bun run --cwd apps/backend dev` - start Convex dev, generate local project wiring.
- `bun run --cwd apps/backend seed:data` - parse `data/components/*/meta.json` and upsert into Convex.
- `bun run --cwd apps/backend seed:data -- --dry-run` - validate and load without writing.

## Data model source of truth

`shared/component-schema/` is the shared canonical schema (Zod + inferred TypeScript types).
Convex validators in `apps/backend/convex/validators.ts` are derived from those shared constants.
