import { Command } from "commander";
import { ConvexHttpClient } from "convex/browser";
import {
  runSearchCommand,
  parsePositiveInteger,
  parseFramework,
  parseStyling,
  parseMotion,
  type SearchCliOptions,
} from "./search.js";
import { runViewCommand, type ViewCliOptions } from "./view.js";

const program = new Command();

program
  .name("component-search")
  .description("Search component metadata via Convex + Fuse")
  .showHelpAfterError();

program
  .command("search")
  .description("Search component metadata")
  .argument("<query>", "Search query (required)")
  .option("-l, --limit <number>", "Maximum number of results", parsePositiveInteger, 10)
  .option("--framework <framework>", "Filter by framework", parseFramework)
  .option("--styling <styling>", "Filter by styling", parseStyling)
  .option("--motion <motion>", "Filter by motion level", parseMotion)
  .option("--json", "Output JSON", false)
  .action(async (query: string, options: SearchCliOptions) => {
    const client = createClient();
    if (!client) {
      return;
    }

    await runSearchCommand(query, options, client);
  });

program
  .command("view")
  .alias("v")
  .description("View detailed component metadata by id")
  .argument("<id>", "Component id (required)")
  .option("--verbose", "Show expanded metadata", false)
  .option("--code", "Print component code", false)
  .option("--json", "Output JSON", false)
  .action(async (id: string, options: ViewCliOptions) => {
    const client = createClient();
    if (!client) {
      return;
    }

    await runViewCommand(id, options, client);
  });

await program.parseAsync(process.argv);

function createClient(): ConvexHttpClient | null {
  const convexUrl = process.env.CONVEX_URL;
  if (!convexUrl) {
    console.error("CONVEX_URL is required.");
    process.exitCode = 1;
    return null;
  }

  return new ConvexHttpClient(convexUrl);
}
