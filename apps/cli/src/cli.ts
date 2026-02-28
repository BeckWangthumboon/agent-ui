import { Command } from "commander";
import { ConvexHttpClient } from "convex/browser";
import {
  runSearchCommand,
  collectMotion,
  collectPrimitiveLibrary,
  parsePositiveInteger,
  parseFramework,
  parseStyling,
  type SearchCliOptions,
} from "./search.js";
import { runAddCommand, type AddCliOptions } from "./add.js";
import { runViewCommand, type ViewCliOptions } from "./view.js";
import {
  loadAgentUiConfig,
  mergeAddOptions,
  mergeSearchOptions,
  parsePackageManager,
} from "./config.js";
import { CLI_NAME } from "./constants.js";
import { runLoginCommand, runLogoutCommand, runStatusCommand } from "./auth/commands.js";
import { requireConvexUrl } from "./auth/config.js";
import { createAuthStorage } from "./auth/storage.js";
import { loadValidStoredSession } from "./auth/refresh.js";

const program = new Command();

program
  .name(CLI_NAME)
  .description("Search component metadata via Convex + Fuse")
  .showHelpAfterError()
  .option("--config <path>", "Path to agent-ui config file");

program
  .command("login")
  .description("Authenticate the CLI with WorkOS using a PKCE copy-paste flow")
  .action(async () => {
    try {
      await runLoginCommand();
    } catch (error) {
      console.error(errorMessage(error));
      process.exitCode = 1;
    }
  });

program
  .command("status")
  .description("Show the stored WorkOS session, if one exists")
  .action(async () => {
    try {
      await runStatusCommand();
    } catch (error) {
      console.error(errorMessage(error));
      process.exitCode = 1;
    }
  });

program
  .command("logout")
  .description("Clear the stored WorkOS session")
  .action(async () => {
    try {
      await runLogoutCommand();
    } catch (error) {
      console.error(errorMessage(error));
      process.exitCode = 1;
    }
  });

program
  .command("search")
  .description("Search component metadata")
  .argument("<query>", "Search query (required)")
  .option("-l, --limit <number>", "Maximum number of results", parsePositiveInteger)
  .option("--framework <framework>", "Filter by framework", parseFramework)
  .option("--styling <styling>", "Filter by styling", parseStyling)
  .option("--motion <motion>", "Filter by motion level (repeatable)", collectMotion)
  .option(
    "--primitive-library <library>",
    "Filter by primitive library (repeatable)",
    collectPrimitiveLibrary,
  )
  .option("--relax", "Use relaxed ranking to show best-effort matches")
  .option("--json", "Output JSON")
  .action(async (query: string, options: SearchCliOptions, command: Command) => {
    const globalOptions = command.optsWithGlobals<{ config?: string }>();
    let mergedOptions: SearchCliOptions;

    try {
      const { config } = await loadAgentUiConfig({
        commandName: "search",
        explicitPath: globalOptions.config,
      });
      mergedOptions = mergeSearchOptions(options, config);
    } catch (error) {
      console.error(errorMessage(error));
      process.exitCode = 1;
      return;
    }

    const client = await createClient();
    if (!client) {
      return;
    }

    await runSearchCommand(query, mergedOptions, client);
  });

program
  .command("view")
  .alias("v")
  .description("View detailed component metadata by id")
  .argument("<id>", "Component id (required)")
  .option("--verbose", "Show expanded metadata")
  .option("--code", "Print component code")
  .option("--example", "Print canonical usage example")
  .option("--json", "Output JSON")
  .action(async (id: string, options: ViewCliOptions) => {
    const client = await createClient();
    if (!client) {
      return;
    }

    await runViewCommand(id, options, client);
  });

program
  .command("add")
  .description("Install a component by id")
  .argument("<id>", "Component id (required)")
  .option("--package-manager <manager>", "Package manager: npx|bunx|pnpm|yarn", parsePackageManager)
  .option("--project-dir <path>", "Directory where install command runs (defaults to cwd)")
  .option("--json", "Output JSON")
  .option("--yes", "Execute install command non-interactively")
  .option("--dry-run", "Print planned changes without executing")
  .action(async (id: string, options: AddCliOptions, command: Command) => {
    const globalOptions = command.optsWithGlobals<{ config?: string }>();
    let loadedConfig = null;

    try {
      const loaded = await loadAgentUiConfig({
        commandName: "add",
        explicitPath: globalOptions.config,
      });
      loadedConfig = loaded.config;
    } catch (error) {
      if (globalOptions.config || !errorMessage(error).includes("No git project found from")) {
        console.error(errorMessage(error));
        process.exitCode = 1;
        return;
      }
    }

    const mergedOptions = mergeAddOptions(options, loadedConfig);

    const client = await createClient();
    if (!client) {
      return;
    }

    await runAddCommand(id, mergedOptions, client);
  });

await program.parseAsync(process.argv);

async function createClient(): Promise<ConvexHttpClient | null> {
  let convexUrl: string;
  try {
    convexUrl = requireConvexUrl();
  } catch (error) {
    console.error(errorMessage(error));
    process.exitCode = 1;
    return null;
  }

  const client = new ConvexHttpClient(convexUrl);

  try {
    const storage = await createAuthStorage();
    const ensuredSession = await loadValidStoredSession(storage);

    if (ensuredSession?.session) {
      client.setAuth(ensuredSession.session.accessToken);
    }
  } catch (error) {
    console.error(
      `Stored WorkOS session could not be used; continuing unauthenticated. ${errorMessage(error)}`,
    );
  }

  return client;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
