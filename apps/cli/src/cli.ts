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
    const convexUrl = process.env.CONVEX_URL;
    if (!convexUrl) {
      console.error("CONVEX_URL is required.");
      process.exitCode = 1;
      return;
    }

    const client = new ConvexHttpClient(convexUrl);
    await runSearchCommand(query, options, client);
  });

await program.parseAsync(process.argv);
