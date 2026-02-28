# CLI

This workspace provides the `component-search` CLI for component lookup and install flows backed by Convex.

## Commands

- `bun run --cwd apps/cli dev -- search <query>` - search component metadata
- `bun run --cwd apps/cli dev -- view <id>` - view component details
- `bun run --cwd apps/cli dev -- add <id>` - install a component
- `bun run --cwd apps/cli dev -- login` - authenticate with WorkOS using a PKCE copy-paste flow
- `bun run --cwd apps/cli dev -- status` - inspect the stored WorkOS session
- `bun run --cwd apps/cli dev -- logout` - clear the stored WorkOS session

## Required env vars

- `CONVEX_URL` - required for `search`, `view`, and `add`
- `WORKOS_CLIENT_ID` - required for `login`
- `WORKOS_REDIRECT_URI` - required for `login`; must match the WorkOS app callback URL

## Headless VPS login flow

`login` always prints a PKCE authorization URL and headless instructions:

1. Open the printed URL in any browser.
2. Complete the WorkOS/AuthKit login flow.
3. Copy the final callback URL from the browser address bar, or copy only the `code` query param.
4. Paste that value back into the CLI prompt.

If the optional `open` package is available and the environment does not look headless, the CLI will also try to open the browser automatically. The copy-paste flow remains the primary path.

## Token storage

The CLI prefers OS credential storage through `keytar` when that module is available at runtime. If not, it falls back to `~/.config/component-search/auth.json` with file mode `0600`.

Stored data includes:

- access and refresh tokens
- token expiry metadata
- a small user summary for `status`
- the WorkOS client id and redirect URI used for the session

Raw tokens are never printed to the terminal.
